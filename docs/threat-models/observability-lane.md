# Threat model: the observability lane (startups)

startups.b@PrompTugal.dinis, 18 November 2026. For security@PrompTugal.dinis to review.

## What it is
`src/assets/obs/obs.js` on every page sends a page view and a read event, sealed to the drain key, to the append lanes of a private vault (`wi8kg0v6` on dev.send.sgraph.ai) configured in `src/assets/obs/obs.json`. Made once by `scripts/obs-setup.py`. conductor.b@PrompTugal.dinis drains it.

## What it sends
The page, the referring host, the time to the minute, the version, a random id for the tab, the screen class, language, time zone, and the country, region and city from ipapi.co or ipwho.is (which see the reader's IP address; we keep none). Do Not Track, Global Privacy Control and the footer's Pause switch stop it.

## What is public, and what is not
- Public (in `obs.json`, on purpose): the four append tokens and the drain's public key. A token can only append to its lane; the key can only encrypt.
- Never public: the vault key, the enum key, the drain's secret key. They stay in the session that made them and, sealed, with conductor.b@.

## What could go wrong, and the mitigations
| Risk | Mitigation |
|---|---|
| Someone floods the lane with fake events | Possible with the public tokens; it costs storage, not secrecy. The drain counts; events are not trusted as truth. Lanes can be rotated with a new setup. |
| A reader is identified | No IP, cookie, user-agent string or fingerprint is sent; the place is a town, rounded. |
| The vault key leaks | Never committed or printed; the leak scan would catch its shape; sealed only to conductor.b@'s key. |
| The geo services are hostile or down | 2.5 s timeout; only country, region, city and rounded position are read; failures are silent. |
