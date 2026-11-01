# 次回予告の3案・実ブラウザ録画

Issue #384 / PR #490。2026-10-13に既存セル画版v2の6場面を使い、比較ページから各案を自然完走させた。この比較録画を見たオーナーの「Cを採用」に従い、Cを通常ゲームの初回・再視聴へ正式採用した。元絵は変更しない。

| 案 | 録画 | ファイル時間 | 予告本体 | 音声ピーク |
| --- | --- | --- | --- | --- |
| A 王道TV | [a-tv.mp4](a-tv.mp4) | 53.38秒 | 47.8秒 | −8.6 dBFS |
| B 短い予告 | [b-rush.mp4](b-rush.mp4) | 34.72秒 | 29.2秒 | −9.4 dBFS |
| C 静かな予告 | [c-quiet.mp4](c-quiet.mp4) | 53.16秒 | 47.5秒 | −23.2 dBFS |

すべて1280×720・30fps H.264 / 48kHzステレオAAC。最初の比較ページと再生後の画面を含む。Cはベルと低い倍音を控えめに置き、最後の問いで無音にする。

[比較スクショ](comparison.png)は同じみんとの場面と章タイトルを実際の動画から抜粋して並べた。`*-minto-warning.png`、`*-chapter-title.png`、`*-last-question.png`は各案の原寸フレーム。`*-ended.png`は動画の終端で、録画直後のブラウザスクショとの平均画素差が2/255未満であることを確認した。末尾の問いと比較ページへの復帰は目視確認済み。

各JSONに動画のSHA-256、元絵のデコード寸法、全カットの観測順、字幕・画像・操作の収まり、保存不変、ブラウザエラー、音量とエンコード情報を記録。3案とも6枚の元絵をデコードし、A/Bは全11カット、Cはみんとの再登場を含む全12カットを完走。レイアウト失敗とブラウザエラーは0、保存データは前後一致。

検証結果:

- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch1_preview.mjs` — 9件PASS（本編の初回・再視聴・中断・保存、画像失敗、動き軽減など）。
- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/chapter_preview_samples.mjs` — 4件PASS（B/CのPC・スマホ横画面、停止/再開、スキップ、保存不変）。
- JS構文、`git diff --check`、`python3 tools/check_agent_docs.py` — PASS。

この比較時点の結果JSONは `production-browser-results.json` / `samples-browser-results.json`。Cを本編へ採用した後の9件の結果は `../browser-results.json`。録画スクリプトと再作成コマンドは [章末と次回予告](../../../spec/chapter_previews.md)を参照。JPEGの時刻は1/1000秒単位で結合し、動画書き出し時のカットのずれを防ぐ。
