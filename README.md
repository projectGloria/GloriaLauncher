<div align="center">

<img src="./public/gloria-icon.svg" alt="GloriaLauncher Icon" width="72" height="72" />

# GLORIA — Craft App Suite & Launcher

**Unified Web & Desktop App Suite Launcher for [@projectGloria](https://github.com/projectGloria)**

[![GitHub Pages](https://img.shields.io/badge/Web_Launcher-GitHub_Pages-00f0ff?style=flat-square&logo=github)](https://projectgloria.github.io/GloriaLauncher/)
[![Desktop Runtime](https://img.shields.io/badge/Desktop-Tauri_v2_%2B_Rust-dc143c?style=flat-square&logo=rust)](https://github.com/projectGloria/GloriaLauncher/releases)
[![Frontend](https://img.shields.io/badge/UI-React_19_%2B_Tailwind_v4-38bdf8?style=flat-square&logo=react)](https://github.com/projectGloria/GloriaLauncher)

</div>

---

## Overview

**GloriaLauncher** is a dual-runtime application suite launcher and showcase for all **33+ `@projectGloria` repositories**—inspired by the brutalist industrial aesthetic of **ArtCraft** (`getartcraft.com` / `ArtCraft Launcher`).

It runs from a **single codebase** in two modes:
1. **Web Edition (GitHub Pages)**: Live at `https://projectgloria.github.io/GloriaLauncher/`. Browse the entire Gloria lineup, filter by category, inspect live repository `README.md` files and release binaries, pin favorite tools, and launch web-enabled apps directly in your browser.
2. **Desktop Edition (Windows Native via Tauri v2 & Rust)**: Frameless dark desktop launcher that downloads release installers/binaries from GitHub Releases into `%LOCALAPPDATA%\GloriaLauncher\apps`, auto-detects local builds in your `Gloria Repoz` workspace, and launches native `.exe` applications with one click.

---

## Features

- **Launcher Grid & Compact Table Views**: Switch seamlessly between the 5-column brutalist card grid and the sortable tabular view (`APP`, `STATUS`, `VERSION`, `RELEASED`, `AUTHOR`).
- **Editorial Lineup Showcase**: Toggle between the **Launcher** view and the **Lineup & Showcase** view (`01 / GLORIA APPS`, `02 / THE LINEUP`, `03 / PRINCIPLES`).
- **Hybrid Curated Catalog + Live GitHub Sync**: Curated metadata, custom accent palettes, and icons for 33+ `@projectGloria` projects enriched live via the GitHub API (`users/projectGloria/repos` & `/releases/latest`) plus automatic discovery of any new repositories.
- **Interactive App Inspector Drawer**: Click any card or `...` button to view live `README.md` documentation, platform/tech tags, and downloadable GitHub Release assets.

---

## Development & Build

### Prerequisites
- **Node.js** 20+
- **Rust** 1.80+ (for Tauri Desktop build)

### Commands

```bash
# Install dependencies
npm install

# Run Web development server (http://localhost:1420)
npm run dev

# Build static Web bundle for GitHub Pages (outputs to ./dist)
npm run build:web

# Run Desktop Launcher in development mode (Tauri v2 + Rust)
npm run tauri:dev

# Build production Windows Desktop installer (.exe / .msi)
npm run tauri:build
```

---

## License

MIT © [projectGloria](https://github.com/projectGloria) / [Nihil](https://github.com/Nihilnia)
