// Generate the site's pages from data/ into _site/: every page as index.html and its markdown
// twin index.md, plus llms.txt and sitemap.xml. Called by scripts/build.mjs after src/ is copied.
// Written by startups@PrompTugal.dinis, 2026-11-17. Node built-ins only.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { variants } from './lib/front-variants.mjs';
import { meterConfig } from './lib/billing.mjs';
import { buildInvestors, GROUPS } from './lib/investors.mjs';
const GROUP_IDX = t => GROUPS.indexOf(t);

const SITE = 'https://startups.promptugal.news';
const OUT = '_site';
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const places = web.places;
  const known = new Set(places.map(p => p.id));
  const alias = { lisbon: 'lisboa', 'lisboa-city': 'lisboa', national: 'portugal' };
  const research = [];
  const gaps = [];
  const researchFiles = existsSync('data/research') ? readdirSync('data/research').filter(f => f.endsWith('.json')).sort() : [];
  for (const f of researchFiles) {
    const d = JSON.parse(readFileSync(join('data/research', f), 'utf8'));
    for (const e of d.entries || []) {
      let place = alias[e.place] || e.place;
      if (!known.has(place)) place = 'portugal';
      research.push({ ...e, place, section: e.section || SECTION_OF[e.kind] || 'support', from: { repository: 'PrompTugal/PrompTugal__News__Startups', path: `data/research/${f}`, by: d.by } });
    }
    for (const g of d.gaps || []) gaps.push({ ...g, file: `data/research/${f}` });
  }
  // One entry per section, place and name: the first wins and later sources are kept as "also".
  const seen = new Map();
  const entries = [];
  for (const e of [...research, ...web.entries]) {
    if (!e.name || !e.source_url) continue;
    const key = `${e.section}|${e.place}|${slug(e.name)}`;
    if (seen.has(key)) { const first = seen.get(key); (first.also ||= []).push({ source_url: e.source_url, read_on: e.read_on }); continue; }
    const x = { ...e, id: slug(`${e.place}-${e.name}`) };
    seen.set(key, x); entries.push(x);
  }
  return { web, places, entries, gaps, researchFiles };
}

// Place order: the Algarve and its towns first, then Lisbon, Porto, the other places, then national.
export function orderPlaces(places, entries) {
  const count = id => entries.filter(e => e.place === id).length;
  const alg = places.filter(p => p.parent === 'algarve').sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  const rest = places.filter(p => !['algarve', 'portugal', 'lisboa', 'porto'].includes(p.id) && p.parent !== 'algarve').sort((a, b) => a.name.localeCompare(b.name));
  const by = id => places.find(p => p.id === id);
  return [
    { group: 'The Algarve', places: [by('algarve'), ...alg].filter(Boolean) },
    { group: 'Lisbon and Porto', places: [by('lisboa'), by('porto')].filter(Boolean) },
    { group: 'Other places', places: rest },
    { group: 'Portugal as a whole', places: [by('portugal')].filter(Boolean) },
  ];
}

// ---------- page frame ----------
const NAV = [['/', 'Front'], ['/places/', 'Places'], ['/support/', 'Incubators and programmes'], ['/calls/', 'Open calls'], ['/funding/', 'Rounds and grants'], ['/companies/', 'Companies'], ['/investors/', 'Investors'], ['/about/', 'How this is made']];
// The reading meter prices a page by its page-type (meta tag): fact listings and place pages are "evidence";
// the front page, about and design pages are "site"; the meter's own account page is "account" (free).
const pageType = path => path === '/account/' ? 'account' : (path === '/' || path === '/about/' || path.startsWith('/design/') || path === '/404/') ? 'site' : 'evidence';
// The PrompTugal.news sites rail (as in PrompTugal__News__Website assets/top/top.tmpl), this site marked as current.
const NET = [['Weather', 'weather'], ['Civic', 'civic'], ['Startups', 'startups'], ['Travel', 'travel'], ['Data', 'data']];
const netRail = `<nav class="em-net" aria-label="The PrompTugal.news sites"><span>Also from PrompTugal.news</span>${NET.map(([n, h]) => h === 'startups' ? `<a href="https://${h}.promptugal.news/" aria-current="page">${n}</a>` : `<a href="https://${h}.promptugal.news/" target="_blank" rel="noopener">${n}</a>`).join('')}</nav>`;
function frame({ path, title, description, body, made }) {
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
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/meter/meter.css">
<script defer src="/assets/meter/meter.js"></script>
<script defer src="/assets/obs/obs.js"></script>
</head>
<body>
<header class="top"><div class="wrap">
<div class="strip"><span>Portugal, town by town · <a href="https://promptugal.news/">PrompTugal.news</a></span><span>version __VERSION__ · <a href="${path}index.md">markdown</a></span></div>
<div class="mast"><a href="/" aria-label="PrompTugal.news Startups, front page"><img class="wm-light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="240" height="40"><img class="wm-dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="240" height="40"></a><span class="sub">Startups</span><div class="tools" id="nr-tools"><a class="tool meter" id="nr-meter-chip" href="/account/"><span class="meter-label">Pay for what you read</span></a></div></div>
<nav class="main" aria-label="Sections">${nav}</nav>
</div></header>
${netRail}
<main class="wrap">
${body}
</main>
<footer><div class="wrap cols">
<div><h2>How this page was made</h2>${made || MADE_DEFAULT}</div>
<div><h2>About this site</h2><p>Independent: not an official or government site, and not investment advice. Public facts only, each with its source and the date it was read. Corrections are welcome through the repository's issues.</p><div class="row"><p class="meta small">Version __VERSION__ · Code Apache-2.0, text CC BY 4.0 · <a href="https://github.com/PrompTugal/PrompTugal__News__Startups">source</a> · <a href="/llms.txt">llms.txt</a></p></div></div>
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
  writeFileSync(join(dir, 'index.md'), md.trim() + '\n\n---\nVersion __VERSION__. Text CC BY 4.0. ' + `${SITE}${path}` + '\n');
}
function page(p) { pages.push(p); write(p.path, frame(p), `# ${p.title}\n\n${p.description}\n\n${p.md}`); }

// ---------- pieces ----------
const isMoney = e => e.section === 'funding' || e.section === 'investors';
export function sourceLine(e) {
  const host = (() => { try { return new URL(e.source_url).hostname.replace(/^www\./, ''); } catch { return 'source'; } })();
  const also = (e.also || []).length ? ` · ${e.also.length} more source${e.also.length > 1 ? 's' : ''}` : '';
  return `<p class="src">Source: <a href="${esc(e.source_url)}" rel="nofollow">${esc(host)}</a>, read ${esc(nice(e.read_on))}${also}</p>`;
}
export function itemHtml(e, placeName) {
  const tags = `<span class="tag${isMoney(e) ? ' money' : ''}">${esc(e.kind)}</span>${placeName ? `<span class="tag">${esc(placeName)}</span>` : ''}`;
  const name = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.name)}</a>` : esc(e.name);
  const facts = [e.amount && `<span class="amount">${esc(e.amount)}</span>`, e.date && esc(nice(e.date)), e.company && `to ${esc(e.company)}`, e.investors?.length && `with ${esc(e.investors.join(', '))}`, e.status && esc(e.status)].filter(Boolean).join(' · ');
  return `<li class="item" id="${esc(e.id)}"><h3>${name}</h3><p>${tags}${facts ? ` ${facts}` : ''}</p><p>${esc(e.what || '')}</p>${sourceLine(e)}</li>`;
}
export function itemMd(e, placeName) {
  const facts = [e.kind, placeName, e.amount, e.date && nice(e.date), e.company && `to ${e.company}`, e.investors?.length && `with ${e.investors.join(', ')}`, e.status].filter(Boolean).join(' · ');
  return `- **${mdEsc(e.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc(facts)}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.`;
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
  const tags = `<span class="tag">${esc(e.kind)}</span><span class="tag"><a href="/places/${esc(e.place)}/">${esc(placeName[e.place])}</a></span>${d && left >= 0 && left <= 14 ? '<span class="tag money">closing within 14 days</span>' : ''}`;
  const name = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.name)}</a>` : esc(e.name);
  const when = d ? (left >= 0 ? `closes ${esc(closesText(d))} (${leftText(left)})` : `closed ${esc(closesText(d))}`) : esc(e.status || '');
  const facts = [e.amount && `<span class="amount">${esc(e.amount)}</span>`, when].filter(Boolean).join(' · ');
  return `<li class="item" id="${esc(e.id)}"><h3>${name}</h3><p>${tags} ${facts}</p><p>${esc(e.what || '')}</p>${sourceLine(e)}</li>`;
}
export function callMd(c, placeName) {
  const { e, d, left } = c;
  const when = d ? (left >= 0 ? `closes ${closesText(d)} (${leftText(left)})${left <= 14 ? ', closing within 14 days' : ''}` : `closed ${closesText(d)}`) : e.status;
  const facts = [e.kind, placeName[e.place], e.amount, when].filter(Boolean).join(' · ');
  return `- **${mdEsc(e.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc(facts)}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.`;
}
// A short box: the next closing calls, each linking to the list.
export function callsBoxMd(list, placeName) {
  return list.map(({ e, d, left }) => `- ${mdEsc(e.name)} (${placeName[e.place]}): closes ${closesText(d)}${left <= 14 ? ` (${leftText(left)})` : ''}`).join('\n') + `\n\nAll open calls: ${SITE}/calls/`;
}
export function callsBoxHtml(list, heading, placeName, showPlace) {
  if (!list.length) return '';
  return `<div class="note"><p><strong>${heading}</strong></p><ul class="list">${list.map(({ e, d, left }) => `<li>${esc(e.name)}${showPlace ? ` (${esc(placeName[e.place])})` : ''}: closes ${esc(closesText(d))}${left <= 14 ? ` (${esc(leftText(left))})` : ''}</li>`).join('')}</ul><p><a href="/calls/">All open calls</a></p></div>`;
}

// ---------- build ----------
export function generate() {
  const { web, places, entries, gaps, researchFiles } = loadData();
  const placeName = Object.fromEntries(places.map(p => [p.id, p.id === 'portugal' ? 'National' : p.name]));
  const groups = orderPlaces(places, entries);
  const sec = s => entries.filter(e => e.section === s);
  const counts = { all: entries.length, support: sec('support').length, funding: sec('funding').length, companies: sec('companies').length, investors: sec('investors').length, places: new Set(entries.map(e => e.place)).size, sources: new Set(entries.map(e => { try { return new URL(e.source_url).hostname; } catch { return ''; } })).size };
  const algarveIds = new Set(['algarve', ...places.filter(p => p.parent === 'algarve').map(p => p.id)]);
  const today = new Date().toISOString().slice(0, 10);
  const calls = classifyCalls(entries, today);
  const ctx = { calls, callsBoxHtml, callsBoxMd, entries, places, placeName, groups, counts, gaps, esc, nice, itemHtml, itemMd, sourceLine, algarveIds, byDate, web };

  // Front page: the chosen variation (A until Dinis picks one at /design/).
  const chosen = 'a';
  const front = variants[chosen](ctx);
  page({ path: '/', title: 'PrompTugal.news Startups: Portugal\'s startups and their funding, place by place', description: 'Incubators, accelerators, public programmes, rounds and grants across Portugal, starting with the Algarve, each fact with its source and the date read.', body: front.html, md: front.md });

  // Design: the three variations side by side.
  for (const k of Object.keys(variants)) {
    const v = variants[k](ctx);
    page({ path: `/design/${k}/`, title: `Front page, variation ${k.toUpperCase()}: ${v.name}`, description: `Design variation ${k.toUpperCase()} of the front page (${v.name}), for Dinis to choose.`, body: `<p class="note">Design variation ${k.toUpperCase()}: ${esc(v.name)}. A proposal for Dinis to choose from; <a href="/design/">see all three</a>.</p>${v.html}`, md: `A proposal for Dinis to choose from.\n\n${v.md}` });
  }
  const vs = Object.keys(variants).map(k => [k, variants[k](ctx)]);
  page({ path: '/design/', title: 'Three front pages to choose from', description: 'One design pass: three variations of the front page with the same real data, side by side, for Dinis to choose.', body: `<p class="kicker">Design pass 1 · a proposal</p><h1>Three front pages to choose from</h1><p class="lede">The same data, three ways to open the site. The live front page uses variation A until Dinis chooses.</p><div class="grid">${vs.map(([k, v]) => `<div class="card"><p class="kicker">Variation ${k.toUpperCase()}</p><h3><a href="/design/${k}/">${esc(v.name)}</a></h3><p>${esc(v.idea)}</p></div>`).join('')}</div><div class="cols" style="margin-top:1.5rem">${vs.map(([k]) => `<div><p class="meta">Variation ${k.toUpperCase()}</p><iframe src="/design/${k}/index.html" title="Variation ${k.toUpperCase()}" style="width:100%;height:70vh;border:1px solid var(--rule);background:var(--paper)" loading="lazy"></iframe></div>`).join('')}</div>`, md: vs.map(([k, v]) => `- Variation ${k.toUpperCase()}, ${v.name} (${SITE}/design/${k}/): ${v.idea}`).join('\n') });

  // Places
  const placeCounts = id => ['support', 'funding', 'companies', 'investors'].map(s => entries.filter(e => e.place === id && e.section === s).length);
  page({ path: '/places/', title: 'Places', description: 'Each place\'s incubators, programmes, rounds, grants, companies and investors, starting with the Algarve.', body: `<p class="kicker">Place by place</p><h1>Places</h1><p class="lede">Start with the Algarve, then Lisbon and Porto. A place with nothing yet is a gap we have not filled, not a place with no startups.</p>${groups.map(g => `<h2>${esc(g.group)}</h2><div class="tablewrap"><table><thead><tr><th>Place</th><th>Support</th><th>Rounds and grants</th><th>Companies</th><th>Investors</th></tr></thead><tbody>${g.places.map(p => { const c = placeCounts(p.id); return `<tr><td><a href="/places/${p.id}/">${esc(p.name)}</a></td>${c.map(n => `<td>${n || '<span class="meta">none yet</span>'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`).join('')}`, md: groups.map(g => `## ${g.group}\n\n${g.places.map(p => { const c = placeCounts(p.id); return `- ${p.name} (${SITE}/places/${p.id}/): ${c[0]} support, ${c[1]} rounds and grants, ${c[2]} companies, ${c[3]} investors`; }).join('\n')}`).join('\n\n') });

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
  page({ path: '/support/', title: 'Incubators, accelerators and programmes in Portugal', description: 'Council incubators, university offices, accelerators and public programmes for founders across Portugal, starting with the Algarve.', body: s.html, md: s.md });

  // Open calls: what a founder can apply to now, soonest closing first. Built from the same merged entries.
  const grp = (title, list, empty) => `<h2>${title} <span class="meta">(${list.length})</span></h2>${list.length ? `<ul class="list">${list.map(c => callHtml(c, placeName)).join('')}</ul>` : `<p class="meta">${empty}</p>`}`;
  const grpMd = (title, list) => `## ${title} (${list.length})\n\n${list.length ? list.map(c => callMd(c, placeName)).join('\n') : 'None.'}`;
  page({ path: '/calls/', title: 'Open calls for Portuguese startups', description: `${calls.open.length} calls open to applications on ${nice(today)}, soonest closing first, each with its source and the date read.`,
    body: `<p class="kicker">Apply now</p><h1>Open calls: what you can apply to now</h1><p class="lede">Calls and programmes with a closing date on or after ${esc(nice(today))}, soonest first. Dates are as each source states them on the day we read it; check the source before applying, as dates move.</p>
${grp('Closing within 14 days', calls.soon, 'None closing in the next 14 days.')}${grp('Closing later', calls.later, 'None.')}${grp('Opening soon', calls.opening, 'None announced in our sources.')}${grp('Recently closed', calls.recent, 'Nothing closed in the last 30 days.')}`,
    md: `Calls and programmes with a closing date on or after ${nice(today)}, soonest first. Dates are as each source states them on the day we read it; check the source before applying.\n\n${grpMd('Closing within 14 days', calls.soon)}\n\n${grpMd('Closing later', calls.later)}\n\n${grpMd('Opening soon', calls.opening)}\n\n${grpMd('Recently closed', calls.recent)}` });

  const funding = sec('funding').sort(byDate);
  s = bySection('funding', `<p class="kicker">Money</p><h1>Rounds, grants and public money</h1><p class="lede">Investment rounds, grants and public programmes as the press or the organisations reported them. Amounts are as the source states them; we do not convert or total them.</p><div class="note">Latest dated: ${funding.filter(e => e.date).slice(0, 3).map(e => `${esc(e.name)} (${esc(nice(e.date))})`).join('; ')}.</div>`, byDate);
  page({ path: '/funding/', title: 'Startup rounds, grants and public money in Portugal', description: 'Investment rounds, grants and public funding programmes for Portuguese startups, place by place, each with its source.', body: s.html, md: s.md });

  s = bySection('companies', `<p class="kicker">Companies</p><h1>Companies</h1><p class="lede">Startups named in our sources, by the place they are based. Being listed here is not an endorsement; it means a public source names them.</p>`, (a, b) => a.name.localeCompare(b.name));
  page({ path: '/companies/', title: 'Startups in Portugal, place by place', description: 'Startups named in public sources, by the place in Portugal they are based, each with its source.', body: s.html, md: s.md });

  const inv = buildInvestors(entries);
  const eur = n => `EUR ${n.toLocaleString('en-GB')}`;
  const dealHtml = d => `<li><a href="/funding/#${esc(d.id)}">${esc(d.company || d.name)}</a>${d.amount ? ` · ${esc(d.amount)}` : ''}${d.date ? ` · ${esc(nice(d.date))}` : ''}</li>`;
  const dealMd = d => `  - [${mdEsc(d.company || d.name)}](${SITE}/funding/#${d.id})${d.amount ? ` · ${mdEsc(d.amount)}` : ''}${d.date ? ` · ${nice(d.date)}` : ''}`;
  const invCard = r => { const e = r.main; return `<li class="item" id="${esc(e.id)}"><h3>${e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(r.name)}</a>` : esc(r.name)}</h3><p><span class="tag money">${esc(e.kind)}</span><span class="tag">${esc(placeName[e.place])}</span></p><p>${esc(e.what || '')}</p>${sourceLine(e)}${r.others.length ? `<p class="meta">Also listed: ${r.others.map(o => `${esc(o.name)} (${esc(placeName[o.place])}), <a href="${esc(o.source_url)}" rel="nofollow">source</a>, read ${esc(nice(o.read_on))}`).join('; ')}</p>` : ''}<p class="meta">Named deals in our data</p>${r.deals.length ? `<ul>${r.deals.map(dealHtml).join('')}</ul>` : `<p>None in our data yet</p>`}</li>`; };
  const invCardMd = r => { const e = r.main; return `- **${mdEsc(r.name)}**${e.url ? ` (${e.url})` : ''}: ${mdEsc([e.kind, placeName[e.place]].join(' · '))}. ${mdEsc(e.what || '')} Source: ${e.source_url}, read ${nice(e.read_on)}.${r.others.length ? ` Also listed: ${r.others.map(o => `${mdEsc(o.name)} (${placeName[o.place]}), ${o.source_url}, read ${nice(o.read_on)}`).join('; ')}.` : ''}\n  Named deals in our data:${r.deals.length ? `\n${r.deals.map(dealMd).join('\n')}` : ' None in our data yet'}`; };
  const tableRows = inv.rows.filter(r => r.deals.length).sort((a, b) => b.deals.length - a.deals.length || a.name.localeCompare(b.name));
  const summary = `${inv.groups.filter(g => g.rows.length).map(g => `${g.title}: ${g.rows.length}`).join('; ')}. ${inv.rows.length} investors in all, with ${inv.dealsLinked} named deals linked (${inv.distinctRounds} different round entries; one round names several investors).`;
  const thin = `The data is thin and growing: investors are listed only where a public page we read names them, and a deal is linked only where our own round entries name the investor. Nothing here is a full list. See the gaps on`;
  const tblNote = `Counts are round entries in our data that name the investor; one round counts for each investor it names, and two entries can describe the same round. We do not total the amounts: the same round can appear more than once, and a round's size is not the investor's own share.`;
  s = { html: `<p class="kicker">Investors · a section for now</p><h1>Investors</h1><p class="lede">Venture funds, angel networks and public investors seen in Portuguese rounds. This data is still thin: we are collecting more, and it may get a site of its own.</p>
<div class="note"><p>${esc(summary)}</p><p>${esc(thin)} <a href="/about/#gaps">How this is made</a>.</p></div>
<p class="meta">Jump to: ${inv.groups.filter(g => g.rows.length).map((g, i) => `<a href="#g${GROUP_IDX(g.title)}">${esc(g.title)}</a>`).join(' · ')} · <a href="#by-investor">Deals by investor</a></p>
${inv.groups.filter(g => g.rows.length).map(g => `<h2 id="g${GROUP_IDX(g.title)}">${esc(g.title)} <span class="meta">(${g.rows.length})</span></h2><ul class="list">${g.rows.map(invCard).join('')}</ul>`).join('')}
<h2 id="by-investor">Deals by investor</h2><p class="meta">${esc(tblNote)}</p><div class="tablewrap"><table><thead><tr><th>Investor</th><th>Named deals</th></tr></thead><tbody>${tableRows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.deals.length}</td></tr>`).join('')}</tbody></table></div>`,
  md: `${summary}\n\n${thin} ${SITE}/about/\n\n${inv.groups.filter(g => g.rows.length).map(g => `## ${g.title} (${g.rows.length})\n\n${g.rows.map(invCardMd).join('\n')}`).join('\n\n')}\n\n## Deals by investor\n\n${tblNote}\n\n| Investor | Named deals |\n| --- | --- |\n${tableRows.map(r => `| ${mdEsc(r.name)} | ${r.deals.length} |`).join('\n')}` };
  page({ path: '/investors/', title: 'Investors in Portuguese startups', description: 'Venture funds, angel networks and public investors active in Portuguese startups, with the deals in our data that name them, each with its source. A section for now.', body: s.html, md: s.md });

  // How this is made
  const fromWeb = entries.filter(e => e.from?.repository?.endsWith('Website')).length;
  const aboutHtml = `<p class="kicker">Provenance</p><h1>How this is made</h1>
<p class="lede">Every fact on this site is a public one, with the page it came from and the date it was read. Nothing is typed into a page by hand: code builds every page from the data files in the repository.</p>
<h2>What runs as code</h2><ul><li><code>scripts/import-website.mjs</code> reads the place research of <a href="https://promptugal.news/">PrompTugal.news</a> (its <code>data/by-place/</code> files and the companies it mapped around Web Summit 2026), keeps only the public fields, and writes <code>data/from-website.json</code>. This import is from commit <code>${esc(web.source.commit.slice(0, 7))}</code>, made on ${esc(nice(web.imported_on))}: ${fromWeb} facts.</li><li><code>scripts/generate.mjs</code> merges it with the team's own research (${researchFiles.map(f => `<code>data/research/${esc(f)}</code>`).join(', ') || 'none yet'}) and builds every page, its markdown twin, <code>llms.txt</code> and the sitemap.</li><li><code>scripts/validate.mjs</code> (the gate) and <code>scripts/leak-scan.mjs</code> run on every push; the site does not deploy if either fails.</li></ul>
<h2>What agents wrote</h2><ul><li>The place agents of PrompTugal.news (place.algarve@, place.faro@ and the others, on Claude) read and summarised the sources imported here.</li><li>startups.research@PrompTugal.dinis (Claude Sonnet) read new sources on 17 November 2026 for the Algarve, Lisbon, Porto and national programmes.</li><li>startups@PrompTugal.dinis (Claude Opus) wrote the first code, the page text and reviewed the research.</li><li>From 18 November 2026 the lead is startups.b@PrompTugal.dinis (Claude Opus), with sub-agents startups.b.dev@PrompTugal.dinis (code, Sonnet) and startups.b.research@PrompTugal.dinis (research, Sonnet).</li></ul>
<h2>What a person checked</h2><p>Nothing yet. Dinis Cruz started the site; no person has reviewed its facts. Read each fact against its source.</p>
<h2>Rules we keep</h2><ul><li>Public facts only. People only as public and professional; no personal contacts.</li><li>Sites read politely, with a named agent and pauses. A refusal (403, bot check, robots.txt) is respected and recorded as a gap, never worked around.</li><li>Amounts as the source states them. A place with no entries is a gap in our research, not a finding.</li></ul>
<h2>The reading meter</h2><p>Pages here cost a few pence of reading credit, as on <a href="https://promptugal.news/">PrompTugal.news</a>: <em>pay for what you read</em>. The balance, the pages you have read and the reading graph are kept in this browser only (localStorage, under this site's own key). Nothing about them is sent to us or to anyone. Clearing this site's data resets it. See <a href="/account/">your account</a>.</p>
<h2>Page views are counted</h2><p>This site counts page views and reading time, publicly, to learn what is read. Each count says the page, the referring site (host only), the time to the minute, the site version, a random id that ends with the tab, the screen size class, the browser's language and time zone, and the country, region and city from the browser's own lookup. No IP address, no cookie and no user-agent string is kept. To find the place, your browser asks ipapi.co or ipwho.is, which see your IP address. Do Not Track and Global Privacy Control are respected, and the Pause switch in the footer turns counting off on this device. The lane is called <code>startups</code>. What is counted is explained at <a href="https://promptugal.news/newsroom/observability/index.html">promptugal.news</a>.</p>
<h2 id="gaps">Gaps we know about</h2>${gaps.length ? `<ul class="list">${gaps.map(g => `<li class="item"><p>${esc(g.what)}</p><p class="src">${/^https?:\/\//.test(g.url || '') ? `<a href="${esc(g.url)}" rel="nofollow">${esc(g.url)}</a> · ` : g.url ? `${esc(g.url)} · ` : ''}${esc(g.why || '')}</p></li>`).join('')}</ul>` : '<p class="meta">None recorded yet.</p>'}
<h2>Counts</h2><div class="stats"><div><b>${counts.all}</b><span>facts</span></div><div><b>${counts.sources}</b><span>source sites</span></div><div><b>${counts.places}</b><span>places with facts</span></div></div>`;
  page({ path: '/about/', title: 'How this site is made', description: 'What runs as code, what agents wrote, what a person checked, and the gaps we know about.', body: aboutHtml, md: `## What runs as code\n\n- scripts/import-website.mjs imports PrompTugal__News__Website data (commit ${web.source.commit.slice(0, 7)}, ${fromWeb} facts).\n- scripts/generate.mjs builds the pages from data/.\n- scripts/validate.mjs and scripts/leak-scan.mjs gate every push.\n\n## What agents wrote\n\n- PrompTugal.news place agents (imported research).\n- startups.research@PrompTugal.dinis (Claude Sonnet): new research, 17 November 2026.\n- startups@PrompTugal.dinis (Claude Opus): first code, text, review.\n- startups.b@PrompTugal.dinis (Claude Opus, lead from 18 November 2026) with sub-agents startups.b.dev and startups.b.research (Claude Sonnet).\n\n## The reading meter\n\nPages cost a few pence of reading credit (pay for what you read). The balance and reading graph are kept in this browser only; nothing is sent.\n\n## Page views are counted\n\nPage views and reading time are counted publicly: page, referring host, time to the minute, version, a random id that ends with the tab, screen size class, language, time zone, and country, region and city from the browser's own lookup (ipapi.co or ipwho.is see the IP address). No IP address, cookie or user-agent string is kept. Do Not Track and Global Privacy Control are respected, and a Pause switch in the footer turns it off. Lane: startups.\n\n## What a person checked\n\nNothing yet.\n\n## Gaps\n\n${gaps.map(g => `- ${g.what} (${g.url || ''}; ${g.why || ''})`).join('\n') || 'None recorded yet.'}` });

  // Account: the reading meter's page. meter.js fills #nr-account (balance, history, reading graph). Not in the main NAV.
  page({ path: '/account/', title: 'Your reading account', description: 'The reading meter for this site: your balance, the pages you have read and your reading graph, kept in this browser only.', body: `<p class="kicker">Pay for what you read</p><h1>Your reading account</h1>
<p class="lede">Each page here costs a few pence of reading credit, set by its kind and how much of it you read. Your balance, your history and your reading graph are kept in this browser only: nothing is sent to us or to anyone, and clearing this site's data resets them.</p>
<div id="nr-account"></div>
<noscript><p class="note">The balance and the reading graph need JavaScript. Without it nothing is charged and nothing is kept.</p></noscript>
<p class="meta">How pages are priced is explained at <a href="https://promptugal.news/account/billing.html">promptugal.news</a>, whose meter this is.</p>`, md: `Each page here costs a few pence of reading credit, set by its kind and how much of it you read. Your balance, your history and your reading graph are kept in this browser only: nothing is sent to anyone. They are drawn by JavaScript in the HTML page; this markdown twin has no balance.\n\nPrices: https://promptugal.news/account/billing.html. The meter's config: ${SITE}/api/v1/billing/meter.json` });

  // 404, llms.txt, sitemap, data
  write('/404/', frame({ path: '/404/', title: 'Page not found', description: 'This page does not exist.', body: '<h1>Page not found</h1><p><a href="/">Back to the front page</a>.</p>' }), '# Page not found');
  writeFileSync(join(OUT, '404.html'), readFileSync(join(OUT, '404/index.html'), 'utf8').replaceAll('href="../', 'href="/').replaceAll('src="../', 'src="/'));
  writeFileSync(join(OUT, 'llms.txt'), `# PrompTugal.news Startups\n\n> Portugal's startups and their funding, place by place: incubators, accelerators, public programmes, rounds and grants, companies and investors. Public facts only, each with its source and the date read. Every page has a markdown twin at index.md. Version __VERSION__.\n\n## Pages\n\n${pages.filter(p => !p.path.startsWith('/design/')).map(p => `- [${p.title}](${SITE}${p.path}index.md): ${p.description}`).join('\n')}\n\n## Data\n\n- [All facts as JSON](${SITE}/data/facts.json): every entry with its source, read date and where it came from.\n\n## Optional\n\n${pages.filter(p => p.path.startsWith('/design/')).map(p => `- [${p.title}](${SITE}${p.path}index.md)`).join('\n')}\n`);
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${SITE}${p.path}</loc></url>`).join('\n')}\n</urlset>\n`);
  mkdirSync(join(OUT, 'api/v1/billing'), { recursive: true });
  writeFileSync(join(OUT, 'api/v1/billing/meter.json'), JSON.stringify(meterConfig('__VERSION__'), null, 2) + '\n');
  mkdirSync(join(OUT, 'data'), { recursive: true });
  writeFileSync(join(OUT, 'data/facts.json'), JSON.stringify({ site: SITE, version: '__VERSION__', licence: 'CC BY 4.0', places, entries: entries.map(({ from, ...e }) => ({ ...e, from: from && { repository: from.repository, path: from.path } })) }, null, 1) + '\n');
  return { pages: pages.length, counts };
}
