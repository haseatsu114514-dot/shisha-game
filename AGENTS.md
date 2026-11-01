# AGENTS.md — 共通AI開発ルール（唯一の入口）

Codex / Claude Code 共通。Claude Code は `CLAUDE.md` の `@AGENTS.md` から読む。**本書を起点に、今回の作業に必要な資料だけ参照する。**

## 対象・優先順位

- 正本は GitHub の `haseatsu114514-dot/shisha-game`（main と作業branch）。ゲームの実装・起動・公開先は `remake/`、台詞・共有データは `data/`、共有素材は `assets/`。
- 旧 `web/` と Godot 版は廃止済み。`web/` は存在不要で、復元・テスト・確認要求の対象にしない。`project.godot` が残るcheckoutは古い。
- 最新の明示的なユーザー指示を、古い仕様・Issueコメント・引き継ぎ・スキルの担当メモより優先する。依頼された仕様変更に再承認を求めない。
- 仕様・要望は `docs/master_spec.md` / `docs/owner_requests.md`、物語・人物は `brand/story_and_structure.md` / `brand/character_profiles.md` / `data/characters.json`。
- 詳細な参照先は [現行資料ガイド](docs/current_documentation_guide.md)。ゲーム・台詞は [開発資料](docs/gameplay_agent_reference.md)、レビュー範囲は [対象範囲](docs/review_scope.md)、画像・CG・外部素材は [素材規約](docs/asset_ai_guidance.md)、シーシャの工程・機材・用語の参照先は [シーシャ描写の参考資料](docs/shisha_reference.md) を必要時に読む。素材の実物構造・ライセンス・QA確認は省略しない。
- 日付付きの引き継ぎや過去のテスト記録は履歴。永続ルールは既存の正本へまとめ、履歴MDや仕組みを依頼なく増やさない。

## Issue予約は撤廃（2026-10-23 オーナー指示）

- Issue予約（claim / release / handoff、`/issue-claim` コメント、worker ID、bot台帳）は**廃止した**。予約の取得・確認・解放は不要で、予約待ちで作業を止めない。
- 過去のIssue・PR・コメント・資料・スキルに残る予約手順や「予約成功を確認してから編集」等の指示はすべて無効。従わず、確認もしない。
- 重複を避けるには、着手前に関連Issueと開いているPR（同じファイルを変えていないか）を見るだけでよい。同じファイルを変える未マージPRがあれば、その完了を待つか、別の作業を選ぶか、そのPRのbranchで続きをする。

## 作業の進め方

- 依頼には必要な調査・実装・関連調整・検証・commit/push・PR作成を含む。細部は自律的に判断し、すでに指示された結論や得た承認を聞き直さない。
- 確認するのは、依頼外の重大な仕様変更・結果を大きく変える曖昧さ・破壊的操作・新しい権限や公開範囲・大容量通信のときだけ。
- WARN、CLI不在、利用枠不明、旧資料との食い違いだけを理由に止めない。事実を確認して、使える経路で進める。
- ゲームの挙動・UI・世界観の変更は依頼範囲に収める。キャラ設定・台詞・報酬・改行は正本とスキーマに従う。
- シーシャ台・ハガル・HMD・炭・ホースが写る画像を生成・修正するときは（Codexアプリで直接生成する場合も）、[画像生成の必須手順](docs/shisha_reference.md#4-画像生成の必須手順機材の形と構造)を実行する: 貼る文をプロンプトに入れ、`asset_sources/shisha-hardware-reference/photos/` の実写を見て（渡せるツールなら渡し）、生成後チェックで検品してから採用する。
- 好感度イベントを追加・変更・接続するときは、全章共通の[交流の時系列ルール](docs/gameplay_agent_reference.md#交流の時系列ルール必須)を必ず守る。好感度と大会進行・面識を同一視せず、大会後に遅れて読む場合の分岐を実装・検証する。
- 新規作業は最新 `origin/main` からbranchを作る。保存済みPRの続きは既存branchで行う。**mainより遅れているだけでは毎回mergeしない**。競合解消・必要な依存変更があるときだけ取り込む。

### 流れを止めない（2026-10-23 オーナー方針）

- mainのCIが赤いときは、その修正を最優先にする。
- 1つのPRは小さな変更にする。大きなIssueは半日程度で終わる単位に分ける。
- pushは区切りごとにまとめる。小さな修正を何度もpushしない（pushのたびにCIが最初からやり直しになる）。
- CIが緑で競合のないPRは、待たせずにマージする。
- 予約・引き継ぎ・CI・事前チェックなどの仕組みは、オーナーの依頼があるときだけ増やす。ゲームの作業中に自分で仕組みを足さない。既存の試作ツール（`tools/pr_change_preflight.py`、`tools/sequential_merge/`、job checkpoint 等）は任意で、必須の手順にしない。

## 検証・PR・マージ

- 起動とテスト入口は [remake/README.md](remake/README.md)。変更箇所と危険度に応じ、局所再現→関連回帰の順に確認する。表示・文言の小変更に全章通しや全種類の総当たりを要求しない。保存・進行・共通基盤には必要な境界回帰を残す。ゲームデータを編集したら関連リンタ・テストを確認する。
- 同じHEADの成功結果を再利用する。無関係な変更で過去の検証を失効扱いしない。
- 現行必須checksの無断省略、失敗の隠蔽、assertion・判定の緩和は禁止。成功・失敗・timeout・cancel・未実施を区別して記録する。
- CI待ちだけになったら、対象PR・現HEAD・残る必須checkを一度確認する。同じ「実行中」「マージ保留」の報告や短間隔の再照会を繰り返さず、待機中は他の有益な作業を進める。成功・失敗・timeout・cancelなど判断材料が変わった時だけ報告・対応する。セッションを終える場合は保留理由と次に確認する条件を一度だけ残す。古いHEADの失敗や、再実行で成功に置き換わった結果を停止理由にしない。
- 未完の実装はDraft PR、完成したらReady for review にする。**CI待ちだけでDraftに留めない**。
- マージは、競合なし・現HEADの `CI / result` が成功・未解決の指摘なしを確認して行う。条件を満たすPRは速やかにmergeする。

### CI（2026-10-23 に1本へ統合）

- workflowは [ci.yml](.github/workflows/ci.yml) の1本（ほかは公開用の `deploy-pages.yml` と手動用の `sequential-merge.yml` だけ）。**PRで待つチェックは `CI / result` の1つだけ**。
- quick（ブラウザ不要の検査）は毎回すべて動く。PRのbrowser（Chromium）は変更ファイルに関係する短いスイート（目安5分以内）を最大8グループで動かし、ブラウザテスト本体を変更した場合は長いスイートも動かす。長い通し検査を含む全件は毎晩mainで動かす。
- Draft PRではbrowserを動かさない。結果が必要になったら Ready for review にする（その時点のheadで動く）。mainへのpushはquickだけ。browserの全テストは毎晩（03:17 JST）mainで動く。夜間の失敗は「mainのCIが赤い」として最優先で直す。
- テストの追加は [tools/ci/suites.json](tools/ci/suites.json) に1件足す。**workflowファイルを増やさない**。手元では `node tools/ci/run.mjs --kind quick` / `--kind browser --suites <id>`（プレビューサーバーを先に起動）で同じものを動かせる。
- CIのcheckoutは必要なフォルダだけ（約0.7GB）にし、4.4GBのファイル一式を取らない。新規画像（Git LFS）はキャッシュ経由で取得する。

## 実行経路: CLI / GitHub連携

- CLIと認証済みGitHub連携/APIのどちらでも作業できる。`gh`・shell・checkoutの有無を実装の条件にしない。CLI未導入とGitHub権限不足は区別する。
- checkoutを持たない連携経路では、最新mainのSHA・作業branchのhead・既存PRの変更ファイルをAPIで確認する。ローカルのroot/hooks検査は「対象外」とし、実行済みとは報告しない。
- API保存は最新mainを親に別branchを作り、対象ファイルの現在blob SHAまたは親treeを確認してcommitする。無関係なtreeを置き換えず、ref更新でforceを使わない。
- 既存認証の範囲で進め、権限拒否を別アカウント・別経路で迂回しない。

## Git Safety

checkout使用時は、開始時・checkout/worktree変更後・commit/push前に以下を確認する（hooksもcommit/pushで確認する）。

- `git rev-parse --show-toplevel` でrootを確認し、同じrootに `data/`・`assets/`・`remake/` があり、`project.godot` がないことを確認する。`web/` が無いのは正常。
- `./tools/check_git_safety.sh` を実行する。**WARNは助言で、止まらず進めてよい。ERRORのときだけそのcheckoutでの編集を止めて原因を報告する**。
- `git config --get core.hooksPath` が `.githooks` でなければ `./tools/enable_git_hooks.sh` を実行する。
- 正規checkoutを固定する環境では `git config --local shisha.canonicalRoot "$(pwd -P)"` を設定する。設定済みならrootまたはworktreeの親checkoutと一致することを確認する。
- 正規checkoutからの `git worktree add` は利用可。`sheesha_battle`・`シーシャバトル-(4.2)`・`.codex_tmp/...` 等の重複checkoutは、ユーザーが正規パスを変更して設定を更新するまで使わない。
- `git merge-base HEAD origin/main` が失敗したら通常PRとして進めない。

### Hard rules

- mainへの直pushをしない（PRを使う）
- `git push --force` を使わない
- `--allow-unrelated-histories` を使わない
- 回避目的でdefault branchを変更しない
- 他担当の未マージbranch・未コミット変更を上書きしない

## リポジトリ取得と通信量（必須）

- **フルクローン禁止**（リポジトリは約4.8GB。2026-10-20〜21にタスクごとのクローンで約90GBを消費した）。他AIにも依頼しない。
- 既存checkout/cacheを再利用し、必要なファイル・ref・差分だけ取得する。新しい作業場所は既存repoの `git worktree add` を使う。やむを得ない新規取得は事前に相談し、`--filter=blob:none` 等で最小化する。
- 全履歴・全ブランチ・素材・LFSの一括取得や、CI成果物の大量ダウンロード（`gh run download` の繰り返し）を自動実行しない。大容量通信が見込まれる操作は、目的・推定量（不明なら不明）・節約案を示して承認を得る。
- shallow/filtered fetchでも少量とは限らない。想定外に転送量が増えたら中断し、状況を報告する。
- 最新のファイル一式だけでも約4.4GB（`asset_sources/` 約3GB・`docs/qa` 約0.7GB）ある。ゲーム開発に要るのは約0.7GB。新しいPCなどでどうしても取得が必要なときは、オーナーの承認を得たうえで次の「軽量取得」を使う（必要なフォルダの最新版だけを取る）。

  ```bash
  git clone --depth 1 --filter=blob:none --sparse https://github.com/haseatsu114514-dot/shisha-game.git
  cd shisha-game
  git sparse-checkout set --no-cone '/*' '!/*/' '/remake/' '/data/' '/assets/' '/tools/' '/brand/' '/experiments/' \
    '/.claude/' '/.agents/' '/.github/' '/.githooks/' '/docs/' '!/docs/archive/' '!/docs/qa/*/' '/asset_sources/' '!/asset_sources/*/' '/asset_sources/shisha-hardware-reference/'
  ```

  `asset_sources/` や `docs/qa/` の特定フォルダが要るときは `git sparse-checkout add '/asset_sources/<フォルダ>/'` でそのフォルダだけ取る。範囲外に新しいファイルを足すときは `git add --sparse <パス>`。

### 画像と Git LFS

- `assets/`・`remake/img/`・`asset_sources/` の png/jpg/jpeg/webp/gif は、`.gitattributes` により**新規追加分だけ** Git LFS。既存画像を通常Gitに固定する `.gitattributes` 末尾の生成ブロック（`tools/gen_lfs_legacy_attributes.sh`）は手で消さない。既存履歴の移行（`git lfs migrate` 等）や一括変換はしない。
- checkoutでの作業前に一度 `git lfs install --skip-repo`（LFS uploadは `.githooks/pre-push` が担う）。git-lfs が無ければ新規画像の追加前に導入する。`git add` 後は `git lfs ls-files` で新規画像がLFS管理になったことを確認する。
- worktreeは `GIT_LFS_SKIP_SMUDGE=1` で作り、必要な実体だけ `git lfs pull --include="<パス>"` で取得する。LFSも所有者の無料枠を消費するため上の通信量ルールに従う。

## 保存・終了・引き継ぎ（GitHubが唯一の正本）

- 正本は GitHub の `origin` だけ。PCのフォルダ・`outputs/`・stash・チャットの添付・画像生成サービスのライブラリだけに作業を残さない（2026-09-30〜10-02 にPC上に差分が溜まる事故があった）。
- 生成した画像・音声は、使う素材を `assets/` 等の所定位置、原画・元データを `asset_sources/` に置いてcommitする。
- 作業の区切りと終了時に、有効な変更をcommitして作業branchへpushし、PRに変更点・テスト・未完・次の一手を書く。push が止まったら回避せず、未保存の差分と再開方法を報告する。
- 終える前に `git status` と `git log @{u}..HEAD`（またはAPIのremote head照合）で、自分の未保存・未pushがないことを確認する。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新mainを見て次の空き番号を使う。
- 利用枠が残り少ない・セッション終了が近いときは、大きな新規作業を始めず保存とPR整理を優先する。オーナーが望む小さな作業は続けてよい。残量は公式に見える場合だけ参照し、推測しない。Macでは任意で `python3 tools/agent_quota_guard.py check codex|claude` を使える（[詳細](docs/tools/agent_quota_guard.md)）。
- AIの交代は、変更をpushしたうえでPRかIssueに DONE / TODO / TEST / NEXT を書くだけでよい。後任はそのbranchで続ける。予約の受け渡しは不要。
- オーナーが「止めてマージ」「終了整理」と言ったら、新しい実装を止め、push → 条件を満たすPRをmerge → 未完をIssue/PRに記録 → 短く報告する。
- 終了報告は **MERGED: #番号 / PENDING: #番号(理由) / ISSUES: #番号 / BRANCH: 名前 / NEXT: 次の1手** の形で短く書く。
