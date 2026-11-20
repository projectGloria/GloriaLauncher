# AGENTS.md — GloriaLauncher

Launcher and showcase for the @projectGloria app suite. It is a React 19 + TS + Tailwind v4 frontend (Vite) that ships two ways: as a Tauri v2 Windows desktop app (Rust) and as a GitHub Pages web edition. Windows-first. Rust 1.80+, Node 22.

## Commands
- Web dev: `npm run dev` (port 1420, strict; Tauri's devUrl depends on it)
- Desktop dev: `npm run tauri:dev`
- Typecheck: `npm run typecheck`
- Web build (what Pages CI runs): `npm run build:web`
- Rust tests: `cd src-tauri && cargo test`
- Desktop bundle (NSIS + MSI): `npm run tauri:build`
- Catalog snapshot: `node scripts/build-catalog.mjs` (needs `GITHUB_TOKEN` or `GH_TOKEN`; writes the gitignored `public/catalog.json`)

## Architecture
- `src/main.tsx` → `src/App.tsx`: one shell that switches between grid, table and showcase views, plus the inspector drawer and settings modal (`src/components/`).
- `src/services/platformService.ts`: the only bridge to Tauri. Every `invoke()` goes through it behind `isTauriDesktop()`, and each call has a web fallback. The web edition never reports apps as installed: detection is desktop-only.
- `src/services/githubService.ts`: catalog sync, tried in order: local `catalog.json` snapshot, then the hosted Pages snapshot, then GitHub (native scraping on desktop, REST on web). Results are cached in localStorage under versioned keys (`_v4`).
- `src/data/gloriaCatalog.ts`: hand-curated metadata merged over the discovered repos. Repos only appear if they have a published release.
- `src-tauri/src/lib.rs`: all Rust code in one file. It holds the commands registered in `generate_handler!`: release discovery, downloads to `~/Downloads/GloriaLauncherDownloads`, zip extraction, launch and uninstall, and the self-update check. It also reads the Windows Uninstall registry keys (`winreg`).
- Installed-app registry: `installed_apps.json` in Tauri's `app_local_data_dir`.
- `src/i18n.ts`: languages en/fr/es/tr. UI strings live in `src/locales/*.json`; per-app texts live in `src/locales/apps/*.json`, keyed by repo name.

## Hard Rules & Gotchas
- **New Tauri command:** register it in `generate_handler!` in `lib.rs`, add a guarded wrapper in `platformService.ts`, and give it a web fallback (or return null).
- **Window/plugin permissions:** grant them in `src-tauri/capabilities/default.json`. The window has `decorations: false`, so minimize, maximize, close and drag go through the custom `Titlebar.tsx`.
- **CSP:** `tauri.conf.json` restricts `connect-src` to `api.github.com` and `raw.githubusercontent.com`. A new network host must be added there too, or it fails silently on desktop only.
- **Web edition:** it shows every app in full color with an Install button (installer download, else the app's `webUrl`). Don't add installed-app detection or pins to the web; a browser can't see what's installed, and detection belongs to the desktop launcher.
- **Anonymous GitHub rate limit:** this is 60 requests/hour. The web edition must keep reading the snapshot first; don't add per-repo REST calls on page load.
- **i18n:** every new UI string goes into all 4 files in `src/locales/`. Don't hardcode English in components.
- **Cache shape changes:** bump the `_v4` suffix on `CACHE_KEY` and `RELEASE_CACHE_PREFIX` in `githubService.ts`.
- **`src-tauri/src/main.rs`:** keep the `windows_subsystem = "windows"` attribute ("DO NOT REMOVE"); without it a console window opens in release builds.
- **Base path:** `vite.config.ts` uses `base: "./"` so the same build works on Pages and in Tauri. Use `import.meta.env.BASE_URL` for public assets, never absolute `/` paths.
- **App version:** read it from the injected `__APP_VERSION__` (taken from `package.json`), not a hardcoded string.

## Release
- Bump the version together in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. Commit as "Release vX.Y.Z".
- Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds Windows installers. The release tag is taken from the `tauri.conf.json` version, and the launcher's self-update looks for a `-setup.exe` asset.
- A push to `main`, an hourly cron or a `refresh-catalog` dispatch rebuilds the snapshot and deploys Pages (`deploy-pages.yml`).
- Commit style: a plain sentence saying what changed and why (e.g. "Detect apps installed via their own installers"). No `feat:`, `fix:` or `chore:` prefixes.

## Done Criteria
Run `npm run typecheck`, `npm run build:web` and `cd src-tauri && cargo test`. All three must pass before you report a change as done. For UI changes, also check the web preview (`.claude/launch.json` → `web-dev` or `web-preview`).
