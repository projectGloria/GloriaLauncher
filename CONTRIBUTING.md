# Contributing to GloriaLauncher

Thank you for your interest in contributing to **GloriaLauncher**.

## Prerequisites

- **Node.js** 22+
- **Rust** 1.80+
- **Windows**: Microsoft C++ Build Tools (Desktop development with C++) and WebView2 Runtime

## Local Setup

```bash
git clone https://github.com/projectGloria/GloriaLauncher.git
cd GloriaLauncher
npm install
```

Run the frontend or desktop app locally:

```bash
# Web frontend (http://localhost:1420)
npm run dev

# Native Windows desktop app (Tauri v2 + Rust)
npm run tauri:dev
```

## Project Layout

- `src/` — React 19 + TypeScript + Tailwind CSS v4 frontend
  - `src/components/` — UI views (grid, table, showcase, inspector drawer, settings)
  - `src/data/gloriaCatalog.ts` — curated metadata for `@projectGloria` apps
  - `src/services/` — GitHub sync, icon resolution, and Tauri/web platform bridge
- `src-tauri/` — Tauri v2 + Rust backend (release discovery, installer downloads, zip extraction, local app registry)

## Before Opening a Pull Request

1. Keep changes focused and small.
2. Run type-checking, build, and Rust unit tests:

   ```bash
   npm run typecheck
   npm run build:web
   cd src-tauri && cargo test
   ```

3. Open a pull request against `main` with a clear summary of what changed and why.
