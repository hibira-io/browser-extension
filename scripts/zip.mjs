// Zips dist/ for the Chrome Web Store upload.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const out = `hibi-extension-${version}.zip`;
execFileSync('zip', ['-qr', `../${out}`, '.'], { cwd: 'dist' });
console.log(out);
