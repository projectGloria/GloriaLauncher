import type { GloriaAppEntry, ReleaseAssetInfo } from "../types/app";
import { GLORIA_CATALOG } from "../data/gloriaCatalog";

const CACHE_KEY = "gloria_launcher_gh_cache_v1";
const RELEASE_CACHE_PREFIX = "gloria_launcher_rel_v1_";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface GitHubRepoResponse {
  name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  has_pages: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  pushed_at: string;
}

interface GitHubReleaseResponse {
  tag_name: string;
  name: string | null;
  published_at: string;
  body: string | null;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

function getAuthHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

function splitDynamicName(repoName: string): { prefix: string; accent: string } {
  const camelMatch = repoName.match(/^([A-Za-z0-9]+?)([A-Z][a-z0-9]+)$/);
  if (camelMatch && camelMatch[1] && camelMatch[2]) {
    return { prefix: camelMatch[1], accent: camelMatch[2] };
  }
  const half = Math.ceil(repoName.length / 2);
  return {
    prefix: repoName.slice(0, half),
    accent: repoName.slice(half) || "App",
  };
}

export async function syncCatalogWithGitHub(
  options: { force?: boolean; githubToken?: string } = {}
): Promise<{
  apps: GloriaAppEntry[];
  checkedAt: Date;
  fromCache: boolean;
}> {
  if (!options.force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          timestamp: number;
          repos: GitHubRepoResponse[];
        };
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          return {
            apps: mergeReposIntoCatalog(parsed.repos),
            checkedAt: new Date(parsed.timestamp),
            fromCache: true,
          };
        }
      }
    } catch {
      // Ignore cache parse issues
    }
  }

  try {
    const res = await fetch(
      "https://api.github.com/users/projectGloria/repos?per_page=100&sort=updated",
      { headers: getAuthHeaders(options.githubToken) }
    );
    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }
    const repos = (await res.json()) as GitHubRepoResponse[];
    const now = Date.now();
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: now, repos })
      );
    } catch {
      // Ignore quota errors
    }
    return {
      apps: mergeReposIntoCatalog(repos),
      checkedAt: new Date(now),
      fromCache: false,
    };
  } catch {
    return {
      apps: [...GLORIA_CATALOG],
      checkedAt: new Date(),
      fromCache: true,
    };
  }
}

function mergeReposIntoCatalog(repos: GitHubRepoResponse[]): GloriaAppEntry[] {
  const repoMap = new Map<string, GitHubRepoResponse>();
  for (const r of repos) {
    repoMap.set(r.name.toLowerCase(), r);
  }

  const merged: GloriaAppEntry[] = GLORIA_CATALOG.map((item) => {
    const gh = repoMap.get(item.id.toLowerCase());
    if (!gh) return item;
    repoMap.delete(item.id.toLowerCase());

    const liveWebUrl =
      item.webUrl ||
      (gh.homepage && gh.homepage.trim() !== "" ? gh.homepage : undefined) ||
      (gh.has_pages
        ? `https://projectgloria.github.io/${gh.name}/`
        : undefined);

    return {
      ...item,
      updatedAt: gh.pushed_at || gh.updated_at || item.updatedAt,
      stars: gh.stargazers_count,
      language: gh.language || item.language,
      hasPages: gh.has_pages,
      webUrl: liveWebUrl,
      description:
        item.description || gh.description || item.tagline,
    };
  });

  // Also include any brand-new public repositories created under @projectGloria
  for (const [, gh] of repoMap) {
    if (gh.name.toLowerCase() === "glorialauncher") continue;
    const { prefix, accent } = splitDynamicName(gh.name);
    merged.push({
      id: gh.name,
      titlePrefix: prefix,
      titleAccent: accent,
      displayName: gh.name,
      subtitle: gh.description
        ? gh.description.slice(0, 56)
        : `${gh.language || "Gloria"} project repository`,
      tagline:
        gh.description ||
        `Open-source project by projectGloria on GitHub.`,
      description:
        gh.description ||
        `Open-source repository ${gh.name} under projectGloria.`,
      accentColor: "#00f0ff",
      surfaceTint: "#081c20",
      category: "Desktop Apps",
      platforms: gh.has_pages ? ["Windows", "Web"] : ["Windows"],
      techStack: gh.language ? [gh.language] : ["Open Source"],
      version: "0.1.0",
      updatedAt: gh.pushed_at || gh.updated_at,
      authorBadge: "BY GLORIA",
      author: "Gloria",
      iconKey: "box",
      repoUrl: gh.html_url,
      webUrl:
        gh.homepage ||
        (gh.has_pages
          ? `https://projectgloria.github.io/${gh.name}/`
          : undefined),
      stars: gh.stargazers_count,
      language: gh.language || undefined,
      hasPages: gh.has_pages,
    });
  }

  return merged;
}

export async function fetchAppReleaseInfo(
  repoId: string,
  githubToken?: string
): Promise<{
  version?: string;
  publishedAt?: string;
  notes?: string;
  assets: ReleaseAssetInfo[];
} | null> {
  const cacheKey = `${RELEASE_CACHE_PREFIX}${repoId.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/projectGloria/${repoId}/releases/latest`,
      { headers: getAuthHeaders(githubToken) }
    );
    if (!res.ok) {
      return null;
    }
    const rel = (await res.json()) as GitHubReleaseResponse;
    const data = {
      version: rel.tag_name.replace(/^v/i, ""),
      publishedAt: rel.published_at,
      notes: rel.body || undefined,
      assets: (rel.assets || []).map((a) => ({
        name: a.name,
        browserDownloadUrl: a.browser_download_url,
        size: a.size,
        contentType: a.content_type,
      })),
    };
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch {
      // Ignore
    }
    return data;
  } catch {
    return null;
  }
}

export async function fetchRepoReadme(repoId: string): Promise<string> {
  const branches = ["main", "master"];
  for (const branch of branches) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/projectGloria/${repoId}/${branch}/README.md`
      );
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Try next branch
    }
  }
  return "";
}

export function formatReadableDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
