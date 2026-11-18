// Merge funding rounds that are the same deal reported by different sources. Node built-ins only.
// Everything here is our inference, not a source's claim: the company is worked out from the entry, and two
// rounds are merged only on exact company equality plus a matching date (and, for rule b, a matching amount).

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const WORDS = /\b(pre-?seed|seed|series [a-e]|first|follow-on|round|funding|financing|raises?|investment)\b/g;

// Normalised company: lower case, accents and punctuation removed, deal words removed.
export const normCompany = s => strip(s).replace(WORDS, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// The company of a round. entry.company if set; else from the name: "<investors> into <Company>" gives the part
// after the last " into "; otherwise the name with any bracketed part and the deal words removed
// ("Granter seed round" gives "granter"). Returns '' when nothing is left.
export function roundCompany(e) {
  if (e.company && String(e.company).trim()) return normCompany(e.company);
  let n = String(e.name || '').replace(/\([^)]*\)/g, ' ');
  const i = n.toLowerCase().lastIndexOf(' into ');
  if (i >= 0) n = n.slice(i + 6);
  return normCompany(n);
}

// Amount as { cur, n } only for plain figures: "EUR 1.6 million", "1.6 million euros", "USD 6 million", "6 million dollars",
// optionally followed by "(whole round)" or "(round total)". Anything else (up to, more than, extra text, no currency) is null.
export function parseAmount(a) {
  const t = String(a || '').trim().replace(/\s*\((whole round|round total)\)$/i, '');
  const m = t.match(/^(?:(EUR|USD|€|\$)\s*)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s+(million))?(?:\s+(euros?|us dollars|dollars))?$/i);
  if (!m) return null;
  const sym = (m[1] || '').toUpperCase(), word = (m[4] || '').toLowerCase();
  const cur = sym === 'EUR' || sym === '€' ? 'EUR' : sym === 'USD' || sym === '$' ? 'USD' : /^euro/.test(word) ? 'EUR' : word ? 'USD' : '';
  if (!cur || (sym && word)) return null;
  const n = parseFloat(m[2].replace(/,/g, '')) * (m[3] ? 1e6 : 1);
  return { cur, n: Math.round(n) };
}

const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d));
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

// Same deal? Rule a: equal company, same ISO day. Rule b: equal company, same amount in the same currency,
// both dates ISO days at most 30 days apart.
export function sameDeal(a, b) {
  const ca = roundCompany(a);
  if (!ca || ca !== roundCompany(b)) return false;
  if (!isDay(a.date) || !isDay(b.date)) return false;
  if (a.date === b.date) return true;
  const x = parseAmount(a.amount), y = parseAmount(b.amount);
  return !!(x && y && x.cur === y.cur && x.n === y.n && days(a.date, b.date) <= 30);
}

// Drop also-sources that repeat a URL: of two with the same source_url the earliest read_on stays (the first on a tie), in
// the place of the first one listed. A source with the main entry's own URL is not listed again. The main entry is never dropped.
export function dedupeAlso(main) {
  if (!main.also?.length) return main;
  const best = new Map();
  for (const a of main.also) {
    const k = a.source_url;
    if (k === main.source_url) continue;
    const b = best.get(k);
    if (!b || (a.read_on || '9999') < (b.read_on || '9999')) best.set(k, a);
  }
  const out = [], done = new Set();
  for (const a of main.also) { if (best.has(a.source_url) && !done.has(a.source_url)) { done.add(a.source_url); out.push(best.get(a.source_url)); } }
  if (out.length) main.also = out; else delete main.also;
  return main;
}

// Merge kind "round" entries in the funding section. Returns { entries, merges }. The main entry of a group is the one
// read earliest (the first in order on a tie); the others become "also" items. The main keeps its own name, what, place,
// amount and source; investors named by the others are added to its list so investor links are not lost.
export function mergeRounds(entries, placeName = {}) {
  const idx = entries.map((e, i) => (e.section === 'funding' && e.kind === 'round' ? i : -1)).filter(i => i >= 0);
  const parent = new Map(idx.map(i => [i, i]));
  const find = i => { while (parent.get(i) !== i) i = parent.get(i); return i; };
  for (let p = 0; p < idx.length; p++) for (let q = p + 1; q < idx.length; q++) {
    if (sameDeal(entries[idx[p]], entries[idx[q]])) parent.set(find(idx[q]), find(idx[p]));
  }
  const groups = new Map();
  for (const i of idx) { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); }
  const drop = new Set(), merges = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const order = [...g].sort((a, b) => (entries[a].read_on || '9999').localeCompare(entries[b].read_on || '9999') || a - b);
    const main = entries[order[0]];
    const notes = [];
    for (const i of order.slice(1)) {
      const o = entries[i];
      drop.add(i);
      (main.also ||= []).push({ name: o.name, source_url: o.source_url, read_on: o.read_on, source_license: o.source_license, file: o.file, provenance: o.provenance }, ...(o.also || []));
      const pa = parseAmount(o.amount), pm = parseAmount(main.amount);
      if (o.amount && (pa && pm ? pa.cur !== pm.cur || pa.n !== pm.n : o.amount !== main.amount)) notes.push(`${o.amount} also reported`);
      if (o.place !== main.place) notes.push(`${placeName[o.place] || o.place} also reported`);
      if (o.investors?.length) {
        const key = x => strip(x).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        main.investors = [...(main.investors || [])];
        for (const v of o.investors) if (!main.investors.some(m => key(m) === key(v))) main.investors.push(v);
      }
    }
    dedupeAlso(main);
    if (notes.length) main.differs = `sources differ: ${[...new Set(notes)].join('; ')}`;
    merges.push({ company: roundCompany(main), dates: order.map(i => entries[i].date), names: order.map(i => entries[i].name), sources: order.map(i => entries[i].source_url) });
  }
  return { entries: entries.filter((_, i) => !drop.has(i)), merges, before: idx.length };
}
