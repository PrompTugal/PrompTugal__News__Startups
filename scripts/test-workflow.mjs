// A static test of .github/workflows/pages.yml against security@'s control 9 (fifth ruling, 16402a95c, 19 Nov 2026):
// the trailer and leak checks run in their own job, which runs no pushed code and reads nothing from the build job but
// its artifact, so a pushed build step that writes GITHUB_ENV or GITHUB_PATH cannot change their result; and deploy and
// tag wait for that job. Node built-ins only. Written by startups.b@PrompTugal.dinis.
import { readFileSync } from 'node:fs';

// Comments are removed first, so no test can be met by a comment (library.b@'s LIB-2026-067): full-line comments, and a
// trailing " # ..." on a line with no quote before it.
const y = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8').split('\n')
  .filter((l) => !/^\s*#/.test(l)).map((l) => (/^[^'"]*\s#\s/.test(l) ? l.replace(/\s#\s.*$/, '') : l)).join('\n') + '\n';
const job = (name) => { const m = y.match(new RegExp(`^  ${name}:\\n((?:    .*\\n|\\s*\\n)*)`, 'm')); return m ? m[1] : null; };
const problems = [];
const checks = job('checks');
if (!checks) problems.push('no checks job');
else {
  const runs = checks.split('\n').filter((l) => /^\s+(?:-\s+)?run:|^\s{10}\S/.test(l)).join('\n');
  for (const bad of [/node\s+(?:\.\/)?scripts\//, /bash\s+(?:\.\/)?scripts\//, /\bnpm\b|\bnpx\b/, /\.\/scripts\//, /\bsource\b|^\s*\.\s/m])
    if (bad.test(runs)) problems.push(`checks job runs pushed code (${bad})`);
  if (/needs\.build\.outputs/.test(checks)) problems.push('checks job reads a build output: only the artifact may reach it');
  if (!/^      GIT_NO_REPLACE_OBJECTS: '1'$/m.test(checks)) problems.push('checks job does not set GIT_NO_REPLACE_OBJECTS=1');
  if (!/^      NODE_OPTIONS: ''$/m.test(checks)) problems.push('checks job does not clear NODE_OPTIONS');
  if (!/RUNNER_TEMP\/trusted\/check-commits\.mjs/.test(checks) || !/RUNNER_TEMP\/trusted\/leak-scan\.mjs/.test(checks)) problems.push('checks job does not run both checks from RUNNER_TEMP');
  if (!/"\$NODE"/.test(checks) || !/readlink -f/.test(checks)) problems.push('checks job does not use an absolute path to node');
  if (/\btags?\b.*describe|git describe/.test(checks)) problems.push('checks job reads a tag');
  if (!/actions\/workflows\/pages\.yml\/runs/.test(checks) || !/\.event == "push"/.test(checks) || !/\.conclusion == "success"/.test(checks) || !/\.head_branch == "dev"/.test(checks) || !/merge-base --is-ancestor "\$A" "\$AFTER"/.test(checks)) problems.push('checks job does not take A from the successful push runs of this workflow on dev and require it to be an ancestor');
  if (/deployments/.test(checks)) problems.push('checks job reads deployments: anyone with write access can make one (sixth ruling)');
  if (!/find _site -type l/.test(checks)) problems.push('checks job does not refuse symlinks in the built site');
  // events.b@'s finding: the artifact's listing is vetted and it is unpacked before the trusted copies are written
  const iUnpack = checks.indexOf('tar -xf'), iVet = checks.indexOf('tar -tvf'), iCopy = checks.indexOf('trusted-checks.sh" "$A"');
  if (iVet < 0 || iUnpack < 0 || iCopy < 0 || !(iVet < iUnpack && iUnpack < iCopy)) problems.push('checks job does not vet and unpack the artifact before writing the trusted copies');
}
if (!/^  deploy:\n    needs: \[build, checks\]/m.test(y)) problems.push('deploy does not need the checks job');
if (!/^  tag:\n    needs: \[build, checks, deploy\]/m.test(y) || !/needs\.checks\.result == 'success'/.test(job('tag') || '')) problems.push('tag does not need a passing checks job');
if (/node \.trusted\/|scripts\/leak-scan\.mjs$|node scripts\/check-commits\.mjs/m.test(job('build') || '')) problems.push('the build job still runs a security check');
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED (${problems.length})`); process.exit(1); }
console.log('test-workflow: OK (control 9: the checks job runs no pushed code; deploy and tag wait for it)');
