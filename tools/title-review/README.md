# タイトルCG選別

公開URL: https://haseatsu114514-dot.github.io/shisha-game/tools/title-review/

正式23枚と過去・修正候補を比較する独立した画面。Issue #407 / 既存PR #387を完成。画像の正式採用はオーナーが判断し、本編への自動反映・画像削除・manifest更新は行わない。

## 使い方

1. キャラクター・系統・選別判定・本編使用で絞り込む。名前・制作履歴・メモも検索できる。
2. 画像を押して詳細を開く。「採用候補／保留／見送り」とメモを付ける。原画・生成指示・制作履歴へのリンク、正式立ち絵／顔／みんとの私服、修正前後を確認する。
3. 一覧の「比較に追加」で2〜4枚選び、下部の「並べて比較」を押す。スマホでは2列で上下にスクロール。画像を押すと拡大し、顔・衣装・器具を確認できる。
4. ブラウザ保存で判定・メモ・比較選択・絞り込みを再開する。端末間の移動や採用担当への引き渡しは「JSONを書き出す／読み込む」。読み込みは内容確認後、JSONに含まれる画像だけを更新する。

「本編使用中」は現行manifestから取得した事実で、選別の「採用候補」と独立。選別結果は `shisha-title-review-v4` だけに保存し、ゲームの `suien_remake_save` と他の保存キーを変更しない。保存不能を明示し、破損した既存保存は上書きせず画面内での選別とJSON書出しを可能にする。不正JSON・未知の画像IDは全体を拒否し、既存判定を保持。旧試作の `shisha-title-review-v3` は対応する画像が全て見つかり、同一原画の判定が矛盾しないときだけ移行。「adopt」は「採用候補」とする。旧キーは保持する。

## 修正依頼をIssueへ渡す

画像の「修正・選別メモ」に具体的な修正点を入力する。

- 「この画像のメモ（TXT）」はその1枚だけを書き出す。
- 上部の「修正メモを書き出す（TXT）」は、絞り込みに関係なくメモのある全画像を書き出す。
- 「Issue下書きを開く」は画像名・原画リンク・SHA256・判定・本編使用状態・メモをGitHubの新規Issueフォームへ入れる。GitHubでログインし、内容を確認して投稿する。ボタンだけで自動投稿しない。
- URLに入りきらない長文は、全文をTXTで書き出してAIに渡すか、GitHubの本文へ貼り付ける。メモは切り捨てない。

TXTをAIへ渡すときは「この修正メモを既存Issueと照合してIssueに保存して」と依頼する。出力にもその用途を記載する。メモの書出し／下書き表示は選別判定を変更せず、画像の修正や本編採用も行わない。

## 収録と非公開資料の保護

- 現行manifestの正式23枚、キービジュアル、新版19案／旧15案と途中生成履歴。
- 別タイトル候補12枚、アゲハの顔・乾燥ラック修正5枚、みんとの植物修正パフェとタッパーv1〜v5。
- ひよりの採用5枚と窓際の修正前v1、縮尺・ホースなどの過去NG原画。
- 関連するみんとの初来店チェキ原画・背景修正前・追加3ポーズ、第1章キービジュアル。

116の原画パスをSHA256で94枚へ重複整理（22重複）。同じ原画の複数パス・系統・指示を併記し、修正前後を相互に接続する。元画像・正式PNG/WebP・採用履歴は編集しない。収録していない実写・素材元・参照フォルダ・QA画像を誤って画像候補へ追加しない。

旧資料で「ageha01 / この別候補系の原画なし」と記録されるスロットは原画が存在せず、画面にその事実を明示する。正式タイトルやアゲハの修正5案は収録済み。この未制作スロットを制作済みとして代用しない。画像制作・候補の採否・機材の精密な再検品は本Issueの対象外。

Pagesは画面の5ファイルと `media/` の生成WebPのみ追加配信し、`asset_sources/` 一式は配信しない。原画や指示へのリンクはGitHub上の既存資料へ接続する。

## 目録の更新

リポジトリrootで、Pillowが使えるPythonを用いる。

```sh
python3 tools/title-review/build_catalog.py
python3 tools/title-review/build_catalog.py --check
```

生成スクリプトは収録対象フォルダ・manifest・既存候補メタデータを読み、元画像に書き込まず、表示用WebP・サムネイル・目録だけを作る。候補集へ原画が追加された場合は自動収録対象を確認してから再生成する。新しい系統の追加は `tools/title-review/extra_sources.json` に明示する。

```json
[{"path":"asset_sources/new-candidates/candidate.png","character":"minto","group":"追加修正候補","label":"候補名","history":"修正点・承認状態","prompt":"asset_sources/new-candidates/candidate.prompt.txt","before":"assets/ui/title_arts/title_art_minto_01_cafe_welcome.png"}]
```

任意の新系統は自動公開せず、生成された画像の由来を確認する。SHA256をIDに使うため、同じ原画の追加パスや別名は既存判定を保持し、原画が異なる新案は別IDになる。

## 検証

```sh
python3 -m http.server 8123
# 別端末（Playwrightをインストール済みの環境）
NODE_PATH="$PWD/remake/test/browser/node_modules" node tools/title-review/test.mjs
node remake/test/title_arts.mjs
```

`REVIEW_URL` で選別画面の検証先、`BASE_URL` で本編の検証先、`ARTIFACT_DIR` で結果・画像の保存先、`CHROME_EXECUTABLE_PATH` でChromeを指定できる。実行ごとに新しいブラウザcontextを作り、実際のプレイヤーの保存を開かない。

CIの `title-review` スイート（`tools/ci/suites.json`。旧 `Title CG review` workflow は `ci.yml` へ統合）は目録・全画像の整合性、PC／390pxタッチ／320pxタッチ、2・3・4枚比較、全フィルター、メモと再開、JSON往復／キャンセル／不正入力の非破壊性、保存不能／破損保存／画像失敗、旧試作移行、本編23枚の抽選と保存不変を検証する。証跡は [QA記録](../../docs/qa/title-review/README.md)。
