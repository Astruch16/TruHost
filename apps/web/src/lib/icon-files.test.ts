import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconUrl, type IconPath } from './icon-files';

const DIR = join(__dirname, '../assets/icons');
const svgs = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? svgs(path) : name.endsWith('.svg') ? [path] : [];
  });

describe('the custom icon files', () => {
  it('has a URL for every icon in the folder, 41 icons and 9 empty states', () => {
    const paths = svgs(DIR).map((p) => relative(DIR, p).replace(/\.svg$/, '') as IconPath);
    expect(paths).toHaveLength(50);
    expect(paths.filter((p) => p.startsWith('empty-states/'))).toHaveLength(9);
    for (const p of paths) expect(iconUrl(p)).toBeTruthy();
  });
});
