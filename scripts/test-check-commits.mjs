// Tests for scripts/check-commits.mjs against security@'s controls 6, 7 and 8 (19 Nov 2026), in throwaway repositories.
// The checker under test is this repository's copy with its trusted base swapped for each test repository's first
// commit, run from outside the test repository's tree (as CI runs the last release's copy). Node built-ins only.
// Written by startups.b@PrompTugal.dinis, 19 Nov 2026.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
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
  // Control 7 as settled (fourth ruling): scripts/trusted-checks.sh takes the checks from the anchor A or fails.
  const SEL = new URL('./trusted-checks.sh', import.meta.url).pathname;
  const sel = (r, before, after = 'HEAD') => spawnSync('bash', [SEL, before, after, join(r.dir, '.trusted')], { cwd: r.dir, encoding: 'utf8' });
  const withLeak = () => { const r = repo(); r.commit('scripts/leak-scan.mjs', 'console.log("leak scan v1")\n', 'leak scan' + OK_TRAILER); return r; };
  { // 8. A's copy is used even when the push weakens the checker
    const r = withLeak(); const before = r.g('rev-parse', 'HEAD');
    r.commit('scripts/check-commits.mjs', 'console.log("OK")\n', 'weaken the checker'); r.commit('g', '1\n', 'no trailer');
    const res = sel(r, before);
    expect('copy from A', res, true, 'security checks from the anchor');
    const copied = readFileSync(join(r.dir, '.trusted/check-commits.mjs'), 'utf8');
    if (copied !== SRC) { failed++; console.error('FAIL copy from A: .trusted/check-commits.mjs is not the copy at A'); }
  }
  { // 9. a missing A fails
    const r = withLeak();
    expect('zero A', sel(r, '0000000000000000000000000000000000000000'), false, 'no anchor');
    expect('missing A', sel(r, ''), false, 'no anchor');
  }
  { // 10. A not an ancestor of AFTER (a force push) fails
    const r = withLeak(); const before = r.commit('h', '1\n', 'h' + OK_TRAILER);
    r.g('reset', '-q', '--hard', 'HEAD~1'); r.commit('i', '1\n', 'i' + OK_TRAILER);
    expect('force push', sel(r, before), false, 'not an ancestor of AFTER');
  }
  { // 11. a missing copy (A has no leak-scan.mjs) fails, with no fallback to the pushed tree
    const r = repo(); const before = r.g('rev-parse', 'HEAD');
    r.commit('scripts/leak-scan.mjs', 'console.log("added after")\n', 'leak scan' + OK_TRAILER);
    expect('missing copy at A', sel(r, before), false, 'has no scripts/leak-scan.mjs');
  }
  { // 12. an unsigned commit from a dropped run (between A and BEFORE) fails: the range is A..AFTER
    const r = withLeak(); const A = r.g('rev-parse', 'HEAD');
    r.commit('j', '1\n', 'dropped run, no trailer');                  // its run was dropped by a newer push
    const before = r.commit('k', '1\n', 'k' + OK_TRAILER); r.commit('l', '1\n', 'l' + OK_TRAILER);
    expect('dropped-run commit, range from BEFORE would miss it', r.run(before), true);
    expect('dropped-run commit, range from A', r.run(A), false, 'dropped run, no trailer');
  }
  { // 13. a pushed tag on an unverified commit is not used: the copy is A's
    const r = withLeak(); const A = r.g('rev-parse', 'HEAD');
    r.commit('scripts/check-commits.mjs', 'console.log("OK")\n', 'weaken' + OK_TRAILER); r.g('tag', 'v0.1.999');
    expect('tag ignored', sel(r, A), true, `security checks from the anchor ${A}`);
    if (readFileSync(join(r.dir, '.trusted/check-commits.mjs'), 'utf8') !== SRC) { failed++; console.error('FAIL tag ignored: the copy is not A\'s'); }
  }
  { // 15. control 9: a checker that is a symlink at A is refused
    const r = repo(); symlinkSync('/etc/hostname', join(r.dir, 'scripts/leak-scan.mjs')); r.g('add', '-A'); r.g('commit', '-q', '-m', 'link' + OK_TRAILER);
    expect('symlink at A refused', sel(r, r.g('rev-parse', 'HEAD')), false, 'symlink');
  }
  { // 16. control 9: the leak scan, run from a copy outside the checkout, scans the checkout given by --root
    const LEAK = new URL('./leak-scan.mjs', import.meta.url).pathname;
    const out = join(root, 'leakcopy'); mkdirSync(out); writeFileSync(join(out, 'leak-scan.mjs'), readFileSync(LEAK));
    const r = repo(); mkdirSync(join(r.dir, '_site')); writeFileSync(join(r.dir, '_site/index.html'), '<p>built</p>\n');
    const res = spawnSync(process.execPath, [join(out, 'leak-scan.mjs'), '--root', r.dir], { cwd: r.dir, encoding: 'utf8' });
    expect('leak scan from a copy with --root', res, true, 'files');
    writeFileSync(join(r.dir, '_site/key.pem'), '-----BEGIN OPENSSH ' + 'PRIVATE KEY-----\n');
    expect('leak scan from a copy finds a leak under --root', spawnSync(process.execPath, [join(out, 'leak-scan.mjs'), '--root', r.dir], { cwd: r.dir, encoding: 'utf8' }), false);
    rmSync(join(r.dir, '_site/key.pem'));
    // LIB-2026-067: a file with a NUL byte is still scanned for key shapes, and a symlink is refused, never followed
    writeFileSync(join(r.dir, '_site/blob.bin'), Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from('-----BEGIN RSA ' + 'PRIVATE KEY-----\n')]));
    expect('leak scan finds a key header in a binary file', spawnSync(process.execPath, [join(out, 'leak-scan.mjs'), '--root', r.dir], { cwd: r.dir, encoding: 'utf8' }), false, 'blob.bin');
    rmSync(join(r.dir, '_site/blob.bin'));
    symlinkSync('/etc/hostname', join(r.dir, '_site/link.txt'));
    expect('leak scan refuses a symlink in the built site', spawnSync(process.execPath, [join(out, 'leak-scan.mjs'), '--root', r.dir], { cwd: r.dir, encoding: 'utf8' }), false, 'a symlink');
  }
  { // 17. control 10: a pushed symlink fails; one listed in A's exceptions passes; one listed only in the pushed tree fails
    const r = withLeak(); const A = r.g('rev-parse', 'HEAD');
    symlinkSync('README', join(r.dir, 'link')); r.g('add', '-A'); r.g('commit', '-q', '-m', 'link' + OK_TRAILER);
    expect('pushed symlink fails', sel(r, A), false, 'adds or changes a symlink: link');
    const r2 = withLeak();
    const A2 = r2.commit('scripts/symlink-exceptions.json', JSON.stringify([{ path: 'link', reason: 'test' }]), 'exception' + OK_TRAILER);
    symlinkSync('README', join(r2.dir, 'link')); r2.g('add', '-A'); r2.g('commit', '-q', '-m', 'link' + OK_TRAILER);
    expect('listed symlink passes', sel(r2, A2), true, 'security checks from the anchor');
    const r3 = withLeak(); const A3 = r3.g('rev-parse', 'HEAD');
    r3.commit('scripts/symlink-exceptions.json', JSON.stringify([{ path: 'link', reason: 'pushed' }]), 'exception' + OK_TRAILER);
    symlinkSync('README', join(r3.dir, 'link')); r3.g('add', '-A'); r3.g('commit', '-q', '-m', 'link' + OK_TRAILER);
    expect('symlink listed only in the pushed tree fails', sel(r3, A3), false, 'adds or changes a symlink: link');
    r3.g('rm', '-q', 'link'); r3.commit('x', '1\n', 'drop link' + OK_TRAILER);
    expect('a symlink added then removed in the range still fails', sel(r3, A3), false, 'adds or changes a symlink: link');
  }
  { // 18. control 10, events.b@'s finding: a symlink whose name holds a newline cannot match an exception by part
    const r = withLeak();
    const A = r.commit('scripts/symlink-exceptions.json', JSON.stringify([{ path: 'link', reason: 'test' }]), 'exception' + OK_TRAILER);
    symlinkSync('README', join(r.dir, 'evil\nlink')); r.g('add', '-A'); r.g('commit', '-q', '-m', 'newline link' + OK_TRAILER);
    expect('newline name does not match an exception', sel(r, A), false, 'adds or changes a symlink');
    const r2 = withLeak();
    const A2 = r2.commit('scripts/symlink-exceptions.json', JSON.stringify([{ path: 'link', reason: 'test' }]), 'exception' + OK_TRAILER);
    symlinkSync('README', join(r2.dir, 'evil\nlink'));   // in the working tree only, so the tree scan must catch it
    expect('newline name in the tree does not match an exception', sel(r2, A2), false, 'the checked-out tree holds a symlink');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
if (failed) { console.error(`FAILED (${failed} of 29 checks)`); process.exit(1); }
console.log('OK (29 checks: controls 6 to 10 on the trailer check, the copy taken from the anchor A, and the --root of the leak scan)');
