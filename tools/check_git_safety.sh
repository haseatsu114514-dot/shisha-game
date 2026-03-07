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

[ -f "project.godot" ] || fail \
  "git root must be the Godot project root. Current git root: $repo_root"
[ -d "scenes" ] || fail "git root is missing scenes/"
[ -d "scripts" ] || fail "git root is missing scripts/"

origin_url="$(git remote get-url origin 2>/dev/null || true)"

if [ -z "$origin_url" ]; then
  fail "origin remote is not configured"
fi

case "$origin_url" in
  *github.com*haseatsu114514-dot/shisha-game.git|\
  *github.com:haseatsu114514-dot/shisha-game.git)
    ;;
  *)
    warn "origin is '$origin_url'. Expected the shisha-game remote."
    ;;
esac

if git show-ref --verify --quiet "refs/remotes/origin/main"; then
  if ! git merge-base HEAD "refs/remotes/origin/main" >/dev/null; then
    fail "current branch does not share history with origin/main"
  fi
else
  warn "origin/main is not available locally. Run 'git fetch origin main'."
fi

branch_name="$(git rev-parse --abbrev-ref HEAD)"

printf 'OK: git safety checks passed\n'
printf 'repo root: %s\n' "$repo_root"
printf 'branch: %s\n' "$branch_name"
