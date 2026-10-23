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

## 枠線の段差修正・名前なし枠 (#880 / PR #881)

操作バーを本文の原画から消す矩形マスクが、本文上辺の金線を削っていた。マスクを分離し、元画像の水平罫を再利用してつなぎ、操作バー下隅の外に残っていた本文の罫線もクリップした。原画PNG・埋め込みWebPのbytesは維持。

ユーザーの追加指定で、ナレーションと主人公の心の声に平らな名前なし枠 `narration.svg` を追加。元画像の下辺・隅飾りを反転し、紫の面を元の本文へなじませた。既存 `.narration` / `.thought` にCSSで適用する。通常の発話で名前付きの枠に戻り、本文の領域と行送りは変わらない。ひよりの発話と併記される本心は名前付きの枠を維持する。

2026-10-23 Chromiumでの検証:

- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=/tmp/vn-fixed node remake/test/browser/conversation_ui.mjs` — PC1280×768／横持ち844×438の2ケースPASS。従来の操作・保存不変の確認に加え、地の文→心の声→発話で枠を切り替え、名前の非表示と本文寸法不変を確認。
- 同じ本編エンジンのプレビューで、通常PC1280×768／横持ち844×438／DS横1280×768／DS縦390×844の4表示を確認。操作バーが画面内に収まり、名前なし枠から発話へ戻ることを確認。
- `remake/index.html` のニューゲーム冒頭でも名前なし枠を確認。
- `git diff --check`、Git Safety — PASS。実機Safari・全章通しは未実施。

表示記録: [名前付き](frame-880/named.png)、[ナレーション](frame-880/narration.png)、[DS縦の心の声](frame-880/thought-ds.png)。

#832 / PR #845のengine・表示名helperには変更なし。そのPRとの統合時も、今回の最新ユーザー指定「ナレーション・心の声は名前なし」を優先する。公開反映までユーザー依頼済み。CI・mainへのマージ・Pagesの結果はPR #881に記録する。

WORKER: codex-vn-frame-880-20261023-b629

CLAIM: https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39936962066

### 採用前の切替比較（ユーザーの最新指定）

「心の声などは『はじめ』表示という既存案に、名前なし枠が入るとどう見えるかをチェックしてから検討したい」という追加指定で、名前なし枠の採用・本編公開は保留。PR #881もDraftで保存する。

[左右比較の動画](frame-880/comparison.mp4)（左A／右B）、[Aの原寸動画](frame-880/named.mp4)、[Bの原寸動画](frame-880/nameless.mp4)。約14秒、同じ4行を同じ速度で送る。ゲーム本体へは未反映。

1. 発話「少し、落ち着いてきた。」
2. 心の声「（今日は、ここで一息つこう）」
3. 地の文「暖かな灯りの下、静かに煙がほどけていく。」
4. 発話「もう少し、ここにいよう。」

Aは『はじめ』の名前と名前欄を維持する表示案を、プレビュー限定のCSSで再現する。Bは今回の名前なし枠を使う。会話本文は比較用の例文で台本への変更はない。本編と同じエンジン・CSS・同梱フォントでブラウザ描画を記録し、FFmpegで動画化・左右配置した。本文の位置と枠の下辺は変わらず、Bでは左上の出っ張りが行の切替時に消え、発話に戻ると再び現れる。

CI（runtime変更HEAD b52e3f33285453e5d3ce98030da3266e8abe8ace）には未解決の失敗がある。game_layoutの4ケースはmix-ok待機でタイムアウト（job120363527817）、first_brewのholes-and-steam-helpはヘルプを閉じた後の動作再開確認で失敗（job120363504416）。baseでの再現は未確認で、既存不具合と断定しない。会話の寸法に関するDSケースや本編冒頭の表示ケースは同じCIでも成功している。失敗の除外・判定緩和・マージは行わない。
