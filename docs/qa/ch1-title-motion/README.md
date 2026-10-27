# 第1章・採用01の順次フェード（Issue #608）

第1章の自然な入口だけを専用 `remake/js/chapters/ch1-title-motion.js` へ接続する。本人が短縮01を承認（2026-10-16 07:47 UTC「進めていいよ」）。公開・マージは別段階で、本PRはDraft保存まで。

## 演出と保存契約

- 4.8秒。人物は60ms後から300ms間隔・640msフェード。章題は2420〜3100ms、完成絵を3100〜4800msの1.7秒保持。
- `remake/img/ui/chapters/ch1-title.webp` の既存6人・顔・衣装・章題を同じ領域で表示。完成絵は原WebP全画素一致。画像追加・修正なし。
- 既存の正規 `SE.jingle()` を画像準備後に1回鳴らす。音源を途中停止しない。
- 通常送りのクリック/タップ/Enter/Space/Controlは従来の章題と同じく吸収。Control keyupを実VNのSKIP解除へ通す。AUTO/SKIPは実VNとの前後連続再生で確認する。
- 動き軽減は完成絵の静止1.7秒。画像失敗・15秒上限は同じ採用章題の文字へfallbackし、遅着画像へ切り替えない。
- LOADのstate交換・AbortSignal・再呼出・host破棄・pagehideで自分のRAF/タイマー/イベントだけを解除。キャンセルされた古いch1入口は日常へ進まず、introDoneも書かない。既存の `_ch1_opening` 保存順・既読判定は維持。
- `core/ui.js` / `vn/engine.js` / `craft/session.js` / 共通CSS・loader・他章・原画は変更しない。#609と変更ファイルを分離した。

## 検証

専用 `node remake/test/browser/ch1_title_motion.mjs`: **12/12 PASS**（既存Playwright 1.58.2 / Chromium145.0.7632.6）。PC1440×900・横844×390の実描画、全画素一致、入力ガード撤去、実VN AUTO/SKIP/Control解除、動き軽減、画像遅延/失敗/15秒上限/遅着、abort/再呼出/host破棄、実ch1でのLOAD→再開→既読省略を確認。

既存 `chapter_titles.mjs`: **18/18 PASS**。第2/4/5章・第3章保留・実入口・通常/AUTO/SKIP/LOAD・fallback・previewを含む。`ch1_opening_resume.mjs` の `new-game-first-scene-save-replays-opening`: **1/1 PASS**。

専用moduleの実測はPC4.813秒／横4.816秒（画像準備を含む呼出から完了まで、描画自体は4.8秒）。PC・横の完成絵と途中フレームを目視し、全体収まり・原画保持を確認した。小さい機械検証要約は [results.json](results.json)。JS構文・diff check・Git Safety PASS。AI文書checkerはsparseで変更対象外の既存3文書が不在のためローカル未完了とし、リンク先画像の大量hydrateで埋めず通常checkoutのCIに委ねる。既存quota補助のSyntaxErrorは依頼外のため未修正。

ブランチは最新main `30de5e928b1c03863a4658d90b709c6169886d01` から開始。素材変更0、新規code/test/docsだけのpackをオフラインで確認して通常push。全履歴・素材・依存の再取得は行っていない。

### ローカル焦点fixtureと確認の限界

既存canonicalのJSを改変せず127.0.0.1で配信。未hydrateの配信WebPには同じcanonical PNGを読み取り専用で返す。章題1/2/4/5は既存の正式WebPそのものを使った。不足している実データJSON5件（111,783 bytes）のみ限定取得し、素材や依存をdownloadしていない。

周辺UIのフォントはsystem fallback。今回表示しないslot/gaugeの先読み5点だけ既存gauge.pngで代用して起動した。この5点・周辺UIフォント・他のゲーム全画面の画質をQA済みとしない。最初の起動スモークはこの不足5点で404となり、上記fixtureを明示した後に専用検証がPASS。製品のasset/loaderは変更していない。

外部通信はCSPで遮断。画像/動画をPRへuploadせず、小さいテスト・QA記録だけ保存する。実機Safari/物理スマホ・公開版は未検証。GitHub CIは正規の全配信素材を使う既存workflowでこの専用テストも実行する。
