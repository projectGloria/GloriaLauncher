import { useEffect, useState } from "react";
import { getAppIconUrl, getCachedAppIconUrl } from "./iconService";

/** Accent + dark tint derived from an app's real icon. */
export interface IconPalette {
  accent: string;
  tint: string;
}

const PALETTE_CACHE_PREFIX = "gloria_launcher_icon_palette_v1_";
const inflight = new Map<string, Promise<IconPalette | null>>();

function readCache(iconUrl: string): IconPalette | null | undefined {
  try {
    const raw = localStorage.getItem(PALETTE_CACHE_PREFIX + iconUrl);
    if (raw === null) return undefined;
    return JSON.parse(raw) as IconPalette | null;
  } catch {
    return undefined;
  }
}

function writeCache(iconUrl: string, palette: IconPalette | null): void {
  try {
    localStorage.setItem(PALETTE_CACHE_PREFIX + iconUrl, JSON.stringify(palette));
  } catch {
    // Ignore quota errors
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
      .toString(16)
      .padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Finds the dominant vivid hue of an icon: pixels are bucketed by hue and weighted
 * by saturation, ignoring transparent and near-grey pixels. The result is tuned to
 * stay readable on the launcher's dark background.
 */
function extractPalette(img: HTMLImageElement): IconPalette | null {
  const SIZE = 48;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const BUCKETS = 24;
  const weight = new Array<number>(BUCKETS).fill(0);
  const sumS = new Array<number>(BUCKETS).fill(0);
  const sumL = new Array<number>(BUCKETS).fill(0);
  const sumX = new Array<number>(BUCKETS).fill(0); // circular hue mean
  const sumY = new Array<number>(BUCKETS).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const [h, s, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    const w = s * (1 - Math.abs(l - 0.5));
    const b = Math.floor(h / (360 / BUCKETS)) % BUCKETS;
    weight[b]! += w;
    sumS[b]! += s * w;
    sumL[b]! += l * w;
    const rad = (h * Math.PI) / 180;
    sumX[b]! += Math.cos(rad) * w;
    sumY[b]! += Math.sin(rad) * w;
  }

  // Score each bucket together with its neighbours so a hue split across two
  // buckets still wins.
  let best = -1;
  let bestScore = 0;
  for (let b = 0; b < BUCKETS; b++) {
    const score =
      weight[b]! +
      0.5 * (weight[(b + 1) % BUCKETS]! + weight[(b + BUCKETS - 1) % BUCKETS]!);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best < 0 || bestScore < 1) return null;

  const w = weight[best]!;
  let hue = (Math.atan2(sumY[best]!, sumX[best]!) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const sat = Math.min(0.95, Math.max(0.55, sumS[best]! / w));
  const light = Math.min(0.66, Math.max(0.52, sumL[best]! / w));

  return {
    accent: hslToHex(hue, sat, light),
    tint: hslToHex(hue, Math.min(0.6, sat), 0.085),
  };
}

function computePalette(iconUrl: string): Promise<IconPalette | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        resolve(extractPalette(img));
      } catch {
        resolve(null); // e.g. tainted canvas
      }
    };
    img.onerror = () => resolve(null);
    img.src = iconUrl;
  });
}

function getIconPalette(iconUrl: string): Promise<IconPalette | null> {
  const cached = readCache(iconUrl);
  if (cached !== undefined) return Promise.resolve(cached);
  let pending = inflight.get(iconUrl);
  if (!pending) {
    pending = computePalette(iconUrl)
      .then((palette) => {
        writeCache(iconUrl, palette);
        return palette;
      })
      .finally(() => inflight.delete(iconUrl));
    inflight.set(iconUrl, pending);
  }
  return pending;
}

function cachedPaletteFor(repoId: string): IconPalette | null {
  const url = getCachedAppIconUrl(repoId);
  return url ? readCache(url) ?? null : null;
}

/**
 * Resolves icon-derived palettes for the given repos, keyed by repo id.
 * Apps without an icon (or whose icon can't be read) are simply absent.
 */
export function useIconPalettes(repoIds: string[]): Record<string, IconPalette> {
  const key = repoIds.join("|");
  const [palettes, setPalettes] = useState<Record<string, IconPalette>>(() => {
    const initial: Record<string, IconPalette> = {};
    for (const id of repoIds) {
      const p = cachedPaletteFor(id);
      if (p) initial[id] = p;
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    for (const id of repoIds) {
      getAppIconUrl(id)
        .then((url) => (url ? getIconPalette(url) : null))
        .then((palette) => {
          if (cancelled || !palette) return;
          setPalettes((prev) =>
            prev[id]?.accent === palette.accent ? prev : { ...prev, [id]: palette }
          );
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return palettes;
}
