// ACC-015: every commit a push adds (merges included, 19 Nov 2026) to dev must carry a readable Agent: trailer,
// read the way git reads it: git log --format=%(trailers:key=Agent,valueonly).
// Usage: node scripts/check-commits.mjs <before> <after>   (the pushed range, before..after)
// security@'s controls (board/team/security/reviews/2026-11-19-0130-bar-signing-live-data.md in PrompTugal__News__Website,
// relayed by conductor.b@ at 14:07 and 14:08 UTC on 19 Nov 2026), as they apply to this trailer check:
// (6) a commit with no parent fails, except the trusted base below; a shallow checkout fails.
// (7) CI runs this file and its exemptions from the last release (git show <tag>:path), never from the pushed tree,
//     so the exemptions are read from beside this file, not from the working directory.
// (8) a commit is skipped only when it is an ancestor of the trusted base (git merge-base --is-ancestor), never by
//     what a tree holds or by a commit date. There is no override of the base.
// Prints OK or lists each commit that fails and exits 1. History is not rewritten (ACC-015).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The trusted base: the commit that seeded this repository and added this check (17 Nov 2026, 19:02 UTC).
const BASE = 'dce0f629026f119d12467838362c70c56e163ab6';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

const [beforeArg, afterArg] = process.argv.slice(2);
const after = afterArg || 'HEAD';
if (!tryGit('rev-parse', '--verify', '--quiet', `${after}^{commit}`)) { console.error(`check-commits: unknown commit ${after}`); process.exit(1); }

if (tryGit('rev-parse', '--is-shallow-repository') !== 'false') { console.error('check-commits: a shallow checkout cannot be checked (fetch the full history)'); process.exit(1); }
if (!tryGit('rev-parse', '--verify', '--quiet', `${BASE}^{commit}`)) { console.error(`check-commits: the trusted base ${BASE} is not in this history`); process.exit(1); }
const isAncestorOfBase = (c) => { try { execFileSync('git', ['merge-base', '--is-ancestor', c, BASE]); return true; } catch { return false; } };

// A new branch, a forced push or a manual run has no usable "before": check everything since the check began.
const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const range = before ? [`${before}..${after}`] : [after];
const added = lines(git('rev-list', ...range));   // merges too: a skip is decided by ancestry only (control 8)

// A role may be dotted, role.speciality (Dinis, 16 Nov 2026: "we definitely should allow dots because that's our terminology").
// PrompTugal's agents sign as role@PrompTugal.dinis (Dinis, 18 Nov 2026, in startups.b@'s session: "yes, change
// check-commits.mjs to accept @PrompTugal.dinis"; also board/guidance/2026-11-18-five-sites-on-account-b.md in PrompTugal__News__Website).
const agentShape = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@(?:agenticcells\.[a-z0-9][a-z0-9.-]*|promptugal\.dinis)$/i;
// Exemptions (specialist.code@, 2026-11-16). CI checks from the last release tag, so one failing commit
// would block every later release, and history is never rewritten. A person may exempt that one commit in
// scripts/commit-exemptions.json: [{ "commit": "<full 40-hex sha>", "reason": "...", "approved_by": "Dinis Cruz",
// "date": "YYYY-MM-DD" }]. Each entry names exactly one commit; malformed entries fail the check.
const exempt = new Map();
const EX = join(dirname(fileURLToPath(import.meta.url)), 'commit-exemptions.json');
if (existsSync(EX)) {
  let list;
  try { list = JSON.parse(readFileSync(EX, 'utf8')); } catch (e) { console.error(`${EX}: not JSON (${e.message})`); process.exit(1); }
  if (!Array.isArray(list)) { console.error(`${EX}: must be a list`); process.exit(1); }
  for (const x of list) {
    if (!x || !/^[0-9a-f]{40}$/.test(x.commit || '') || !(x.reason || '').trim() || !(x.approved_by || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) {
      console.error(`${EX}: each entry needs a full 40-hex commit, a reason, approved_by and a date`); process.exit(1);
    }
    exempt.set(x.commit, x);
  }
}
const errors = [];
let checked = 0, exempted = 0;
for (const c of added) {
  if (c === BASE || isAncestorOfBase(c)) continue;
  if (exempt.has(c)) { exempted++; continue; }
  checked++;
  if (!git('log', '-1', '--format=%P', c)) errors.push(`${c.slice(0, 7)} ${git('log', '-1', '--format=%s', c)}: a commit with no parent that is not the trusted base`);
  const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim());
  const subject = git('log', '-1', '--format=%s', c);
  if (!agents.length) errors.push(`${c.slice(0, 7)} ${subject}: no readable Agent: trailer (it must sit in the final trailer block)`);
  else if (!agents.every((a) => agentShape.test(a))) errors.push(`${c.slice(0, 7)} ${subject}: Agent: trailer is not role@agenticcells.person or role@PrompTugal.dinis (${agents.join(', ')})`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED (${errors.length} of ${checked} commits checked)`);
  process.exit(1);
}
console.log(`OK (${checked} commits checked, ${exempted} exempted, ${added.length - checked - exempted} at or before the trusted base skipped)`);
