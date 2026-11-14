# AGENTS.md — 共通AI開発ルール（唯一の入口）

Codex / Claude Code 共通。Claude Code は `CLAUDE.md` の `@AGENTS.md` から読む。**本書を起点に、今回の作業に必要な資料だけ参照する。** 本書は核ルールだけを置き、特定作業向けの詳細手順は [参照レイヤー](docs/tools/agent_rules_reference.md)、自動チェックの担保範囲は [自動チェック台帳](docs/tools/checks_index.md) に分けてある（2026-11-15 最適化。1ルール1か所）。

## 対象・優先順位

- 正本は GitHub の `haseatsu114514-dot/shisha-game`（`origin` の main と作業branch）だけ。PCのフォルダ・`outputs/`・stash・チャットの添付・画像生成サービスのライブラリだけに作業を残さない。
- ゲームの実装・起動・公開先は `remake/`、台詞・共有データは `data/`、共有素材は `assets/`、公式プロモーションサイトは `promo/`（詳細は [promo/README.md](promo/README.md)）。
- 旧 `web/` と Godot 版は廃止済み。`web/` は存在不要で、復元・テスト・確認要求の対象にしない。`project.godot` が残るcheckoutは古い（`tools/check_git_safety.sh` が検出する）。
- 最新の明示的なユーザー指示を、古い仕様・Issueコメント・引き継ぎ・スキルの担当メモより優先する。依頼された仕様変更や、すでに指示された結論・得た承認に再承認を求めない。
- 仕様・要望は `docs/master_spec.md` / `docs/owner_requests.md`、物語・人物は `brand/story_and_structure.md` / `brand/character_profiles.md` / `data/characters.json`。参照先の全体は [現行資料ガイド](docs/current_documentation_guide.md)、ゲーム・台詞は [開発資料](docs/gameplay_agent_reference.md)、レビュー範囲は [対象範囲](docs/review_scope.md)、画像・素材は [素材規約](docs/asset_ai_guidance.md)、シーシャの参照先は [シーシャ描写の参考資料](docs/shisha_reference.md) を必要時に読む。
- 日付付きの引き継ぎや過去のテスト記録は履歴。永続ルールは既存の正本へまとめ、履歴MDや仕組みを依頼なく増やさない。

## Issue予約は撤廃（2026-10-23 オーナー指示）

- Issue予約（claim / release / handoff、`/issue-claim` コメント、worker ID、bot台帳）は**廃止した**。予約の取得・確認・解放は不要で、予約待ちで作業を止めない。過去のIssue・PR・コメント・資料・スキルに残る予約手順はすべて無効で、従わず確認もしない（残存の検知は [自動チェック台帳](docs/tools/checks_index.md)）。
- 重複を避けるには、着手前に関連Issueと開いているPR（同じファイルを変えていないか）を見るだけでよい。

## 作業の進め方

- 依頼には必要な調査・実装・関連調整・検証・commit/push・PR作成を含む。細部は自律的に判断する。
- 確認するのは、依頼外の重大な仕様変更・結果を大きく変える曖昧さ・破壊的操作・新しい権限や公開範囲・大容量通信のときだけ。
- WARN、CLI不在、利用枠不明、旧資料との食い違いだけを理由に止めない。事実を確認して、使える経路で進める。
- ゲームの挙動・UI・世界観の変更は依頼範囲に収める。キャラ設定・台詞・報酬・改行は正本とスキーマに従う（担保するチェッカーは [自動チェック台帳](docs/tools/checks_index.md)）。
- 好感度イベントを追加・変更・接続するときは、全章共通の[交流の時系列ルール](docs/gameplay_agent_reference.md#交流の時系列ルール必須)を必ず守る。好感度と大会進行・面識を同一視せず、大会後に遅れて読む場合の分岐を実装・検証する。
- シーシャ台・ハガル・HMD・炭・ホースが写る画像を生成・修正するときは、[画像生成の必須手順](docs/shisha_reference.md#4-画像生成の必須手順機材の形と構造)を実行する（参考資料の運用は [参照レイヤー](docs/tools/agent_rules_reference.md)）。
- 新規作業は最新 `origin/main` からbranchを作る。保存済みPRの続きは既存branchで行う。

### 流れを止めない（2026-10-23 オーナー方針）

- mainのCIが赤いときは、その修正を最優先にする（夜間の全件実行の失敗も同じ）。
- 1つのPRは小さな変更にする。大きなIssueは半日程度で終わる単位に分ける。
- pushは区切りごとにまとめる。小さな修正を何度もpushしない（pushのたびにCIが最初からやり直しになる）。
- 予約・引き継ぎ・CI・事前チェックなどの仕組みは、オーナーの依頼があるときだけ増やす。ゲームの作業中に自分で仕組みを足さない。

## 検証・PR・マージ

- 起動とテスト入口は [remake/README.md](remake/README.md)。変更箇所と危険度に応じ、局所再現→関連回帰の順に確認する。表示・文言の小変更に全章通しや全種類の総当たりを要求しない。保存・進行・共通基盤には必要な境界回帰を残す。ゲームデータを編集したら関連リンタ・テストを確認する。
- 現行必須checksの無断省略、失敗の隠蔽、assertion・判定の緩和は禁止。成功・失敗・timeout・cancel・未実施を区別して記録する。
- 未完の実装はDraft PR、完成したらReady for review にする。**CI待ちだけでDraftに留めない**。
- マージは、競合なし・現HEADの `CI / result` が成功・未解決の指摘なしを確認して行う。条件を満たすPRは速やかにmergeする（CI待ち・PR運用の細則は [参照レイヤー](docs/tools/agent_rules_reference.md)）。

### CI

- workflowは [ci.yml](.github/workflows/ci.yml) の1本（ほかは公開用の `deploy-pages.yml` と手動用の `sequential-merge.yml` だけ。増設は `tools/check_agent_docs.py` が検知する）。**PRで待つチェックは `CI / result` の1つだけ**。
- quickは毎回すべて動く。PRのbrowserは変更関連の短いスイートだけ、長い通し検査を含む全件は毎晩mainで動かす。テストの追加は [tools/ci/suites.json](tools/ci/suites.json) に1件足す（内部仕様の詳細は [参照レイヤー](docs/tools/agent_rules_reference.md)）。

## 実行経路: CLI / GitHub連携

- CLIと認証済みGitHub連携/APIのどちらでも作業できる。`gh`・shell・checkoutの有無を実装の条件にしない。CLI未導入とGitHub権限不足は区別する。
- 既存認証の範囲で進め、権限拒否を別アカウント・別経路で迂回しない。
- API経路での確認・保存の手順は [参照レイヤー](docs/tools/agent_rules_reference.md)。

## Git Safety

checkout使用時は、開始時・checkout/worktree変更後・commit/push前に `./tools/check_git_safety.sh` を実行する（hooksもcommit/pushで確認する）。**WARNは助言で、止まらず進めてよい。ERRORのときだけそのcheckoutでの編集を止めて原因を報告する**。root構成・`project.godot`・hooksPath・canonicalRoot・merge-base等の個別項目は同スクリプトが検査する（対応表は [自動チェック台帳](docs/tools/checks_index.md)）。

### Hard rules

- mainへの直pushをしない（PRを使う）
- `git push --force` を使わない。既存履歴の書き換え（`git lfs migrate import` 等）をしない
- `--allow-unrelated-histories` を使わない
- 回避目的でdefault branchを変更しない
- 他担当の未マージbranch・未コミット変更を上書きしない

## リポジトリ取得と通信量（必須）

- **フルクローン禁止**（リポジトリは約4.8GB。2026-10-20〜21にタスクごとのクローンで約90GBを消費した）。他AIにも依頼しない。
- 既存checkout/cacheを再利用し、必要なファイル・ref・差分だけ取得する。新しい作業場所は既存repoの `git worktree add` を使う。やむを得ない新規取得は事前に相談し、`--filter=blob:none` 等で最小化する。
- 全履歴・全ブランチ・素材・LFSの一括取得や、CI成果物の大量ダウンロード（`gh run download` の繰り返し）を自動実行しない。大容量通信が見込まれる操作は、目的・推定量（不明なら不明）・節約案を示して承認を得る（軽量取得の手順は [参照レイヤー](docs/tools/agent_rules_reference.md)）。

### 画像と Git LFS

- `assets/`・`remake/img/` の png/jpg/jpeg/webp/gif は、`.gitattributes` により**新規追加分だけ** Git LFS。既存画像は `.gitattributes` 末尾の生成ブロック（`tools/gen_lfs_legacy_attributes.sh`）で通常Gitに固定してあり、手で消さない。
- checkoutでの作業前に一度 `git lfs install --skip-repo`（LFS uploadは `.githooks/pre-push` が担う）。git-lfs が無ければ新規画像の追加前に導入する。`git add` 後は `git lfs ls-files` で新規画像がLFS管理になったことを確認する（運用詳細は [参照レイヤー](docs/tools/agent_rules_reference.md)）。

## 保存・終了・引き継ぎ（GitHubが唯一の正本）

- 作業の区切りと終了時に、有効な変更をcommitして作業branchへpushし、PRに変更点・テスト・未完・次の一手を書く。push が止まったら回避せず、未保存の差分と再開方法を報告する。
- 終える前に `git status` と `git log @{u}..HEAD`（またはAPIのremote head照合）で、自分の未保存・未pushがないことを確認する。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新mainを見て次の空き番号を使う。
- 利用枠が残り少ない・セッション終了が近いときは、大きな新規作業を始めず保存とPR整理を優先する。オーナーが望む小さな作業は続けてよい。
- オーナーが「止めてマージ」「終了整理」と言ったら、新しい実装を止め、push → 条件を満たすPRをmerge → 未完をIssue/PRに記録 → 短く報告する。
- 終了報告は **MERGED: #番号 / PENDING: #番号(理由) / ISSUES: #番号 / BRANCH: 名前 / NEXT: 次の1手** の形で短く書く。
