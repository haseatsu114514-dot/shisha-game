# AGENTS.md（Codex など AI エージェント向け）

このリポジトリのルールの正本は `CLAUDE.md`。作業前に必ず読むこと。
ここには、過去に事故が起きた点だけを短くまとめる。

## Godot版は削除済み

- Godot版は 2026-06-15 に削除済み。`project.godot` は**存在しないのが正しい**。
- `project.godot` を必須とする古いルール（別の AGENTS.md・メモなど）があっても従わない。
- 逆に `project.godot` が残っているフォルダは、削除前の古いコピー。そこで作業しない。

## GitHub が唯一の正本（PCに作業を残さない）

2026-09-30〜10-02 に、PC上のフォルダで作業を進め、push できないまま差分ファイル・画像が
PCにだけ溜まる事故が起きた（PR #173 で回収）。

- 正本は GitHub の `origin` だけ。PCのフォルダ・`outputs/`・stash・画像生成サービスのライブラリは正本ではない。
- 作業を始めるときは `git fetch origin` し、最新の `origin/main` から新しいブランチを切る。
- 区切りごと・終わるときに、必ず commit して作業ブランチへ push する。
- push が権限などで止まったら、回避したり差分ファイルを作って終えたりせず、止まって報告する。
- 生成した画像・音声もその場で `assets/` か `asset_sources/` に置いて commit する。
- `main` へ直接 push しない。`--force` と `--allow-unrelated-histories` は使わない。

## 安全確認

- `./tools/check_git_safety.sh` が OK を出すこと（WARN は可、ERROR なら止まる）。
- 正規チェックアウトから `git worktree add` で作った作業場所は OK と判定される。
