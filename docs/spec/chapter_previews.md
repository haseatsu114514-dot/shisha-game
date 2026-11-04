# 第1章の章末と次回予告

第1〜4章の完了後に、短い無言の間と「次回予告」を挟み、次章の登場人物の実台詞と映像へつなぐ。

## 演出と正本

`data/chapter_previews/ch2.json`〜`ch5.json` が予告台本の正本。本編の出典は各カットの `source`（`data/dialogue/*.json#dialogue_id`）。2026-11-04 に main f22bba186 の全予告・次章の実台詞と照合し、最新のオーナー方針「次章の実台詞で伝える、映像内字幕」に合わせた。

900msの無言の間→2400msの「次回予告」→次章の台詞と映像→章題→台詞の余韻の順。創作の後日談・キッカー・問いは削除。第3章の創作の噂カットも外し、正体を補作しない。第5章の短縮反復は夜の動画の全文に戻し、締めをはじめが挑戦に応じる実台詞に替えた。独白も本編の実在する行を使う。大会の結果・順位、人物の正体、最終的な答えは追加しない。

| 次章 | 正式採用のカット数 | 時間 | 出典 |
| --- | --- | --- | --- |
| 第2章 | 11 | 47秒 | ch2_main / ch2_isolation / ch2_tournament |
| 第3章 | 10 | 36.8秒 | ch3_prologue / ch3_main / ch3_rivals |
| 第4章 | 11 | 42.8秒 | ch4_main |
| 第5章 | 10 | 38.8秒 | ch5_main |

第2章は `createChapterSample(base, "quiet")` が章題後のみんとの同じ台詞を反復する。他章の反復は台本側で保持する。比較A/Bも同じ正本の台詞を使い、旧文言の上書きはしない。正式採用Cのスタイルは全章に適用する。

元絵は16:9の全構図を表示し、白文字と黒縁・影の字幕を映像内の下部へ直接重ねる。テロップ枠・黒帯・通常会話ウインドウ・話者名は表示しない。縮小表示でも字幕16px・操作ボタン高さ44px以上を確保する。字幕を読んでいる間は絵を暗転させない。章題はDotGothic16、字幕はSuien Gothic。音声ナレーションは付けない。

既存素材 `assets/cgs/ch2_preview/`〜`ch5_preview/`（1664×936 WebP）を再利用。第2章の採用元は `asset_sources/ch2-preview/adoption.json`。新規画像生成はしない。曲は第2章向けが `preview-score.js`、他章は `preview-cue.js` に章別arrangementを渡す。既存のBGM音量と消音を尊重する。

## 進行と保存

- `ch1.js` の大会後の会話・休養で見送った夜イベントを終えてから、`phase=cleared` を保存し `showClear()` へ進む。
- クリア画面の上へ `playChapterPreview()` を重ねる。完走/明示的スキップのみ `_ch1_preview_seen` を保存する。古いクリアセーブにも初回の予告を出す。
- 再視聴と単体APIは報酬・章・日付・好感度・LIME・本編の既読・手動保存枠を変更しない。中断・画面の撤去は予告を既読にしない。
- 予告終了後は通常16:9のクリア画面へ戻る。成長のレーダーを維持し、「次回予告をもう一度」「タイトルへ」を表示。実装済みの第2章へ進むボタンを表示する。

一時停止・音・スキップはロード中も表示する。画像の読み込み/デコードに失敗した場合は再読込かスキップを選べる。準備前にタイムラインは進めない。タブが隠れた間は映像と曲を止め、ユーザーの一時停止はタブ復帰後にも保持する。Enterの連打ではスキップしない。Escでスキップ、Spaceで一時停止/再開、Tabで操作へ移動。動きを減らす設定ではパン・ズームを省く。

## 確認・録画

`python3 remake/tools/serve_preview.py --port 8123` を起動し、`/remake/chapter-preview.html?ch=ch2`〜`ch5` から再生できる。確認ページは本編の保存を変えない。第2〜4章末は未視聴なら完了カードから再生し、再生中は次章ボタンを無効化する。完走・明示スキップだけ既読を保存する。第5章末は予告を置かず完結する。

- `node remake/test/chapter_preview_scripts.mjs`: 次章の台詞の出典・原文一致、無言の間、キッカー混入、登録・素材。
- `node remake/test/browser/chapter_preview.mjs`: 全章のPC・スマホ横/縦、見出し、映像内字幕・文字サイズ・操作ボタン、完走、保存不変、章末接続。
- `node remake/test/browser/ch1_preview.mjs`: 初回・再視聴・旧セーブ、完走、読込遅延/失敗、中断、非表示時停止、動き軽減。
- `node remake/test/browser/chapter_preview_samples.mjs`: 比較B/CのPC・タッチ、停止・スキップ・保存不変。

録画は本編と同じ共通プレイヤーをChromiumで自然完走する。Playwrightは `remake/test/browser/` の依存を使う。CDPの実描画時刻を保持した30fps H.264/AACで音楽も録る。同じフォルダの `capture.json` に全カット・字幕/操作の収まり・画像デコード・保存不変・ブラウザエラーを記録する。

```bash
PREVIEW_URL='http://127.0.0.1:8123/remake/chapter-preview.html?ch=ch3' \
CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
OUTPUT_VIDEO='/tmp/ch3-preview.mp4' CAPTURE_DIR='/tmp/ch3-capture' \
node remake/tools/record_chapter_preview.mjs
```

比較ページは `/remake/chapter-preview-samples.html?sample=tv|rush|quiet`。A/Bは過去の比較用、正式採用はC。

## 章タイトルコール（2026-11-02 に remake/README.md から移した）

## 採用済みの章タイトルコール（#385）

第1章「煙がつなぐ街」、第2章「才能の壁」は採用画像を章開始に表示する。
第4章「継承の煙」・第5章「機械仕掛けの神」も共通表示へ登録済み（章ランナーは `chapters/ch4.js`・`ch5.js`）。
第3章はオーナー決定により『嘘つきたちの夜 / SMOKE AND MIRRORS』を採用。画像差し替えは保留し、呼び出し元の文字表示を保つ。
第2章は王冠構図案C（背景の王冠輪郭）を採用し、英題をHollow Crownへ更新・接続済み（Issue #549 / PR #550）。

`/remake/chapter-titles-preview.html` で1・2・4・5章を本編と同じ表示処理で確認できる。ゲームの保存データは変更しない。
画像準備後に表示し、読み込めない場合は章名の文字表示で進む。画像内の文字へDOMの章名を重ねず、縦横比を保って全体を収める。
章の既読・進行・セーブの判定は従来の呼び出し元が行う。

原画と採用の正本は `asset_sources/chapter-title/ch2-5-style-studies-385-20261013/type-polish/adoption.json`。
`python3 tools/build_chapter_titles.py` は対象4枚だけをSHA256照合して無劣化WebPへ変換し、全画素一致を検証する。
採用記録の `runtime_integrated:false` は、採用画像4枚の本編表示が当時は部分導入だったことを示す記録。実際の導入は `js/core/chapter-title-art.js` と [検証記録](../qa/chapter-titles/README.md) を参照。

検証: `node remake/test/browser/chapter_titles.mjs`。PC・タッチ・縦DS、実際のNEW GAME/第2章入口、保存不変、画像の遅延/失敗と第3章保留を確認する。
