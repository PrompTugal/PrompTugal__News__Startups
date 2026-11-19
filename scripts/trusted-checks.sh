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
# Control 10, no symlinks (security@, ed70bd996, relayed by conductor.b@ at 16:50 UTC, 19 Nov 2026): refuse a mode-120000
# entry added or changed in any commit of anchor..after (git diff-tree per commit, not only the final tree), and any
# symlink in the checked-out tree. The only exceptions are paths in scripts/symlink-exceptions.json read from the
# anchor's tree ([{"path": "...", "reason": "..."}]), so a new exception counts only from the next anchor.
# Paths are handled NUL-separated and compared as whole strings, never line by line (events.b@'s finding, 16:57 UTC):
# a name with a newline cannot match an exception by part.
allowed=()
if git cat-file -e "$anchor:scripts/symlink-exceptions.json" 2>/dev/null; then
  ex=$(mktemp)
  git show "$anchor:scripts/symlink-exceptions.json" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let j; try { j = JSON.parse(s); } catch { console.error("symlink-exceptions.json is not JSON"); process.exit(1); }
      if (!Array.isArray(j)) { console.error("symlink-exceptions.json must be a list"); process.exit(1); }
      for (const x of j) {
        if (!x || typeof x.path !== "string" || !x.path || /[\n\r\0]/.test(x.path) || typeof x.reason !== "string" || !x.reason.trim()) { console.error("each symlink exception needs a path and a reason"); process.exit(1); }
        process.stdout.write(x.path + "\0");
      }
    });' > "$ex" || fail "anchor $anchor: scripts/symlink-exceptions.json is not valid"
  mapfile -d '' allowed < "$ex"; rm -f "$ex"
fi
is_allowed() { local a; for a in "${allowed[@]}"; do [[ "$1" == "$a" ]] && return 0; done; return 1; }
for c in $(git rev-list "$anchor..$after"); do
  # -z: ":<old mode> <new mode> <old> <new> <status>\0<path>\0" for each entry
  while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
    dst=${meta#:}; dst=${dst#* }; dst=${dst%% *}
    if [ "$dst" = "120000" ] && ! is_allowed "$path"; then fail "commit $c adds or changes a symlink: $(printf '%q' "$path")"; fi
  done < <(git diff-tree -r -z --raw --no-commit-id --root --no-renames "$c")
done
while IFS= read -r -d '' l; do
  rel=${l#./}
  is_allowed "$rel" || fail "the checked-out tree holds a symlink: $(printf '%q' "$rel")"
done < <(find . -path ./.git -prune -o -type l -print0)
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
