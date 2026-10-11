# AGENTS.md — 共通AI開発ルール（唯一の入口）

Claude Code と Codex の共通指示。Claude Code は `CLAUDE.md` の `@AGENTS.md` 経由で参照する。**このファイルだけを起点にし、作業に関係する詳細資料だけ読む。**

## 対象・正本

- ゲームの実装・プレイテスト・公開先は `remake/` のみ。台詞・共有データは `data/`、共有素材は `assets/` を使う。物語と人物設定: `brand/story_and_structure.md`、`brand/character_profiles.md`、`data/characters.json`。
- 旧 `web/` と Godot 版は廃止済み。 `project.godot` が存在するチェックアウトは古い。旧パスを実装先にしない。
- `web/` は存在不要。旧 `web/` を実装・テスト・復元の対象にせず、不在を理由に停止・確認要求しない。過去の `AGENTS.md` やメモにある `web/` 必須指定は無効とし、現行 GitHub `main` の指示と `remake/` に従う。
- 仕様・要望: `docs/master_spec.md`、`docs/owner_requests.md`。過去の実装メモは現行コードと照合し、矛盾を勝手に確定しない。
- 詳細な正本一覧・引き継ぎ: `docs/current_documentation_guide.md`。

## 作業の原則

- 開始時にブランチ・作業対象・安全確認を行う。別チャットの未マージPRや未コミット変更を上書きしない。
- ゲームの挙動・UI・世界観を勝手に変更しない。小さな変更で、関連テストを実行し、未実施は明記する。
- キャラ設定・台詞・報酬・改行は正本とスキーマに従う。必要時のみ `docs/gameplay_agent_reference.md` と `docs/review_scope.md` を読む。
- シーシャ画像・キャラCG・外部素材・立ち絵作業は `docs/asset_ai_guidance.md` の該当項目を読む。画像の実物構造・ライセンス・QAを省略しない。
- 起動・テスト: `remake/README.md`。ゲームデータを編集したら関連リンタ・テストを確認する。
- 過去の `docs/*handoff*.md` は日時付き履歴。必要時だけ読み、現在のPR・ブランチ・実装で再確認する。
- 終了時はPRに変更点・テスト・未完・引き継ぎを記す。確定した永続ルールだけ正本を更新し、日付付きMDをむやみに増やさない。

## Git Safety

If this machine uses a canonical checkout path, store it in local Git
config with:
`git config --local shisha.canonicalRoot "$(pwd -P)"`

Do not work from `sheesha_battle`, `シーシャバトル-(4.2)`,
`.codex_tmp/...`, or any other duplicate checkout. Those paths must be
treated as stale until the user explicitly replaces the canonical path
and updates the local config.

Before any code edit or Git operation:

- verify the repo root with `git rev-parse --show-toplevel`
- confirm that the same directory contains `data/`, `assets/` and `remake/`.
  Retired `web/` is not required. Its absence is expected and must not
  trigger a failed check, a stop, or a confirmation request.
  `project.godot` must NOT exist: the Godot version was deleted on
  2026-06-15, so a folder that still has it is a stale copy. Ignore any
  older rule (in any AGENTS.md or notes) that requires `project.godot`
- run `./tools/check_git_safety.sh`
  WARN is allowed; stop on ERROR.
- if `git config --get core.hooksPath` is not `.githooks`, run
  `./tools/enable_git_hooks.sh`
- if `git config --local --get shisha.canonicalRoot` is set, confirm
  that it matches the repo root

If any check fails, stop. Do not create branches, do not commit, do not
push, and do not try to merge unrelated histories.

A worktree made from the canonical checkout (`git worktree add`) is
allowed; `check_git_safety.sh` accepts it.

### Hard rules

- branch from `origin/main`
- use pull requests instead of direct pushes to `main`
- do not use `git push --force`
- do not use `--allow-unrelated-histories`
- do not change the default branch to a feature branch as a workaround

If `git merge-base HEAD origin/main` fails, the branch is not safe for a
normal PR. Stop and fix the Git layout first.

### GitHub が唯一の正本（PCに作業を残さない・2026-10-03）

2026-09-30〜10-02 に、Codex がPC上のフォルダで作業を進め、push できないまま差分ファイル・画像が
PCにだけ溜まる事故が起きた（PR #173 で回収）。再発防止として以下を守る。

- 正本は GitHub の `origin`（main と作業ブランチ）だけ。PCのフォルダ・`outputs/`・stash・
  チャットの添付・画像生成サービスのライブラリは正本ではない。「ローカル正本」として扱わない。
- 作業を始めるときは `git fetch origin` し、**最新の `origin/main` から新しいブランチ**を切る。
  未コミットの変更が残った古いフォルダや、古い作業ブランチの上で続きをしない。
- 作業の区切りごと・セッションの終わりに、必ず commit して作業ブランチへ push する。
  push が権限などで止まったら、回避したり差分ファイルを作って終えたりせず、止まってオーナーに報告する。
- 生成した画像・音声もその場で `assets/`（使う素材）か `asset_sources/`（元データ）に置いて commit する。
  デスクトップや外部のライブラリに置いたままにしない。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新の `origin/main` を取り込んでから次の空き番号を使う（別チャットと同時に作業して番号が重なった例がある・2026-10-04）。
- 終える前に `git status`（未コミットが無い）と `git log @{u}..HEAD`（未pushが無い）を確認する。

---
