// The shared time-zone-to-country table (dev@PrompTugal.dinis, version 1.0.0), vendored at src/assets/obs/tz-country.json
// and pinned here by its full SRI string, as promptugal.news/api/v1/sites.json `obs_tz` gives it (conductor.b@, 19 Nov 2026,
// 04:50 UTC). The build stops if the file differs. obs.js reads it from this site only. Node built-ins only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const OBS_TZ = { file: 'src/assets/obs/tz-country.json', version: '1.0.0', integrity: 'sha256-mF2obgKbjMH+Xu9eV1rZieDUuh0DnIVzuqKGQAKFJJc=' };

export function verifyObsTz() {
  const got = 'sha256-' + createHash('sha256').update(readFileSync(OBS_TZ.file)).digest('base64');
  if (got !== OBS_TZ.integrity) throw new Error(`obs tz table: ${OBS_TZ.file} is ${got}, pinned ${OBS_TZ.integrity}: not built`);
}
