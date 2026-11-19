// The shared map ptmap 1.0.2 (designer@; Dinis, 19 Nov 2026 about 17:40 UTC: Portugal big, London and the EU small).
// Vendored from PrompTugal__News__Website design/shared-map/v1.0.2/ (src/assets/ptmap/SOURCE.md), never loaded from
// promptugal.news, and checked at build against the registry's pins (map.versions["<v>"].integrity, sha384). As with the
// sites bar: the map is on only when the registry lists this version's pins and its review reads "passed"; otherwise it is
// left out of the build. A vendored file that does not match its pin stops the build. Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const MAP_VERSION = '1.0.2';
export const MAP_DIR = `assets/ptmap/${MAP_VERSION}`;
export const MAP_FILES = { 'ptmap.js': `src/${MAP_DIR}/ptmap.js`, 'ptmap.css': `src/${MAP_DIR}/ptmap.css` };
const SRI = /^sha(256|384|512)-[A-Za-z0-9+\/]{43,86}={0,2}$/;
const digest = (algo, raw) => `${algo}-` + createHash(algo).update(raw).digest('base64');

// Returns { on: true, message } or { on: false, message }. Throws when a vendored file does not match its pin.
export function checkMap(registry, read = (f) => readFileSync(f)) {
  const m = registry && registry.map;
  if (!m || typeof m !== 'object') return { on: false, message: `ptmap ${MAP_VERSION} off: the registry names no map` };
  const v = m.versions && Object.prototype.hasOwnProperty.call(m.versions, MAP_VERSION) ? m.versions[MAP_VERSION] : null;
  const pins = v && v.integrity;
  if (!pins) return { on: false, message: `ptmap ${MAP_VERSION} off: the registry lists no pins for it (it names ${m.version || 'none'})` };
  // the review of this version: versions["<v>"].review, or the top-level review when it is the version the registry names
  const review = String(v.review != null ? v.review : (m.version === MAP_VERSION ? m.review : '') || '');
  if (!/^passed\b/.test(review)) return { on: false, message: `ptmap ${MAP_VERSION} off: the registry's review reads "${(review || 'none').slice(0, 60)}"` };
  for (const [name, f] of Object.entries(MAP_FILES)) {
    const pin = pins[name];
    if (typeof pin !== 'string' || !SRI.test(pin)) throw new Error(`ptmap: the registry has no SRI pin for ${name} of ${MAP_VERSION}: not built`);
    if (digest(pin.split('-')[0], read(f)) !== pin) throw new Error(`ptmap: ${f} does not match the registry's pin for ${MAP_VERSION}: not built`);
  }
  return { on: true, message: `ptmap ${MAP_VERSION} on` };
}
