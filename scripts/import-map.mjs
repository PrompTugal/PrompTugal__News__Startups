// Import the drawing data for the front page's maps from a checkout of PrompTugal__News__Website:
// the mainland Portugal and Algarve outlines (Natural Earth, public domain, via world-atlas, ISC) and
// each place's seat (the "at" field of data/by-place/places.json). Writes data/map/*.json.
// Written by startups@PrompTugal.dinis, 2026-11-19. Node built-ins only.
// Usage: node scripts/import-map.mjs ../PrompTugal__News__Website
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const src = process.argv[2] || '../PrompTugal__News__Website';
const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const read = p => JSON.parse(readFileSync(join(src, p), 'utf8'));
mkdirSync('data/map', { recursive: true });
for (const name of ['portugal-outline', 'algarve-outline']) {
  const d = read(`assets/portugal/${name}.json`);
  writeFileSync(`data/map/${name}.json`, JSON.stringify({ ...d, from: { repository: 'PrompTugal/PrompTugal__News__Website', path: `assets/portugal/${name}.json`, commit } }) + '\n');
}
const at = Object.fromEntries(read('data/by-place/places.json').places.filter(p => Array.isArray(p.at)).map(p => [p.id, p.at]));
writeFileSync('data/map/places-at.json', JSON.stringify({ about: 'Each place\'s seat as [longitude, latitude], from data/by-place/places.json in PrompTugal__News__Website. Drawing only.', from: { repository: 'PrompTugal/PrompTugal__News__Website', path: 'data/by-place/places.json', commit }, at }, null, 1) + '\n');
console.log(`map data from ${commit.slice(0, 7)}: ${Object.keys(at).length} places with a seat`);
