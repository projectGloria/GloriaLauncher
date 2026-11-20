#!/usr/bin/env node
// Builds a static snapshot of every @projectGloria repository that has a published
// GitHub Release, written to public/catalog.json.
//
// The web edition reads this file first, so visitors never touch the anonymous
// GitHub REST API (60 requests/hour per IP, which a single page load of ~30 repos
// used to exhaust). Run in CI with GITHUB_TOKEN, or locally with GH_TOKEN.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "projectGloria";
const SELF = "glorialauncher";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const outFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "catalog.json"
);

async function gh(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "gloria-launcher-catalog",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${path}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const repos = (await gh(`/users/${OWNER}/repos?per_page=100&sort=updated`))
    .filter((r) => r.name.toLowerCase() !== SELF && !r.private);

  const entries = await Promise.all(
    repos.map(async (r) => {
      const releases = await gh(`/repos/${OWNER}/${r.name}/releases?per_page=5`);
      const rel = Array.isArray(releases) ? releases.find((x) => !x.draft) : null;
      if (!rel) return null;
      return {
        name: r.name,
        description: r.description,
        homepage: r.homepage,
        html_url: r.html_url,
        has_pages: r.has_pages,
        stargazers_count: r.stargazers_count,
        language: r.language,
        updated_at: r.updated_at,
        pushed_at: r.pushed_at,
        release: {
          version: rel.tag_name.replace(/^v/i, ""),
          publishedAt: rel.published_at,
          notes: rel.body || undefined,
          assets: (rel.assets || []).map((a) => ({
            name: a.name,
            browserDownloadUrl: a.browser_download_url,
            size: a.size,
            contentType: a.content_type,
          })),
        },
      };
    })
  );

  const withReleases = entries.filter(Boolean);
  if (withReleases.length === 0) {
    throw new Error("No repositories with releases found; refusing to write an empty catalog.");
  }

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(
    outFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), repos: withReleases }, null, 2)
  );
  console.log(`Wrote ${withReleases.length} apps to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
