// Prints the anchor A (scripts/lib/anchor.mjs) or fails. In CI only: needs GITHUB_REPOSITORY and GITHUB_TOKEN
// (the run's own token, with deployments: read). Limit: like the workflow, this file comes from the pushed tree.
import { anchorFromGitHub } from './lib/anchor.mjs';
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
if (!repo || !token) { console.error('anchor: GITHUB_REPOSITORY and GITHUB_TOKEN are needed'); process.exit(1); }
try { console.log(await anchorFromGitHub({ repo, token })); }
catch (e) { console.error(String(e.message || e)); process.exit(1); }
