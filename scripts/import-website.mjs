// Import: read the places registry, the public by-place research and the mapped companies from a checkout of
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
const REG = 'data/site/places-registry.json';   // ontologist@'s registry of places every site reads (conductor.b@, 19 Nov 2026)
if (!existsSync(join(src, REG))) { console.error(`import: no ${REG} under ${src}`); process.exit(1); }
const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const read = p => JSON.parse(readFileSync(join(src, p), 'utf8'));
const clean = s => (typeof s === 'string' ? s.replaceAll('—', ', ').replace(/\s+/g, ' ').trim() : undefined);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => clean(o[k])).map(k => [k, clean(o[k])]));

// How each list's kinds map onto this site's four sections.
const SUPPORT = { 'public desk': 'public desk', incubator: 'incubator', accelerator: 'accelerator', space: 'space', community: 'community', mentoring: 'mentoring', programme: 'programme', funding: 'funding programme' };
const MONEY = { grant: 'grant', investment: 'round', programme: 'programme', fund: 'fund', investor: 'investor' };

// Places from the registry (one source, not a file of our own). A place's id here is the one its by-place file uses
// (the registry's id or one of its aliases, so Lisbon stays "lisboa" and its URL is unchanged); parent "place:<id>"
// maps the same way. Kept: places with a by-place file or used by this site's own research files, and their ancestors.
const reg = read(REG).places;
const regById = new Map(reg.map(p => [p.id, p]));
const hasFile = id => existsSync(join(src, `data/by-place/${id}.json`));
const ownId = p => [p.id, ...(p.aliases || [])].find(hasFile) || p.id;
const used = new Set();
for (const f of existsSync('data/research') ? readdirSync('data/research').filter(f => f.endsWith('.json')) : []) {
  const d = JSON.parse(readFileSync(join('data/research', f), 'utf8'));
  for (const e of d.entries || []) if (e.place) used.add(e.place);
}
const wanted = p => [p.id, ...(p.aliases || [])].some(id => hasFile(id) || used.has(id));
const keep = new Set();
for (const p of reg) if (wanted(p)) for (let q = p, seen = new Set(); q && !seen.has(q.id); q = q.parent ? regById.get(String(q.parent).replace(/^place:/, '')) : null) { seen.add(q.id); keep.add(q.id); }
const places = reg.filter(p => keep.has(p.id)).map(p => {
  const parent = p.parent ? regById.get(String(p.parent).replace(/^place:/, '')) : null;
  const o = { ...pick({ ...p, id: ownId(p), parent: parent ? ownId(parent) : undefined }, ['id', 'name', 'kind', 'parent', 'country']) };
  if (Array.isArray(p.at) && p.at.length === 2 && p.at.every(Number.isFinite)) o.at = p.at;
  return o;
});
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
