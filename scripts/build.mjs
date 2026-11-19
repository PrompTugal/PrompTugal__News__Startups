// Build: copy src/ to _site/, stamp the version, write version.json.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev".
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generate.mjs';
import { loadRegistry, loadBar, ownEntry, BAR_VERSION } from './lib/sites-bar.mjs';
import { checkObsTz, OBS_TZ_SITE } from './lib/obs-tz.mjs';
import { checkMap, MAP_DIR } from './lib/ptmap.mjs';
const version = process.env.SITE_VERSION || 'dev';
rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });
const reg = await loadRegistry();
const tz = checkObsTz(reg.registry);
console.log(tz.on ? `obs_tz ${tz.version} on (checked against ${reg.from.split(' ')[0]})` : tz.message);
if (!tz.on) rmSync(join('_site', OBS_TZ_SITE), { force: true });   // left out, never shipped unchecked
const bar = await loadBar(reg);
console.log(`${bar.message} (registry: ${reg.from.split(' ')[0]})`);
if (!bar.on) rmSync(join('_site', 'assets', 'sites-bar', BAR_VERSION), { recursive: true, force: true });   // left out, never shipped unchecked
const mp = checkMap(reg.registry);
console.log(`${mp.message} (registry: ${reg.from.split(' ')[0]})`);
if (!mp.on) { rmSync(join('_site', MAP_DIR), { recursive: true, force: true }); rmSync(join('_site', 'assets', 'ptmap-init.js'), { force: true }); }   // left out, never shipped unchecked
const gen = generate({ bar: bar.html, entry: ownEntry(reg.registry), map: mp.on });
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
