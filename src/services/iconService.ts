const GITHUB_OWNER = "projectGloria";
const ICON_CACHE_PREFIX = "gloria_launcher_icon_v2_";
const FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-check found icons weekly
const MISSING_TTL_MS = 6 * 60 * 60 * 1000; // retry missing icons after 6h

const GH_TOKEN_STORAGE_KEY = "gloria_launcher_gh_token";

interface IconCacheEntry {
  timestamp: number;
  url: string | null;
}

const inflight = new Map<string, Promise<string | null>>();

function rawUrl(repo: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${repo}/HEAD/${encoded}`;
}

function readCache(repo: string): IconCacheEntry | null {
  try {
    const raw = localStorage.getItem(ICON_CACHE_PREFIX + repo.toLowerCase());
    if (!raw) return null;
    const entry = JSON.parse(raw) as IconCacheEntry;
    const ttl = entry.url ? FOUND_TTL_MS : MISSING_TTL_MS;
    return Date.now() - entry.timestamp < ttl ? entry : null;
  } catch {
    return null;
  }
}

function writeCache(repo: string, url: string | null): void {
  try {
    localStorage.setItem(
      ICON_CACHE_PREFIX + repo.toLowerCase(),
      JSON.stringify({ timestamp: Date.now(), url } satisfies IconCacheEntry)
    );
  } catch {
    // Ignore quota errors
  }
}

const EXCLUDED_DIR =
  /(^|\/)(node_modules|vendor|third_party|tools|test|tests|__tests__|examples?|screenshots?|\.github)\//i;

/**
 * Scores a repository path as a candidate app icon. Higher is better; null = not an icon.
 * Prefers .ico, then .png, then .svg; files named after the repo or "icon"/"logo".
 */
export function scoreIconPath(path: string, repo: string): number | null {
  const lower = path.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf(".") + 1);
  const extScore = ext === "ico" ? 300 : ext === "png" ? 200 : ext === "svg" ? 100 : -1;
  if (extScore < 0) return null;
  if (EXCLUDED_DIR.test(lower)) return null;

  const file = lower.slice(lower.lastIndexOf("/") + 1);
  const stem = file.slice(0, file.lastIndexOf("."));
  const repoLower = repo.toLowerCase();
  const repoCompact = repoLower.replace(/[^a-z0-9]/g, "");
  const stemCompact = stem.replace(/[^a-z0-9]/g, "");

  let nameScore: number;
  if (stemCompact === repoCompact) nameScore = 60;
  else if (/^(app_?icon|icon|logo|favicon)$/.test(stem)) nameScore = 50;
  else if (stemCompact.includes(repoCompact) && /icon|logo/.test(stem)) nameScore = 45;
  else if (/^(icon|logo|app_?icon)[-_@]?\d+(x\d+)?$/.test(stem)) nameScore = 40;
  else if (/^ic_launcher/.test(stem)) nameScore = 35;
  else return null;

  // Penalise splash/tray/notification variants and prefer larger raster sizes.
  if (/splash|tray|notif|small|mono|disabled|badge/.test(stem)) nameScore -= 30;
  const sizeMatch = stem.match(/(\d{2,4})/);
  const sizeBonus = sizeMatch ? Math.min(Number(sizeMatch[1]), 512) / 64 : 0;

  // Prefer shallower paths and app-ish folders over docs.
  const depth = lower.split("/").length - 1;
  const dirBonus = /(^|\/)(assets|resources|icons|build|src-tauri\/icons|public)\//.test(lower)
    ? 4
    : 0;
  const docsPenalty = /(^|\/)docs\//.test(lower) ? 6 : 0;

  return extScore + nameScore + sizeBonus + dirBonus - docsPenalty - depth;
}

export function pickBestIconPath(paths: string[], repo: string): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const p of paths) {
    const score = scoreIconPath(p, repo);
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

async function listRepoFiles(repo: string): Promise<string[] | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  try {
    const token = localStorage.getItem(GH_TOKEN_STORAGE_KEY);
    if (token && token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  } catch {
    // Ignore
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/git/trees/HEAD?recursive=1`,
      { headers }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { tree?: Array<{ path: string; type: string }> };
    if (!Array.isArray(json.tree)) return null;
    return json.tree.filter((t) => t.type === "blob").map((t) => t.path);
  } catch {
    return null;
  }
}

/**
 * Icon paths that can't be guessed from the repo name (e.g. different casing),
 * keyed by lowercase repo name. Tried first when the API is unavailable.
 */
const KNOWN_ICON_PATHS: Record<string, string> = {
  "faceit-autopilot": "icons/Faceit-AutoPilot.ico",
};

/** Common icon locations, probed on raw.githubusercontent.com when the API is unavailable. */
function fallbackCandidates(repo: string): string[] {
  const lower = repo.toLowerCase();
  const known = KNOWN_ICON_PATHS[lower];
  return [
    ...(known ? [known] : []),
    `${repo}.ico`,
    `assets/${repo}.ico`,
    `icons/${repo}.ico`,
    `resources/${repo}.ico`,
    `icon.ico`,
    `assets/icon.ico`,
    `resources/icon.ico`,
    `build/icon.ico`,
    `src-tauri/icons/icon.ico`,
    `app/src-tauri/icons/icon.ico`,
    `assets/icon.png`,
    `build/icon.png`,
    `resources/icon.png`,
    `public/icons/icon-128.png`,
    `icons/icon-128.png`,
    `docs/assets/icon.png`,
    `docs/assets/${lower}-icon.png`,
    `docs/assets/icon.svg`,
    `docs/assets/${lower}-icon.svg`,
  ];
}

async function probeCandidates(repo: string): Promise<string | null> {
  for (const path of fallbackCandidates(repo)) {
    try {
      const res = await fetch(rawUrl(repo, path), { method: "HEAD" });
      if (res.ok) return path;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

async function resolveIcon(repo: string): Promise<string | null> {
  const files = await listRepoFiles(repo);
  const path = files ? pickBestIconPath(files, repo) : await probeCandidates(repo);
  const url = path ? rawUrl(repo, path) : null;
  // Only remember "no icon" when the full file list was checked; a miss from
  // the guess-based fallback (API rate-limited) is retried next time.
  if (url || files) writeCache(repo, url);
  return url;
}

/** Synchronous cache read, so components can render a known icon on first paint. */
export function getCachedAppIconUrl(repo: string): string | null | undefined {
  const entry = readCache(repo);
  return entry ? entry.url : undefined;
}

/** Resolves the app's icon URL in its GitHub repo (prefers .ico). Deduplicated and cached. */
export function getAppIconUrl(repo: string): Promise<string | null> {
  const cached = readCache(repo);
  if (cached) return Promise.resolve(cached.url);
  const key = repo.toLowerCase();
  let pending = inflight.get(key);
  if (!pending) {
    pending = resolveIcon(repo).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/** Drops a cached icon URL (e.g. after the image failed to load). */
export function forgetAppIcon(repo: string): void {
  try {
    localStorage.removeItem(ICON_CACHE_PREFIX + repo.toLowerCase());
  } catch {
    // Ignore
  }
}
