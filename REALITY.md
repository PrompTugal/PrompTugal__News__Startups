# REALITY.md: what exists now

- Seeded by the AgentiCCells site factory on 2026-11-17 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-17__startups-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-17: cells@AgentiCCells.dinis, at Dinis's word (~19:00 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME` (startups.promptugal.news), ignored `.credentials/` and `.sg-send/`, and created `main` from this commit.

## The first version (startups@PrompTugal.dinis, 17 November 2026)
- **Build:** `scripts/build.mjs` copies `src/` and runs `scripts/generate.mjs`, which builds every page from `data/` with its markdown twin (`index.md`), plus `llms.txt`, `sitemap.xml`, `404.html` and `data/facts.json`. Node built-ins only. The gate (`scripts/validate.mjs`) and the leak scan run in CI before each deploy; CI sets the version (v0.1.N) shown in every page's masthead and footer.
- **Pages:** front page (`/`, variation A), `/places/` and one page per place (36 places from PrompTugal.news's place list), `/support/` (incubators, accelerators, programmes, public desks), `/funding/` (rounds, grants, public money), `/companies/`, `/investors/` (a section for now), `/about/` (how it is made, gaps), `/design/` with three front page variations (A the ledger, B the map of places, C the founder's path) for Dinis to choose.
- **Data:** `data/from-website.json`, imported from PrompTugal__News__Website (commit dfa068e) by `scripts/import-website.mjs`: public fields only. The team's own research, read on 17 November 2026 by startups.research@PrompTugal.dinis (Sonnet) and reviewed by startups@: `data/research/algarve.json` (57 facts, 14 gaps: council incubators and nests, UAlg CRIA and TEC Campus, Algarve Evolution, ALGARVE 2030 calls, one round) and `data/research/lisbon-porto-national.json` (65 facts, 14 gaps: Lisbon and Porto hubs and calls, national programmes, 21 rounds, 11 investors, statistics). After merging and removing duplicates the site shows 473 facts from 132 source sites across 32 places: 231 support, 108 rounds and grants, 117 companies, 17 investors.
- **Brand:** PrompTugal.news brand v2.0 wordmark and favicon (copied from PrompTugal__News__Website `assets/brand/`), Newsreader and IBM Plex fonts hosted in `src/assets/fonts/` (SIL OFL 1.1), sub-brand "Startups".
- **Not done:** no session key (keygen was refused by the session's permission system), so commits and pages are not signed; no person has checked any fact; no data.promptugal.news API is read yet (it does not exist yet).
- **Live:** https://startups.promptugal.news over HTTPS, deployed from `dev` by `.github/workflows/pages.yml`.
- **Debrief:** `board/team/startups/debriefs/2026-11-17-first-version.md`.

## Account B (startups.b@PrompTugal.dinis, from 18 November 2026)
- **Lead:** startups.b@PrompTugal.dinis (Opus) on Dinis's other account, started by conductor.b@PrompTugal.dinis; sub-agents startups.b.dev@ and startups.b.research@ (Sonnet). Status: `board/team/startups/status.json`.
- **Masthead:** one chip, "Pay for what you read · £balance", in every page's masthead, on phones too. This site has its own meter: `src/assets/meter/meter.js`, `meter.css` and `src/assets/components/sg-meter/v1/v1.5/v1.5.0/sg-meter-core.js`, vendored from PrompTugal__News__Website f261682c (`src/assets/meter/SOURCE.md`); its config `api/v1/billing/meter.json` is made by `scripts/lib/billing.mjs` from `data/billing/`. The balance is kept in the reader's browser only. Top-up and pricing links go to promptugal.news's pages.
- **Account page:** `/account/`, with the balance, the history and the reading graph (drawn by meter.js). Not in the main navigation.
- **Sites rail:** Weather, Civic, Startups, Travel, Data, fixed at the right edge on screens 1180 px and wider.
- **Page views:** `src/assets/obs/obs.js` (promptugal.news's, two edits) reads promptugal.news's `obs.json` and writes to its lanes; events carry `site: startups.promptugal.news`. Lane name: `startups`. No token or key in this repository.
- **IPMA:** no page here is built on IPMA data.
- **Not done:** no session key (refused again on 18 November); the commit check still accepts only `@AgentiCCells` agents (changing it was refused), so commits carry `Agent: startups.b@AgentiCCells.dinis`.
