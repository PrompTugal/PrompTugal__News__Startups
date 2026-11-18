#!/usr/bin/env python3
"""Make startups.promptugal.news's own observability lane ("startups"): startups.b@PrompTugal.dinis, 18 November 2026,
at Dinis's word in its session ("yes, make your key with sgit pki and set up your tracking lane") and the guidance
PrompTugal__News__Website board/guidance/2026-11-18-keys-issues-rebuilds-observability.md, item 5: "each site lead
creates its own lane and append tokens, keeps them out of the repository and every log, and shares the drain
credentials with conductor.b@ sealed to conductor.b@'s key".

Adapted from PrompTugal__News__Website newsroom/tools/obs/obs_setup.py (Apache-2.0), without the public vault
(conductor.b@ drains and publishes):

    SG_SEND_ACCESS_TOKEN=... python3 -I scripts/obs-setup.py --conductor-bundle <conductor.b-promptugal bundle.json>

1. a PRIVATE data vault (promptugal-obs-startups) on dev.send.sgraph.ai: a README, the drain key (identity/private/,
   an RSA-4096 pair made here; only its public half leaves the vault), identity/lanes.json (lane names by the SHA-256
   of each token); then four append lanes ('site') and the enum key that lists them;
2. writes the public half to src/assets/obs/obs.json: endpoint, vault id, the lanes' append tokens, the drain's
   public key. Public on purpose: a token can only append to its lane, and the key can only encrypt;
3. keeps the credentials (vault key, enum key, tokens) in ~/.sg-send/obs-startups/creds.json (0600), outside the
   repository, and seals them to conductor.b@'s key with sgit pki encrypt into ~/.sg-send/obs-startups/creds.json.enc,
   for delivery to conductor.b@.
Run once. Prints no credential.
"""
import argparse, datetime, hashlib, json, os, secrets, subprocess, sys, urllib.request

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://dev.send.sgraph.ai'
AGENT = 'startups.b@PrompTugal.dinis'
HOME = os.path.expanduser('~/.sg-send/obs-startups')
CREDS = os.path.join(HOME, 'creds.json')
VAULTS = os.path.expanduser('~/vaults')
NAME = 'promptugal-obs-startups'
h = lambda s: hashlib.sha256(s.encode()).hexdigest()


def post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'{}')


def run(cwd, *a):
    r = subprocess.run(list(a), cwd=cwd, capture_output=True, text=True)
    if r.returncode:   # the last line of stderr only, never the arguments (one is the access token)
        sys.exit(f'obs-setup: {a[0]} {a[1]} failed (exit {r.returncode}): ' + ((r.stderr or r.stdout).strip().splitlines() or [''])[-1][:200])
    return r.stdout


def wjson(p, obj, mode=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
    if mode:
        os.chmod(p, mode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--conductor-bundle', required=True, help="conductor.b-promptugal's public bundle (JSON), from PrompTugal__News__Website board/keys.json")
    o = ap.parse_args()
    if os.path.exists(CREDS):
        sys.exit(f'obs-setup: {CREDS} exists; the lane is made already')
    token = os.environ['SG_SEND_ACCESS_TOKEN']
    bundle = json.load(open(o.conductor_bundle))
    if not str(bundle.get('fingerprint', '')).startswith('sha256:'):
        sys.exit('obs-setup: the conductor bundle has no encryption fingerprint')
    from sgit_ai.crypto.PKI__Crypto import PKI__Crypto
    from sgit_ai.crypto.Vault__Crypto import Vault__Crypto
    pki, today = PKI__Crypto(), datetime.datetime.now(datetime.timezone.utc).strftime('%-d %B %Y')

    # 1. the private data vault, with the drain key inside it
    os.makedirs(VAULTS, exist_ok=True)
    d = os.path.join(VAULTS, NAME)
    if os.path.exists(d):
        sys.exit(f'obs-setup: {d} exists; this runs once')
    run(VAULTS, 'sgit', 'create', NAME, '--base-url', HOST, '--token', token, '--no-push')
    open(os.path.join(d, 'README.md'), 'w').write(
        f'# startups.promptugal.news observability: the data vault (private)\n\nMade by {AGENT} on {today}, at Dinis Cruz\'s word, '
        'with scripts/obs-setup.py in PrompTugal/PrompTugal__News__Startups. Page views and reads from startups.promptugal.news '
        '(src/assets/obs/obs.js) arrive sealed to the drain key (identity/) on this vault\'s append lanes (lane name: startups). '
        'conductor.b@PrompTugal.dinis drains them. Private: its read key would give out the lanes\' enum key and the drain key.\n')
    priv, pub = pki.generate_encryption_key_pair()
    pub_pem, priv_pem = pki.export_public_key_pem(pub), pki.export_private_key_pem(priv)
    fp = pki.compute_fingerprint(pub)
    os.makedirs(os.path.join(d, 'identity', 'private'), exist_ok=True)
    with open(os.path.join(d, 'identity', 'private', 'private_key.pem'), 'w') as f:
        f.write(priv_pem)
    wjson(os.path.join(d, 'identity', 'public-bundle.json'), {'encrypt': pub_pem, 'fingerprint': fp, 'label': 'startups.promptugal.news observability drain'})
    names = ['site 1', 'site 2', 'site 3', 'site 4']
    toks = [secrets.token_hex(32) for _ in names]
    wjson(os.path.join(d, 'identity', 'lanes.json'), {'about': 'The append lanes, in order, by the SHA-256 of each token (the anchor the server holds). Lane name: startups.',
                                                      'lanes': [{'name': n, 'anchor': h(t)} for n, t in zip(names, toks)]})
    run(d, 'sgit', 'commit', 'the data vault: README, the drain key, the lanes')
    run(d, 'sgit', 'push')
    vk = open(os.path.join(d, '.sg_vault', 'local', 'vault_key')).read().strip()
    vid = vk.split(':')[-1]
    enum_key = secrets.token_hex(32)
    write_key = Vault__Crypto().derive_keys_from_vault_key(vk)['write_key']
    r = post(f'{HOST}/api/vault/append/configure/{vid}', {'append_anchors': [h(t) for t in toks], 'enum_key_hash': h(enum_key)},
             {'x-sgraph-vault-write-key': write_key, 'x-sgraph-access-token': token})
    if r.get('status') != 'configured':
        sys.exit(f'obs-setup: configure answered {r.get("status")}')

    # 2. the public half, in this repository
    wjson(os.path.join(ROOT, 'src', 'assets', 'obs', 'obs.json'), {
        'about': f'startups.promptugal.news\'s own observability lane, named startups ({AGENT}, {today}, at Dinis Cruz\'s word; '
                 'made by scripts/obs-setup.py). Public on purpose: each append token can only write to its lane, and the key can only encrypt. '
                 'Used by assets/obs/obs.js on every page. The data vault is private; conductor.b@PrompTugal.dinis drains it.',
        'lane': 'startups', 'enabled': True, 'endpoint': HOST, 'vault_id': vid,
        'lanes': {'site': toks},
        'recipient': {'fingerprint': fp, 'encrypt': pub_pem},
        'geo': ['https://ipapi.co/json/', 'https://ipwho.is/']})

    # 3. the credentials: outside the repository, and sealed to conductor.b@
    creds = {'type': 'promptugal.obs/creds', 'lane': 'startups', 'site': 'startups.promptugal.news', 'host': HOST, 'vault_id': vid,
             'vault_key': vk, 'enum_key': enum_key, 'tokens': toks, 'lane_names': names, 'drain_key_fingerprint': fp,
             'drain_key_in': 'identity/private/private_key.pem in the vault', 'made': today, 'by': AGENT}
    os.makedirs(HOME, mode=0o700, exist_ok=True)
    wjson(CREDS, creds, 0o600)
    bf = os.path.join(HOME, 'conductor.b-bundle.json')
    wjson(bf, bundle)
    run(HOME, 'sgit', 'pki', 'import', bf)
    run(HOME, 'sgit', 'pki', 'encrypt', '--recipient', bundle['fingerprint'], '--output', CREDS + '.enc', CREDS)
    print(f'obs-setup: data vault {vid} (private, 4 lanes configured); drain key {fp}; src/assets/obs/obs.json written; '
          f'credentials in {CREDS} (0600) and sealed to {bundle["fingerprint"]} in {CREDS}.enc')


if __name__ == '__main__':
    main()
