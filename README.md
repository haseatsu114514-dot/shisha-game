# shisha-game

## Git Safety

This project has extra guardrails to reduce unrelated-history PRs and
"ancestor reversion" accidents.

### One-time setup per clone

Run this once after cloning:

```bash
./tools/enable_git_hooks.sh
```

This enables the repo-managed `pre-push` hook in `.githooks/`.

### Before creating a PR

Run:

```bash
./tools/check_git_safety.sh
```

The check fails if:

- the Git root is not the Godot project root
- `origin/main` is missing or unrelated to the current branch
- the working copy is pointed at the wrong repository by mistake

### Workflow rules

- Open the repository at the folder that contains `project.godot`.
- Create feature branches from `origin/main`.
- Do not push directly to `main`.
- Do not use `git push --force` on shared branches.
- If `./tools/check_git_safety.sh` fails, stop and fix the Git layout first.
