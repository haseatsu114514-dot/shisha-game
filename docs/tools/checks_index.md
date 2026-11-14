# 自動チェック台帳（何が機械で担保されているか）

`AGENTS.md` のルールのうち、自動チェックで担保されているもの・いないものの一覧。新しいチェックを足したらここへ登録し、ルールを散文からチェックへ移したら対応表を更新する（2026-11-15 のルール最適化で新設）。

## チェッカー・スイートの所在

| 種別 | 所在 | 備考 |
|---|---|---|
| Git安全 | `tools/check_git_safety.sh` / `tools/enable_git_hooks.sh` / `.githooks/pre-push` | checkout開始時・commit/push前に実行。WARNは助言、ERRORだけ止める |
| 文書・入口 | `tools/check_agent_docs.py` | `AGENTS.md` / `CLAUDE.md` / 主要ガイドのリンクと入口の形、予約手順の残存、workflow構成を検査（CIの `docs` スイート） |
| 台詞・設定 | `tools/check_story_canon.py` / `check_char_consistency.py` / `check_speakers.py` / `check_dialogue_links.py` / `check_dialogue_text_only.py` / `check_mashiro_address.py` / `check_confession_flags.py` / `check_legacy_terms.py` / `check_glossary_coverage.py` / `check_active_json.py` / `check_face_icons_fresh.py`、`tools/lint_dialogue.py` | CIの `dialogue-lint` ほか quick スイート群 |
| テストスイート | `tools/ci/suites.json`（quick / browser の区分が正本） | PRで待つチェックは `CI / result` の1つだけ |
| LFS属性の生成 | `tools/gen_lfs_legacy_attributes.sh` | `.gitattributes` 末尾の生成ブロックを作る。手で消さない |

## ルール → チェック対応表（チェック化の対象だった18件）

2026-11-15 の棚卸しで「チェック化」推奨になった項目の現況。状態は実物で確認したものだけを書く。

| ルール（旧AGENTS.mdの所在） | 担保するチェック | 状態 |
|---|---|---|
| `project.godot` が残るcheckoutは古い（対象・優先順位） | `check_git_safety.sh` が fail で検出 | 済み |
| root・`data/`・`assets/`・`remake/` の構成確認（Git Safety） | `check_git_safety.sh` | 済み |
| `core.hooksPath` が `.githooks` か（Git Safety） | `check_git_safety.sh` が warn | 済み |
| `shisha.canonicalRoot` の設定・一致（Git Safety） | `check_git_safety.sh` が warn | 済み |
| 重複checkout（`sheesha_battle` 等）を使わない（Git Safety） | canonicalRoot の検査で間接的に検出 | 部分 |
| `git merge-base HEAD origin/main` の成否（Git Safety） | `check_git_safety.sh` | 済み |
| Issue予約の手順を資料・スキルに残さない（撤廃の打ち消し） | `check_agent_docs.py` が `.claude/skills/` と主要ガイドの予約コマンド残存を検出（2026-11-15 追加） | 済み |
| workflowファイルを増やさない（CI） | `check_agent_docs.py` が `.github/workflows/` の構成（ci / deploy-pages / sequential-merge の3本）を検出（2026-11-15 追加） | 済み |
| キャラ設定・台詞・改行は正本とスキーマに従う（作業の進め方） | 上表の台詞・設定チェッカー群＋ `dialogue-lint` | 済み（報酬などの網羅は仕様側） |
| 好感度イベントの時系列ルール（作業の進め方） | `check_confession_flags.py` と affinity 系スイート | 部分（全章の遅れ読み分岐の網羅はテスト拡張待ち） |
| 参考資料（siryou等）の写真をゲームのリポジトリへ入れない | なし | 未（pre-commit での検出が候補） |
| `.gitattributes` の生成ブロックを手で消さない（画像とGit LFS） | なし（生成は `gen_lfs_legacy_attributes.sh`） | 未（CI差分チェックが候補） |
| CIに `asset_sources/` を読ませるときの `suites.json` sparse と生成ブロックの整合 | なし | 未 |
| checkout前に `git lfs install --skip-repo`、git-lfs の有無 | なし（`.githooks/pre-push` が upload を担う） | 未 |
| `git add` 後に新規画像がLFS管理か `git lfs ls-files` で確認 | pre-push が upload 時に検証 | 部分 |
| 終了前の未保存・未push確認（`git status` / `git log @{u}..HEAD`） | なし | 未（定型スクリプト化が候補） |
| 要望台帳（`docs/owner_requests.md`）のID採番 | なし | 未（台帳リンタが候補） |
| Git Safety の実行タイミング自体（開始時・変更後・commit/push前） | hooks が commit/push で担保、開始時は散文 | 部分 |

「未」は散文ルールのまま残すものではなく、チェック化の候補として管理する。実装したらこの表の状態を更新すること。
