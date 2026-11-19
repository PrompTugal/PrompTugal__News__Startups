// Tests of the sites bar check (security@'s rulings of 19 Nov 2026, 04:51 and 05:14 UTC): this version's files must match
// the registry's pins for it, or the build stops; a registry that no longer lists this version turns the bar off; the
// per-version pins (bar.versions) keep it on. Each case checks the reason. Node built-ins only.
import { createHash } from 'node:crypto';
import { checkBar, BAR_VERSION, BAR_FILES } from './lib/sites-bar.mjs';
const bytes = { [BAR_FILES.js]: Buffer.from('js'), [BAR_FILES.css]: Buffer.from('css'), [BAR_FILES.render]: Buffer.from('render') };
const read = f => bytes[f];
const pin = raw => 'sha256-' + createHash('sha256').update(raw).digest('base64');
const good = { js: pin(bytes[BAR_FILES.js]), css: pin(bytes[BAR_FILES.css]), render: pin(bytes[BAR_FILES.render]) };
const bad = { ...good, css: pin(Buffer.from('other')) };
let fails = 0;
const t = (name, fn, want) => { let got; try { got = JSON.stringify(fn()); } catch (e) { got = 'throws: ' + (/does not match/.test(e.message) ? 'mismatch' : /no SRI pin/.test(e.message) ? 'no pin' : e.message); }
  const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${got}, want ${want}`}`); };
t('this version named, pins match: on', () => checkBar({ bar: { version: BAR_VERSION, integrity: good } }, read), '{"on":true}');
t('this version named, one file differs: stops', () => checkBar({ bar: { version: BAR_VERSION, integrity: bad } }, read), 'throws: mismatch');
t('this version named, a pin missing: stops', () => checkBar({ bar: { version: BAR_VERSION, integrity: { js: good.js, css: good.css } } }, read), 'throws: no pin');
t('newer version named, ours kept in versions: on', () => checkBar({ bar: { version: '9.0.0', integrity: bad, versions: { [BAR_VERSION]: { integrity: good } } } }, read), '{"on":true}');
t('newer version named, ours kept but differs: stops', () => checkBar({ bar: { version: '9.0.0', integrity: good, versions: { [BAR_VERSION]: { integrity: bad } } } }, read), 'throws: mismatch');
t('newer version named, ours not listed: off', () => checkBar({ bar: { version: '9.0.0', integrity: good, versions: {} } }, read), `{"on":false,"message":"sites-bar ${BAR_VERSION} off: the registry names 9.0.0"}`);
t('no bar in the registry: off', () => checkBar({}, read), `{"on":false,"message":"sites-bar ${BAR_VERSION} off: the registry names none"}`);
t('newer version named, ours kept in the bar\'s own shape: on', () => checkBar({ bar: { version: '9.0.0', integrity: bad, versions: { [BAR_VERSION]: good } } }, read), '{"on":true}');
t('newer version named, ours kept in the bar\'s own shape but differs: stops', () => checkBar({ bar: { version: '9.0.0', integrity: good, versions: { [BAR_VERSION]: bad } } }, read), 'throws: mismatch');
if (fails) { console.error(`test-sites-bar: ${fails} failed`); process.exit(1); }
console.log('test-sites-bar: OK');
