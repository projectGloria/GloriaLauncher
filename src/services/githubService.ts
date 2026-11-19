import type { GloriaAppEntry, ReleaseAssetInfo } from "../types/app";
import { GLORIA_CATALOG } from "../data/gloriaCatalog";
import {
  filterReposWithReleasesDesktop,
  listPublicReposDesktop,
} from "./platformService";

const GITHUB_OWNER = "projectGloria";
const CACHE_KEY = "gloria_launcher_gh_cache_v3";
const RELEASE_CACHE_PREFIX = "gloria_launcher_rel_v3_";
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
  draft?: boolean;
  prerelease?: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

export interface ReleaseInfoData {
  version?: string;
  publishedAt?: string;
  notes?: string;
  assets: ReleaseAssetInfo[];
}

interface GraphQLRepoNode {
  name: string;
  description: string | null;
  homepageUrl: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  updatedAt: string;
  pushedAt: string | null;
  releases: {
    totalCount: number;
    nodes: Array<{
      tagName: string;
      name: string | null;
      publishedAt: string | null;
      description: string | null;
      isDraft: boolean;
      releaseAssets: {
        nodes: Array<{
          name: string;
          downloadUrl: string;
          size: number;
          contentType: string;
        }>;
      };
    }>;
  };
}

const CATALOG_BY_ID = new Map<string, GloriaAppEntry>(
  GLORIA_CATALOG.map((item) => [item.id.toLowerCase(), item])
);

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
  const dashIdx = repoName.indexOf("-");
  if (dashIdx > 0 && dashIdx < repoName.length - 1) {
    return {
      prefix: repoName.slice(0, dashIdx + 1),
      accent: repoName.slice(dashIdx + 1),
    };
  }
  const half = Math.ceil(repoName.length / 2);
  return {
    prefix: repoName.slice(0, half),
    accent: repoName.slice(half) || "App",
  };
}

function buildAppEntry(
  gh: GitHubRepoResponse,
  release: ReleaseInfoData | null
): GloriaAppEntry {
  const curated = CATALOG_BY_ID.get(gh.name.toLowerCase());
  const liveWebUrl =
    curated?.webUrl ||
    (gh.homepage && gh.homepage.trim() !== "" ? gh.homepage : undefined) ||
    (gh.has_pages
      ? `https://projectgloria.github.io/${gh.name}/`
      : undefined);

  if (curated) {
    return {
      ...curated,
      version: release?.version || curated.version,
      updatedAt:
        release?.publishedAt || gh.pushed_at || gh.updated_at || curated.updatedAt,
      stars: gh.stargazers_count,
      language: gh.language || curated.language,
      hasPages: gh.has_pages,
      webUrl: liveWebUrl,
      description: curated.description || gh.description || curated.tagline,
      releaseTag: release?.version,
      releasePublishedAt: release?.publishedAt,
      releaseNotes: release?.notes,
      releaseAssets: release?.assets,
    };
  }

  const { prefix, accent } = splitDynamicName(gh.name);
  return {
    id: gh.name,
    titlePrefix: prefix,
    titleAccent: accent,
    displayName: gh.name,
    subtitle: gh.description
      ? gh.description.slice(0, 56)
      : `${gh.language || "Gloria"} project repository`,
    tagline:
      gh.description || `Open-source project by projectGloria on GitHub.`,
    description:
      gh.description ||
      `Open-source repository ${gh.name} under projectGloria.`,
    accentColor: "#00f0ff",
    surfaceTint: "#081c20",
    category: "Desktop Apps",
    platforms: gh.has_pages ? ["Windows", "Web"] : ["Windows"],
    techStack: gh.language ? [gh.language] : ["Open Source"],
    version: release?.version || "0.1.0",
    updatedAt: release?.publishedAt || gh.pushed_at || gh.updated_at,
    authorBadge: "BY GLORIA",
    author: "Gloria",
    iconKey: "box",
    repoUrl: gh.html_url,
    webUrl: liveWebUrl,
    stars: gh.stargazers_count,
    language: gh.language || undefined,
    hasPages: gh.has_pages,
    releaseTag: release?.version,
    releasePublishedAt: release?.publishedAt,
    releaseNotes: release?.notes,
    releaseAssets: release?.assets,
  };
}

function cacheReleaseData(repoId: string, data: ReleaseInfoData): void {
  try {
    localStorage.setItem(
      `${RELEASE_CACHE_PREFIX}${repoId.toLowerCase()}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedSyncedApps(): {
  apps: GloriaAppEntry[];
  checkedAt: Date;
} | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      apps: GloriaAppEntry[];
    };
    if (Array.isArray(parsed.apps)) {
      return {
        apps: parsed.apps,
        checkedAt: new Date(parsed.timestamp),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

async function fetchReleasesViaGraphQL(
  token: string
): Promise<GloriaAppEntry[] | null> {
  const query = `
    query($owner: String!) {
      user(login: $owner) {
        repositories(first: 100, privacy: PUBLIC, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            description
            homepageUrl
            url
            stargazerCount
            primaryLanguage { name }
            updatedAt
            pushedAt
            releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
              totalCount
              nodes {
                tagName
                name
                publishedAt
                description
                isDraft
                releaseAssets(first: 20) {
                  nodes {
                    name
                    downloadUrl
                    size
                    contentType
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        ...getAuthHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { owner: GITHUB_OWNER } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { user?: { repositories?: { nodes?: GraphQLRepoNode[] } } };
    };
    const nodes = json.data?.user?.repositories?.nodes;
    if (!Array.isArray(nodes)) return null;

    const apps: GloriaAppEntry[] = [];
    for (const node of nodes) {
      if (node.name.toLowerCase() === "glorialauncher") continue;
      const latest = node.releases?.nodes?.find((r) => !r.isDraft);
      if (!latest || (node.releases?.totalCount ?? 0) === 0) continue;

      const releaseData: ReleaseInfoData = {
        version: latest.tagName.replace(/^v/i, ""),
        publishedAt: latest.publishedAt || undefined,
        notes: latest.description || undefined,
        assets: (latest.releaseAssets?.nodes || []).map((a) => ({
          name: a.name,
          browserDownloadUrl: a.downloadUrl,
          size: a.size,
          contentType: a.contentType,
        })),
      };
      cacheReleaseData(node.name, releaseData);

      const ghRepo: GitHubRepoResponse = {
        name: node.name,
        description: node.description,
        homepage: node.homepageUrl,
        html_url: node.url,
        has_pages: false,
        stargazers_count: node.stargazerCount,
        language: node.primaryLanguage?.name || null,
        updated_at: node.updatedAt,
        pushed_at: node.pushedAt || node.updatedAt,
      };
      apps.push(buildAppEntry(ghRepo, releaseData));
    }

    return apps;
  } catch {
    return null;
  }
}

async function fetchLatestReleaseRecord(
  repoId: string,
  githubToken?: string
): Promise<{ status: number; data: ReleaseInfoData | null }> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repoId}/releases?per_page=1`,
    { headers: getAuthHeaders(githubToken) }
  );
  if (!res.ok) {
    return { status: res.status, data: null };
  }
  const list = (await res.json()) as GitHubReleaseResponse[];
  const rel = Array.isArray(list) ? list.find((r) => !r.draft) : undefined;
  if (!rel) {
    return { status: res.status, data: null };
  }
  const data: ReleaseInfoData = {
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
  cacheReleaseData(repoId, data);
  return { status: res.status, data };
}

async function fetchRepoList(githubToken?: string): Promise<GitHubRepoResponse[]> {
  let apiError: Error;
  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`,
      { headers: getAuthHeaders(githubToken) }
    );
    if (res.ok) {
      return (await res.json()) as GitHubRepoResponse[];
    }
    apiError = new Error(`GitHub API HTTP ${res.status}`);
  } catch (err) {
    apiError = err instanceof Error ? err : new Error(String(err));
  }

  // Desktop fallback: read the public profile pages natively (not rate-limited
  // like the anonymous REST API).
  const native = await listPublicReposDesktop(GITHUB_OWNER);
  if (!native || native.length === 0) throw apiError;
  return native.map((r) => ({
    name: r.name,
    description: r.description ?? null,
    homepage: null,
    html_url: `https://github.com/${GITHUB_OWNER}/${r.name}`,
    has_pages: false,
    stargazers_count: 0,
    language: r.language ?? null,
    updated_at: r.updatedAt || new Date().toISOString(),
    pushed_at: r.updatedAt || new Date().toISOString(),
  }));
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
          apps: GloriaAppEntry[];
        };
        if (
          Array.isArray(parsed.apps) &&
          Date.now() - parsed.timestamp < CACHE_TTL_MS
        ) {
          return {
            apps: parsed.apps,
            checkedAt: new Date(parsed.timestamp),
            fromCache: true,
          };
        }
      }
    } catch {
      // Ignore cache parse issues
    }
  }

  // Fast single-request GraphQL path when the user provides a GitHub token
  if (options.githubToken && options.githubToken.trim()) {
    const gqlApps = await fetchReleasesViaGraphQL(options.githubToken.trim());
    if (gqlApps) {
      const now = Date.now();
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: now, apps: gqlApps })
        );
      } catch {
        // Ignore quota errors
      }
      return {
        apps: gqlApps,
        checkedAt: new Date(now),
        fromCache: false,
      };
    }
  }

  try {
    const allRepos = (await fetchRepoList(options.githubToken)).filter(
      (r) => r.name.toLowerCase() !== "glorialauncher"
    );

    // On Desktop, the native Rust side detects real GitHub Releases (skipping bare
    // git tags) and returns their assets without touching the 60 req/hr REST quota.
    const desktopReleases = await filterReposWithReleasesDesktop(
      GITHUB_OWNER,
      allRepos.map((r) => r.name)
    );

    const appsWithReleases: GloriaAppEntry[] = [];

    if (desktopReleases !== null) {
      const releaseByRepo = new Map(
        desktopReleases.map((rel) => [rel.repo.toLowerCase(), rel])
      );
      for (const repo of allRepos) {
        const rel = releaseByRepo.get(repo.name.toLowerCase());
        if (!rel) continue;
        const releaseData: ReleaseInfoData = {
          version: rel.tag.replace(/^v/i, ""),
          publishedAt: rel.publishedAt || undefined,
          assets: rel.assets,
        };
        cacheReleaseData(repo.name, releaseData);
        appsWithReleases.push(buildAppEntry(repo, releaseData));
      }
    } else {
      // Web mode without a token: check releases via REST API with bounded concurrency
      let rateLimited = false;
      const batchSize = 6;
      for (let i = 0; i < allRepos.length && !rateLimited; i += batchSize) {
        const batch = allRepos.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (repo) => {
            if (rateLimited) return null;
            try {
              const relRes = await fetchLatestReleaseRecord(
                repo.name,
                options.githubToken
              );
              if (relRes.status === 403 || relRes.status === 429) {
                rateLimited = true;
                return null;
              }
              if (!relRes.data) return null;
              return buildAppEntry(repo, relRes.data);
            } catch {
              return null;
            }
          })
        );
        for (const entry of results) {
          if (entry) appsWithReleases.push(entry);
        }
      }
    }

    const now = Date.now();
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: now, apps: appsWithReleases })
      );
    } catch {
      // Ignore quota errors
    }

    return {
      apps: appsWithReleases,
      checkedAt: new Date(now),
      fromCache: false,
    };
  } catch {
    const cached = getCachedSyncedApps();
    if (cached) {
      return {
        apps: cached.apps,
        checkedAt: cached.checkedAt,
        fromCache: true,
      };
    }
    return {
      apps: [],
      checkedAt: new Date(),
      fromCache: true,
    };
  }
}

export async function fetchAppReleaseInfo(
  repoId: string,
  githubToken?: string
): Promise<ReleaseInfoData | null> {
  const cacheKey = `${RELEASE_CACHE_PREFIX}${repoId.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as {
        timestamp: number;
        data: ReleaseInfoData;
      };
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore
  }

  try {
    const { data } = await fetchLatestReleaseRecord(repoId, githubToken);
    return data;
  } catch {
    return null;
  }
}

export function pickPreferredReleaseAsset(
  assets: ReleaseAssetInfo[]
): ReleaseAssetInfo | undefined {
  if (!assets || assets.length === 0) return undefined;

  const isMetadataFile = (name: string) =>
    /\.(blockmap|yml|yaml|json|sig|asc|txt|sha256|md5)$/i.test(name) ||
    /checksum|sha256sum/i.test(name);

  const installable = assets.filter((a) => !isMetadataFile(a.name));
  const pool = installable.length > 0 ? installable : assets;

  return (
    pool.find((a) => /(setup|install).*\.(exe|msi)$/i.test(a.name)) ||
    pool.find((a) => /\.msi$/i.test(a.name)) ||
    pool.find((a) => /\.exe$/i.test(a.name)) ||
    pool.find((a) => /\.zip$/i.test(a.name)) ||
    pool[0]
  );
}

export async function fetchRepoReadme(repoId: string): Promise<string> {
  const branches = ["main", "master"];
  for (const branch of branches) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${GITHUB_OWNER}/${repoId}/${branch}/README.md`
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
