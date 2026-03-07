#!/usr/bin/env bash

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  printf 'ERROR: not inside a git repository\n' >&2
  exit 1
fi

cd "$repo_root"
[ -f "project.godot" ] || {
  printf 'ERROR: git root must contain project.godot before enabling hooks\n' >&2
  printf 'ERROR: current git root is %s\n' "$repo_root" >&2
  exit 1
}

git config core.hooksPath .githooks

printf 'Enabled repo hooks: %s/.githooks\n' "$repo_root"
printf "Next step: ./tools/check_git_safety.sh\n"
