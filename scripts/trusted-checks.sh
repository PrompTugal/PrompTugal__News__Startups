#!/usr/bin/env bash
# Copy the security checks CI runs from BEFORE, the commit dev pointed to before this push, which was already checked
# (security@'s control 7 as settled in its third ruling, 3724c9ca2, relayed by conductor.b@ at 14:11 UTC, 19 Nov 2026).
# Fails, never falls back to the trusted base's copy or to the pushed tree, when BEFORE is missing (a zero id or a new
# branch), when BEFORE is not an ancestor of AFTER (a force push), or when BEFORE has no copy of a check.
# Tags are not a source of trust. Usage: bash scripts/trusted-checks.sh <before> <after> <outdir>
# Limit: this file, like the workflow, comes from the pushed tree; only branch protection with a required check closes that.
set -euo pipefail
before=${1:-} after=${2:-} out=${3:-}
fail() { echo "trusted-checks: $*" >&2; exit 1; }
[ -n "$out" ] || fail "usage: trusted-checks.sh <before> <after> <outdir>"
[[ -n "$before" && ! "$before" =~ ^0+$ ]] || fail "no BEFORE (a new branch or a manual run): no checked copy of the checks"
git rev-parse --verify --quiet "$before^{commit}" >/dev/null || fail "BEFORE $before is not in this history"
git rev-parse --verify --quiet "$after^{commit}" >/dev/null || fail "AFTER $after is not in this history"
git merge-base --is-ancestor "$before" "$after" || fail "BEFORE $before is not an ancestor of AFTER $after (a force push)"
rm -rf "$out" && mkdir -p "$out"
for f in check-commits.mjs leak-scan.mjs; do
  git cat-file -e "$before:scripts/$f" 2>/dev/null || fail "BEFORE $before has no scripts/$f"
  git show "$before:scripts/$f" > "$out/$f"
done
if git cat-file -e "$before:scripts/commit-exemptions.json" 2>/dev/null; then git show "$before:scripts/commit-exemptions.json" > "$out/commit-exemptions.json"; fi
echo "security checks from BEFORE $(git rev-parse "$before^{commit}")"
