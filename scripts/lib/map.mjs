// The front page's maps: an inline SVG of mainland Portugal (or the Algarve) with one dot per fact,
// laid out in a sunflower around its place's seat, each dot a link to that fact on its place page.
// Facts with no single seat (the whole Algarve, Portugal as a whole) sit in a labelled cluster at sea.
// Outlines: Natural Earth (public domain) via world-atlas (ISC, data/map/LICENSE-world-atlas.txt).
// Written by startups@PrompTugal.dinis, 2026-11-19. Node built-ins only.
import { readFileSync, existsSync } from 'node:fs';

const rd = f => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
export const SECTION_LABEL = { support: 'incubators and programmes', funding: 'rounds and grants', companies: 'companies', investors: 'investors' };
const ORDER = ['funding', 'investors', 'support', 'companies'];

// view: { noLabel: id => bool (a dot cluster drawn without its name), lon0, lon1, lat0, lat1, w, outline, clusters: { placeId: [lon, lat, label] }, include: id => bool }
export function mapSvg({ entries, placeName, esc, view, title }) {
  const O = rd(`data/map/${view.outline}.json`), AT = rd('data/map/places-at.json');
  if (!O || !AT) return '';
  const { lon0, lon1, lat0, lat1, w } = view, k = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  const sc = w / ((lon1 - lon0) * k), h = Math.round((lat1 - lat0) * sc);
  const X = lo => +((lo - lon0) * k * sc).toFixed(1), Y = la => +((lat1 - la) * sc).toFixed(1);
  const land = (n, cls) => (O.countries[n] || []).map(poly => `<path class="${cls}" d="${poly.map(r => 'M' + r.map(([lo, la]) => `${X(lo)},${Y(la)}`).join('L') + 'Z').join('')}"/>`).join('');
  const seat = id => view.clusters?.[id] || (AT.at[id] && [...AT.at[id]]);
  const byPlace = new Map();
  for (const e of entries) {
    if (!view.include(e.place)) continue;
    const s = seat(e.place); if (!s) continue;
    if (!byPlace.has(e.place)) byPlace.set(e.place, []);
    byPlace.get(e.place).push(e);
  }
  const step = view.step || 2.3, r = view.dot || 1.6, GOLD = 2.39996;
  let dots = '', labels = '', placed = 0;
  for (const [id, list] of byPlace) {
    const [lo, la, label] = seat(id), cx = X(lo), cy = Y(la);
    list.sort((a, b) => ORDER.indexOf(a.section) - ORDER.indexOf(b.section));
    list.forEach((e, i) => {
      const rr = step * Math.sqrt(i), t = i * GOLD;
      const x = (cx + rr * Math.cos(t)).toFixed(1), y = (cy + rr * Math.sin(t)).toFixed(1);
      dots += `<a href="/places/${id}/#${esc(e.id)}" class="dot s-${e.section}"><title>${esc(`${e.name} (${e.kind}, ${placeName[id]})`)}</title><circle cx="${x}" cy="${y}" r="${r}"/></a>`;
      placed++;
    });
    const out = step * Math.sqrt(list.length) + 3;
    const name = label || placeName[id];
    if (view.noLabel?.(id) && !label) continue;
    const left = cx > w * 0.78;
    if (label || list.length >= (view.labelMin || 1)) labels += `<a href="/places/${id}/" class="plabel"><text x="${(left ? cx - out : cx + out).toFixed(1)}" y="${(cy + 3 + (view.labelDy?.[id] || 0)).toFixed(1)}"${left ? ' text-anchor="end"' : ''}>${esc(name)} <tspan>${list.length}</tspan></text></a>`;
  }
  const aria = `${title}: ${placed} facts as dots, ${byPlace.size} places`;
  return { svg: `<svg class="ptmap" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title>${land('Spain', 'es')}${land('Portugal', 'pt')}${dots}${labels}</svg>`, placed, places: byPlace.size };
}

export function legendHtml(counts) {
  return `<p class="maplegend">${ORDER.map(s => `<span class="key s-${s}"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4"/></svg> ${SECTION_LABEL[s]}${counts ? ` (${counts[s]})` : ''}</span>`).join('')}</p>`;
}

export const VIEWS = {
  portugal: { outline: 'portugal-outline', lon0: -11.3, lon1: -6.1, lat0: 36.85, lat1: 42.2, w: 460, step: 2.1, dot: 1.5, labelMin: 3,
    clusters: { portugal: [-10.45, 39.6, 'Portugal as a whole'], algarve: [-8.2, 36.92, 'Algarve-wide'] }, include: () => true },
  algarve: { outline: 'algarve-outline', lon0: -9.05, lon1: -7.25, lat0: 36.84, lat1: 37.55, w: 460, step: 3.4, dot: 2.3, labelMin: 1,
    clusters: { algarve: [-8.15, 36.9, 'Algarve-wide'] }, labelDy: { olhao: 10, 'vila-real-de-santo-antonio': 6, 'castro-marim': -4 }, include: id => id !== 'portugal' && id !== 'lisboa' && id !== 'porto' },
};
