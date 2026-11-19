// Tests for scripts/check-commits.mjs against security@'s controls 6, 7 and 8 (19 Nov 2026), in throwaway repositories.
// The checker under test is this repository's copy with its trusted base swapped for each test repository's first
// commit, run from outside the test repository's tree (as CI runs the last release's copy). Node built-ins only.
// Written by startups.b@PrompTugal.dinis, 19 Nov 2026.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SRC = readFileSync(new URL('./check-commits.mjs', import.meta.url), 'utf8');
const BASE_LINE = /const BASE = '[0-9a-f]{40}';/;
if (!BASE_LINE.test(SRC)) { console.error('test-check-commits: no BASE line in check-commits.mjs'); process.exit(1); }
const OK_TRAILER = '\n\nAgent: startups.b@PrompTugal.dinis\nIssue: WS-177';
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
const root = mkdtempSync(join(tmpdir(), 'test-check-commits-'));
let n = 0, failed = 0;

function repo() {
  const dir = join(root, `r${++n}`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const g = (...a) => execFileSync('git', a, { cwd: dir, env, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'dev');
  g('config', 'commit.gpgsign', 'false');
  const commit = (file, text, msg, extra = []) => { writeFileSync(join(dir, file), text); g('add', '-A'); g('commit', '-q', '-m', msg, ...extra); return g('rev-parse', 'HEAD'); };
  writeFileSync(join(dir, 'scripts/check-commits.mjs'), SRC);
  const base = commit('README', 'seed\n', 'seed' + OK_TRAILER);
  // the trusted copy: this checker with the test repository's base, kept outside the tree with its own exemptions
  const trusted = join(root, `trusted${n}`);
  mkdirSync(trusted);
  writeFileSync(join(trusted, 'check-commits.mjs'), SRC.replace(BASE_LINE, `const BASE = '${base}';`));
  const run = (before, after = 'HEAD', cwd = dir) => spawnSync('node', [join(trusted, 'check-commits.mjs'), before, after], { cwd, encoding: 'utf8' });
  return { dir, g, commit, base, trusted, run };
}

function expect(name, res, ok, text) {
  const pass = (res.status === 0) === ok && (!text || (res.stdout + res.stderr).includes(text));
  if (!pass) { failed++; console.error(`FAIL ${name}: status ${res.status}\n${res.stdout}${res.stderr}`); }
}

try {
  { // 1. a commit with the trailer after the base passes
    const r = repo(); r.commit('a', '1\n', 'add a' + OK_TRAILER);
    expect('trailer after the base', r.run(r.base), true, '1 commits checked');
  }
  { // 2. control 8: a commit that removes the checker and adds a change with no trailer still fails
    const r = repo(); r.g('rm', '-q', 'scripts/check-commits.mjs'); r.commit('b', 'x\n', 'remove the checker and change b');
    expect('checker removed, no trailer', r.run(r.base), false, 'no readable Agent: trailer');
  }
  { // 3. control 8: an old-dated commit from an unrelated history, merged in, is not skipped (6: it has no parent)
    const r = repo();
    r.g('checkout', '-q', '--orphan', 'side'); r.g('rm', '-q', '-rf', '.');
    const old = { ...env, GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z' };
    writeFileSync(join(r.dir, 'c'), 'old\n'); r.g('add', '-A');
    execFileSync('git', ['commit', '-q', '-m', 'old and unrelated' + OK_TRAILER], { cwd: r.dir, env: old });
    r.g('checkout', '-q', 'dev'); r.g('merge', '-q', '--allow-unrelated-histories', '--no-edit', '-m', 'merge' + OK_TRAILER, 'side');
    expect('orphan merged in, old date', r.run(r.base), false, 'a commit with no parent that is not the trusted base');
  }
  { // 4. control 8: a commit that is an ancestor of the base is skipped, the base included
    const r = repo();
    expect('base itself skipped', r.run(''), true, '1 at or before the trusted base skipped');
  }
  { // 5. control 7: exemptions in the pushed tree are not read; only those beside the trusted copy count
    const r = repo();
    const bad = r.commit('d', '1\n', 'no trailer');
    const ex = JSON.stringify([{ commit: bad, reason: 'test', approved_by: 'Dinis Cruz', date: '2026-11-19' }]);
    r.commit('scripts/commit-exemptions.json', ex, 'exempt it' + OK_TRAILER);
    expect('exemption in the pushed tree ignored', r.run(r.base), false, 'no readable Agent: trailer');
    writeFileSync(join(r.trusted, 'commit-exemptions.json'), ex);
    expect('exemption beside the trusted copy counts', r.run(r.base), true, '1 exempted');
  }
  { // 6. control 6: a shallow checkout fails
    const r = repo(); r.commit('e', '1\n', 'e' + OK_TRAILER); r.commit('f', '1\n', 'f' + OK_TRAILER);
    const shallow = join(root, `shallow${n}`);
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${r.dir}`, shallow], { env });
    expect('shallow checkout', r.run('', 'HEAD', shallow), false, 'shallow checkout');
  }
  { // 7. a history without the trusted base fails
    const r = repo();
    const other = join(root, 'other'); mkdirSync(other);
    const g = (...a) => execFileSync('git', a, { cwd: other, env, encoding: 'utf8' });
    g('init', '-q', '-b', 'dev'); writeFileSync(join(other, 'x'), 'another history\n'); g('add', '-A'); g('commit', '-q', '-m', 'other' + OK_TRAILER);
    expect('base not in history', spawnSync('node', [join(r.trusted, 'check-commits.mjs'), '', 'HEAD'], { cwd: other, encoding: 'utf8' }), false, 'is not in this history');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
if (failed) { console.error(`FAILED (${failed} of 8 checks)`); process.exit(1); }
console.log('OK (8 checks: controls 6, 7 and 8 on the trailer check)');
