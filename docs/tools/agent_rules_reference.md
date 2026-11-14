# AGENTS.md 参照レイヤー（必要時だけ読む詳細）

`AGENTS.md` は核ルールだけに絞ってある。本書は「特定の作業のときだけ必要な詳細」の置き場で、毎回は読まない。2026-11-15 のルール最適化で `AGENTS.md` から移した。ルールを変えるときは、核ルールは `AGENTS.md`、詳細は本書、と置き場を守る（1ルール1か所）。

## 資料の詳細マップ

- 仕様・要望の正本は `docs/master_spec.md` / `docs/owner_requests.md`。物語・人物は `brand/story_and_structure.md` / `brand/character_profiles.md` / `data/characters.json`。
- ゲーム・台詞の詳細は `docs/gameplay_agent_reference.md`、レビュー範囲は `docs/review_scope.md`、画像・CG・外部素材は `docs/asset_ai_guidance.md`、シーシャの工程・機材・用語の参照先は `docs/shisha_reference.md`。全体の索引は `docs/current_documentation_guide.md`。
- 素材の実物構造・ライセンス・QA確認は省略しない（詳細は `docs/asset_ai_guidance.md`）。
- 公式プロモーションサイトは `promo/`（ゲーム本体と独立した静的ページ）。作り・更新・載せる範囲は `promo/README.md` に従う。

## シーシャ機材が写る画像の生成・修正

- シーシャ台・ハガル・HMD・炭・ホースが写る画像を生成・修正するときは（Codexアプリで直接生成する場合も）、[画像生成の必須手順](../shisha_reference.md#4-画像生成の必須手順機材の形と構造)を実行する: 貼る文をプロンプトに入れ、参考写真を見て（渡せるツールなら渡し）、生成後チェックで検品してから採用する。
- 参考写真と機材の資料は**非公開リポジトリ `siryou`**（https://github.com/haseatsu114514-dot/siryou ）の `shisha-hardware-reference/`（PCではゲームのリポジトリと同じ階層に `git clone https://github.com/haseatsu114514-dot/siryou ../siryou`）。機材と内装は日本のシーシャバーの写真（`web-refs/images/`）を基準にし、海外の写真（`photos/`）は構造の確認だけに使う。
- 資料の写真をゲームのリポジトリへ入れない（検知の自動化は [checks_index.md](checks_index.md) の対応表で管理）。

## PR運用の細則

- 同じファイルを変更する未マージPRがある場合は、その完了を待つか、別の作業を選ぶか、そのPRのbranchで続きをする。
- 保存済みPRの続きは既存branchで行う。`main` より遅れているだけでは毎回mergeせず、競合解消・必要な依存変更があるときだけ取り込む。
- 同じHEADの成功結果を再利用する。無関係な変更で過去の検証を失効扱いしない。
- CI待ちだけになったら、対象PR・現HEAD・残る必須checkを一度確認する。同じ「実行中」「マージ保留」の報告や短間隔の再照会を繰り返さず、待機中は他の有益な作業を進める。成功・失敗・timeout・cancelなど判断材料が変わった時だけ報告・対応する。セッションを終える場合は保留理由と次に確認する条件を一度だけ残す。古いHEADの失敗や、再実行で成功に置き換わった結果を停止理由にしない。
- AIの交代は、変更をpushしたうえでPRかIssueに DONE / TODO / TEST / NEXT を書くだけでよい。後任はそのbranchで続ける（保存の核ルールは `AGENTS.md`）。

## CIの内部仕様

- quick（ブラウザ不要の検査）は毎回すべて動く。PRのbrowser（Chromium）は変更ファイルに関係する短いスイート（目安5分以内）を最大8グループで動かし、ブラウザテスト本体を変更した場合は長いスイートも動かす。全件は毎晩mainで動かす。
- Draft PRではbrowserを動かさない。結果が必要になったら Ready for review にする（その時点のheadで動く）。mainへのpushはquickだけ。browserの全テストは毎晩（03:17 JST）mainで動く（夜間の失敗の扱いは `AGENTS.md` の最優先ルール）。
- テストの追加は `tools/ci/suites.json` に1件足す。手元では、プレビューサーバーを先に起動して `node tools/ci/run.mjs --kind quick` / `--kind browser --suites <id>` で同じものを動かせる。起動とテスト入口の詳細は `remake/README.md`。
- CIのcheckoutは必要なフォルダだけ（約0.7GB）にし、ファイル一式を取らない。新規画像（Git LFS）はキャッシュ経由で取得する。
- workflowファイルの増設禁止は [checks_index.md](checks_index.md) 経由で `tools/check_agent_docs.py` が検知する。

## GitHub連携（API経路）の手順

- checkoutを持たない連携経路では、最新mainのSHA・作業branchのhead・既存PRの変更ファイルをAPIで確認する。ローカルのroot/hooks検査は「対象外」とし、実行済みとは報告しない（結果の区別記録は `AGENTS.md` の核ルール）。
- API保存は最新mainを親に別branchを作り、対象ファイルの現在blob SHAまたは親treeを確認してcommitする。無関係なtreeを置き換えず、ref更新でforceを使わない。

## リポジトリ取得の詳細

- shallow/filtered fetchでも少量とは限らない。想定外に転送量が増えたら中断し、状況を報告する。
- 最新のファイル一式は約1.3GB（`asset_sources/` 約0.5GB。2026-11-11 に `asset_sources/` の画像・動画をLFSへ移す前は約3.5GB）。ゲーム開発に要るのは約0.8GB。履歴には変換前の画像が残るので、全履歴の取得は今も大きい。新しいPCなどでどうしても取得が必要なときは、オーナーの承認を得たうえで次の「軽量取得」を使う（必要なフォルダの最新版だけを取る）。

  ```bash
  git clone --depth 1 --filter=blob:none --sparse https://github.com/haseatsu114514-dot/shisha-game.git
  cd shisha-game
  git sparse-checkout set --no-cone '/*' '!/*/' '/remake/' '/data/' '/assets/' '/promo/' '/tools/' '/brand/' '/experiments/' \
    '/.claude/' '/.agents/' '/.github/' '/.githooks/' '/docs/' '!/docs/archive/' '!/docs/qa/*/' '/asset_sources/' '!/asset_sources/*/' '/asset_sources/shisha-hardware-reference/'
  ```

- `asset_sources/` や `docs/qa/` の特定フォルダが要るときは `git sparse-checkout add '/asset_sources/<フォルダ>/'` でそのフォルダだけ取る。範囲外に新しいファイルを足すときは `git add --sparse <パス>`。

## 画像と Git LFS の運用詳細

- `asset_sources/` の画像（png/jpg/jpeg/webp/gif）・動画（mp4/webm/mov）・zip・pdf は、既存分も含めて Git LFS（2026-11-11 オーナー決定で一括変換。履歴は書き換えていない）。例外は、CIが中身を読むフォルダ（`tools/ci/suites.json` の `sparse` にある `asset_sources/…`）と `asset_sources/shisha-hardware-reference/` で、同じ生成ブロックで通常Gitのまま。
- `asset_sources/` の原画を見る・加工するときは、そのフォルダだけ `git lfs pull --include="asset_sources/<フォルダ>/**"` で取る。
- 規定以外の一括LFS変換は、オーナーの依頼があるときだけ行う。
- worktreeは `GIT_LFS_SKIP_SMUDGE=1` で作り、必要な実体だけ `git lfs pull --include="<パス>"` で取得する。LFSも所有者の無料枠を消費するため `AGENTS.md` の通信量ルールに従う。
- 生成した画像・音声は、使う素材を `assets/` 等の所定位置、原画・元データを `asset_sources/` に置いてcommitする。

## 任意ツール（必須手順にしない）

- 既存の試作ツール（`tools/pr_change_preflight.py`、`tools/sequential_merge/`、job checkpoint 等）は任意で、必須の手順にしない。
- 利用枠残量は公式に見える場合だけ参照し、推測しない。Macでは任意で `python3 tools/agent_quota_guard.py check codex|claude` を使える（[詳細](agent_quota_guard.md)）。
