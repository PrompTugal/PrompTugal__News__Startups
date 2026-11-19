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

// OpenSSH key rules (security@'s ruling of 05:14 UTC). Sample keys are built here, so this file holds none.
const D = '-'.repeat(5), b64 = n => createHash('sha512').update('k' + n).digest('base64').replace(/=+$/, '');
const sshPub = (type) => `${type} AAAA` + b64(1) + b64(2);
const priv = kind => `${D}BEGIN ${kind}PRIVATE KEY${D}`;
const SSH = 'ssh public key outside its published field', PRIV = 'private key block';
for (const k of ['OPENSSH ', 'RSA ', 'EC ', 'DSA ', 'ENCRYPTED ', ''])
  for (const path of ['team/keys.json', REGISTRY_COPY, 'scripts/x.mjs'])
    expect(`private key header '${k}' fails in ${path}`, kinds(path, priv(k)).includes(PRIV), true);
expect('ssh-ed25519 key in its published field passes', kinds('team/keys.json', reg({ keys: [{ ssh_signing: { public_key: sshPub('ssh-ed25519') } }] })).filter(k => k === SSH), []);
expect('ssh-ed25519 key in another field of team/keys.json fails', kinds('team/keys.json', reg({ keys: [{ note: sshPub('ssh-ed25519') }] })).includes(SSH), true);
expect('ssh-rsa key in a script fails', kinds('scripts/x.mjs', `const k = '${sshPub('ssh-rsa')}'`).includes(SSH), true);
expect('ecdsa key in the registry copy fails', kinds(REGISTRY_COPY, reg({ k: sshPub('ecdsa-sha2-nistp256') })).includes(SSH), true);
expect('ssh key in a public_key field outside ssh_signing fails', kinds('team/keys.json', reg({ other: { public_key: sshPub('ssh-ed25519') } })).includes(SSH), true);
for (const type of ['ssh-ed25519', 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com', 'sk-ecdsa-sha2-nistp256@openssh.com']) {
  expect(`${type} key outside the published field fails`, kinds('board/team/startups/status.json', reg({ note: sshPub(type) })).includes(SSH), true);
  expect(`${type} key in ssh_signing.public_key passes`, kinds('team/keys.json', reg({ keys: [{ ssh_signing: { public_key: sshPub(type) } }] })).filter(k => k === SSH), []);
}
if (fails) { console.error(`test-leak-scan: ${fails} failed`); process.exit(1); }
console.log('test-leak-scan: OK');
