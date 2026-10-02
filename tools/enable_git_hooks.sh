#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  printf 'ERROR: not inside a git repository\n' >&2
  exit 1
fi

cd "$repo_root"
"$repo_root/tools/check_git_safety.sh" >/dev/null

# worktree の中で実行しても、正規チェックアウト（共有 .git の持ち主）を登録する
main_root="$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd -P)")"

git config core.hooksPath .githooks
git config --local shisha.canonicalRoot "$main_root"

printf 'Enabled repo hooks: %s/.githooks\n' "$repo_root"
printf 'Canonical checkout: %s\n' "$main_root"
printf "Next step: ./tools/check_git_safety.sh\n"
