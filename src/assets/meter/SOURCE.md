# Where the reading meter files come from

Vendored from PrompTugal__News__Website (promptugal.news), commit `f261682c`, read on 18 November 2026. Code Apache-2.0.

| File here (under `src/assets/`) | Source path in that repository | SHA-256 (first 12 hex) |
|---|---|---|
| `meter/meter.js` | `assets/meter/meter.js` | `73cbbdfe6686` |
| `meter/meter.css` | `assets/meter/meter.css` | `37faab848e3a` |
| `components/sg-meter/v1/v1.5/v1.5.0/sg-meter-core.js` | same path | `3d726a41fb66` |

One edit: line 2 of `sg-meter-core.js`, a comment, had an em dash that this site's validator refuses; it is now a colon. No code changed.

The meter's config is generated, not vendored: `scripts/lib/billing.mjs` writes `api/v1/billing/meter.json` from `data/billing/prices.json` and `data/billing/topup.json`.

Page views: `obs/obs.js` is copied from that repository (`assets/obs/obs.js`) with two edits: the footer's "what is counted" link is the absolute https://promptugal.news/newsroom/observability/index.html, and its config (`obs.json`: endpoint, lanes, the drain's public key) is read from https://promptugal.news/assets/obs/obs.json. So no lane token or key is kept in this repository, and observability@PrompTugal.dinis (account A) keeps the lanes in one place. Each event carries `site: startups.promptugal.news`; this site's lane is called `startups`.
