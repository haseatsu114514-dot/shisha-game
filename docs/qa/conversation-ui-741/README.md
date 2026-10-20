# 会話UIの本編適用と操作プレビュー (#741)

ユーザーが承認した墨紫・細い金縁・一体型の名前欄・横一体の操作バーを本編共通VNに適用。本文の998px幅、178pxの枠高、改行・改ページ処理は維持。操作バーの下辺と本文上辺は5px離す。名前は同梱のZen Old Mincho Bold（OFL）で可変表示し、長い呼び名は文字数に合わせて縮小する。その他のパネルやゲームの台本は変更しない。

`/remake/conversation-preview.html` は本編のengine.jsを読み、同じCSS/DOMで会話を再生する。保存済みデータは読み書きしない。ひよりは既存日常台本（冒頭の地の文を省略）、話者切替・地の文・選択肢はUI確認用例文。公開ゲーム本体のデプロイではなく、別URLの確認用ページ。

本編プレビュー確認後の調整: 名前の文字を合計5px下へ、操作バーを合計5px下へ移動。本文枠からの間隔を5pxへ変更。AUTOとSKIPは排他にし、相手のモードを解除してからONにする。CtrlキーによるSKIPも同様。ボタンのaria-pressedを実状態と同期。

検証（Chromium、2026-10-20）:
- `CHROME_EXECUTABLE_PATH=/usr/lib/chromium/chromium BASE_URL=http://127.0.0.1:8134/remake/ node remake/test/browser/conversation_ui.mjs` — PC1280×768／横持ち844×438でPASS。5pxの間隔、本心の枠内表示、AUTO/SKIPの双方向排他・Ctrlキーでの排他と解除・OFF切替・LOG・用語集・選択・名前切替・地の文、保存不変、JSエラー／HTTP失敗なし。
- 公開用に絞ったファイル一式でも同じ2ケースがPASS。
- `node remake/test/vn_visual_readiness.mjs` — 4ケースすべてPASS（PC／横持ちの表情読み込み待ち、CGフェードと選択停止、SKIP中の場面転換）。
- 本編index.htmlを起動して日常会話を再生。DS表示も1280×720／844×390／390×844で名前欄・操作バーが画面内に収まることを確認。
- `git diff --check`、`./tools/check_git_safety.sh` — PASS。

全章の通しプレイは未実施。Open PR #739はengine.jsの文章レイアウトを変更するため、マージ時に同ファイルの名前欄に追加した2行を保持すること。本文の行送り・計測ロジックには変更なし。

WORKER: codex-dialogue-ui-20261020-a91f
CLAIM: https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39386478328
