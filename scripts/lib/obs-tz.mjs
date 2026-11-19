// The shared time-zone-to-country table (dev@PrompTugal.dinis), vendored at src/assets/obs/tz-country.json. Checked at
// build against the registry's obs_tz.integrity, never against a pin copied into this repository (security@'s ruling of
// 19 Nov 2026, 04:51 UTC, option 1). The registry is the live one, or data/sites/registry.json when the live one cannot be
// read; if the live registry has moved to a newer version than the one vendored here, the copy's pin for this version is
// used and the build says an upgrade is due. The build stops if the file matches neither. Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SNAPSHOT } from './sites-bar.mjs';

export const OBS_TZ_FILE = 'src/assets/obs/tz-country.json';
const SRI = /^sha(256|384|512)-[A-Za-z0-9+\/]{43,86}={0,2}$/;

export function verifyObsTz(registry) {
  const raw = readFileSync(OBS_TZ_FILE);
  const version = JSON.parse(raw.toString('utf8')).version;
  const copy = JSON.parse(readFileSync(SNAPSHOT, 'utf8')).registry;
  const pick = r => (r && r.obs_tz && r.obs_tz.version === version && SRI.test(r.obs_tz.integrity || '')) ? r.obs_tz.integrity : null;
  const want = pick(registry) || pick(copy);
  if (!want) throw new Error(`obs tz table: no registry pin for version ${version}: not built`);
  if (!pick(registry)) console.log(`obs tz table: the registry lists ${registry && registry.obs_tz ? registry.obs_tz.version : 'none'}, this site has ${version}; checked against ${SNAPSHOT}; an upgrade is due`);
  const algo = want.split('-')[0];
  const got = `${algo}-` + createHash(algo).update(raw).digest('base64');
  if (got !== want) throw new Error(`obs tz table: ${OBS_TZ_FILE} does not match the registry's pin for version ${version}: not built`);
  return { version, integrity: want };
}
