// Build: copy src/ to _site/, stamp the version, write version.json.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev".
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generate.mjs';
import { loadBar, ownEntry, BAR_VERSION } from './lib/sites-bar.mjs';
const version = process.env.SITE_VERSION || 'dev';
rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });
const bar = await loadBar();
console.log(bar.html ? `sites bar ${BAR_VERSION} from ${bar.from}` : `sites bar ${BAR_VERSION}: registry refused by the renderer (from ${bar.from}); built without a bar`);
const gen = generate({ bar: bar.html, entry: ownEntry(bar.registry) });
console.log(`generated ${gen.pages} pages: ${JSON.stringify(gen.counts)}`);
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt|svg)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built: new Date().toISOString() }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version})`);
