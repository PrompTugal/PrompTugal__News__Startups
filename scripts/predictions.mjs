// The site's predictions, kept as shown (Dinis, 19 November 2026, about 01:17 and 03:15 UTC: "show the past"; "the
// predictions are one collection"; PrompTugal__News__Website board/guidance/2026-11-19-show-the-past.md and
// 2026-11-19-no-ip-lookup-predictions-and-small-decisions.md). Run by the site lead at a wake, never by CI:
//   node scripts/predictions.mjs
// For each open call shown on /calls/, it appends one prediction line, in library.b@'s form
// (https://library.promptugal.news/predictions/form/), to data/predictions/predictions.jsonl: the closing date as the
// source states it and as the site shows it. Append only: a line is never edited or removed; a call already recorded
// with the same date is skipped; a changed date is a new line naming the one it corrects. said_by is the organiser
// when the source is its own page, or "<organiser>, as reported by <host>" (library.b@, 19 Nov 2026, 07:52 UTC). Outcome lines are written
// by hand once the call's page has been read again after its date. Every line is checked against the form first.
// Node built-ins only.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { loadData, classifyCalls } from './generate.mjs';

const FILE = 'data/predictions/predictions.jsonl';
const SITE = 'startups.promptugal.news';
const W = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const closes = iso => { const d = new Date(iso + 'T00:00:00Z'); return `closes ${W[d.getUTCDay()]} ${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const clean = (s, n) => String(s || '').replace(/[\[\]<>`\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const https = u => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };

export function checkLine(o) {
  const bad = [];
  const req = ['type', 'id', 'site', 'page', 'shown_at', 'said_by', 'source', 'licence', 'kind', 'subject', 'due', 'said'];
  for (const k of req) if (o[k] == null || o[k] === '') bad.push(`missing ${k}`);
  if (o.type !== 'prediction') bad.push('type');
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(o.id || '')) bad.push('id');
  if (o.site !== SITE) bad.push('site');
  for (const k of ['page', 'source']) if (!https(o[k])) bad.push(`${k} not https`);
  if (!o.licence || !o.licence.name || !https(o.licence.url)) bad.push('licence');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(o.shown_at || '')) bad.push('shown_at');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.due || '') || isNaN(Date.parse(o.due))) bad.push('due');
  if (!['forecast', 'warning', 'countdown', 'score', 'expected-date', 'statement'].includes(o.kind)) bad.push('kind');
  for (const [k, n] of [['said_by', 80], ['subject', 120], ['said', 300]]) if (String(o[k] || '').length > n || /[\[\]<>`\u0000-\u001f]/.test(o[k] || '')) bad.push(k);
  return bad;
}

if (process.argv[1] && process.argv[1].endsWith('predictions.mjs')) {
  const now = new Date().toISOString().slice(0, 16) + 'Z', today = now.slice(0, 10);
  const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const latest = new Map();                                   // call id -> its latest prediction line
  for (const l of lines) if (l.type === 'prediction') latest.set(l.id.replace(/\.\d{4}-\d{2}-\d{2}$/, ''), l);
  const { entries } = loadData();
  const calls = classifyCalls(entries, today);
  const add = [];
  for (const { e, d } of calls.open) {
    if (!d || d < today) continue;                             // only before its time: never a retrospective record
    const base = `call.${e.id}`.slice(0, 89), id = `${base}.${d}`;
    const prev = latest.get(base);
    if (prev && prev.due === d) continue;
    const host = (() => { try { return new URL(e.source_url).hostname; } catch { return ''; } })();
    const lic = e.source_license && https(e.source_license.url) ? e.source_license : { name: "the source's terms", url: host ? `https://${host}/` : '' };
    const o = { type: 'prediction', id, site: SITE, page: `https://${SITE}/calls/#${e.id}`, shown_at: now, said_by: clean(e.organiser ? (e.organiser_source === 'own' ? e.organiser : `${e.organiser}, as reported by ${host}`) : (host || 'the organiser'), 80),
      source: https(e.source_url), licence: { name: clean(lic.name, 80), url: https(lic.url) }, kind: 'expected-date',
      subject: clean(`${e.name}, closing date`, 120), due: d, said: clean(`${closes(d)}, as the source states it (read ${e.read_on})`, 300) };
    if (prev) o.corrects = prev.id;
    const bad = checkLine(o);
    if (bad.length) { console.log(`skipped ${e.id}: ${bad.join(', ')}`); continue; }
    add.push(o);
  }
  if (add.length) appendFileSync(FILE, add.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.log(`predictions: ${add.length} added, ${lines.length} kept as they were, in ${FILE}`);
}
