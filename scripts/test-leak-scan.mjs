// Tests of the leak scan's one pin exemption (security@'s ruling of 19 Nov 2026, addendum 04:51 UTC): an SRI pin passes
// only in data/sites/registry.json, only in an .integrity or .integrity.<file> field, only as the whole value. Everything
// else of that shape, and any key-shaped string in the same file, must still fail. Each case checks the reason, not only
// the outcome. Node built-ins only; run in release.sh and CI before the scan.
import { scanText, REGISTRY_COPY } from './leak-scan.mjs';
import { createHash } from 'node:crypto';
// Sample values are computed here, so this file holds no long literal for the scan to find.
const sri = (algo, s) => `${algo}-` + createHash(algo).update(s).digest('base64');
const PIN = sri('sha256', 'pin one');                                            // a well-formed SRI pin
const PIN2 = sri('sha384', 'pin two');
const FAKE = createHash('sha512').update('not a pin').digest('base64').replace(/[+/=]/g, '').slice(0, 40);  // key-shaped, high-entropy
const reg = o => JSON.stringify(o, null, 1);
const kinds = (path, text) => scanText(path, text).map(f => f.kind);
let fails = 0;
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); };
const HE = 'long high-entropy string';

expect('pin in obs_tz.integrity of the registry copy passes', kinds(REGISTRY_COPY, reg({ registry: { obs_tz: { integrity: PIN } } })), []);
expect('pin in bar.integrity.js of the registry copy passes', kinds(REGISTRY_COPY, reg({ registry: { bar: { integrity: { js: PIN2 } } } })), []);
expect('key-shaped string in the same file still fails', kinds(REGISTRY_COPY, reg({ registry: { obs_tz: { integrity: PIN }, note: FAKE } })), [HE]);
expect('pin in a field not named integrity fails', kinds(REGISTRY_COPY, reg({ registry: { obs_tz: { checksum: PIN } } })), [HE]);
expect('pin with text around it fails', kinds(REGISTRY_COPY, reg({ registry: { obs_tz: { integrity: PIN + ' x' } } })), [HE]);
expect('pin in any other file fails', kinds('scripts/lib/obs-tz.mjs', `const pin = '${PIN}';`), [HE]);
expect('pin in a status file fails', kinds('board/team/startups/status.json', reg({ integrity: PIN })), [HE]);
expect('token in an integrity field fails', kinds(REGISTRY_COPY, reg({ registry: { obs_tz: { integrity: FAKE } } })), [HE]);
if (fails) { console.error(`test-leak-scan: ${fails} failed`); process.exit(1); }
console.log('test-leak-scan: OK');
