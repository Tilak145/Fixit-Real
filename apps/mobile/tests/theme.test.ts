import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const prepareDesign = require('../spk-design.cjs') as (app: string, options?: { watch?: boolean }) => Promise<void>;

function variants(css: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [, name, body] of css.matchAll(/@variant (\w+) \{([^}]*)\}/g)) {
    result[name!] = Object.fromEntries([...body!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key!, value!.trim()]));
  }
  return result;
}

function compile(design?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'spk-native-theme-'));
  mkdirSync(path.join(dir, 'lib'));
  if (design) writeFileSync(path.join(dir, 'DESIGN.md'), design);
  return {
    dir,
    async read() {
      await prepareDesign(dir, { watch: false });
      return { css: readFileSync(path.join(dir, 'spk-design.css'), 'utf8'), theme: readFileSync(path.join(dir, 'lib/spk-design-theme.ts'), 'utf8') };
    },
  };
}

test('DESIGN tokens compile into complete light and dark Uniwind colors', async () => {
  const fixture = compile();
  try {
    const { css } = await fixture.read();
    const { light, dark } = variants(css);
    assert.ok(light && dark);
    assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
    for (const value of [...Object.values(light), ...Object.values(dark)]) assert.match(value, /^(#|rgb|hsl|oklch)/);
    assert.notEqual(light['--color-background'], dark['--color-background']);
    assert.ok(light['--color-sidebar'] && light['--color-chart-5'] && light['--color-brand-primary']);
    assert.match(css, /--radius-lg: \d+px;/);
  } finally { rmSync(fixture.dir, { recursive: true, force: true }); }
});

test('a design declaring only dark serves both variants', async () => {
  const fixture = compile('---\nschema: spk.design.v1\nname: Dark app\ndefaultTheme: dark\nthemes:\n  dark:\n    background: "#111111"\n---\n');
  try {
    const { css, theme } = await fixture.read();
    assert.match(theme, /"defaultTheme":"dark"/);
    const { light, dark } = variants(css);
    assert.equal(dark?.['--color-background'], '#111111');
    assert.deepEqual(light, dark);
  } finally { rmSync(fixture.dir, { recursive: true, force: true }); }
});
