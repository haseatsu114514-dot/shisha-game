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

## Asset Index

This repo keeps a machine-readable asset index at `assets_index.json`.

Regenerate it after adding, removing, or renaming runtime assets:

```bash
python3 tools/update_assets_index.py
```

The generator cross-references:

- `assets/` runtime directories
- `アセット差し替え進捗管理表.csv`

It reports:

- indexed runtime assets
- assets tracked by AI or human review
- CSV rows with missing files
- runtime files not yet tracked in the progress sheet
