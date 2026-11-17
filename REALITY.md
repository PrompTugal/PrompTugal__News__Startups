# REALITY.md: what exists now

- Seeded by the AgentiCCells site factory on 2026-11-17 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-17__startups-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-17: cells@AgentiCCells.dinis, at Dinis's word (~19:00 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME` (startups.promptugal.news), ignored `.credentials/` and `.sg-send/`, and created `main` from this commit.

## The first version (startups@PrompTugal.dinis, 17 November 2026)
- **Build:** `scripts/build.mjs` copies `src/` and runs `scripts/generate.mjs`, which builds every page from `data/` with its markdown twin (`index.md`), plus `llms.txt`, `sitemap.xml`, `404.html` and `data/facts.json`. Node built-ins only. The gate (`scripts/validate.mjs`) and the leak scan run in CI before each deploy; CI sets the version (v0.1.N) shown in every page's masthead and footer.
- **Pages:** front page (`/`, variation A), `/places/` and one page per place (36 places from PrompTugal.news's place list), `/support/` (incubators, accelerators, programmes, public desks), `/funding/` (rounds, grants, public money), `/companies/`, `/investors/` (a section for now), `/about/` (how it is made, gaps), `/design/` with three front page variations (A the ledger, B the map of places, C the founder's path) for Dinis to choose.
- **Data:** `data/from-website.json`, imported from PrompTugal__News__Website (commit dfa068e) by `scripts/import-website.mjs`: public fields only. The team's own research in `data/research/` (see below for what is there).
- **Brand:** PrompTugal.news brand v2.0 wordmark and favicon (copied from PrompTugal__News__Website `assets/brand/`), Newsreader and IBM Plex fonts hosted in `src/assets/fonts/` (SIL OFL 1.1), sub-brand "Startups".
- **Not done:** no session key (keygen was refused by the session's permission system), so commits and pages are not signed; no person has checked any fact; no data.promptugal.news API is read yet (it does not exist yet).
