# Repo Safety Rules

This repository must be opened at the Git root that also contains
`project.godot`.

Before any branch, merge, or push operation:

1. Run `git rev-parse --show-toplevel`.
2. Confirm that the returned directory contains `project.godot`.
3. Run `./tools/check_git_safety.sh`.

If the Git root does not contain `project.godot`, stop immediately.
That means the game is being edited from a parent monorepo or another
wrong checkout, which can cause unrelated-history PRs and ancestor
reversion accidents.

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
