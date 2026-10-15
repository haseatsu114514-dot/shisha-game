# 斧投げ体験改善 #589

## 改善前の参照画面

変更前mainに保存されていた既存QAの実画面を、比較用にバイト列を維持して複写した。新しいプレイ結果や今回の変更後の検証結果ではない。元画面の由来は `docs/qa/axe-flight-issue537/README.md` を参照。

| コピー | 元ファイル | SHA-256 |
| --- | --- | --- |
| `before-pc-power.png` | `docs/qa/axe-flight-issue537/flight-ui-pc-power.png` | `7e19beb0339933d03609a066b37c42d32039feea6b80ff9d86eb84b8061551de` |
| `before-touch-portrait-power.png` | `docs/qa/axe-flight-issue537/flight-ui-touch-portrait-power.png` | `9c1bd93146502e4268368210bec9a87127b2d26e12bae2d0121788cb89d3e5a8` |
| `before-touch-landscape-power.png` | `docs/qa/axe-flight-issue537/flight-ui-touch-landscape-power.png` | `b3c4c60577d0521a9253fbe7e677dfdc22de84efd54674672373ec1d122ab7eb` |

## 今回の実操作検証

`/workspace/shisha-game`、Node 24.19.0、system Chromium (`/usr/bin/chromium`) / Playwright 1.62.1。プレビューは `python3 remake/tools/serve_preview.py --port 8123`。ブラウザごとに使い捨てcontextを作り、既存プレイヤーの保存を開かずに実行した。

- 既存 `axe_throw.mjs` 全20ケースの初回は17 PASS / 3 FAIL。独立ページのPC・タッチ縦横、3ゲージ、飛行、照準と着地、宣言、手ブレ・集中、ルール停止、再挑戦、中断、読込失敗など17件はPASS。stage APIの友人旧保存・友人・恋人の3件だけ、タイトルの表示切替ツールバーが新しい位置の「ルール」に重なりクリックを遮った。ミニゲーム表示中だけ同ツールバーを非表示にする修正後、`TEST_CASES=api-` で同じ3件を再実行し **3 / 3 PASS**。最後に全20件を再実行した結果としては扱わない。最終再実行結果は `axe-api-final/axe-throw.json`。
- 新規 `axe_polish.mjs` は最終 **6 / 6 PASS**。PC 1280×800・タッチ縦390×844・タッチ横844×390で的の実クリック/タップにより横→縦→力を止め、各3投を完走。落下とブルの結果表示・助言、常時合計と返値の一致、各投点数、最終集計、収まり、保存全文不変を検証。F集中の1投1回・構え直し後の消費維持・Ctrl/Meta/Alt+Fの非消費、相手ターンの的/F入力拒否、ルール中のインパクト停止、動き軽減時のエフェクト省略も確認。最終結果は `polish-suite/axe-polish.json`。
- 新規ケースの初回には縦画面の合計HUD内部で2pxの高さ超過があり、書体の実グリフを収める行高へ修正してPASSした。収まり判定は緩めていない。もう1件はテストが `aria-disabled=true` の的をPlaywrightの通常locatorクリックで押そうとして自動操作側に拒否されたため、実マウス座標クリックへ修正した。入力を受け付けないことのassertは維持した。

新規6件はブラウザの時計を制御して各針を読み、実ボタン/的/キーボードを操作する。得点・着地点・相手の履歴を直接注入しない。画面は同じ実ミニゲームから取得した。時計を制御した結果と、自然な本編進行の証明は区別する。CSSの結果表示アニメーションは撮影前に実時間350ms待った。

再現コマンド（サーバー起動後）:

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=docs/qa/axe-polish-589/polish-suite COMPARISON_DIR=docs/qa/axe-polish-589/after node remake/test/browser/axe_polish.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium TEST_CASES=api- ARTIFACT_DIR=docs/qa/axe-polish-589/axe-api-final node remake/test/browser/axe_throw.mjs
```

## 木板の表示寸法

`target-size-comparison.json` は変更前main `3810c65717709b3d28c8c02f85f0158da2558049` と今回のCSS最終版で、力ゲージ操作中の木板SVG imageの実DOM境界を測った結果。変更前はそのコミットのHTML・CSS・入口JS・ミニゲームJSをPlaywrightのレスポンスrouteで読み、共通の既存素材を使用した独立context。変更後は通常のローカル配信。画像の透明余白を含む同じ要素の幅を比較するため、木の不透明部分だけのピクセル幅とは異なる。

| 画面 | 改善前 | 改善後 | 幅の増加 |
| --- | ---: | ---: | ---: |
| PC 1280×800 | 333.75px | 386.08px | 15.68% |
| タッチ縦390×844 | 165.29px | 247.38px | 49.66% |
| タッチ横844×390 | 150.00px | 188.12px | 25.41% |

同梱の改善前3枚は既存QAからの複写であり、この測定の再撮影画像ではない。測定途中のCSSでは縦画面の増加率が約52%だったが、最終値は上表の49.66%を採用する。


## 対戦・本編・保存の回帰

- `node --test remake/test/axe_throw.mjs remake/test/axe_match.mjs remake/test/axe_presentation.mjs`: **28 / 28 PASS**。難易度別各1万試合の既存分布は変更なし。
- `axe_versus.mjs`: 初回7件は5 PASS / 2 FAIL。PCと横持ちの20投完走後の結果画面ではみ出しを検知。重複TOTALを結果中だけ省き、両者記録を比較できる配置へ修正。同じ `pc-twenty-throws` と `touch-landscape-twenty-throws` を最終CSSで再実行して **各PASS**。縦20投、キーボード・動き軽減20投、引き分け・リトライ、相手ターン排他・停止、Abort/LOAD/同hostの5件は初回PASS。初回結果は `versus-initial.json`、再実行は `versus-final-pc.json` / `versus-final-landscape.json`。修正後全7件の単一連続実行とは区別する。
- 最終CSSの既存 `TEST_CASES=flight-ui` は **3 / 3 PASS**。PC・縦・横で操作値、照準と着地、投擲/落下、説明中の飛行停止、表示の収まりを再検証。`flight-ui-final.json`。
- `play_spots.mjs`: **20 / 20 PASS**。実マップの3投/10投、料金・行動・記録・保存、中断、結果で取消、LOAD/pagehide/画面撤去、章別の施設導線を確認。`play-spots.json`。
- `save_load.mjs`: **6 / 6 PASS**。旧保存・3枠・PC/スマホの保存UI。`save-load.json`。
- `node --experimental-vm-modules remake/test/lime_consistency.mjs`: **PASS**。
- JS構文、workflow YAML構文、`python3 tools/check_agent_docs.py`、差分・Git Safety: **PASS**。独立レビューで発見したCtrl/Command+Fの集中消費は修正し、修飾キー3種の非消費を実ブラウザと新規回帰で確認。

## 画面と範囲

- 入口: `menu-1280x720.png` / `menu-390x844.png` / `menu-844x390.png`。
- 操作中: `after/final-*-power.png`。結果: `after/polish-*-bull-result.png`、`after/polish-*-summary.png`。命中演出: `after/polish-pc-impact.png`。
- 的のタップ後に残るブラウザ既定のSVG輪郭を抑え、キーボードの焦点枠は的の内側に残す。ゲームを閉じると、タイトル切替ツールバーは自動的に戻る。
- 新しい画像/音声ファイルは生成していない。採用済み素材と既存SEを使用。採点、対戦難易度、解禁、料金/報酬、物語、保存schemaは変更していない。
- 実機Safari/実スマホ、公開版のプレイは未実施。タッチはChromiumエミュレーション。GitHub CIとマージ/公開はこのローカル検証と別に扱う。
- Issue #589 / PR #591。固有worker `codex-axe-polish-20261015-07f0e2`。API通信403による予約不可に対し、オーナーが今回だけ予約省略を明示承認した。通常の予約台帳は作成/変更していない。


## 追加依頼: マキのレッスンと得点の説明

初回の画像とsource-sha256.jsonはコミット2848eab6時点のUIの履歴。追加依頼で合計点をheaderへ移し、予測点と宣言説明を追加した現在の画面は `lesson/`、実装ハッシュは `lesson/source-sha256.json` を参照する。

- ヘッダーに日本語の合計点を常時表示。操作中は「今の照準」の予測点を表示し、通常/宣言した青/落下を実際の採点モデルで判定する。横・縦は力を適正と仮定する旨を表示、力の段階は現在の力・手ブレ・上下補正も含む。
- 選択時に青の宣言、外7/中心8/他0、残り回数と閉鎖した高さを明示。ルール冒頭にも通常と青の図解、操作の要点を置いた。
- 独立入口と店内からマキの無料1投レッスン。案内/的/横/縦/力/結果/終了の7画面で、説明中は時間を止め、説明後に実操作する。途中終了・何度でも復習可能。強制チュートリアルや永続フラグは追加しない。
- `axe_lesson.mjs`: **6 / 6 PASS**。PC/タッチ縦横の全説明段階停止→実1投→完了、予測点の採点一致、図解/宣言説明、skip/Abort/host撤去、本編の残高不足・当日使用済・体力0から無料完走→元menu復帰、staminaGuard0回、金/体力/行動/記録/保存全文の不変。
- 既存 `axe_polish.mjs` **6 / 6 PASS**、`TEST_CASES=flight-ui` **3 / 3 PASS**、相手ターン排他/停止/二重入力 **PASS**。モデル/助言 **28 / 28 PASS**。
- 独立レビューでは各段階9回で予測点/白い着地点と共通モデル一致、投擲3回で確定結果とも一致。無料終了後の有料3投で、有料時だけ3,000円/体力10/記録1回を処理し、無料案内中はstaminaGuardを呼ばないことを確認。
- 台詞は正規のマキの設定/既存立ち絵を使用。専用UIの台詞を自然な短い行に分け、`lint_dialogue.py axe_tutorial` **ERROR 0 / WARN 0**。章のVNへ自動登録しない。

再現:

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=/tmp/axe-lesson COMPARISON_DIR=/tmp/axe-lesson-screens node remake/test/browser/axe_lesson.mjs
```


有料プレイ後の再来店では、無料ボタン追加により戻るボタンが下へはみ出す失敗を検出した。店専用CSSで有料2カードを横並びにし、見出し/記録欄/余白を整理して修正。既存PCの3投→記録保存→再来店、およびタッチの10投→記録保存→再来店を再実行してPASS。既存店員・営業時間のPC/タッチ2件もPASS。assertの範囲は緩めていない。両モードの長い記録がある表示もPC/横/縦で計測し、店員・無料ボタン・記録・戻る操作の全てが画面内に収まることを確認した。

現在の画面: [青の説明](lesson/phone-killshot-guide.png)、[選択時の条件](lesson/phone-killshot-choice.png)、[今の照準6点](lesson/phone-live-preview-six.png)。計測表の約50%拡大は初回2848eab6時点の値で、追加した得点HUDの画面寸法を示す値ではない。
