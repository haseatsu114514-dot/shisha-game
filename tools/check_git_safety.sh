#!/usr/bin/env bash

set -euo pipefail

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  fail "not inside a git repository"
fi

cd "$repo_root"

canonical_root="$(git config --local --get shisha.canonicalRoot 2>/dev/null || true)"
actual_root="$(pwd -P)"
# 同じリポジトリから git worktree add で作った作業場所は、共有の .git が正規チェックアウトのものになる
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
main_root="$(dirname "$common_dir")"

if [ -n "$canonical_root" ] && [ "$actual_root" != "$canonical_root" ] \
  && [ "$main_root" != "$canonical_root" ]; then
  fail \
    "wrong local checkout. Expected '$canonical_root' (or a worktree of it) but got '$actual_root'"
fi

# Godot版は 2026-06-15 に削除済み。project.godot が残っているのは削除前の古いコピー
if [ -f "project.godot" ]; then
  fail "project.godot exists: this is a stale pre-2026-06-15 (Godot era) copy. Clone origin/main again"
fi

[ -d "data" ] || fail "git root is missing data/"
[ -d "assets" ] || fail "git root is missing assets/"
[ -d "remake" ] || [ -d "web" ] || fail "git root is missing remake/ (and web/)"

origin_url="$(git remote get-url origin 2>/dev/null || true)"

if [ -z "$origin_url" ]; then
  fail "origin remote is not configured"
fi

case "$origin_url" in
  *haseatsu114514-dot/shisha-game|*haseatsu114514-dot/shisha-game.git)
    ;;
  *)
    warn "origin is '$origin_url'. Expected the shisha-game remote."
    ;;
esac

if git show-ref --verify --quiet "refs/remotes/origin/main"; then
  if ! git merge-base HEAD "refs/remotes/origin/main" >/dev/null; then
    fail "current branch does not share history with origin/main"
  fi
  behind="$(git rev-list --count HEAD..refs/remotes/origin/main 2>/dev/null || echo 0)"
  if [ "$behind" -gt 0 ]; then
    warn "this branch is $behind commit(s) behind origin/main. Bring in origin/main (merge, not force) before editing, or start a new branch from it."
  fi
else
  warn "origin/main is not available locally. Run 'git fetch origin main'."
fi

branch_name="$(git rev-parse --abbrev-ref HEAD)"
hooks_path="$(git config --get core.hooksPath 2>/dev/null || true)"

if [ "$hooks_path" != ".githooks" ]; then
  warn "core.hooksPath is '${hooks_path:-<unset>}'. Run './tools/enable_git_hooks.sh'."
fi

if [ -z "$canonical_root" ]; then
  warn "shisha.canonicalRoot is unset. Run 'git config --local shisha.canonicalRoot \"$main_root\"' if this is the approved checkout."
fi

printf 'OK: git safety checks passed\n'
printf 'repo root: %s\n' "$repo_root"
printf 'branch: %s\n' "$branch_name"
