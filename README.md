# shisha-game

水煙前線 -EN:CODE-（シーシャ屋アドベンチャー＆シミュレーション）。

現行のゲームは **`remake/`**（ESモジュール・ビルド不要）。第1章を通しで遊べます。
旧ブラウザ版 `web/` と単一HTML配布版は、2026-10-07のオーナー指示で削除しました。
共有の `data/`・`assets/` は現行版が使います。街歩き・歩行の未接続試作は `experiments/proto/` に保存しています。

ローカルで遊ぶ: `python3 remake/tools/serve_preview.py --port 8123` →
`http://127.0.0.1:8123/remake/`（詳細は `remake/README.md`）。

## Git Safety

This project has extra guardrails to reduce unrelated-history PRs and
"ancestor reversion" accidents.

### One-time setup per clone

Run this once after cloning:

```bash
./tools/enable_git_hooks.sh
```

This enables the repo-managed `pre-commit` / `pre-push` hooks in `.githooks/`
and records this folder as the canonical checkout. Worktrees made from it
(`git worktree add`) pass the checks too.

### Before creating a PR

Run:

```bash
./tools/check_git_safety.sh
```

The check fails if:

- the folder is not the canonical checkout (or a worktree of it)
- `project.godot` exists — the Godot version was deleted on 2026-06-15,
  so such a folder is a stale copy
- `data/`, `assets/` or `remake/` is missing
- `origin/main` is missing or unrelated to the current branch
- the working copy is pointed at the wrong repository by mistake

It warns when the branch is behind `origin/main`.

### Workflow rules

- GitHub (`origin`) is the only source of truth. Do not leave work only
  on a PC folder, in `outputs/`, in a stash, or in an image library.
- Start each task with `git fetch origin` and a new branch from the latest
  `origin/main`.
- Commit and push to the work branch at every checkpoint. If a push is
  blocked, stop and report instead of saving patch files locally.
- Commit generated images/audio right away (`assets/` or `asset_sources/`).
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
