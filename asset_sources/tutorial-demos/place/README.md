# 炭の配置（PLACE）のお手本 — #1357

採用main `69cfc2577cf960818d9cb452b94e706f6c531e14` の本編レンダラーを1280×720で撮影。新UIや旧パイロットの流用ではない。原録画は `raw.mp4`、実行用は `remake/media/demo-place.mp4`。字幕と矢印の正本は `remake/js/craft/demo.js` の `STEP_DEMOS.place`。

現行mainの初回LESSONは `applyCoalTraining` で三角3個を自動確定し、PLACEの操作自体を省略する。この動画は炭の授業後の通常REHEARSALで、所持中のフラット炭を使う配置画面。メモリ上の正規セッションに、既存previewと同じ12gの配合・normalパッキングと炭授業済みflagだけを準備した。`craftTest.auto` は使わず、`opt-triangle` ボタンへ実クリックを1回送り、正規の次工程 `runHeat` を表示する。採点操作や資源の獲得は行わない。

実測: 8.983秒でボタンをクリック、9.356秒で炭焼きパネルを表示。字幕は0／3／9.36秒で切替。MP4は16.033333秒、1280×720・30fps・H.264・音声なし、298,909 bytes。炭の焼き上がりや完成得点は示さない。実行用・原録画のsha256と生成条件は `capture.json`。

再撮影はrepo rootでプレビューサーバーを起動し、`BASE_URL=http://127.0.0.1:8123/remake/ CAPTURE_DIR=/tmp/place-demo-capture CHROME_EXECUTABLE_PATH=/usr/bin/chromium node asset_sources/tutorial-demos/place/record.mjs`。Playwright・ffmpegを使用。記録スクリプトはスクリーンキャストの実時刻を維持し、画面内容や結果を差し替えない。

本スライスは動画と独立登録まで。初回自動表示はPLACEから呼ばれておらず、`steps.js`／`session.js` が盤PR #2166と重なるため変更していない。さらに初回LESSONで配置操作を新設する仕様変更も行っていない。既存の汎用手動リンクは生成されるが、横画面では既存CSSの `bench-hint` 非表示で利用できない。自動接続の対象・呼出位置と、通常画面の手動入口は後続で扱う。検証は非表示リンクを強制クリックせず、実際の既存プレイヤーを直接開く独立試験として区別する。

検証の区別: `tutorial_step_help` は汎用の初回既読helperを直接呼ぶ検査（17件成功）で、PLACE本編への自動接続成功とは扱わない。横画面の独立プレイヤー検査は、実MP4の読込、実再生による字幕・矢印切替、停止中の制作時計停止、とばす／正常終了／再表示とLOAD後の無報酬を確認した。ローカルPythonサーバーはHTTP Range未対応のため、途中位置はシークで捏造せず実再生で進めて確認する。既存シートには画面離脱を監視する仕組みがなく、独立試験は離脱後に明示的に後始末する。自動的な離脱時停止は未対応として残す。
