# 第1章の章末と次回予告

Issue #384・#519。第1章で勝利とライバルの「もう一口」を受け取ったあと、はじめが採点表を気にし始める短い余韻から、第二章「才能の壁（ホロウ・クラウン）」の断片へつなぐ。

## 演出と正本

`data/chapter_previews/ch2.json` が基礎台本と採用案の正本。オーナーの「Cを採用」に従い、`presentation: quiet` を正式な初回・再視聴に使う。採用Cは全12カット47.5秒。カットの間とみんとの再登場は `remake/js/chapters/chapter-preview-samples.js` で組み立てる。オーナーの「みんとが出る既存90年代風サンプルをベースに」に従い、Issue #415のセル画版v2の6場面・台詞・読みの間を採用した。スミの沈黙、なるとのすれ違い、みんとの気遣い、つむぎの水、大会前夜のあげはの約束、ひとりの控え室をつなぎ、「誰のために、煙を作る。」で締める。

採用Cは16:9の横長画面に元絵全体を収め、絵の下へ細い字幕を置く。章タイトルは既存サンプルと同じDotGothic16を使い、静かな倍音とベル、控えめなフェードで余韻を残す。章タイトルのあとにみんとの「何があっても、わたしはここにいるから。」をもう一度置き、最後の問いへつなぐ。音声ナレーションは付けず、サンプルの読みの間を確保する。既存6場面の断片までを扱い、大会の順位・採点の説明、未知の送信者の正体は追加しない。

2026-10-24（#929）で第2章の筋の変更に合わせて文言を改めた。なるはDAY11の「……今の話、点になるのか？」、入口の影は大会前夜のあげはの「じゃ、明日は同じ舞台でね。」（あげはは大会後も去らない）、控え室ははじめの「……おめでとうが、届いてるのに。」（祝福は届くが受け取れない）。絵・カット数・時間は変更なし。新しい場面（C.STATIONの試煙会、神崎の手元、REIのイヤホンなど）は絵ができてから差し替えを検討する。

Issue #519で、つむぎの水の場面をヨーコ／初期OVAのような可愛さを意識した一枚へ、アゲハの場面を夜の入口の後ろ姿と長い影へ更新した（#929以降は大会前夜の約束の場面として使う。素材のファイル名は `05-ageha-departure` のまま）。入口の場面は元のタイトル絵と異なる低い斜めの構図で、顔を隠し、話者名も表示しない。髪飾りの小さな色を、2章の人物登場時に「あ、この子か」と気付く手がかりにする。章頭の巨大な人物画は予告に使わず、台詞とCの間を保つ。

実装素材は `assets/cgs/ch2_preview/` に6枚、1664×936のWebPで合計1,018,040バイト（約0.97MiB）。既存4枚は `asset_sources/trailer-90s-anime-concept/images/` のPNGを原寸で形式変換。#519の2枚は `asset_sources/retro-ova-study-519/images/` のPNGから構図全体を縮小して1664×936へ収め、右に1pxの黒余白を置いた。クロップ・色補正は行わず、PNG原画も保持する。採用元と実装素材のハッシュ・変換条件は `asset_sources/ch2-preview/adoption.json`。生成指示と目視QAは各素材元にある。DotGothic16は約2MiBで、サンプルと同じSIL OFLフォント。素材と書体は章末/再視聴時に読み、タイトル起動時には追加通信しない。

曲は `remake/js/chapters/preview-score.js` のオリジナルWebAudioスコア。既存のBGM音量/消音を尊重し、予告内の音ボタンは一時的な消音のみ。SEの音量を0にしても曲中の打楽器は音楽として残る。外部曲・音声は追加しない。

## 進行と保存

- `ch1.js` の大会後の会話・休養で見送った夜イベントを終えてから、`phase=cleared` を保存し `showClear()` へ進む。
- クリア画面の上へ `playChapterPreview()` を重ねる。完走/明示的スキップのみ `_ch1_preview_seen` を保存する。古いクリアセーブにも初回の予告を出す。
- 再視聴と単体APIは報酬・章・日付・好感度・LIME・本編の既読・手動保存枠を変更しない。中断・画面の撤去は予告を既読にしない。
- 予告終了後は通常16:9のクリア画面へ戻る。成長のレーダーを維持し、「次回予告をもう一度」「タイトルへ」を表示。未実装の第2章へ遷移するボタンは出さない。

一時停止・音・スキップはロード中も表示する。画像の読み込み/デコードに失敗した場合は再読込かスキップを選べる。準備前にタイムラインは進めない。タブが隠れた間は映像と曲を止め、ユーザーの一時停止はタブ復帰後にも保持する。Enterの連打ではスキップしない。Escでスキップ、Spaceで一時停止/再開、Tabで操作へ移動。動きを減らす設定ではパン・ズームを省く。

## 確認

`python3 remake/tools/serve_preview.py --port 8123` を起動し、`http://127.0.0.1:8123/remake/chapter-preview.html` の再生ボタンを押す。本編の保存は変更しない。本編の到達から確認する場合は新規第1章の大会優勝、またはクリア済みセーブから再開する。

`node remake/test/browser/ch1_preview.mjs` の9ケースで、採用Cの自然完走の全12カット、タイトル後のみんとの言葉、採用6枚/16:9構図の保持/字幕の書体、初回と再視聴、旧セーブ、16:9復帰、PC/タッチ横画面、動き軽減、字幕と操作の収まり、非表示の停止、読み込み失敗と遅延、中断の後片付け、単体ページの保存不変を検証する。CIは `.github/workflows/ch1-preview.yml`。

最新の#519の画像を反映した[音付きゲーム録画・約53秒](../asset_sources/retro-ova-study-519/gameplay/chapter-preview.mp4)と[録画QA](../asset_sources/retro-ova-study-519/gameplay/capture.json)は本編と同じ予告APIを確認ページで自然完走したもの。初回・再視聴・保存・PC/タッチ・読込失敗などの9ケースと、比較ページの4ケースは成功。入口の影のタッチ画面でも話者名なしと保存不変を確認した。[画像と採用の記録](../asset_sources/retro-ova-study-519/README.md)。以前の録画とQAは `docs/qa/ch1-preview/` に履歴として保持する。`samples/c-quiet.mp4` は#519の更新前のC。ゲーム本編の通し検証は `node remake/test/playthrough.mjs`。

## 3案の比較サンプル

オーナーの「何パターンかサンプルを録画やスクショで見たい」に対応した比較ページは `/remake/chapter-preview-samples.html`。`?sample=tv` / `rush` / `quiet` で直接各案を開ける。

| 案 | 時間 | 見せ方と引き |
| --- | --- | --- |
| A 王道のテレビ予告 | 47.8秒 | 4:3のTV枠・ドット字幕・曲。6場面を順に見せ、「誰のために、煙を作る。」で締める。 |
| B 短く畳みかける予告 | 29.2秒 | 字幕を大きく2行へ整え、速い曲で畳みかける。ひとりの控え室から音を引き、問いを残す。 |
| C 言葉を残す静かな予告（正式採用） | 47.5秒 | 横長の画面・細い字幕・静かな倍音とベル。タイトルのあとに既存のみんとの言葉を再び置いてから、最後の問いへ。 |

比較案は `remake/js/chapters/chapter-preview-samples.js` が既存台本を複製して組み立てる。Bの改行以外の台詞は元と同じ。Cの再登場は同じ絵と台詞の編集上の反復で、新しい出来事を追加しない。全案で#519の更新を含む同じ採用6枚を使い、比較再生はセーブ・既読・音量設定を変更しない。採用CのCSSは本編と比較ページで共有し、Bと比較ページ自体のCSSだけを比較ページで読む。

PC/スマホ横画面の表示、一時停止、再開、スキップ、保存不変は `node remake/test/browser/chapter_preview_samples.mjs`。録画で全カットの自然完走、元絵のデコード、字幕と操作の収まり、保存不変、ブラウザエラーを確認する。成果物は `docs/qa/ch1-preview/samples/`。

録画の再作成にはPlaywright・Chromium・ffmpegが必要。サーバー起動後に例として:

```bash
PREVIEW_URL='http://127.0.0.1:8123/remake/chapter-preview-samples.html?sample=rush' \
CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
OUTPUT_VIDEO='.codex/artifacts/chapter-preview-recording/b-rush.mp4' \
CAPTURE_DIR='.codex/artifacts/chapter-preview-recording/b-rush' \
node remake/tools/record_chapter_preview.mjs
```

録画は実ブラウザの描画時刻を保持した30fpsのH.264/AAC。独立した録画用ブラウザだけに音声ミックスを追加し、ゲームコードには録画処理を入れない。導入画面と再生後の画面があるため、ファイルの長さは予告本体より約5秒長い。

## 第2章以降への展開（#1558）

共通プレイヤー `remake/js/chapters/chapter-preview.js` の登録表 `PREVIEWS` に、予告1（第2章末→第3章『嘘つきたちの夜』）・予告2（第3章末→第4章『継承の煙』）・予告3（第4章末→第5章『機械仕掛けの神』）を追加した。台本は `data/chapter_previews/ch3.json` / `ch4.json` / `ch5.json`（全12カット・47.5秒）、素材は `assets/cgs/ch3_preview/` / `ch4_preview/` / `ch5_preview/` に各6枚（1664×936 WebP、章合計1.0MiB以内。原画と採用記録は `asset_sources/ch3-preview/` 等）。曲は第1章の固定作曲を使わず、各カットの `cue` で進む共通スコア（`preview-cue.js`）に章ごとの調の移し替え（arrangement）を付けた。話者名は新規分では表示しない（台本に speaker を持たない）。

接続は第1章と同じ挙動で、各章の完了カードから行う: 第2章は `ch2-tournament.js` の完了カード、第3章は `ch3-aftermath.js` の完了カード、第4章は `ch4.js` の完了カード。未視聴なら自動再生し、再生中は「第N章へ進む」を押せない。完走/明示スキップのときだけ既読（`_ch2_preview_seen` / `_ch3_preview_seen` / `_ch4_preview_seen`）を保存し、再視聴ボタン「次回予告をもう一度」を置く。第5章の終わりには予告を置かない（スタッフロールで完結）。

確認ページは `remake/chapter-preview.html?ch=ch3` のように `?ch=` で切り替える（既定は ch2）。検証は台本・登録・素材の実在を `node remake/test/chapter_preview_scripts.mjs`、登録表の全予告の再生・操作・保存不変と第2章完了カードの統合を `node remake/test/browser/chapter_preview.mjs` が担う。
