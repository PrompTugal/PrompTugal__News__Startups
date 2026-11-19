#!/usr/bin/env bash
# Copy the security checks CI runs from the anchor A, the newest commit a passing run verified (scripts/anchor.mjs;
# security@'s fourth ruling, 948820a7e, relayed by conductor.b@ at 14:17 UTC, 19 Nov 2026; it replaced BEFORE).
# Fails, never falls back to the trusted base's copy or to the pushed tree, when A is missing, when A is not an
# ancestor of AFTER (a force push), or when A has no copy of a check. Tags are never read.
# Usage: bash scripts/trusted-checks.sh <anchor> <after> <outdir>
# Limit: this file, like the workflow, comes from the pushed tree; only branch protection with a required check closes that.
set -euo pipefail
anchor=${1:-} after=${2:-} out=${3:-}
fail() { echo "trusted-checks: $*" >&2; exit 1; }
[ -n "$out" ] || fail "usage: trusted-checks.sh <anchor> <after> <outdir>"
[[ -n "$anchor" && ! "$anchor" =~ ^0+$ ]] || fail "no anchor: no verified commit to take the checks from"
git rev-parse --verify --quiet "$anchor^{commit}" >/dev/null || fail "anchor $anchor is not in this history"
git rev-parse --verify --quiet "$after^{commit}" >/dev/null || fail "AFTER $after is not in this history"
git merge-base --is-ancestor "$anchor" "$after" || fail "anchor $anchor is not an ancestor of AFTER $after (a force push)"
[ ! -L "$out" ] || fail "$out is a symlink"
rm -rf "$out" && mkdir -p "$out"
for f in check-commits.mjs leak-scan.mjs; do
  git cat-file -e "$anchor:scripts/$f" 2>/dev/null || fail "anchor $anchor has no scripts/$f"
  [ "$(git ls-tree "$anchor" "scripts/$f" | cut -c1-6)" = "100644" ] || fail "anchor $anchor: scripts/$f is not a plain file (a symlink is refused)"
  git show "$anchor:scripts/$f" > "$out/$f"
done
if git cat-file -e "$anchor:scripts/commit-exemptions.json" 2>/dev/null; then
  [ "$(git ls-tree "$anchor" scripts/commit-exemptions.json | cut -c1-6)" = "100644" ] || fail "anchor $anchor: scripts/commit-exemptions.json is not a plain file (a symlink is refused)"
  git show "$anchor:scripts/commit-exemptions.json" > "$out/commit-exemptions.json"
fi
echo "security checks from the anchor $(git rev-parse "$anchor^{commit}")"
