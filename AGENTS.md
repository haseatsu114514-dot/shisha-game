# Repo Safety Rules

If this machine uses a canonical checkout path, store it in local Git
config with:
`git config --local shisha.canonicalRoot "$(pwd -P)"`

Treat any other copy of this repository as unsafe unless the user
explicitly says it has replaced the canonical checkout and the local
config has been updated.

Do not edit, branch, commit, merge, or push from:

- parent directories that happen to contain this folder
- `.codex_tmp/` copies
- older folders such as `sheesha_battle` or `シーシャバトル-(4.2)`

Before any code edit, branch, commit, merge, or push operation:

1. Run `git rev-parse --show-toplevel`.
2. Confirm that the same directory contains `project.godot`.
3. Run `./tools/check_git_safety.sh`.
4. If `git config --get core.hooksPath` is not `.githooks`, run
   `./tools/enable_git_hooks.sh`.
5. If `git config --local --get shisha.canonicalRoot` is set, confirm
   that it matches the repo root.

If any check fails, stop immediately and tell the user which path was
wrong. Do not guess. Do not continue from a parent monorepo or stale
local checkout, because that is how ancestor reversion accidents happen.

## Git rules

- Start all feature work from `origin/main`.
- Never push directly to `main`.
- Never use `git push --force` on `main` or shared branches.
- Never switch the default branch to a feature branch just to bypass PR
  restrictions.
- Never use `--allow-unrelated-histories` for this repository.
- Prefer `git fetch origin` plus explicit commands over a blind `git pull`.

If `git merge-base HEAD origin/main` fails, the branch is not safe for a
normal PR. Stop and tell the user instead of trying to merge or rename
branches around the problem.
