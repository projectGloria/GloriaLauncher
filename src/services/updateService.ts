import type { GloriaAppEntry, InstalledAppRecord } from "../types/app";

/** Splits "v1.2.3-beta.4" into its numeric core and pre-release identifiers. */
function parseVersion(v: string): { core: number[]; pre: string[] } {
  const clean = v.trim().replace(/^v/i, "").split("+")[0] ?? "";
  const dash = clean.indexOf("-");
  const coreText = dash === -1 ? clean : clean.slice(0, dash);
  const preText = dash === -1 ? "" : clean.slice(dash + 1);
  return {
    core: coreText.split(".").map((p) => parseInt(p, 10) || 0),
    pre: preText ? preText.split(".") : [],
  };
}

/** Semver-style compare. "2.0.0.0" equals "v2.0.0"; "1.0.0-beta" is older than "1.0.0". */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const len = Math.max(va.core.length, vb.core.length);
  for (let i = 0; i < len; i++) {
    const diff = (va.core[i] ?? 0) - (vb.core[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  // A release outranks any pre-release of the same core version.
  if (va.pre.length === 0 && vb.pre.length === 0) return 0;
  if (va.pre.length === 0) return 1;
  if (vb.pre.length === 0) return -1;
  const preLen = Math.max(va.pre.length, vb.pre.length);
  for (let i = 0; i < preLen; i++) {
    const pa = va.pre[i];
    const pb = vb.pre[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    const na = /^\d+$/.test(pa) ? parseInt(pa, 10) : NaN;
    const nb = /^\d+$/.test(pb) ? parseInt(pb, 10) : NaN;
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return Math.sign(na - nb);
    } else if (pa !== pb) {
      return pa < pb ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Returns the newer release version (without a leading "v") when the installed
 * copy is older than the latest published release, else null.
 * Local workspace builds aren't versioned releases, so they never get offered one.
 */
export function getAvailableUpdate(
  app: GloriaAppEntry,
  record: InstalledAppRecord | undefined
): string | null {
  if (!record || record.source === "local-workspace") return null;
  const latest = app.releaseTag;
  if (!latest || !record.version) return null;
  return compareVersions(latest, record.version) > 0
    ? latest.replace(/^v/i, "")
    : null;
}
