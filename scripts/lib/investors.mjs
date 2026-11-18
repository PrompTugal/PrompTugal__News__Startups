// Investors section: group investors by type and link them to the round entries that name them.
// Pure functions over the merged entries; generate.mjs renders the result.

export const GROUPS = ['Venture capital funds', 'Corporate venture', 'Angel networks and angel funds', 'Public and publicly backed', 'Other'];

// Type rule, first match wins. It reads the kind, the name and the text we hold; it is an inference, not a claim by the investor.
export function investorGroup(e) {
  const t = `${e.name} ${(e.what || '').split(/\.\s/)[0]}`; // the name and the first sentence only, so a passing mention of a backer does not decide the type
  if (/corporate venture|venture arm of/i.test(t)) return GROUPS[1];
  if (e.kind === 'angel network' || /\bangels?\b/i.test(e.name)) return GROUPS[2];
  if (/portugal ventures|banco portugu[eê]s de fomento|caixa capital/i.test(e.name) || /state development bank|\bstate[- ]owned\b/i.test(t)) return GROUPS[3];
  if (e.kind === 'fund' || /venture|capital|\bfund\b|\bVC\b/i.test(t)) return GROUPS[0];
  return GROUPS[4];
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// The name before any parenthesis or colon: "Banco Português de Fomento (group)" -> "Banco Português de Fomento".
export const baseName = s => String(s || '').split(/[(:]/)[0].trim();
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Does round entry r name investor base name b? First through investors[] (whole name, or the listed name is the start of ours, 5+ characters),
// failing that through the round's name and text (whole words, case and accent insensitive, 5+ characters only).
function names(r, b) {
  const nb = norm(b);
  for (const i of r.investors || []) {
    const ni = norm(baseName(i));
    if (ni === nb || (ni.length >= 5 && nb.startsWith(ni + ' '))) return true;
  }
  if (nb.length < 5) return false;
  return new RegExp(`(^|[^a-z0-9])${escRe(nb)}([^a-z0-9]|$)`).test(norm(`${r.name} ${r.what || ''}`));
}

// Only plain EUR amounts parse: "EUR 600,000", "1.6 million euros", "6 million euros". Anything with a qualifier, another currency or extra text is not parsed.
export function parseEur(a) {
  const m = String(a || '').trim().match(/^(?:EUR\s*|€\s*)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s+million)?(\s+euros)?$/i);
  if (!m) return null;
  if (!/^(EUR|€)/i.test(a.trim()) && !m[3]) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Math.round(m[2] ? n * 1e6 : n);
}

export function buildInvestors(entries) {
  const invs = entries.filter(e => e.section === 'investors');
  const rounds = entries.filter(e => e.section === 'funding');
  // One row per base name: the same investor listed under two places is one row, the other listings kept as "also".
  const rows = new Map();
  for (const e of [...invs].sort((a, b) => a.name.localeCompare(b.name) || a.place.localeCompare(b.place))) {
    const key = norm(baseName(e.name));
    if (!rows.has(key)) rows.set(key, { name: baseName(e.name), base: baseName(e.name), main: e, others: [] });
    else rows.get(key).others.push(e);
  }
  const out = [];
  for (const r of rows.values()) {
    r.group = investorGroup(r.main);
    r.deals = rounds.filter(x => names(x, r.base));
    const amts = r.deals.map(d => parseEur(d.amount));
    r.total = r.deals.length && amts.every(a => a != null) ? amts.reduce((s, a) => s + a, 0) : null;
    out.push(r);
  }
  const groups = GROUPS.map(g => ({ title: g, rows: out.filter(r => r.group === g).sort((a, b) => a.name.localeCompare(b.name)) }));
  const dealIds = new Set(out.flatMap(r => r.deals.map(d => d.id)));
  return { groups, rows: out, dealsLinked: out.reduce((s, r) => s + r.deals.length, 0), distinctRounds: dealIds.size };
}
