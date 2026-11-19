// Tests for scripts/lib/ptmap.mjs: the shared map is on only with the registry's pins and a passed review; a file that
// does not match its pin stops the build. Node built-ins only. Written by startups.b@PrompTugal.dinis, 19 Nov 2026.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { checkMap, MAP_FILES, MAP_VERSION } from './lib/ptmap.mjs';

const sri = (f) => 'sha384-' + createHash('sha384').update(readFileSync(f)).digest('base64');
const pins = Object.fromEntries(Object.entries(MAP_FILES).map(([k, f]) => [k, sri(f)]));
const reg = (map) => ({ map });
let failed = 0;
const is = (name, got, want) => { if (got !== want) { failed++; console.error(`FAIL ${name}: got ${got}, want ${want}`); } };
const throws = (name, fn, text) => { try { fn(); failed++; console.error(`FAIL ${name}: did not throw`); } catch (e) { if (!String(e.message).includes(text)) { failed++; console.error(`FAIL ${name}: ${e.message}`); } } };

is('no map', checkMap(reg(undefined)).on, false);
is('version not listed', checkMap(reg({ version: '9.9.9', review: 'passed', versions: {} })).on, false);
is('review pending', checkMap(reg({ version: MAP_VERSION, review: 'pending: security@', versions: { [MAP_VERSION]: { integrity: pins } } })).on, false);
is('pins and passed review', checkMap(reg({ version: MAP_VERSION, review: 'passed (security@, b5fc4fdef)', versions: { [MAP_VERSION]: { integrity: pins } } })).on, true);
throws('wrong pin', () => checkMap(reg({ review: 'passed', versions: { [MAP_VERSION]: { integrity: { ...pins, 'ptmap.js': 'sha384-' + 'A'.repeat(64) } } } })), 'does not match');
throws('pin not SRI', () => checkMap(reg({ review: 'passed', versions: { [MAP_VERSION]: { integrity: { ...pins, 'ptmap.css': 'abc' } } } })), 'no SRI pin');
throws('a changed file', () => checkMap(reg({ review: 'passed', versions: { [MAP_VERSION]: { integrity: pins } } }), (f) => Buffer.concat([readFileSync(f), Buffer.from('x')])), 'does not match');
is('versions holding a prototype key is not a pin', checkMap(reg({ review: 'passed', versions: JSON.parse('{"__proto__": {"integrity": {}}}') })).on, false);
if (failed) { console.error(`FAILED (${failed} of 8 checks)`); process.exit(1); }
console.log('test-ptmap: OK (8 checks)');
