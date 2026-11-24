# AGENTS.md — GloriaLauncher

Launcher and showcase for the @projectGloria app suite: React 19 + TS + Tailwind v4 (Vite) shipping as a Tauri v2 Windows desktop app (Rust 1.80+, Node 22) and a GitHub Pages web edition.

## Commands
- Dev (web / desktop): `npm run dev` (strict port 1420, required by Tauri `devUrl`) / `npm run tauri:dev`
- Typecheck: `npm run typecheck`
- Test (Rust all / single): `cargo test --manifest-path src-tauri/Cargo.toml` / `cargo test --manifest-path src-tauri/Cargo.toml TEST_NAME`
- Build (web / desktop bin): `npm run build:web` / `npx tauri build --no-bundle` (then pack via GloriaSetup; see `.brain/building-the-project.md`)
- Catalog snapshot: `node scripts/build-catalog.mjs` (needs `GITHUB_TOKEN` or `GH_TOKEN`; writes gitignored `public/catalog.json`)

## Architecture
- `src/main.tsx` → `src/App.tsx` — Single shell switching between grid, table, and showcase views, plus inspector drawer and settings modal (`src/components/`).
- `src/services/platformService.ts` — Sole Tauri IPC bridge; every `invoke()` is guarded by `isTauriDesktop()` with a web fallback (installed-app detection is desktop-only).
- `src/services/githubService.ts` — Catalog sync (local `catalog.json` → hosted Pages snapshot → GitHub scraping on desktop / REST on web), cached in `localStorage` under `_v4` keys.
- `src/data/gloriaCatalog.ts` — Hand-curated metadata merged over discovered repos (only repos with a published release appear).
- `src-tauri/src/lib.rs` — All Rust backend logic: `generate_handler!` commands, downloads to `~/Downloads/GloriaLauncherDownloads`, zip extraction, single-instance, tray-icon mode, `winreg` Uninstall registry detection, `installed_apps.json` (in `app_local_data_dir`), and self-update check.
- `src/i18n.ts` — `en`/`fr`/`es`/`tr` localization (`src/locales/*.json` for UI, `src/locales/apps/*.json` keyed by repo name).
- **Version Manifests:** `gloria.toml`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json` (keep versions synced across all listed files).

## Personal Rules (Brain)
- **Git Branching:** Never create new branches or git worktrees. Always work directly on `main` until explicitly told otherwise.
- **Versioning:** Never bump versions during normal work. The user picks the version at release time and `/monjita-github-release` sets it in every version file at once; keep version files in sync with each other otherwise.
- **Commit Format:** Write one plain sentence stating what changed and why; do not use `feat:`/`fix:`/`chore:` conventional-commit prefixes.
- **Commit & Push Policy:** Never run `git commit`, `git tag`, or `git push` unless explicitly asked; never force-push to `main`. When the user says "commit and push", verify the build and tests pass, commit on `main`, and push to `origin main`. Pushing never releases anything.
- **Releases:** Releases happen only through `/monjita-github-release`, which bumps the version, pushes, runs `gh workflow run release.yml`, and watches it until the GitHub Release is live. Never create release tags or releases by hand.
- **Path Privacy:** Always use `C:\Users\you` in documentation, comments, and examples—never hardcode the local machine's real username.
- **Release Workflow:** `.github/workflows/release.yml` must be a copy of `GloriaSetup/templates/release.yml` (shared `check`/`release` jobs from `projectGloria/GloriaSetup/.github/workflows/app-{check,release}.yml@main`, plus this repo's own `build` job). Don't hand-write release workflows or pin `gloria-setup`; see `.brain/github-actions.md`.
- **Window Chrome:** Disable native OS titlebars; build an integrated frameless titlebar with drag region, double-click maximize, and custom min/max/close controls.
- **Desktop Shell Lock:** Lock the app shell to `100vw x 100vh` (`overflow: hidden`) with internal scroll panes and `user-select: none` on UI chrome.
- **Scrollbars:** Ban raw OS scrollbars; use thin (4–6px) themed scrollbars with transparent tracks and zero layout shift.
- **Interactive Controls:** Custom-style all form controls; define explicit `hover`, `active`, `focus-visible`, and `disabled` states with snappy 120–180ms transitions.

## Playbooks (Read Before Task)
- **Building & Packaging:** Read `.brain/building-the-project.md` before packaging, compiling release binaries, or building an installer.
- **GitHub Actions & Releases:** Read `.brain/github-actions.md` before creating/modifying `.github/workflows/*.yml`, setting up release automation, or debugging a failed release.

## Repo Guardrails & Gotchas
- **New Tauri command:** Register it in `generate_handler!` in `src-tauri/src/lib.rs`, add a guarded wrapper in `src/services/platformService.ts`, and provide a web fallback (or return `null`).
- **Window/plugin permissions:** Grant in `src-tauri/capabilities/default.json`; `decorations: false` routes min/max/close and drag through `src/components/Titlebar.tsx`.
- **CSP:** `src-tauri/tauri.conf.json` restricts `connect-src` to `api.github.com` and `raw.githubusercontent.com`; add any new network host there or it fails silently on desktop only.
- **Web edition:** Show every app in full color with an Install button (installer download, else `webUrl`); never add installed-app detection or pins on web.
- **Anonymous GitHub rate limit:** 60 req/hr; web edition must read the catalog snapshot first—never add per-repo REST calls on page load.
- **i18n:** Put every new UI string in all 4 files in `src/locales/` (`en`, `es`, `fr`, `tr`); never hardcode English in components.
- **Cache shape changes:** Bump the `_v4` suffix on `CACHE_KEY` and `RELEASE_CACHE_PREFIX` in `src/services/githubService.ts`.
- **`src-tauri/src/main.rs`:** Keep `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` so release builds don't open a console window.
- **Base path & version:** `vite.config.ts` sets `base: "./"`; use `import.meta.env.BASE_URL` for public assets (never `/`), and read the app version from injected `__APP_VERSION__`.
- **Self-update & Pages CI:** Launcher self-update looks for a `-setup.exe` release asset. `.github/workflows/deploy-pages.yml` rebuilds the catalog snapshot and deploys Pages on `main` push, hourly cron, or `refresh-catalog` dispatch.

## Done Criteria
Run `npm run typecheck`, `npm run build:web`, and `cargo test --manifest-path src-tauri/Cargo.toml`, and verify all 6 Version Manifests agree. For UI changes, also inspect the live app via `npm run dev` (or `npm run preview`).

<!-- brain-sync: 31e69a675214 -->
