# 章タイトルのフェード — Issue #572

2026-10-15 JST。基準main: `e3aa425581afe4ed0f6ff3e195ae1577752d63ec`。
実装・検証対象runtime: `c33264b92946899c910c30199e77ea461ecb0aa7`。
テスト追加とこの記録は後続commitに保存し、runtimeの2ファイルは同じ内容を維持する。
テスト実行時のsuiteとruntimeのSHA256は [verification.json](verification.json) に記録。

## 変更と再現

`chapterTitle()` はDOM追加後の単一requestAnimationFrameで `.show` を付けていた。
初期opacity=0が描画スタイルとして確定する前にopacity=1となり、画像が突然現れることを未変更mainで再現した。
計測側がshow前のcomputed styleを読むと旧実装でもフェードが始まるため、フレーム採取はshow後だけ行う。

- 修正前の初回描画: opacity=1。フェードインの中間フレームなし。
- 修正後: 透明な初期スタイルをlayoutで確定し、既存の0.9秒opacity transitionで表示。完全表示の読取時間は約2.3秒を維持。
- 退場は実際のopacity animation完了を待ち、1.1秒の上限を置く。動き軽減ではCSSのtransition無効を尊重する。
- 画像待ちから退場完了まで透明な入力ガードを置き、クリック・タップ・Enter/Space/Controlのkeydownを吸収する。Controlのkeyupは既存SKIP解除へ通す。
- finallyでガードとキーリスナーを撤去。失敗/15秒の画像待ち上限では従来の文字表示を続け、遅着した画像へ途中で入れ替えない。

採用済み1/2/4/5章の画像・表示順・第3章保留・物語・呼出し箇所・セーブ形式は変更していない。
第4・5章は既存の表示確認用で、本編の後半章接続を今回追加したものではない。

## 変更前後

同じtonari昼背景に、本編と同じ第1章カードを呼び出して比較。画像の初回showから約140ms後に撮影を開始するため、PNGには撮影処理分の時差がある。厳密なopacityはJSONの各フレームを参照する。

| 状態 | 変更前 | 変更後 |
| --- | --- | --- |
| 入場 | [突然全表示](before-entry.png) | [背景からフェード](after-entry.png) |
| 完全表示 | 上の画像と同じ採用画像 | [保持](after-hold.png) |
| 退場 | [動画](before.webm) | [フェード中](after-exit.png) |
| 復帰 | 動画の末尾 | [背景へ復帰](after-returned.png) |
| 描画記録 | [フレームJSON](before-frames.json) | [フレームJSON](after-frames.json) |
| 動画 | [変更前](before.webm) | [変更後](after.webm) |

実入口と表示範囲: [NEW GAMEから第1章](new-game-chapter-1.png)、[クリア画面から第2章](clear-to-chapter-2.png)、[844×390タッチ](touch-chapter-1.png)、[390×844縦DS・動き軽減](portrait-ds-chapter-1.png)。
上の比較背景は演出単体のfixture。実第1章は従来のコールドオープン後の暗い背景から入り、tonariへ続く。
PNGは原画の再生成ではなく実ブラウザのスクリーンショット。

## 検証

Chromiumの新規contextで実施し、ブラウザ例外・不意の失敗リクエストも検査した。PC1280×720、タッチ844×390/640×360、縦DS390×844を含む。

- `chapter_titles.mjs`: **18/18 PASS**。[全結果](results.json)。既存9ケースを保持し、通常/AUTO/SKIPのPC・小画面タッチ6ケース、実LOAD2ケース、画像待ちタイムアウト1ケースを追加。
- 通常/AUTO/SKIP: 実VNの前会話→章タイトル→次会話。turboを使わず、AUTO/SKIPは実ボタンで操作。読込中・表示中・退場中にポインタとEnter/Spaceを入力しても前画面操作や次会話へ抜けず、撤去後にポインタ/キー操作が復帰。前会話から次会話まで保存不変。
- fade: show前のstyle読取なしで、低opacity→中間値→完全表示2秒以上→中間値→opacity<0.02、単調変化、in/out両transition、カード最大1枚、最後のガード撤去をassert。PC/タッチ各モード・LOADの8件の `*-fade.json` が実フレーム記録。
- LOAD: 第2章の実入口で表示途中にページ再読込。schema14の手動枠を実LOADし、未読の章タイトルを1枚だけ再生して地図へ到達。所持金・機材・装備・能力・在庫・好感度・旧フラグと手動枠の元JSONを保持。読了済みオートセーブをもう一度LOADすると章タイトルを再表示しない。
- 画像遅延・破損・15秒超過・遅着、文字フォールバック、第3章未登録、プレビュー保存不変、画像内タイトルとDOM文字の二重表示なし、全4画像containを確認。
- `save_load.mjs`: **6/6 PASS**。[結果](save-load-results.json)。全スロット、schema5移行、不正JSON、PC/タッチUI、縦回転。
- `ch1_opening_resume.mjs` の `new-game-first-scene-save-replays-opening`: **1/1 PASS**。[結果](opening-resume-results.json)。実保存を再読込し、冒頭・第1章タイトルを経て接客終了後の日常へ到達。
- JS構文、`check_agent_docs.py`、`git diff --check`、Git Safety: PASS。

コマンド（repoルートでpreview server起動後）:

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/chapter_titles.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/save_load.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium CASE_FILTER=new-game-first-scene-save-replays-opening node remake/test/browser/ch1_opening_resume.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=/tmp/chapter-fade-compare node docs/qa/chapter-title-fade/capture.mjs
```

比較captureは基準mainのui.js/base.cssだけをネットワーク応答として差し替える。作業ツリーを巻き戻さず、同じserverと採用画像で比較する。
`RECORD_VIDEO=1` を指定するとPlaywrightの動画も保存する（ffmpegの準備が必要）。この環境では既存の `/usr/bin/ffmpeg` を使って保存した。
Playwright用ffmpegのダウンロードはドメイン制限で失敗したが、画像・フレーム計測・既存ffmpegによる録画は成功した。

実機Safari・物理スマホ・公開版QA・NEW GAMEから両大会までの手動通しは未実施。
後半章の自然到達は本編未接続のため検証対象外。GitHub CIの最終headでの結果はPRを参照し、ローカル結果と混同しない。

## 担当と予約

WORKER: `codex-fade572-20261015-a059e792`

- [claim run 38719336403](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38719336403): SUCCESS、実noticeのCLAIMED_ISSUE=572とowner一致。
- [status run 38729118339](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38729118339): SUCCESS、実noticeのCLAIM_VALIDATED_ISSUE=572、owner、RUN=38719336403一致。
- 編集前の最新bot台帳も同owner/run。再claim・移管・解除は実施していない。
- 着手時Open PR8件の実変更ファイルと今回の予定パスに重複なし。未push作業は取得不能。#574とのui.js/base.css予定共有は依頼元への報告済み。
- マージ・公開は親担当のレビュー後。Draftと予約を保持する。
