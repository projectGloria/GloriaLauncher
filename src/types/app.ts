export type AppCategory =
  | "Desktop Apps"
  | "VS Code & Editor"
  | "Browser Extensions"
  | "Android & Mobile"
  | "CLI & System";

export type PlatformTarget =
  | "Windows"
  | "Web"
  | "VS Code"
  | "Browser"
  | "Android"
  | "CLI";

export interface ReleaseAssetInfo {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string;
}

export interface GloriaAppEntry {
  /** Exact repository name on github.com/projectGloria */
  id: string;
  /** First part of the stylized name (rendered in crisp white), e.g. "Omni" */
  titlePrefix: string;
  /** Highlighted second part of the stylized name (rendered in accentColor), e.g. "Convert" */
  titleAccent: string;
  /** Full readable display name */
  displayName: string;
  /** Short 1-line subtitle directly below the app name (like "Image editing" or "Reading, organizing and protecting PDFs") */
  subtitle: string;
  /** Punchy tagline shown in the card body */
  tagline: string;
  /** Extended description for the showcase / drawer */
  description: string;
  /** Brand accent color hex (used for titleAccent, version badge, icon background, active top border) */
  accentColor: string;
  /** Secondary dark tint for card hover or active state */
  surfaceTint: string;
  /** Category for filtering */
  category: AppCategory;
  /** Supported platforms */
  platforms: PlatformTarget[];
  /** Primary tech stack badges */
  techStack: string[];
  /** Default/curated semantic version string */
  version: string;
  /** Default/curated last updated string (ISO or readable) */
  updatedAt: string;
  /** Author badge text (e.g. "BY GLORIA") */
  authorBadge: string;
  /** Author column name (e.g. "Gloria") */
  author: string;
  /** Icon key for rendering bespoke vector artwork */
  iconKey: string;
  /** GitHub repository URL */
  repoUrl: string;
  /** Optional live web URL / Marketplace URL / GitHub Pages URL */
  webUrl?: string;
  /** Whether this app is featured/pinned in the top row on Web mode */
  featured?: boolean;
  /** Relative path patterns to look for local executable inside sibling Gloria Repoz folders on Desktop */
  localExeCandidates?: string[];
  /** Live GitHub enrichment fields */
  stars?: number;
  language?: string;
  releaseTag?: string;
  releasePublishedAt?: string;
  releaseNotes?: string;
  releaseAssets?: ReleaseAssetInfo[];
  hasPages?: boolean;
}

export interface InstalledAppRecord {
  appId: string;
  version: string;
  executablePath: string;
  installDir: string;
  installedAt: string;
  source: "github-release" | "local-workspace" | "custom";
}

export interface DownloadProgressPayload {
  appId: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  status: string;
}
