// A static test of .github/workflows/pages.yml against security@'s control 9 (fifth ruling, 16402a95c, 19 Nov 2026):
// the trailer and leak checks run in their own job, which runs no pushed code and reads nothing from the build job but
// its artifact, so a pushed build step that writes GITHUB_ENV or GITHUB_PATH cannot change their result; and deploy and
// tag wait for that job. Node built-ins only. Written by startups.b@PrompTugal.dinis.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Comments are removed first, so no test can be met by a comment (library.b@'s LIB-2026-067): full-line comments, and a
// trailing " # ..." on a line with no quote before it.
const y = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8').split('\n')
  .filter((l) => !/^\s*#/.test(l)).map((l) => (/^[^'"]*\s#\s/.test(l) ? l.replace(/\s+#\s.*$/, '') : l)).join('\n') + '\n';
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
  if (!/find "\$U" -type l/.test(checks) || !/mv "\$U" "\$GITHUB_WORKSPACE\/_site"/.test(checks)) problems.push('checks job does not unpack the site in RUNNER_TEMP, refuse symlinks there, then move it into place');
  if (!/git ls-tree --name-only "\$AFTER" _site/.test(checks)) problems.push('checks job does not refuse a pushed _site path');
  if (!/\.gitattributes/.test(checks) || !/xargs -0 -r rm -f/.test(checks)) problems.push('checks job does not remove pushed .gitattributes');
  if (!/\.name == "checks" and \.conclusion == "success"/.test(checks) || !/actions\/runs\/\$\{row%%,\*\}\/jobs/.test(checks)) problems.push('checks job does not require the anchor run to have a passing checks job');
  if (!/^    if: github\.ref == 'refs\/heads\/dev'/m.test(checks)) problems.push('checks job is not limited to refs/heads/dev');
  // events.b@'s finding: the artifact's listing is vetted and it is unpacked before the trusted copies are written
  const iUnpack = checks.indexOf('tar -xf'), iVet = checks.indexOf('tar -tvf'), iCopy = checks.indexOf('trusted-checks.sh" "$A"');
  if (iVet < 0 || iUnpack < 0 || iCopy < 0 || !(iVet < iUnpack && iUnpack < iCopy)) problems.push('checks job does not vet and unpack the artifact before writing the trusted copies');
  if (!/^      GIT_ATTR_SOURCE: 4b825dc642cb6eb9a060e54bf8d69288fbee4904$/m.test(checks) || !/older than 2\.42/.test(checks)) problems.push('checks job does not turn pushed attributes off with GIT_ATTR_SOURCE and enforce git 2.42');
}
if (!/^  deploy:\n    needs: \[build, checks\]\n    if: github\.ref == 'refs\/heads\/dev' && /m.test(y)) problems.push('deploy does not need the checks job, or is not limited to refs/heads/dev');
if (!/github\.ref == 'refs\/heads\/dev'/.test(job('tag') || '')) problems.push('tag is not limited to refs/heads/dev');
if (!/^  tag:\n    needs: \[build, checks, deploy\]/m.test(y) || !/needs\.checks\.result == 'success'/.test(job('tag') || '')) problems.push('tag does not need a passing checks job');
if (/node \.trusted\/|scripts\/leak-scan\.mjs$|node scripts\/check-commits\.mjs/m.test(job('build') || '')) problems.push('the build job still runs a security check');
// Every run block parses as bash (cyber.b@'s finding: a stray quote broke a run). Taken from the raw file, comments kept.
{
  const raw = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8').split('\n');
  for (let i = 0; i < raw.length; i++) {
    const m = /^(\s*)(?:- )?run: (.*)$/.exec(raw[i]);
    if (!m) continue;
    let body = m[2];
    if (body === '|') {
      const lines = []; const ind = raw[i + 1] ? raw[i + 1].search(/\S/) : 0;
      for (let j = i + 1; j < raw.length && (raw[j].trim() === '' || raw[j].search(/\S/) >= ind); j++) lines.push(raw[j].slice(ind));
      body = lines.join('\n');
    } else if (/^'.*'$/.test(body)) body = body.slice(1, -1).replace(/''/g, "'");
    body = body.replace(/\$\{\{[^}]*\}\}/g, 'X');
    const r = spawnSync('bash', ['-n'], { input: body, encoding: 'utf8' });
    if (r.status !== 0) problems.push(`run block at line ${i + 1} does not parse as bash: ${r.stderr.trim()}`);
  }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED (${problems.length})`); process.exit(1); }
console.log('test-workflow: OK (control 9: the checks job runs no pushed code; deploy and tag wait for it)');
