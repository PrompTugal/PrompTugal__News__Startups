// Generate the site's pages from data/ into _site/: every page as index.html and its markdown
// twin index.md, plus llms.txt and sitemap.xml. Called by scripts/build.mjs after src/ is copied.
// Written by startups@PrompTugal.dinis, 2026-11-17. Node built-ins only.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { MAP_DIR } from './lib/ptmap.mjs';
import { join, dirname } from 'node:path';
import { variants } from './lib/front-variants.mjs';
import { loadLicences, sourceLicence, licenceHtml, licenceMd, OWN } from './lib/licence.mjs';
import { mergeRounds, dedupeAlso } from './lib/rounds.mjs';
import { fileMeta, makeProvenance, howHtml, howMd, WEBSITE_FILE } from './lib/provenance.mjs';
import { buildInvestors, GROUPS } from './lib/investors.mjs';
const GROUP_IDX = t => GROUPS.indexOf(t);

const SITE = 'https://startups.promptugal.news';
const OUT = '_site';
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Only absolute http(s) URLs may become links; anything else (javascript:, data:, relative, prose) becomes ''.
// A URL with spaces, quotes or angle brackets is percent-encoded (new URL().href); others are kept as written.
export const safeUrl = u => { const t = String(u ?? '').trim(); if (!/^https?:\/\//i.test(t)) return ''; try { const x = new URL(t); return /^https?:$/.test(x.protocol) ? (/[\s"<>]/.test(t) ? x.href : t) : ''; } catch { return ''; } };
const mdEsc = s => String(s ?? '').replace(/([\\`*_[\]|])/g, '\\$1');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const nice = d => { if (!d) return ''; const [y, m, day] = d.split('-'); return [day ? +day : '', m ? MONTHS[+m - 1] : '', y].filter(Boolean).join(' '); };

// ---------- data ----------
const SECTION_OF = {
  startup: 'companies', company: 'companies',
  round: 'funding', grant: 'funding', investment: 'funding',
  fund: 'investors', investor: 'investors', 'angel network': 'investors',
};
export function loadData() {
  const web = JSON.parse(readFileSync('data/from-website.json', 'utf8'));
  const places = web.places.map(p => ({ ...p }));
  const known = new Set(places.map(p => p.id));
  // Each place's country: follow its parent chain to a place of kind country (data/countries.json names them), so
  // nothing below is hard-coded to one country. A research entry for an unknown place goes to its own country's place
  // (its country field, a code or a country id), or to the only country there is when it names none.
  const COUNTRIES = JSON.parse(readFileSync('data/countries.json', 'utf8')).countries;
  const byId = new Map(places.map(p => [p.id, p]));
  const countryOf = p => { const seen = new Set(); while (p && !seen.has(p.id)) { seen.add(p.id); if (p.kind === 'country' || (!p.parent && COUNTRIES[p.id])) return p.id; p = byId.get(p.parent); } return ''; };
  for (const p of places) { p.country = countryOf(p); p.country_code = (COUNTRIES[p.country] || {}).code || ''; }
  const countryPlaces = places.filter(p => p.kind === 'country').map(p => p.id);
  const countryFor = c => { if (!c) return countryPlaces.length === 1 ? countryPlaces[0] : ''; const k = String(c).toLowerCase(); return countryPlaces.find(id => id === k || (COUNTRIES[id] || {}).code === k.toUpperCase()) || ''; };
  const alias = { lisbon: 'lisboa', 'lisboa-city': 'lisboa' };
  const research = [];
  const gaps = [];
  const metaOf = new Map([[WEBSITE_FILE, fileMeta(WEBSITE_FILE, web)]]);
  const researchFiles = existsSync('data/research') ? readdirSync('data/research').filter(f => f.endsWith('.json')).sort() : [];
  for (const f of researchFiles) {
    const d = JSON.parse(readFileSync(join('data/research', f), 'utf8'));
    metaOf.set(`data/research/${f}`, fileMeta(`data/research/${f}`, d));
    for (const e of d.entries || []) {
      let place = alias[e.place] || e.place;
      if (place === 'national') place = countryFor(e.country || d.country);
      if (!known.has(place)) place = countryFor(e.country || d.country);
      if (!known.has(place)) { gaps.push({ what: `an entry for an unknown place and country (${String(e.place || '').slice(0, 40)}) was left out`, url: '', why: 'no place or country to put it in', file: `data/research/${f}` }); continue; }
      research.push({ ...e, place, section: e.section || SECTION_OF[e.kind] || 'support', file: `data/research/${f}`, from: { repository: 'PrompTugal/PrompTugal__News__Startups', path: `data/research/${f}`, by: d.by } });
    }
    for (const g of d.gaps || []) gaps.push({ ...g, file: `data/research/${f}` });
  }
  const LICENCES = loadLicences();
  // One entry per section, place and name: the first wins and later sources are kept as "also".
  const seen = new Map();
  const entries = [];
  // Links from research files and imports become hrefs on every page: only http(s) URLs are kept (no javascript:,
  // data: or other schemes), so an entry whose source is not http(s) is dropped and counted (AppSec, 18 Nov 2026).
  let unsafeLinks = 0;
  for (const raw of [...research, ...web.entries.map(w => ({ ...w, file: WEBSITE_FILE }))]) {
    const e = { ...raw, url: safeUrl(raw.url), source_url: safeUrl(raw.source_url) };
    if ((raw.url && !e.url) || (raw.source_url && !e.source_url)) unsafeLinks++;
    if (!e.name || !e.source_url) continue;
    const key = `${e.section}|${e.place}|${slug(e.name)}`;
    if (seen.has(key)) { const first = seen.get(key); const sl = sourceLicence(e, LICENCES); (first.also ||= []).push({ name: e.name, source_url: e.source_url, read_on: e.read_on, source_license: sl, file: e.file, provenance: makeProvenance({ ...e, license: OWN, source_license: sl }, metaOf.get(e.file)) }); continue; }
    const x = { ...e, id: slug(`${e.place}-${e.name}`), license: OWN, source_license: sourceLicence(e, LICENCES) };
    x.provenance = makeProvenance(x, metaOf.get(e.file));
    seen.set(key, x); entries.push(x);
  }
  if (unsafeLinks) console.log(`links dropped (not http or https): ${unsafeLinks}`);
  // Second merge: the same funding round reported under different names or places (see scripts/lib/rounds.mjs).
  const placeNames = Object.fromEntries(places.map(p => [p.id, p.kind === 'country' ? (countryPlaces.length > 1 ? `National (${p.name})` : 'National') : p.name]));
  for (const e of entries) dedupeAlso(e);
  const merged = mergeRounds(entries, placeNames);
  return { web, places, countries: COUNTRIES, entries: merged.entries, gaps, researchFiles, roundMerges: merged.merges, roundsBefore: merged.before };
}

// Place order: the Algarve and its towns first, then Lisbon, Porto, the other places, then each country as a whole.
export function orderPlaces(places, entries) {
  const count = id => entries.filter(e => e.place === id).length;
  const alg = places.filter(p => p.parent === 'algarve').sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  const home = p => (p.country_code || 'PT') === 'PT';
  const rest = places.filter(p => home(p) && !['algarve', 'lisboa', 'porto'].includes(p.id) && p.kind !== 'country' && p.parent !== 'algarve').sort((a, b) => a.name.localeCompare(b.name));
  // Beyond Portugal (Dinis, 18 Nov 2026, "Beyond Portugal: London"): London, then the EU as a whole, then any other place outside Portugal.
  const beyond = places.filter(p => !home(p) && p.kind !== 'country').sort((a, b) => (a.id === 'london' ? -1 : b.id === 'london' ? 1 : 0) || (a.id === 'european-union' ? -1 : b.id === 'european-union' ? 1 : 0) || a.name.localeCompare(b.name));
  const by = id => places.find(p => p.id === id);
  return [
    { group: 'The Algarve', places: [by('algarve'), ...alg].filter(Boolean) },
    { group: 'Lisbon and Porto', places: [by('lisboa'), by('porto')].filter(Boolean) },
    { group: 'Other places', places: rest },
    ...(beyond.length ? [{ group: 'Beyond Portugal', places: beyond }] : []),
    ...places.filter(p => p.kind === 'country').map(c => ({ group: `${c.name} as a whole`, places: [c] })),
  ];
}

// ---------- page frame ----------
const NAV = [['/', 'Front'], ['/places/', 'Places'], ['/support/', 'Incubators and programmes'], ['/calls/', 'Open calls'], ['/funding/', 'Rounds and grants'], ['/companies/', 'Companies'], ['/investors/', 'Investors'], ['/about/', 'How this is made']];
// A page's kind (meta page-type), for readers and the sites bar: fact listings and place pages are "evidence";
// the front page, about, account and design pages are "site". Nothing here is priced: only promptugal.news bills
// (Dinis, 18 November 2026; PrompTugal__News__Website board/guidance/2026-11-18-billing-only-on-the-main-site.md).
const pageType = path => (path === '/account/' || path === '/' || path === '/about/' || path.startsWith('/design/') || path === '/404/') ? 'site' : 'evidence';
// The countries this site covers, in words, from the places that have facts (set in generate()): "Portugal" today,
// "Portugal and the United Kingdom" once London has facts. Nothing in the wording below names a country itself.
let WHERE = '';
let MAP = false; // the shared map ptmap is drawn on /places/ only when scripts/lib/ptmap.mjs has checked it
let BAR = ''; // the sites bar's HTML, rendered at build by scripts/lib/sites-bar.mjs (empty: no bar)
function frame({ path, title, description, body, made, head = '' }) {
  const depth = path.split('/').filter(Boolean).length;
  const up = depth ? '../'.repeat(depth) : './';
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === path || (href !== '/' && path.startsWith(href)) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" type="text/markdown" href="${path}index.md">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<meta name="page-type" content="${pageType(path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/preview.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site.css">
${BAR ? '<link rel="stylesheet" href="/assets/sites-bar/1.2.1/sites-bar.css">\n<script defer src="/assets/sites-bar/1.2.1/sites-bar.js"></script>\n' : ''}<script defer src="/assets/calls.js"></script>
<script defer src="/assets/obs/obs.js"></script>
${head}</head>
<body>
${BAR}
<header class="top"><div class="wrap">
<div class="strip"><span>${esc(WHERE.replace(/^the /, 'The '))}, town by town · <a href="https://promptugal.news/">PrompTugal.news</a></span><span>version __VERSION__ · <a href="${path}index.md">markdown</a></span></div>
<div class="mast"><a href="/" aria-label="PrompTugal.news Startups, front page"><img class="wm-light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="240" height="40"><img class="wm-dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="240" height="40"></a><span class="sub">Startups</span><div class="tools" id="nr-tools"><a class="tool free" id="nr-free-chip" href="/about/#free">Free to read</a></div></div>
<nav class="main" aria-label="Sections">${nav}</nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap cols">
<div><h2>How this page was made</h2>${made || MADE_DEFAULT}</div>
<div><h2>About this site</h2><p>Independent: not an official or government site, and not investment advice. If you think we should not show your data, <a href="https://github.com/PrompTugal/PrompTugal__News__Startups/issues">open an issue</a> and we take it down while we talk. Public facts only, each with its source and the date it was read. Corrections are welcome through the repository's issues. Our text and data: <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a>. Facts taken from other sites stay under each source's licence or terms, linked on every item.</p><div class="row"><p class="meta small">Version __VERSION__ · Code Apache-2.0 · <a href="https://github.com/PrompTugal/PrompTugal__News__Startups">source</a> · <a href="/llms.txt">llms.txt</a> · <a href="/security/">security</a></p></div></div>
</div></footer>
</body>
</html>
`.replaceAll('href="/', `href="${up}`).replaceAll('src="/', `src="${up}`).replaceAll(`href="${up}"`, `href="${up}index.html"`);
}
const MADE_DEFAULT = `<ul><li><b>Code:</b> <code>scripts/generate.mjs</code> builds this page from <code>data/</code> on every push; nothing on it is typed by hand.</li><li><b>Agents:</b> facts gathered by the PrompTugal.news place agents (imported from PrompTugal__News__Website) and by startups.b.research@PrompTugal.dinis (Sonnet); the lead is now startups.b@PrompTugal.dinis (Opus), with sub-agents startups.b.dev@PrompTugal.dinis and startups.b.research@PrompTugal.dinis (Sonnet).</li><li><b>Checked by a person:</b> not yet.</li></ul>`;

const pages = [];
function write(path, html, md) {
  const dir = join(OUT, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(join(dir, 'index.md'), md.trim() + '\n\n---\nVersion __VERSION__. Our text and data: CC BY 4.0. Facts from other sites stay under each source\'s licence or terms. ' + `${SITE}${path}` + '\n');
}
function page(p) { pages.push(p); write(p.path, frame(p), `# ${p.title}\n\n${p.description}\n\n${p.md}`); }

// ---------- pieces ----------
const isMoney = e => e.section === 'funding' || e.section === 'investors';
export function sourceLine(e) {
  const host = (() => { try { return new URL(e.source_url).hostname.replace(/^www\./, ''); } catch { return 'source'; } })();
  const also = (e.also || []).length ? ` · ${e.also.length} more source${e.also.length > 1 ? 's' : ''}` : '';
  const alsoList = (e.also || []).filter(a => safeUrl(a.source_url));
  const alsoHtml = alsoList.length ? `<p class="meta">Also reported by: ${alsoList.map(a => `<a href="${esc(safeUrl(a.source_url))}" rel="nofollow">${esc(a.name || safeUrl(a.source_url))}</a>, read ${esc(nice(a.read_on))}${licenceHtml({ source_license: a.source_license && { ...a.source_license, url: safeUrl(a.source_license.url) } }, esc)}${a.provenance ? `<br>${howHtml(a.provenance, esc, nice, safeUrl, true)}` : ''}`).join('</p><p class="meta">')}</p>` : '';
  return `<p class="src">Source: <a href="${esc(e.source_url)}" rel="nofollow">${esc(host)}</a>, read ${esc(nice(e.read_on))}${also}${licenceHtml(e, esc)}</p>${e.provenance ? `<p class="meta">${howHtml(e.provenance, esc, nice, safeUrl)}</p>` : ''}${alsoHtml}${e.differs ? `<p class="meta">${esc(e.differs)}</p>` : ''}`;
}
export function itemHtml(e, placeName) {
  const tags = `<span class="tag${isMoney(e) ? ' money' : ''}">${esc(e.kind)}</span>${placeName ? `<span class="tag">${esc(placeName)}</span>` : ''}`;
  const name = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.name)}</a>` : esc(e.name);
  const facts = [e.amount && `<span class="amount">${esc(e.amount)}</span>`, e.date && esc(nice(e.date)), e.company && `to ${esc(e.company)}`, e.investors?.length && `with ${esc(e.investors.join(', '))}`, e.status && esc(e.status)].filter(Boolean).join(' · ');
  return `<li class="item" id="${esc(e.id)}"><h3>${name}</h3><p>${tags}${facts ? ` ${facts}` : ''}</p><p>${esc(e.what || '')}</p>${sourceLine(e)}</li>`;
}
export function itemMd(e, placeName) {
  const facts = [e.kind, placeName, e.amount, e.date && nice(e.date), e.company && `to ${e.company}`, e.investors?.length && `with ${e.investors.join(', ')}`, e.status].filter(Boolean).join(' · ');
  return `- **${mdEsc(e.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc(facts)}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.${licenceMd(e)}${howMd(e.provenance, mdEsc, nice, safeUrl)}${alsoMd(e)}${e.differs ? ` ${mdEsc(e.differs)}.` : ''}`;
}
// Other sources of the same fact, each with its own licence or terms link; every URL passes safeUrl().
function alsoMd(e) {
  const l = (e.also || []).filter(a => safeUrl(a.source_url));
  return l.length ? ` Also reported by: ${l.map(a => `${mdEsc(a.name || '')} ${safeUrl(a.source_url)}, read ${nice(a.read_on)}.${licenceMd({ source_license: a.source_license && { ...a.source_license, url: safeUrl(a.source_license.url) } })}${howMd(a.provenance, mdEsc, nice, safeUrl, true)}`.replace(/\s+/g, ' ').trim()).join(' ')}` : '';
}
const byDate = (a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name);
const KIND_ORDER = ['incubator', 'accelerator', 'business nest', 'tech park', 'hub', 'university office', 'coworking', 'space', 'programme', 'call', 'funding programme', 'public desk', 'public body', 'association', 'community', 'mentoring', 'law', 'statistic'];
const kindRank = k => { const i = KIND_ORDER.indexOf(k); return i < 0 ? 99 : i; };


// ---------- open calls ----------
// Which kinds can carry a closing date. A "round" or a plain "grant" with a past date is something that
// happened, not a call; an incubator, programme or accelerator only counts when it states a deadline.
const CALL_KINDS = new Set(['call', 'programme', 'accelerator', 'incubator', 'competition', 'grant call', 'voucher', 'funding programme']);
const STRICT_CALL_KINDS = new Set(['call', 'competition', 'grant call', 'voucher']);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
// The closing date of an entry as a full ISO day, or null. Rule: only call-like kinds; a date written
// in the status ("closes 2027-01-15", "closed 2025-01-19") wins, because entry.date is then the
// publication date; otherwise entry.date counts when it is a full day and the status is not "ongoing".
// A past date on a bare incubator, programme or accelerator is not a closing date unless the status says "closed".
export function closingDate(e) {
  if (!CALL_KINDS.has(e.kind) || e.section === 'funding' && e.kind === 'grant') return null;
  const st = String(e.status || '');
  const m = st.match(/clos\w*\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})/i);
  if (m) return m[1];
  if (/^ongoing/i.test(st) || !ISO_DAY.test(e.date || '')) return null;
  if (/^closed/i.test(st) || STRICT_CALL_KINDS.has(e.kind)) return e.date;
  return e.date >= TODAY_HINT ? e.date : null;
}
let TODAY_HINT = '';
const dayNum = iso => Date.parse(iso + 'T00:00:00Z') / 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const closesText = iso => `${WEEKDAYS[new Date(iso + 'T00:00:00Z').getUTCDay()]} ${nice(iso)}`;
export function classifyCalls(entries, today) {
  TODAY_HINT = today;
  const soon = [], later = [], opening = [], recent = [];
  for (const e of entries) {
    const d = closingDate(e);
    const closed = /^closed/i.test(e.status || '');
    if (d && !closed && d >= today) { const left = dayNum(d) - dayNum(today); (left <= 14 ? soon : later).push({ e, d, left }); }
    else if (d && d < today && dayNum(today) - dayNum(d) <= 30) recent.push({ e, d, left: dayNum(d) - dayNum(today) });
    else if (/^opens/i.test(e.status || '') && CALL_KINDS.has(e.kind)) opening.push({ e, d: null, left: null });
  }
  const bySoonest = (a, b) => a.d.localeCompare(b.d) || a.e.name.localeCompare(b.e.name);
  soon.sort(bySoonest); later.sort(bySoonest); recent.sort((a, b) => b.d.localeCompare(a.d) || a.e.name.localeCompare(b.e.name));
  opening.sort((a, b) => a.e.name.localeCompare(b.e.name));
  return { today, soon, later, opening, recent, open: [...soon, ...later] };
}
const leftText = n => n === 0 ? 'closes today' : `${n} day${n === 1 ? '' : 's'} left`;
export function callHtml(c, placeName) {
  const { e, d, left } = c;
  const tags = `<span class="tag">${esc(e.kind)}</span><span class="tag"><a href="/places/${esc(e.place)}/">${esc(placeName[e.place])}</a></span>${d && left >= 0 && left <= 14 ? '<span class="tag money" data-soon>closing within 14 days</span>' : ''}`;
  const name = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.name)}</a>` : esc(e.name);
  const when = d ? `<span class="when" data-closes="${esc(d)}">${left >= 0 ? `closes ${esc(closesText(d))} (${leftText(left)})` : `closed ${esc(closesText(d))}`}</span>` : esc(e.status || '');
  const facts = [e.amount && `<span class="amount">${esc(e.amount)}</span>`, when, e.organiser && `run by ${esc(e.organiser)}`].filter(Boolean).join(' · ');
  return `<li class="item" id="${esc(e.id)}"><h3>${name}</h3><p>${tags} ${facts}</p><p>${esc(e.what || '')}</p>${sourceLine(e)}</li>`;
}
export function callMd(c, placeName) {
  const { e, d, left } = c;
  const when = d ? (left >= 0 ? `closes ${closesText(d)} (${leftText(left)})${left <= 14 ? ', closing within 14 days' : ''}` : `closed ${closesText(d)}`) : e.status;
  const facts = [e.kind, placeName[e.place], e.amount, when, e.organiser && `run by ${e.organiser}`].filter(Boolean).join(' · ');
  return `- **${mdEsc(e.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc(facts)}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.${licenceMd(e)}${howMd(e.provenance, mdEsc, nice, safeUrl)}`;
}
// A short box: the next closing calls, each linking to the list.
export function callsBoxMd(list, placeName) {
  return list.map(({ e, d, left }) => `- ${mdEsc(e.name)} (${placeName[e.place]}): closes ${closesText(d)}${left <= 14 ? ` (${leftText(left)})` : ''}`).join('\n') + `\n\nAll open calls: ${SITE}/calls/`;
}
export function callsBoxHtml(list, heading, placeName, showPlace) {
  if (!list.length) return '';
  return `<div class="note"><p><strong>${heading}</strong></p><ul class="list">${list.map(({ e, d, left }) => `<li>${esc(e.name)}${showPlace ? ` (${esc(placeName[e.place])})` : ''}: <span class="when" data-closes="${esc(d)}">closes ${esc(closesText(d))}${left <= 14 ? ` (${esc(leftText(left))})` : ''}</span></li>`).join('')}</ul><p><a href="/calls/">All open calls</a></p></div>`;
}

// ---------- build ----------
export function generate({ bar = '', entry = null, map = false } = {}) {
  BAR = bar;
  MAP = map;
  {
    const d0 = loadData(), used = new Set(d0.entries.map(e => (d0.places.find(p => p.id === e.place) || {}).country).filter(Boolean));
    const names = [...used].sort((a, b) => a === 'portugal' ? -1 : b === 'portugal' ? 1 : a.localeCompare(b)).map(id => (d0.countries[id] || {}).name || id);
    WHERE = names.length <= 1 ? (names[0] || 'Portugal') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const { web, places, entries, gaps, researchFiles, roundMerges, roundsBefore } = loadData();
  const dropped = roundMerges.reduce((n, m) => n + m.names.length - 1, 0);
  console.log(`rounds merged: ${roundMerges.reduce((n, m) => n + m.names.length, 0)} entries into ${roundMerges.length} (${roundsBefore} round entries before, ${roundsBefore - dropped} after)`);
  for (const m of roundMerges) console.log(`  merge: ${m.company} | dates ${m.dates.map(d => d || 'none').join(', ')} | ${m.names.join(' + ')} | ${m.sources.join(' ')}`);
  const placeName = Object.fromEntries(places.map(p => [p.id, p.id === 'portugal' ? 'National' : p.name]));
  const groups = orderPlaces(places, entries);
  const sec = s => entries.filter(e => e.section === s);
  const counts = { all: entries.length, support: sec('support').length, funding: sec('funding').length, companies: sec('companies').length, investors: sec('investors').length, places: new Set(entries.map(e => e.place)).size, sources: new Set(entries.map(e => { try { return new URL(e.source_url).hostname; } catch { return ''; } })).size };
  const algarveIds = new Set(['algarve', ...places.filter(p => p.parent === 'algarve').map(p => p.id)]);
  const today = new Date().toISOString().slice(0, 10);
  const calls = classifyCalls(entries, today);
  const ctx = { calls, callsBoxHtml, callsBoxMd, entries, places, placeName, groups, counts, gaps, esc, nice, itemHtml, itemMd, sourceLine, algarveIds, byDate, web, where: WHERE };

  // Front page: the three variations as views (Dinis, 19 November 2026: "actually all free are quite important,
  // can we put them as 'views' for the home page?"). Tabs work without script (radio buttons and CSS); a few
  // lines of script keep the chosen view in the address (#ledger, #places, #path) so a view can be linked.
  const VIEW_SLUG = { a: 'ledger', b: 'places', c: 'path' };
  const fv = Object.keys(variants).map(k => ({ k, slug: VIEW_SLUG[k] || k, ...variants[k](ctx) }));
  const asView = h => h.replace(/<h1>/g, '<h2 class="vh">').replace(/<\/h1>/g, '</h2>').replace(/<li class="item" id="[^"]*"/g, '<li class="item"');
  const frontHtml = `<h1 class="sr">PrompTugal.news Startups: startups and their funding in ${esc(WHERE)}, place by place</h1>
<div class="views">
${fv.map((v, i) => `<input type="radio" name="view" id="view-${v.slug}" class="vr"${i === 0 ? ' checked' : ''}>`).join('')}
<div class="vtabs"><span class="meta">View:</span>${fv.map(v => `<label for="view-${v.slug}" title="${esc(v.idea)}">${esc(v.name)}</label>`).join('')}</div>
${fv.map(v => `<section class="view view-${v.slug}" aria-label="${esc(v.name)}">${asView(v.html)}</section>`).join('\n')}
</div>
<script>(function(){var v=${JSON.stringify(fv.map(v => v.slug))};function set(){var h=location.hash.slice(1);if(v.indexOf(h)>=0)document.getElementById('view-'+h).checked=true}set();addEventListener('hashchange',set);v.forEach(function(s){document.getElementById('view-'+s).addEventListener('change',function(){history.replaceState(null,'','#'+s)})})})();</script>`;
  const frontMd = `Three views of the same data: ${fv.map(v => `${v.name} (${SITE}/#${v.slug})`).join(', ')}.\n\n${fv.map(v => `# View: ${v.name}\n\n${v.idea}\n\n${v.md}`).join('\n\n')}`;
  page({ path: '/', title: `PrompTugal.news Startups: startups and their funding in ${WHERE}, place by place`, description: `Incubators, accelerators, public programmes, rounds and grants across ${WHERE}, starting with the Algarve, each fact with its source and the date read.`, body: frontHtml, md: frontMd });

  // Design: the three variations side by side.
  for (const k of Object.keys(variants)) {
    const v = variants[k](ctx);
    page({ path: `/design/${k}/`, title: `Front page, variation ${k.toUpperCase()}: ${v.name}`, description: `Design variation ${k.toUpperCase()} of the front page (${v.name}), for Dinis to choose.`, body: `<p class="note">Design variation ${k.toUpperCase()}: ${esc(v.name)}. Now one of the three views of the <a href="/">front page</a>; <a href="/design/">see all three</a>.</p>${v.html}`, md: `One of the three views of the front page.\n\n${v.md}` });
  }
  const vs = Object.keys(variants).map(k => [k, variants[k](ctx)]);
  page({ path: '/design/', title: 'The front page\'s three views', description: 'Three views of the front page with the same real data, side by side: the ledger, the map of places and the founder\'s path.', body: `<p class="kicker">Design pass 1 · chosen: all three</p><h1>The front page's three views</h1><p class="lede">The same data, three ways to open the site. At Dinis's word (19 November 2026) all three are now views of the front page, chosen with the tabs at its top.</p><div class="grid">${vs.map(([k, v]) => `<div class="card"><p class="kicker">Variation ${k.toUpperCase()}</p><h3><a href="/design/${k}/">${esc(v.name)}</a></h3><p>${esc(v.idea)}</p></div>`).join('')}</div><div class="cols" style="margin-top:1.5rem">${vs.map(([k]) => `<div><p class="meta">Variation ${k.toUpperCase()}</p><iframe src="/design/${k}/index.html" title="Variation ${k.toUpperCase()}" style="width:100%;height:70vh;border:1px solid var(--rule);background:var(--paper)" loading="lazy"></iframe></div>`).join('')}</div>`, md: vs.map(([k, v]) => `- Variation ${k.toUpperCase()}, ${v.name} (${SITE}/design/${k}/): ${v.idea}`).join('\n') });

  // Places
  const placeCounts = id => ['support', 'funding', 'companies', 'investors'].map(s => entries.filter(e => e.place === id && e.section === s).length);
  // The shared map (ptmap, scripts/lib/ptmap.mjs; Dinis, 19 Nov 2026): Portugal big, one dot per place with facts, sized by its count.
  // Portugal's places are dots; London is the small inset once it has facts (data/research/london.json, 20 Nov 2026).
  // The EU is the Brussels inset once it has facts (data/research/eu.json, 21 Nov 2026).
  const AT = (() => { try { return JSON.parse(readFileSync('data/map/places-at.json', 'utf8')).at || {}; } catch { return {}; } })();
  const mapPlaces = places.filter(p => p.kind !== 'country' && (p.country_code || 'PT') === 'PT' && (p.at || AT[p.id])).map(p => ({ id: p.id, name: p.name, at: p.at || AT[p.id], href: `${SITE}/places/${p.id}/`, n: placeCounts(p.id).reduce((a, b) => a + b, 0) })).filter(p => p.n > 0);
  const londonN = places.some(p => p.id === 'london') ? placeCounts('london').reduce((a, b) => a + b, 0) : 0;
  const euN = places.some(p => p.id === 'european-union') ? placeCounts('european-union').reduce((a, b) => a + b, 0) : 0;
  const mapData = { places: mapPlaces, label: 'Places with startup facts on this site', ...(londonN ? { london: { href: `${SITE}/places/london/`, n: londonN } } : {}), ...(euN ? { eu: { href: `${SITE}/places/european-union/`, n: euN } } : {}) };
  const mapHtml = MAP && mapPlaces.length ? `<div id="ptmap" class="ptmap-host"></div><script type="application/json" id="ptmap-data">${JSON.stringify(mapData).replace(/</g, '\\u003c')}</script>` : '';
  const mapHead = mapHtml ? `<link rel="stylesheet" href="/${MAP_DIR}/ptmap.css">\n<script defer src="/${MAP_DIR}/ptmap.js"></script>\n<script defer src="/assets/ptmap-init.js"></script>\n` : '';
  page({ path: '/places/', head: mapHead, title: 'Places', description: 'Each place\'s incubators, programmes, rounds, grants, companies and investors, starting with the Algarve.', body: `<p class="kicker">Place by place</p><h1>Places</h1><p class="lede">Start with the Algarve, then Lisbon and Porto. A place with nothing yet is a gap we have not filled, not a place with no startups.</p>${mapHtml}${groups.map(g => `<h2>${esc(g.group)}</h2><div class="tablewrap"><table><thead><tr><th>Place</th><th>Support</th><th>Rounds and grants</th><th>Companies</th><th>Investors</th></tr></thead><tbody>${g.places.map(p => { const c = placeCounts(p.id); return `<tr><td><a href="/places/${p.id}/">${esc(p.name)}</a></td>${c.map(n => `<td>${n || '<span class="meta">none yet</span>'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`).join('')}`, md: groups.map(g => `## ${g.group}\n\n${g.places.map(p => { const c = placeCounts(p.id); return `- ${p.name} (${SITE}/places/${p.id}/): ${c[0]} support, ${c[1]} rounds and grants, ${c[2]} companies, ${c[3]} investors`; }).join('\n')}`).join('\n\n') });

  const SECTIONS = [['support', 'Incubators, accelerators and programmes'], ['funding', 'Rounds, grants and public money'], ['companies', 'Companies'], ['investors', 'Investors']];
  for (const p of places) {
    const mine = entries.filter(e => e.place === p.id);
    const children = places.filter(c => c.parent === p.id);
    const parent = places.find(x => x.id === p.parent);
    const sorted = s => mine.filter(e => e.section === s).sort(s === 'funding' ? byDate : (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name));
    const html = `<p class="kicker">${esc(p.kind || 'place')}${parent ? ` in <a href="/places/${parent.id}/">${esc(parent.name)}</a>` : ''}</p><h1>${esc(p.name)}</h1>
<p class="lede">${mine.length ? `${mine.length} public facts about starting and funding a company in ${esc(p.name)}: who supports founders, what money has gone where, and the companies and investors named.` : `Nothing collected for ${esc(p.name)} yet. That is a gap in our research, not a finding.`}</p>
${callsBoxHtml(calls.open.filter(c => c.e.place === p.id), `Open now: ${calls.open.filter(c => c.e.place === p.id).length} call${calls.open.filter(c => c.e.place === p.id).length === 1 ? '' : 's'}`, placeName, false)}
${children.length ? `<p class="meta">Places within: ${children.map(c => `<a href="/places/${c.id}/">${esc(c.name)}</a>`).join(' · ')}</p>` : ''}
${SECTIONS.map(([s, label]) => { const l = sorted(s); return `<h2>${label}</h2>${l.length ? `<ul class="list">${l.map(e => itemHtml(e)).join('')}</ul>` : '<p class="meta">None collected yet.</p>'}`; }).join('\n')}`;
    const md = SECTIONS.map(([s, label]) => { const l = sorted(s); return `## ${label}\n\n${l.length ? l.map(e => itemMd(e)).join('\n') : 'None collected yet.'}`; }).join('\n\n');
    const myCalls = calls.open.filter(c => c.e.place === p.id);
    const md2 = (myCalls.length ? `## Open now: ${myCalls.length} call${myCalls.length === 1 ? '' : 's'}\n\n${callsBoxMd(myCalls, placeName)}\n\n` : '') + md;
    page({ path: `/places/${p.id}/`, title: `${p.name}: startups, incubators and funding`, description: `Incubators, programmes, rounds, grants, companies and investors in ${p.name}, each with its source and the date read.`, body: html, md: md2 });
  }

  // Section pages, grouped by place in place order.
  const placeOrder = groups.flatMap(g => g.places.map(p => p.id));
  const bySection = (s, intro, sortFn) => {
    const l = sec(s);
    const used = placeOrder.filter(id => l.some(e => e.place === id));
    const html = used.map(id => `<h2 id="${id}">${esc(placeName[id])}</h2><ul class="list">${l.filter(e => e.place === id).sort(sortFn).map(e => itemHtml(e)).join('')}</ul>`).join('');
    const md = used.map(id => `## ${placeName[id]}\n\n${l.filter(e => e.place === id).sort(sortFn).map(e => itemMd(e)).join('\n')}`).join('\n\n');
    return { html: `${intro}<p class="meta">Jump to: ${used.map(id => `<a href="#${id}">${esc(placeName[id])}</a>`).join(' · ')}</p>${html}`, md };
  };
  const kindSort = (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name);
  let s = bySection('support', `<p class="kicker">Support</p><h1>Incubators, accelerators and programmes</h1><p class="lede">Where a founder can get space, mentoring, a programme or a public desk, place by place. Open calls carry their dates; check the organisation's own page before applying.</p>`, kindSort);
  page({ path: '/support/', title: `Incubators, accelerators and programmes in ${WHERE}`, description: `Council incubators, university offices, accelerators and public programmes for founders across ${WHERE}, starting with the Algarve.`, body: s.html, md: s.md });

  // Open calls: what a founder can apply to now, soonest closing first. Built from the same merged entries.
  const grp = (title, list, empty) => `<h2>${title} <span class="meta">(${list.length})</span></h2>${list.length ? `<ul class="list">${list.map(c => callHtml(c, placeName)).join('')}</ul>` : `<p class="meta">${empty}</p>`}`;
  const grpMd = (title, list) => `## ${title} (${list.length})\n\n${list.length ? list.map(c => callMd(c, placeName)).join('\n') : 'None.'}`;
  page({ path: '/calls/', title: `Open calls for startups in ${WHERE}`, description: `${calls.open.length} calls open to applications on ${nice(today)}, soonest closing first, each with its source and the date read.`,
    body: `<p class="kicker">Apply now</p><h1>Open calls: what you can apply to now</h1><p class="lede">Calls and programmes with a closing date on or after ${esc(nice(today))}, soonest first. Dates are as each source states them on the day we read it; check the source before applying, as dates move.</p><p class="meta" id="calls-asof" data-built="${esc(today)}">This list was built on ${esc(nice(today))}; the days left are as of that day.</p>
${grp('Closing within 14 days', calls.soon, 'None closing in the next 14 days.')}${grp('Closing later', calls.later, 'None.')}${grp('Opening soon', calls.opening, 'None announced in our sources.')}${grp('Recently closed', calls.recent, 'Nothing closed in the last 30 days.')}`,
    md: `Calls and programmes with a closing date on or after ${nice(today)}, soonest first. Dates are as each source states them on the day we read it; check the source before applying.\n\n${grpMd('Closing within 14 days', calls.soon)}\n\n${grpMd('Closing later', calls.later)}\n\n${grpMd('Opening soon', calls.opening)}\n\n${grpMd('Recently closed', calls.recent)}` });

  const funding = sec('funding').sort(byDate);
  s = bySection('funding', `<p class="kicker">Money</p><h1>Rounds, grants and public money</h1><p class="lede">Investment rounds, grants and public programmes as the press or the organisations reported them. Amounts are as the source states them; we do not convert or total them.</p><div class="note">Latest dated: ${funding.filter(e => e.date).slice(0, 3).map(e => `${esc(e.name)} (${esc(nice(e.date))})`).join('; ')}.</div>`, byDate);
  page({ path: '/funding/', title: `Startup rounds, grants and public money in ${WHERE}`, description: `Investment rounds, grants and public funding programmes for startups in ${WHERE}, place by place, each with its source.`, body: s.html, md: s.md });

  s = bySection('companies', `<p class="kicker">Companies</p><h1>Companies</h1><p class="lede">Startups named in our sources, by the place they are based. Being listed here is not an endorsement; it means a public source names them.</p>`, (a, b) => a.name.localeCompare(b.name));
  page({ path: '/companies/', title: `Startups in ${WHERE}, place by place`, description: `Startups named in public sources, by the place in ${WHERE} they are based, each with its source.`, body: s.html, md: s.md });

  const inv = buildInvestors(entries);
  const eur = n => `EUR ${n.toLocaleString('en-GB')}`;
  const dealHtml = d => `<li><a href="/funding/#${esc(d.id)}">${esc(d.company || d.name)}</a>${d.amount ? ` · ${esc(d.amount)}` : ''}${d.date ? ` · ${esc(nice(d.date))}` : ''}</li>`;
  const dealMd = d => `  - [${mdEsc(d.company || d.name)}](${SITE}/funding/#${d.id})${d.amount ? ` · ${mdEsc(d.amount)}` : ''}${d.date ? ` · ${nice(d.date)}` : ''}`;
  const invCard = r => { const e = r.main; return `<li class="item" id="${esc(e.id)}"><h3>${e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(r.name)}</a>` : esc(r.name)}</h3><p><span class="tag money">${esc(e.kind)}</span><span class="tag">${esc(placeName[e.place])}</span></p><p>${esc(e.what || '')}</p>${sourceLine(e)}${r.others.length ? `<p class="meta">Also listed: ${r.others.map(o => `${esc(o.name)} (${esc(placeName[o.place])}), <a href="${esc(o.source_url)}" rel="nofollow">source</a>, read ${esc(nice(o.read_on))}`).join('; ')}</p>` : ''}<p class="meta">Named deals in our data</p>${r.deals.length ? `<ul>${r.deals.map(dealHtml).join('')}</ul>` : `<p>None in our data yet</p>`}</li>`; };
  const invCardMd = r => { const e = r.main; return `- **${mdEsc(r.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc([e.kind, placeName[e.place]].join(' · '))}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.${licenceMd(e)}${howMd(e.provenance, mdEsc, nice, safeUrl)}${r.others.length ? ` Also listed: ${r.others.map(o => `${mdEsc(o.name)} (${placeName[o.place]}), ${o.source_url}, read ${nice(o.read_on)}`).join('; ')}.` : ''}\n  Named deals in our data:${r.deals.length ? `\n${r.deals.map(dealMd).join('\n')}` : ' None in our data yet'}`; };
  const tableRows = inv.rows.filter(r => r.deals.length).sort((a, b) => b.deals.length - a.deals.length || a.name.localeCompare(b.name));
  const summary = `${inv.groups.filter(g => g.rows.length).map(g => `${g.title}: ${g.rows.length}`).join('; ')}. ${inv.rows.length} investors in all, with ${inv.dealsLinked} named deals linked (${inv.distinctRounds} different round entries; one round names several investors).`;
  const thin = `The data is thin and growing: investors are listed only where a public page we read names them, and a deal is linked only where our own round entries name the investor. Nothing here is a full list. See the gaps on`;
  const tblNote = `Counts are round entries in our data that name the investor; one round counts for each investor it names. Entries for the same deal are merged when the company and the date, or the company and the amount within 30 days, match; a duplicate we could not match may remain. We do not total the amounts: a round's size is not the investor's own share.`;
  s = { html: `<p class="kicker">Investors · a section for now</p><h1>Investors</h1><p class="lede">Venture funds, angel networks and public investors seen in rounds in ${esc(WHERE)}. This data is still thin: we are collecting more, and it may get a site of its own.</p>
<div class="note"><p>${esc(summary)}</p><p>${esc(thin)} <a href="/about/#gaps">How this is made</a>.</p></div>
<p class="meta">Jump to: ${inv.groups.filter(g => g.rows.length).map((g, i) => `<a href="#g${GROUP_IDX(g.title)}">${esc(g.title)}</a>`).join(' · ')} · <a href="#by-investor">Deals by investor</a></p>
${inv.groups.filter(g => g.rows.length).map(g => `<h2 id="g${GROUP_IDX(g.title)}">${esc(g.title)} <span class="meta">(${g.rows.length})</span></h2><ul class="list">${g.rows.map(invCard).join('')}</ul>`).join('')}
<h2 id="by-investor">Deals by investor</h2><p class="meta">${esc(tblNote)}</p><div class="tablewrap"><table><thead><tr><th>Investor</th><th>Named deals</th></tr></thead><tbody>${tableRows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.deals.length}</td></tr>`).join('')}</tbody></table></div>`,
  md: `${summary}\n\n${thin} ${SITE}/about/\n\n${inv.groups.filter(g => g.rows.length).map(g => `## ${g.title} (${g.rows.length})\n\n${g.rows.map(invCardMd).join('\n')}`).join('\n\n')}\n\n## Deals by investor\n\n${tblNote}\n\n| Investor | Named deals |\n| --- | --- |\n${tableRows.map(r => `| ${mdEsc(r.name)} | ${r.deals.length} |`).join('\n')}` };
  page({ path: '/investors/', title: `Investors backing startups in ${WHERE}`, description: `Venture funds, angel networks and public investors active in startups in ${WHERE}, with the deals in our data that name them, each with its source. A section for now.`, body: s.html, md: s.md });

  // How this is made
  const fromWeb = entries.filter(e => e.from?.repository?.endsWith('Website')).length;
  const lic = { 'published licence': 0, 'terms page': 0, 'terms page not found yet': 0, 'no source link': 0 };
  const missing = new Map();
  for (const e of entries) { lic[e.source_license.status]++; if (e.source_license.status === 'terms page not found yet') { const h = new URL(e.source_license.url).hostname.replace(/^www\./, ''); missing.set(h, (missing.get(h) || 0) + 1); } }
  const missingList = [...missing].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const licText = `Our text and data are CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Facts taken from other sites stay under each source's published licence or, where none is published, its terms, linked on every item. Of ${entries.length} entries: ${lic['published licence']} with a published source licence, ${lic['terms page']} with a terms page, ${lic['terms page not found yet']} with terms not found yet${lic['no source link'] ? `, ${lic['no source link']} with no source link` : ''}.`;
  const aboutHtml = `<p class="kicker">Provenance</p><h1>How this is made</h1>
<p class="lede">Every fact on this site is a public one, with the page it came from and the date it was read. Nothing is typed into a page by hand: code builds every page from the data files in the repository.</p>
<h2>What runs as code</h2><ul><li><code>scripts/import-website.mjs</code> reads the place research of <a href="https://promptugal.news/">PrompTugal.news</a> (its <code>data/by-place/</code> files and the companies it mapped around Web Summit 2026), keeps only the public fields, and writes <code>data/from-website.json</code>. This import is from commit <code>${esc(web.source.commit.slice(0, 7))}</code>, made on ${esc(nice(web.imported_on))}: ${fromWeb} facts.</li><li><code>scripts/generate.mjs</code> merges it with the team's own research (${researchFiles.map(f => `<code>data/research/${esc(f)}</code>`).join(', ') || 'none yet'}) and builds every page, its markdown twin, <code>llms.txt</code> and the sitemap.</li><li><code>scripts/validate.mjs</code> (the gate) and <code>scripts/leak-scan.mjs</code> run on every push; the site does not deploy if either fails.</li></ul>
<h2>What agents wrote</h2><ul><li>The place agents of PrompTugal.news (place.algarve@, place.faro@ and the others, on Claude) read and summarised the sources imported here.</li><li>startups.research@PrompTugal.dinis (Claude Sonnet) read new sources on 17 November 2026 for the Algarve, Lisbon, Porto and national programmes.</li><li>startups@PrompTugal.dinis (Claude Opus) wrote the first code, the page text and reviewed the research.</li><li>From 18 November 2026 the lead is startups.b@PrompTugal.dinis (Claude Opus), with sub-agents startups.b.dev@PrompTugal.dinis (code, Sonnet) and startups.b.research@PrompTugal.dinis (research, Sonnet).</li></ul>
<h2>What a person checked</h2><p>Nothing yet. Dinis Cruz started the site; no person has reviewed its facts. Read each fact against its source.</p>
<h2>Provenance</h2><p>Every item shows how we know it: who read it, how, when, in which file, and under which licence. <code>data/facts.json</code> carries the same in a <code>provenance</code> field on every entry and every other source of it.</p>
<h2>Security</h2><p>Security findings, ours included, and the threat models of what runs on its own here (the build, the research pulls, the page-view lane) are on <a href="/security/">the security page</a>.</p>
<h2>Taking data down</h2><p>Everything here is public and linked to its source. If you think we should not show your data, open a public issue on <a href="https://github.com/PrompTugal/PrompTugal__News__Startups/issues">the site's repository</a>: we take it down while we talk.</p>
<h2>Rules we keep</h2><ul><li>Public facts only. People only as public and professional; no personal contacts.</li><li>Sites read politely, with a named agent and pauses. A refusal (403, bot check, robots.txt) is respected and recorded as a gap, never worked around.</li><li>Amounts as the source states them. A place with no entries is a gap in our research, not a finding.</li></ul>
<h2 id="licences">Licences</h2><p>Our text and data are <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a>. Facts taken from other sites stay under each source's published licence or, where none is published, its terms, linked on every item. Of ${entries.length} entries: ${lic['published licence']} with a published source licence, ${lic['terms page']} with a terms page, ${lic['terms page not found yet']} with terms not found yet${lic['no source link'] ? `, ${lic['no source link']} with no source link` : ''}.</p>${missingList.length ? `<p class="meta">Gap list, sources whose terms we have not found yet (entries): ${missingList.map(([h, n]) => `${esc(h)} (${n})`).join(', ')}.</p>` : ''}
<h2 id="free">Free to read</h2><p>Every page here is free: nothing is charged, there is no reading meter and no advert. Only <a href="https://promptugal.news/">PrompTugal.news</a> charges for reading (pay for what you read). This site may therefore show data whose terms allow non-commercial use only, each item with its licence and provenance.</p>
<h2>Page views are counted</h2><p>This site counts page views and reading time, publicly, to learn what is read. Each count says the page, the referring site (host only), the time to the minute, the site version, a random id that ends with the tab, the screen size class, the browser's language and time zone, and the country, worked out in your browser from its time zone, with no lookup. No IP address, no cookie and no user-agent string is kept, and no one is asked where you are. Do Not Track and Global Privacy Control are respected, and the Pause switch in the footer turns counting off on this device. The lane is called <code>startups</code>. What is counted is explained at <a href="https://promptugal.news/newsroom/observability/index.html">promptugal.news</a>.</p>
<h2 id="gaps">Gaps we know about</h2>${gaps.length ? `<ul class="list">${gaps.map(g => `<li class="item"><p>${esc(g.what)}</p><p class="src">${/^https?:\/\//.test(g.url || '') ? `<a href="${esc(g.url)}" rel="nofollow">${esc(g.url)}</a> · ` : g.url ? `${esc(g.url)} · ` : ''}${esc(g.why || '')}</p></li>`).join('')}</ul>` : '<p class="meta">None recorded yet.</p>'}
<h2>Counts</h2><div class="stats"><div><b>${counts.all}</b><span>facts</span></div><div><b>${counts.sources}</b><span>source sites</span></div><div><b>${counts.places}</b><span>places with facts</span></div></div>`;
  page({ path: '/about/', title: 'How this site is made', description: 'What runs as code, what agents wrote, what a person checked, and the gaps we know about.', body: aboutHtml, md: `## What runs as code\n\n- scripts/import-website.mjs imports PrompTugal__News__Website data (commit ${web.source.commit.slice(0, 7)}, ${fromWeb} facts).\n- scripts/generate.mjs builds the pages from data/.\n- scripts/validate.mjs and scripts/leak-scan.mjs gate every push.\n\n## What agents wrote\n\n- PrompTugal.news place agents (imported research).\n- startups.research@PrompTugal.dinis (Claude Sonnet): new research, 17 November 2026.\n- startups@PrompTugal.dinis (Claude Opus): first code, text, review.\n- startups.b@PrompTugal.dinis (Claude Opus, lead from 18 November 2026) with sub-agents startups.b.dev and startups.b.research (Claude Sonnet).\n\n## Licences\n\n${licText}${missingList.length ? ` Terms not found yet: ${missingList.map(([h, n]) => `${h} (${n})`).join(', ')}.` : ''}\n\n## Free to read\n\nEvery page here is free: nothing is charged, there is no reading meter and no advert. Only https://promptugal.news/ charges for reading. This site may therefore show data whose terms allow non-commercial use only, each item with its licence and provenance.\n\n## Page views are counted\n\nPage views and reading time are counted publicly: page, referring host, time to the minute, version, a random id that ends with the tab, screen size class, language, time zone, and the country, worked out in the browser from its time zone with no lookup. No IP address, cookie or user-agent string is kept. Do Not Track and Global Privacy Control are respected, and a Pause switch in the footer turns it off. Lane: startups.\n\n## What a person checked\n\nNothing yet.\n\n## Taking data down\n\nIf you think we should not show your data, open a public issue at https://github.com/PrompTugal/PrompTugal__News__Startups/issues and we take it down while we talk.\n\n## Gaps\n\n${gaps.map(g => `- ${g.what} (${g.url || ''}; ${g.why || ''})`).join('\n') || 'None recorded yet.'}` });

  // Security: every finding, ours included, and the threat models (Dinis, 18 Nov 2026; PrompTugal__News__Website
  // board/guidance/2026-11-18-security-findings-published.md). An open finding shows only its title, severity and state.
  {
    const F = existsSync('data/security/findings.json') ? JSON.parse(readFileSync('data/security/findings.json', 'utf8')).findings : [];
    const TM = existsSync('docs/threat-models') ? readdirSync('docs/threat-models').filter(f => f.endsWith('.md')).sort() : [];
    const REPO = 'https://github.com/PrompTugal/PrompTugal__News__Startups/blob/dev/';
    const title = f => (readFileSync(join('docs/threat-models', f), 'utf8').match(/^# (.+)$/m) || [, f])[1];
    const full = x => x.state !== 'open';
    const fHtml = x => `<li class="item"><h3>${esc(x.title)}</h3><p><span class="tag">${esc(x.severity)}</span><span class="tag">${esc(x.state)}</span>${full(x) ? ` found ${esc(nice(x.found))} by ${esc(x.found_by)}` : ''}</p>${full(x) ? `<p>${esc(x.detail)}</p><p><b>Fix:</b> ${esc(x.fix)} Commit <a href="https://github.com/PrompTugal/PrompTugal__News__Startups/commit/${esc(x.fix_commit)}">${esc(x.fix_commit)}</a>, ${esc(nice(x.fixed))}. File: <code>${esc(x.file)}</code>.</p>` : '<p class="meta">Details are published once it is fixed.</p>'}</li>`;
    const fMd = x => `- **${x.title}** (${x.severity}, ${x.state})` + (full(x) ? `: found ${x.found} by ${x.found_by}. ${x.detail} Fix: ${x.fix} Commit ${x.fix_commit}, ${x.fixed}. File: ${x.file}.` : ': details published once fixed.');
    page({ path: '/security/', title: 'Security on this site', description: 'Every security finding on startups.promptugal.news, ours included, and the threat models of what runs on its own.',
      body: `<p class="kicker">Security</p><h1>Security findings and threat models</h1>
<p class="lede">Every vulnerability, bug and breach we find on this site is published here, with its severity, when it was found and by whom, and the fix. An open finding shows only its title, severity and state until it is fixed. The log for every PrompTugal.news site is at <a href="https://promptugal.news/security/">promptugal.news/security/</a>.</p>
<h2>Findings (${F.length})</h2>${F.length ? `<ul class="list">${F.map(fHtml).join('')}</ul>` : '<p class="meta">None yet.</p>'}
<h2>Threat models</h2><p>What runs on its own here, what it reads and writes, what it trusts, and what could go wrong.</p><ul>${TM.map(f => `<li><a href="${REPO}docs/threat-models/${esc(f)}">${esc(title(f))}</a></li>`).join('')}</ul>
<h2>Report a problem</h2><p>Open a public issue on <a href="https://github.com/PrompTugal/PrompTugal__News__Startups/issues">the site's repository</a>. Please do not post the details of an open vulnerability there; say that you have found one and we will reply.</p>`,
      md: `Every security finding on this site, ours included. Central log: https://promptugal.news/security/\n\n## Findings\n\n${F.map(fMd).join('\n') || 'None yet.'}\n\n## Threat models\n\n${TM.map(f => `- ${title(f)}: ${REPO}docs/threat-models/${f}`).join('\n')}` });
  }

  // Account: this site has no account and charges nothing (only promptugal.news bills). The page stays so that
  // links made while it had a meter still lead somewhere. Not in the main NAV.
  page({ path: '/account/', title: 'No account needed', description: 'This site is free to read: there is no account, no balance and no charge.', body: `<p class="kicker">Free to read</p><h1>No account needed</h1>
<p class="lede">This site is free to read. There is no account, no balance and no charge. Only <a href="https://promptugal.news/">PrompTugal.news</a> charges for reading, and its account page is <a href="https://promptugal.news/account/">there</a>.</p>
<p class="meta">Until 18 November 2026 this site had a reading meter. A balance it kept is still in your browser's storage for this site; nothing uses it, and clearing this site's data removes it.</p>`, md: `This site is free to read. There is no account, no balance and no charge. Only https://promptugal.news/ charges for reading; its account page is https://promptugal.news/account/.\n\nUntil 18 November 2026 this site had a reading meter. A balance it kept is still in your browser's storage for this site; nothing uses it, and clearing this site's data removes it.` });

  // 404, llms.txt, sitemap, data
  write('/404/', frame({ path: '/404/', title: 'Page not found', description: 'This page does not exist.', body: '<h1>Page not found</h1><p><a href="/">Back to the front page</a>.</p>' }), '# Page not found');
  writeFileSync(join(OUT, '404.html'), readFileSync(join(OUT, '404/index.html'), 'utf8').replaceAll('href="../', 'href="/').replaceAll('src="../', 'src="/'));
  writeFileSync(join(OUT, 'llms.txt'), `# PrompTugal.news Startups\n\n> Startups and their funding in ${WHERE}, place by place: incubators, accelerators, public programmes, rounds and grants, companies and investors. Public facts only, each with its source and the date read. Every page has a markdown twin at index.md. Licences: our text and data are CC BY 4.0; facts taken from other sites stay under each source's licence or terms, linked on every item (fields license and source_license in facts.json). Version __VERSION__.\n\n## Pages\n\n${pages.filter(p => !p.path.startsWith('/design/')).map(p => `- [${p.title}](${SITE}${p.path}index.md): ${p.description}`).join('\n')}\n\n## Data\n\n- [All facts as JSON](${SITE}/data/facts.json): every entry with its source, read date and where it came from.\n\n## Optional\n\n${pages.filter(p => p.path.startsWith('/design/')).map(p => `- [${p.title}](${SITE}${p.path}index.md)`).join('\n')}\n`);
  // The site's preview for the shared sites bar and social cards (Dinis, 18 Nov 2026 ~22:00 UTC; PrompTugal__News__Website
  // board/guidance/2026-11-18-the-sites-bar.md; designer@'s spec SB6): /preview.svg, 320 by 180, from designer@'s template
  // (scripts/lib/sites-bar/preview-template.svg.txt), three live numbers from the same counts as the pages, every value
  // escaped, no script, no external reference, system fonts only. /preview.png is the same at 2x, rendered in CI.
  // preview.json keeps all six counts, with provenance and licence.
  {
    const figs = [[calls.open.length, 'calls open to apply to'], [counts.funding, 'rounds and grants'], [counts.places, 'places'], [counts.all, 'facts with their sources'], [counts.investors, 'investors'], [counts.sources, 'source sites']];
    const accent = entry && /^#[0-9a-f]{6}$/i.test(entry.accent || '') ? entry.accent : '#d4761a';
    const line = entry && typeof entry.line === 'string' ? entry.line : 'startups and their funding, by place';
    const fill = { site: 'PrompTugal.news Startups', line, accent, SITE: 'STARTUPS', n1: figs[0][0], label1: figs[0][1], n2: figs[1][0], label2: figs[1][1], n3: figs[2][0], label3: figs[2][1], read_at: nice(today), licence: 'CC BY 4.0 PrompTugal.news' };
    let svg = readFileSync('scripts/lib/sites-bar/preview-template.svg.txt', 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in fill)) throw new Error(`preview template: no value for {{${k}}}`); return esc(String(fill[k])); });
    svg = svg.replace(/(<svg [^>]*>)/, `$1\n  <title>${esc(`PrompTugal.news Startups: ${figs[0][0]} calls open, ${figs[1][0]} rounds and grants, ${figs[2][0]} places`)}</title>\n  <desc>${esc(`Counted from data/facts.json by scripts/generate.mjs on ${today}, version __VERSION__. Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), PrompTugal.news.`)}</desc>`);
    writeFileSync(join(OUT, 'preview.svg'), svg);
    writeFileSync(join(OUT, 'preview.json'), JSON.stringify({ site: SITE, built: today, version: '__VERSION__', figures: Object.fromEntries(figs.map(([n, l]) => [l, n])),
      provenance: { from: 'data/facts.json', method: 'counted by scripts/generate.mjs at build', by: 'startups.b@PrompTugal.dinis' },
      license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', holder: 'PrompTugal.news' },
      images: { svg: `${SITE}/preview.svg`, png: `${SITE}/preview.png` } }, null, 2) + '\n');
  }
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${SITE}${p.path}</loc></url>`).join('\n')}\n</urlset>\n`);
  mkdirSync(join(OUT, 'data'), { recursive: true });
  writeFileSync(join(OUT, 'data/facts.json'), JSON.stringify({ site: SITE, version: '__VERSION__', licence: 'CC BY 4.0', places, entries: entries.map(({ from, ...e }) => ({ ...e, from: from && { repository: from.repository, path: from.path } })) }, null, 1) + '\n');
  return { pages: pages.length, counts };
}
