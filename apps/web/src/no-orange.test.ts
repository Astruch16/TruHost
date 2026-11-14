import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * There is no orange in the app: gold (amber-mid, #D9AE3C) marks what's low or needs attention, the muted rose what's
 * empty, green what's done. This fails on any orange colour in the web app's source: a hex value in the orange range
 * (hue 12–40°, saturated and neither near-black nor near-white, so wood browns, tans and golds pass), or an `orange`
 * colour token or class.
 */
// Vitest runs from apps/web.
const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.gen.ts') ? [path] : [];
  });
}

/** Hue (degrees), saturation and lightness (0–1) of "#rrggbb" or "#rgb". */
function hsl(hex: string): [number, number, number] {
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

const isOrange = (hex: string) => {
  const [h, s, l] = hsl(hex);
  return h >= 12 && h <= 40 && s >= 0.55 && l >= 0.3 && l <= 0.7;
};

describe('no orange in the app', () => {
  it('tells orange from gold, browns and reds', () => {
    expect(['c8601e', 'a34a12', 'd29a2a', 'f28c28', 'e67e22'].filter(isOrange)).toHaveLength(5);
    // Gold, wood, tan, sand, the danger red and the muted rose stay.
    expect(['d9ae3c', '8a5a3b', 'b98a5e', 'cdaa80', 'ead9b2', 'c4473b', 'c2477a'].filter(isOrange)).toEqual([]);
  });

  it('has no orange hex values, colour tokens or classes in src', () => {
    const found: string[] = [];
    for (const path of files(SRC)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const where = `${relative(SRC, path)}:${i + 1}`;
          for (const [, hex] of line.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
            if (isOrange(hex!)) found.push(`${where} #${hex}`);
          }
          if (
            /(--color-orange|\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent)-orange-)/.test(
              line,
            )
          ) {
            found.push(`${where} ${line.trim()}`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
