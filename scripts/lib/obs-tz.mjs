// The shared time-zone-to-country table (dev@PrompTugal.dinis), vendored at src/assets/obs/tz-country.json. Checked at
// build against the registry (the live one, or data/sites/registry.json when the live one cannot be read), never against
// a pin copied into this repository (security@'s ruling of 19 Nov 2026, 04:51 UTC, option 1). Version bumps, per
// security@'s ruling (Website 1acd10498, 05:14 UTC):
//   - the registry names this version: the file must match its pin, or the build stops;
//   - the registry names a newer version: this version's own pin is used if the registry still keeps it
//     (obs_tz.versions["<v>"].integrity); otherwise the table is left out of the site (never shipped unchecked), so no
//     country is sent, and the build log says "obs_tz <v> off: the registry names <newer>".
// Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const OBS_TZ_FILE = 'src/assets/obs/tz-country.json';
export const OBS_TZ_SITE = 'assets/obs/tz-country.json';
const SRI = /^sha(256|384|512)-[A-Za-z0-9+\/]{43,86}={0,2}$/;
const digest = (algo, raw) => `${algo}-` + createHash(algo).update(raw).digest('base64');

// Returns { on: true, version } or { on: false, version, message }. Throws when a pin for this version does not match.
export function checkObsTz(registry, raw = readFileSync(OBS_TZ_FILE)) {
  const version = JSON.parse(raw.toString('utf8')).version;
  const o = registry && registry.obs_tz;
  if (!o) return { on: false, version, message: `obs_tz ${version} off: the registry names none` };
  const pin = o.version === version ? o.integrity : (o.versions && o.versions[version] && o.versions[version].integrity);
  if (!pin) return { on: false, version, message: `obs_tz ${version} off: the registry names ${o.version}` };
  if (!SRI.test(pin)) throw new Error(`obs tz table: the registry's pin for ${version} is not an SRI string: not built`);
  if (digest(pin.split('-')[0], raw) !== pin) throw new Error(`obs tz table: ${OBS_TZ_FILE} does not match the registry's pin for version ${version}: not built`);
  return { on: true, version };
}
