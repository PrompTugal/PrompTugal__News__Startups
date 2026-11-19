// The PrompTugal sites bar v1.1.0 on startups.promptugal.news (Dinis, 18 November 2026, about 22:00 UTC:
// PrompTugal__News__Website board/guidance/2026-11-18-the-sites-bar.md; cleared to install by conductor.b@ on
// 19 November 2026, 00:55 UTC, after security@'s post-review of the exact files, Website commit 6b0335be).
// The three files are vendored, never loaded from promptugal.news, and pinned here by sha256: the build stops if one
// differs. At build the registry is read from promptugal.news/api/v1/sites.json and rendered by the vendored renderer;
// if the registry cannot be read, the last snapshot committed in data/sites/registry.json is used; if the renderer
// refuses the registry (returns ''), the pages are built without a bar, never with a hand-made one. Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { render } from './sites-bar/1.1.0/sites-bar-render.mjs';

export const BAR_VERSION = '1.1.0';
export const HERE = 'startups.promptugal.news';
export const REGISTRY_URL = 'https://promptugal.news/api/v1/sites.json';
const PINNED = {
  'scripts/lib/sites-bar/1.1.0/sites-bar-render.mjs': 'b9b50ae32fd5dc234ba6e9b4660061afb25554b542a1c779f68d1d8c61a98dbc',
  'src/assets/sites-bar/1.1.0/sites-bar.css': '302e2544eb34e3d6ce8d8e14fe2918c9f658a587f62d47d4ca20b2b4f3f7854d',
  'src/assets/sites-bar/1.1.0/sites-bar.js': 'bc97a820a8f4fbda60ff65c3073be6fe79b2d1d3ee954257e3a59bca7429e9b0',
};
export const SNAPSHOT = 'data/sites/registry.json';

export function verifyPinned() {
  for (const [f, want] of Object.entries(PINNED)) {
    const got = createHash('sha256').update(readFileSync(f)).digest('hex');
    if (got !== want) throw new Error(`sites bar: ${f} has sha256 ${got.slice(0, 12)}, pinned ${want.slice(0, 12)}: not built`);
  }
}

async function fetchRegistry() {
  const r = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(20000), redirect: 'error', headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  if (t.length > 200000) throw new Error('registry larger than 200 kB');
  return JSON.parse(t);
}

// The registry: the live one, or this site's copy when the live one cannot be read. Returns { registry, from }.
export async function loadRegistry() {
  try { return { registry: await fetchRegistry(), from: REGISTRY_URL }; }
  catch (e) {
    const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
    return { registry: snap.registry, from: `${SNAPSHOT} (read ${snap.read_on}; live registry not read: ${String(e.message || e).slice(0, 80)})` };
  }
}

// Returns { html, registry, from }: html is '' when the renderer refuses the registry.
export function loadBar({ registry, from }) {
  verifyPinned();
  const html = render(registry, { here: HERE, newTab: true });
  return { html, registry, from };
}

// This site's own entry in the registry (its line and accent), for the preview.
export function ownEntry(registry) {
  const s = registry && Array.isArray(registry.sites) ? registry.sites : [];
  return s.find(e => { try { return new URL(e.url).hostname === HERE; } catch { return false; } }) || null;
}
