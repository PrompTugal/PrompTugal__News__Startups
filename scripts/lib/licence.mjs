// Licence fields for every entry. What we make is CC BY 4.0; what we take stays under its
// source's published licence, or links to the source's terms. Node built-ins only.
import { readFileSync, existsSync } from 'node:fs';

export const OWN = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', holder: 'PrompTugal.news', note: 'This record and its summary, written by PrompTugal.news.' };

export function loadLicences(path = 'data/source-licences.json') {
  const hosts = new Map();
  if (!existsSync(path)) return hosts;
  const d = JSON.parse(readFileSync(path, 'utf8'));
  for (const [h, v] of Object.entries(d.hosts || {})) hosts.set(h.toLowerCase().replace(/^www\./, ''), v);
  return hosts;
}

const parse = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x : null; } catch { return null; } };

export function sourceLicence(e, hosts) {
  const u = parse(e.source_url) || parse(e.url);
  if (!u) return { name: "the source's terms", url: '', holder: '', status: 'no source link' };
  const holder = u.hostname.toLowerCase().replace(/^www\./, '');
  const rec = hosts.get(u.hostname.toLowerCase().replace(/^www\./, '')) || {};
  if (rec.licence_url) return { name: rec.licence_name || 'published licence', url: rec.licence_url, holder, status: 'published licence' };
  if (rec.terms_url) return { name: "the source's terms", url: rec.terms_url, holder, status: 'terms page' };
  return { name: "the source's terms", url: u.origin + '/', holder, status: 'terms page not found yet' };
}

export function licenceHtml(e, esc) {
  const s = e.source_license; if (!s) return '';
  const link = s.url ? `<a href="${esc(s.url)}" rel="nofollow license">${esc(s.name)}</a>` : esc(s.name);
  return ` · licence: ${link}${s.status === 'terms page not found yet' ? ' (terms not found yet)' : ''}`;
}
export function licenceMd(e) {
  const s = e.source_license; if (!s) return '';
  return ` Licence: ${s.url ? `[${s.name}](${s.url})` : s.name}${s.status === 'terms page not found yet' ? ' (terms not found yet)' : ''}.`;
}
