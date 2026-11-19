// The PrompTugal sites bar 1.2.0 on startups.promptugal.news (Dinis, 18 November 2026, about 22:00 UTC, and 19 November
// 2026, 03:18 UTC, the one switcher; PrompTugal__News__Website board/guidance/2026-11-18-the-sites-bar.md). security@ said
// go on 1.2.0 at its 07:03 wake (Website 055e6c1430); conductor.b@ relayed it at 07:15 UTC.
// The three files are vendored, never loaded from promptugal.news, and checked at build against the registry's pins
// (bar.integrity for the version it names, or bar.versions["<v>"].integrity), never against a pin copied into this
// repository (security@'s ruling of 04:51 UTC, option 1). The registry is the live one, or data/sites/registry.json when
// the live one cannot be read. If the registry no longer lists this version, the bar is switched off (no bar, never a
// hand-made one) and the build log says "sites-bar <v> off: the registry names <newer>"; a file that does not match its
// pin stops the build (security@'s ruling of 05:14 UTC). The renderer is imported only after its own bytes are checked.
// If the renderer refuses the registry (returns ''), the pages are built without a bar. Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BAR_VERSION = '1.2.0';
export const HERE = 'startups.promptugal.news';
export const REGISTRY_URL = 'https://promptugal.news/api/v1/sites.json';
export const SNAPSHOT = 'data/sites/registry.json';
export const BAR_FILES = {
  js: `src/assets/sites-bar/${BAR_VERSION}/sites-bar.js`,
  css: `src/assets/sites-bar/${BAR_VERSION}/sites-bar.css`,
  render: `scripts/lib/sites-bar/${BAR_VERSION}/sites-bar-render.mjs`,
};
const SRI = /^sha(256|384|512)-[A-Za-z0-9+\/]{43,86}={0,2}$/;
const digest = (algo, raw) => `${algo}-` + createHash(algo).update(raw).digest('base64');

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

// Returns { on: true } or { on: false, message }. Throws when a vendored file does not match this version's pin.
export function checkBar(registry, read = f => readFileSync(f)) {
  const b = registry && registry.bar;
  if (!b) return { on: false, message: `sites-bar ${BAR_VERSION} off: the registry names none` };
  // a version's pins: bar.integrity for the one the registry names; for others bar.versions["<v>"], whose pins sit either
  // under .integrity (obs_tz's shape) or directly as js, css and render (the bar's shape on 19 Nov 2026)
  const kept = b.versions && Object.prototype.hasOwnProperty.call(b.versions, BAR_VERSION) ? b.versions[BAR_VERSION] : null;
  const pins = b.version === BAR_VERSION ? b.integrity : (kept && (kept.integrity || kept));
  if (!pins) return { on: false, message: `sites-bar ${BAR_VERSION} off: the registry names ${b.version}` };
  for (const [k, f] of Object.entries(BAR_FILES)) {
    const pin = pins[k];
    if (typeof pin !== 'string' || !SRI.test(pin)) throw new Error(`sites bar: the registry has no SRI pin for ${k} of ${BAR_VERSION}: not built`);
    if (digest(pin.split('-')[0], read(f)) !== pin) throw new Error(`sites bar: ${f} does not match the registry's pin for ${BAR_VERSION}: not built`);
  }
  return { on: true };
}

// Returns { html, on, message }: html is '' when the bar is off or the renderer refuses the registry.
export async function loadBar({ registry }) {
  const c = checkBar(registry);
  if (!c.on) return { html: '', on: false, message: c.message };
  const { render } = await import(pathToFileURL(BAR_FILES.render).href);   // only after its bytes matched the pin
  const html = render(registry, { here: HERE });                           // 1.2.0: same-tab links (Dinis, 03:18 UTC)
  return { html, on: true, message: html ? `sites-bar ${BAR_VERSION} on` : `sites-bar ${BAR_VERSION}: the renderer refused the registry; built without a bar` };
}

// This site's own entry in the registry (its line and accent), for the preview.
export function ownEntry(registry) {
  const s = registry && Array.isArray(registry.sites) ? registry.sites : [];
  return s.find(e => { try { return new URL(e.url).hostname === HERE; } catch { return false; } }) || null;
}
