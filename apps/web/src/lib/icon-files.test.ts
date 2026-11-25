import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconSvg, type IconPath } from './icon-files';

const DIR = join(__dirname, '../assets/icons');
const svgs = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? svgs(path) : name.endsWith('.svg') ? [path] : [];
  });

describe('the custom icon files', () => {
  const paths = svgs(DIR).map((p) => relative(DIR, p).replace(/\.svg$/, '') as IconPath);

  it('draws every icon in the folder, 41 on a 24 grid and 9 empty states on a 64 grid', () => {
    expect(paths).toHaveLength(50);
    expect(paths.filter((p) => p.startsWith('empty-states/'))).toHaveLength(9);
    for (const p of paths) {
      const { viewBox, body } = iconSvg(p);
      expect(viewBox).toBe(p.startsWith('empty-states/') ? '0 0 64 64' : '0 0 24 24');
      expect(body).toMatch(/^</);
    }
  });

  // They're drawn inline (dangerouslySetInnerHTML), so they must hold drawing only, in the CSS colour.
  it('holds only drawing: no scripts, links, event handlers, embedded content or fixed colours', () => {
    for (const p of paths) {
      const text = readFileSync(join(DIR, `${p}.svg`), 'utf8');
      expect(text, p).not.toMatch(/<script|<foreignObject|<use|<image|href=|\son\w+=|url\(|javascript:/i);
      expect(iconSvg(p).body, p).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });
});
