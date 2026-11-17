// Import: read the public by-place research and the mapped companies from a checkout of
// PrompTugal/PrompTugal__News__Website and write data/from-website.json, public fields only.
// Written by startups@PrompTugal.dinis, 2026-11-17. Node built-ins only.
//
// Usage: node scripts/import-website.mjs ../PrompTugal__News__Website
//
// Kept: name, what, url, source_url, read_on, kind or type, date, amount (each value as the
// Website repo's agents recorded it, with their source and the date they read it).
// Left out: the team's private notes (priority, owner, decision, why it matters), people,
// contacts, and the AI-path notes (that site's lens, not this one's).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const src = process.argv[2] || '../PrompTugal__News__Website';
if (!existsSync(join(src, 'data/by-place/places.json'))) { console.error(`import: no data/by-place/places.json under ${src}`); process.exit(1); }
const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const read = p => JSON.parse(readFileSync(join(src, p), 'utf8'));
const clean = s => (typeof s === 'string' ? s.replaceAll('—', ', ').replace(/\s+/g, ' ').trim() : undefined);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => clean(o[k])).map(k => [k, clean(o[k])]));

// How each list's kinds map onto this site's four sections.
const SUPPORT = { 'public desk': 'public desk', incubator: 'incubator', accelerator: 'accelerator', space: 'space', community: 'community', mentoring: 'mentoring', programme: 'programme', funding: 'funding programme' };
const MONEY = { grant: 'grant', investment: 'round', programme: 'programme', fund: 'fund', investor: 'investor' };

const places = read('data/by-place/places.json').places.map(p => pick(p, ['id', 'name', 'kind', 'parent']));
const entries = [];
for (const p of places) {
  const file = `data/by-place/${p.id}.json`;
  if (!existsSync(join(src, file))) continue;
  const d = read(file);
  const from = { repository: 'PrompTugal/PrompTugal__News__Website', path: file, commit };
  for (const x of d.start_company || []) {
    entries.push({ section: 'support', kind: SUPPORT[x.kind] || clean(x.kind) || 'support', place: p.id, ...pick(x, ['name', 'what', 'url', 'source_url', 'read_on']), from });
  }
  for (const x of d.investors || []) {
    const kind = MONEY[x.type] || clean(x.type) || 'funding';
    const section = kind === 'fund' || kind === 'investor' ? 'investors' : 'funding';
    entries.push({ section, kind, place: p.id, ...pick(x, ['name', 'what', 'url', 'source_url', 'read_on', 'date', 'amount']), from });
  }
  for (const x of d.ai_map || []) {
    if (x.type === 'startup') entries.push({ section: 'companies', kind: 'startup', place: p.id, ...pick(x, ['name', 'what', 'url', 'source_url', 'read_on']), from });
    if (x.type === 'investor') entries.push({ section: 'investors', kind: 'investor', place: p.id, ...pick(x, ['name', 'what', 'url', 'source_url', 'read_on']), from });
  }
}

// Mapped companies based in Portugal: name, site and what they do, cited to the company's own
// site where the Website team read it (never a websummit.com page as the reader's source).
const companies = [];
for (const id of readdirSync(join(src, 'data/companies'))) {
  const f = `data/companies/${id}/company.json`;
  if (!existsSync(join(src, f))) continue;
  const c = read(f);
  if (c.country !== 'Portugal' || !/startup/.test(c.category || '')) continue;
  const sources = existsSync(join(src, `data/companies/${id}/sources.json`)) ? read(`data/companies/${id}/sources.json`).sources : [];
  const own = sources.find(s => s.id === 'own1' || (s.url && !/websummit\.com/.test(s.url)));
  if (!own) continue;
  companies.push({ section: 'companies', kind: 'startup', place: 'portugal', name: clean(c.name), what: clean(c.what), url: clean(c.website), source_url: own.url, read_on: own.read_on, note: 'Listed for Web Summit Lisbon 2026 as a Portuguese startup.', from: { repository: 'PrompTugal/PrompTugal__News__Website', path: f, commit } });
}

const out = {
  about: 'Public facts imported from PrompTugal/PrompTugal__News__Website (by-place research and mapped companies) by scripts/import-website.mjs. Each value keeps the source and the date read that the Website team recorded.',
  imported_by: 'startups@PrompTugal.dinis',
  imported_on: new Date().toISOString().slice(0, 10),
  source: { repository: 'https://github.com/PrompTugal/PrompTugal__News__Website', commit },
  places,
  entries: [...entries, ...companies],
};
writeFileSync('data/from-website.json', JSON.stringify(out, null, 1) + '\n');
const count = {}; for (const e of out.entries) count[e.section] = (count[e.section] || 0) + 1;
console.log(`imported ${out.entries.length} entries from ${commit.slice(0, 7)}: ${JSON.stringify(count)}`);
