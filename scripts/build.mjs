// Bundles the extension into dist/. HIBIRA_BASE points it at another server
// (a local demo); the store build talks to https://hibira.io.
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const base = process.env.HIBIRA_BASE ?? 'https://hibira.io';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
if (process.env.HIBIRA_DEMO) {
  // Local demo only: let the panel see tab URLs without a toolbar click,
  // which automated runs can't make. Store builds never set this.
  const manifestPath = 'dist/manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.permissions.push('tabs');
  // The e2e maps northwind.example and shop.example to the demo server:
  // northwind.example counts as turned on, shop.example shows the off state.
  manifest.host_permissions = ['http://northwind.example/*'];
  manifest.name = `${manifest.short_name} (local demo)`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
const opts = {
  entryPoints: {
    background: 'src/background/main.ts',
    content: 'src/content/main.ts',
    panel: 'src/panel/main.ts',
  },
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  outdir: 'dist',
  minify: !watch,
  legalComments: 'none',
  define: { __HIBIRA_BASE__: JSON.stringify(base), __DEMO__: String(Boolean(process.env.HIBIRA_DEMO)) },
};
// The content script is injected as a classic script.
const content = { ...opts, entryPoints: { content: 'src/content/main.ts' }, format: 'iife' };
const rest = { ...opts, entryPoints: { background: opts.entryPoints.background, panel: opts.entryPoints.panel } };
if (watch) {
  for (const o of [content, rest]) await (await context(o)).watch();
  console.log('watching…');
} else {
  await Promise.all([build(content), build(rest)]);
  console.log(`built dist/ for ${base}`);
}
