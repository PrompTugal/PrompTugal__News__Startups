# Hand-over: startups.promptugal.news, first version

startups@PrompTugal.dinis (Opus, session_018yvwtNmAs1tsZPsYxxjP4z), 17 November 2026. Started by conductor@PrompTugal.dinis at Dinis's word. Sub-agents run inside this session: two startups.research@PrompTugal.dinis (Sonnet).

## What exists
- The site, live at https://startups.promptugal.news from `dev`: front page (variation A), `/places/` and 36 place pages, `/support/`, `/funding/`, `/companies/`, `/investors/` (a section), `/about/` (provenance and the gaps list), `/design/` (three front pages: A the ledger, B the map of places, C the founder's path). Every page has a markdown twin (`index.md`); plus `llms.txt`, `sitemap.xml`, `data/facts.json`. Version in the masthead and footer, pay statement in the masthead linking to promptugal.news/account/.
- 473 facts from 132 source sites across 32 places (support 231, rounds and grants 108, companies 117, investors 17), each with source and date read. Counts are what `scripts/generate.mjs` printed at build.
- Code: `scripts/import-website.mjs` (imports PrompTugal__News__Website's by-place lists and Portuguese mapped companies, public fields only, from commit dfa068e), `scripts/generate.mjs` and `scripts/lib/front-variants.mjs` (all pages), the template's `build.mjs`, `validate.mjs`, `leak-scan.mjs`, `check-commits.mjs`, `release.sh` unchanged except that `build.mjs` calls the generator.
- `.gitignore` had a Python-template `lib/` rule; `!scripts/lib/` added so the build helper is tracked.

## What I learnt
- The gate's commit check (`scripts/check-commits.mjs`) accepts only `Agent: role@agenticcells.<person>`. The five-sites brief asks for `Agent: startups@PrompTugal.dinis`. I did not change the check: commits carry subject `startups@PrompTugal.dinis: ...` and trailer `Agent: startups@AgentiCCells.dinis`. Trailers must be one block at the end (a blank line before Co-Authored-By hides Agent:).
- The validator treats any non-http href as a local link, so a research gap whose `url` is prose broke the build; gaps now show non-URLs as text.
- Research sub-agents sometimes fill `url` with a guessed home page. For the Algarve file I set `url` to the page actually read for those (noted in the file's `notes`). Ask for "only URLs you read" in future briefs.

## What is next
1. Re-check the Algarve Evolution facts at algarveevolution.pt and CRIA at cria.pt (both returned 503 today; the entries rest on a newsroom.sgit.ai summary).
2. Places with few or no facts: Vila Real de Santo António, Aljezur, Vila do Bispo, Lagoa (Lagoa Business Center), Quarteira; then Braga, Coimbra (IPN), Aveiro.
3. Lisbon: Nova SBE, ISCTE, Hub Criativo do Beato, Lab2Market@Técnico, Porto Business School (seen only in search snippets, not recorded).
4. Investors: more funds and angel networks with named 2025 to 2026 deals (Armilar, Faber, Busy Angels, Shilling, Bynd); then decide if they get their own site.
5. Rounds filed as national because the source names no city (Sword Health, Tekever, Bloq.it and others): find each company's own stated base.
6. Read data.promptugal.news's API instead of the Website repo when it exists.
7. Dinis's choice of front page: set `chosen` in `scripts/generate.mjs`.

## What blocks me
- **No session key.** `pki-agent.mjs keygen --session` was refused by this session's permission system. `board/keys.json` records it as pending; commits are unsigned. Not worked around.
- Sites that refused or failed (403, 503, 445, 404) are listed in `/about/` and in each research file's `gaps`.

## What Dinis must decide
- Which front page: A, B or C (https://startups.promptugal.news/design/).
- The Agent trailer: keep `startups@AgentiCCells.dinis` for this repo's commit check, or allow `@PrompTugal.dinis` in `check-commits.mjs` (a change to a check, so his call).
- Allow the session key to be made (permission for `pki-agent.mjs keygen`), or make one on the other account.
- Whether third-party summaries (newsroom.sgit.ai) may stand as sources until the primary page can be read.

## Where things live
- Data: `data/from-website.json` (generated), `data/research/*.json` (hand-collected), `data/README.md` (shape). Rules for this repo: the last section of `CLAUDE.md`. No notes or state outside the repository.
