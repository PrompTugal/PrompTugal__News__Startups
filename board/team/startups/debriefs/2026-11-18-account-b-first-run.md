# Hand-over: startups.promptugal.news, 18 November 2026 (account B, first run)

startups.b@PrompTugal.dinis (Opus), started by conductor.b@PrompTugal.dinis at Dinis's word (PrompTugal__News__Website `board/guidance/2026-11-18-five-sites-on-account-b.md`). Sub-agents in this run: startups.b.dev@ and startups.b.research@ (Sonnet). Carries on from `2026-11-17-first-version.md`.

## Done
- **Masthead (fix 3):** one chip, "Pay for what you read · £balance", on every page, visible on phones. This site runs its own copy of promptugal.news's meter (sg-meter v1.5.0, vendored; `src/assets/meter/SOURCE.md`); config made by `scripts/lib/billing.mjs` from `data/billing/`. `/account/` shows the balance, history and reading graph. The sites rail (Weather, Civic, Startups, Travel, Data) sits at the right edge on wide screens. Checked in Chromium at 1280 and 390 px.
- **IPMA (fix 4):** no page here is built on IPMA data.
- **Observability (fix 5):** `src/assets/obs/obs.js` (promptugal.news's, two edits) reads promptugal.news's `obs.json`, so no lane token or drain key sits in this repository; events carry `site: startups.promptugal.news`. Lane name `startups`, in `status.json` for conductor.b@ to relay.
- **Research:** investors (13 entries) and the centre-north (12 entries), with 29 gaps; Granter and Neuraspace re-read at source; one British company's round removed.

## What I learnt
- The validator refuses third-party scripts and em dashes even in vendored comments; the leak scan flags append tokens and public keys outside `team/keys`. Reading config cross-origin (JSON, not a script) keeps both gates whole.
- meter.css hides the chip under 768 px (promptugal.news moves it into its own top bar); `site.css` overrides that here.
- Research sub-agents read through a summarising fetch: re-read amounts at source before publishing.

## Blocked (not worked around)
- **Session key (fix 1):** the permission system refused `pki-agent.mjs keygen --session` again. Nothing is signed. Recorded in `board/keys.json`.
- **Commit check (fix 2):** changing `scripts/check-commits.mjs` to accept `@PrompTugal.dinis` was refused. Commits carry `Agent: startups.b@AgentiCCells.dinis`.

## Next
1. Investors that refused or did not resolve today: Busy Angels, Hovione Capital, Sonae IM, Big Start Ventures, Beta Capital; Portugal Ventures' 2025 annual report.
2. Centre-north rounds of 2025 to 2026; Startup Guimarães, Startup Viseu, UA Incubator, PCI (unreachable today).
3. From the first debrief: Algarve Evolution and CRIA at source; each nationally filed company's own base.

## For Dinis
- Allow the session key, or make it; allow the commit check change, or keep the AgentiCCells trailer.
- Top-up: the account page's button goes to promptugal.news's top-up page, and credit lands there. Keep, or no top-up here until this site has its own?
- Front page A, B or C at https://startups.promptugal.news/design/.

## 10:43 wake (scheduled)
- No hold; guidance read (nothing new for this site). The key and the commit check not retried (refused twice; waiting on Dinis).
- `/calls/`: open calls, soonest first, with "Open now" boxes on place pages and "Closing soon" on the front page (startups.b.dev@). The closing date comes from a date written in the entry's status, else the entry's date for call-like kinds; rounds and grants never count.
- Research (startups.b.research@): open calls nationwide (7) and the thin Algarve places (19). INPI SME Fund, Startup Braga's Global Health Accelerator and the Algarve 2030 deadlines re-read at source; duplicates and a one-day event removed. Several Algarve entries rest on 2016 to 2022 reports and say so.
- Learnt: a page that counts days goes stale between builds; a daily CI rebuild would fix it (asked of Dinis).

## 13:43 wake (scheduled)
- No hold; no new guidance for this site. Key and commit check not retried.
- `/investors/` as a section (startups.b.dev@): five groups, named deals linked. I removed its totals column: the same round appears as several entries (Granter three times), so totals overstated.
- Open calls in the cities (startups.b.research@): only 4 with a stated closing date; most city programmes are closed, undated or refused (startuplisboa.com 404, startupleiria.pt does not resolve from this session). Founder Institute removed (paid; its date is a price deadline).
- Learnt: duplicate round entries now matter, because pages link and count them; merging rounds by company and date is the next data fix.

## Between wakes (~14:25 to 15:20 UTC), at Dinis's word relayed by conductor.b@ (checked in the guidance)
- Licences on every fact (startups.b.dev@; field names as data.b@'s licence.mjs) and the terms pages of 144 source hosts (startups.b.research@): 4 publish a licence, 36 a terms page, 104 not found or refused.
- Daily rebuild and the take-down disclaimer.
- Keygen refused a third time, after Dinis's yes; conductor.b@ told. Own observability lane waits on the key.
