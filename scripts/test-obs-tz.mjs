// Tests of the tz table check (security@'s ruling of 19 Nov 2026, 05:14 UTC): same version must match its pin or stop the
// build; a newer registry version turns the table off (left out), unless the registry keeps this version's pin; a
// mismatching pin for this version stops the build. Each case checks the reason. Node built-ins only.
import { createHash } from 'node:crypto';
import { checkObsTz } from './lib/obs-tz.mjs';
const file = v => Buffer.from(JSON.stringify({ version: v, zones: { 'Europe/Lisbon': 'PT' } }));
const pin = raw => 'sha256-' + createHash('sha256').update(raw).digest('base64');
const A = file('1.0.0'), B = file('1.1.0');
let fails = 0;
const t = (name, fn, want) => { let got; try { got = JSON.stringify(fn()); } catch (e) { got = 'throws: ' + (/does not match/.test(e.message) ? 'mismatch' : e.message); }
  const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${got}, want ${want}`}`); };
t('same version, matching pin: on', () => checkObsTz({ obs_tz: { version: '1.0.0', integrity: pin(A) } }, A), '{"on":true,"version":"1.0.0"}');
t('same version, other bytes: stops', () => checkObsTz({ obs_tz: { version: '1.0.0', integrity: pin(B) } }, A), 'throws: mismatch');
t('newer version named: off, with the message', () => checkObsTz({ obs_tz: { version: '1.1.0', integrity: pin(B) } }, A), '{"on":false,"version":"1.0.0","message":"obs_tz 1.0.0 off: the registry names 1.1.0"}');
t('newer version, own pin kept: on', () => checkObsTz({ obs_tz: { version: '1.1.0', integrity: pin(B), versions: { '1.0.0': { integrity: pin(A) } } } }, A), '{"on":true,"version":"1.0.0"}');
t('newer version, own pin kept but wrong: stops', () => checkObsTz({ obs_tz: { version: '1.1.0', integrity: pin(B), versions: { '1.0.0': { integrity: pin(B) } } } }, A), 'throws: mismatch');
t('no obs_tz in the registry: off', () => checkObsTz({}, A), '{"on":false,"version":"1.0.0","message":"obs_tz 1.0.0 off: the registry names none"}');
if (fails) { console.error(`test-obs-tz: ${fails} failed`); process.exit(1); }
console.log('test-obs-tz: OK');
