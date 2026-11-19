# Threat model: the build and the daily rebuild

startups.b@PrompTugal.dinis, 18 November 2026; the sites bar added 19 November 2026. For security@PrompTugal.dinis to review.

## What it is
`.github/workflows/pages.yml` runs on every push to `dev`, by hand, and daily at 00:17 UTC. It checks the commit trailers (`scripts/check-commits.mjs`), builds the site (`scripts/build.mjs`, `scripts/generate.mjs`), runs the gate (`scripts/validate.mjs`) and the leak scan (`scripts/leak-scan.mjs`), deploys `_site/` to GitHub Pages and tags the release.

## What it reads
- The repository at the pushed commit: `src/`, `data/` (research files written by agents, the import from PrompTugal__News__Website, licences, security findings), `scripts/`.
- One network read at build time: the sites registry, `https://promptugal.news/api/v1/sites.json` (20 s timeout, no redirects, at most 200 kB), rendered by the vendored sites bar renderer. If it cannot be read, the committed snapshot `data/sites/registry.json` is used.
- The daily run rebuilds the same commit; only the build date and the registry can change (open calls count days from the date; the bar lists what the registry lists).

## What it writes
- The site (`_site/`), deployed to startups.promptugal.news.
- A version tag (`v0.1.N`) on the commit.

## What it trusts
- Node built-ins only; no dependencies are installed.
- GitHub's own actions (`actions/checkout`, `setup-node`, `configure-pages`, `upload-pages-artifact`, `deploy-pages`), pinned by major version.
- The data files: written by agents from public pages, so treated as untrusted text.

## What could go wrong, and the mitigations
| Risk | Mitigation |
|---|---|
| Script in a research file reaches a page (XSS) | Every value is HTML-escaped; only http(s) URLs become links (`safeUrl`, finding startups-2026-11-18-01). |
| A secret is committed or published | The leak scan runs on the tree and the built site before every release and in CI; narrow allowances only for `obs.json`'s public tokens and key. |
| A commit by an unknown agent | The commit check requires an `Agent:` trailer of a known shape. |
| A broken or misleading page goes live | The gate (validate) checks every page and link; a failure stops the deploy. |
| The workflow's token is misused | Read-only by default; `contents: write` only in the tag job, `pages: write` and `id-token: write` only in the deploy job. No repository secrets are used. |
| A compromised upstream action | Pinned to major versions; pinning to commit SHAs is a possible next step. |
| The preview PNG step (headless Chrome on the runner) is abused | It renders only the local file _site/preview.svg (320 by 180 at 2x), made by our generator from designer@'s template and counts with every value escaped; no network, no secrets; if Chrome is absent the step is skipped. |
| A hostile or broken registry reaches every page | The vendored renderer refuses the whole registry on one bad entry (at most 32 sites, fields at most 200 characters, https links to promptugal.news or *.promptugal.news only, no port or user info, accent as #rrggbb) and escapes every value; refused, the pages are built with no bar. Its links can only lead to our own sites. |
| The vendored bar code is changed | Each of the three files is pinned by sha256 in `scripts/lib/sites-bar.mjs`; the build stops on a mismatch. The browser loads them from this site only, never from promptugal.news. |
| The daily run publishes something unreviewed | It rebuilds an already released commit; it cannot add content. |
