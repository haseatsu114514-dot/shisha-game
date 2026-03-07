#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  printf 'ERROR: not inside a git repository\n' >&2
  exit 1
fi

cd "$repo_root"
"$repo_root/tools/check_git_safety.sh" >/dev/null

git config core.hooksPath .githooks
git config --local shisha.canonicalRoot "$(pwd -P)"

printf 'Enabled repo hooks: %s/.githooks\n' "$repo_root"
printf 'Canonical checkout: %s\n' "$(pwd -P)"
printf "Next step: ./tools/check_git_safety.sh\n"
