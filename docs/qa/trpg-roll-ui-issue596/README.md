# Issue 596 判定卓 QA

対象: 木/真鍮の9-slice枠、青緑フェルト、外周の港地図/紙。実装は `remake/css/trpg-stage.css` のみ。台詞・人物・背景・モデル・乱数・料金・行動・保存のコード/データに変更なし。既存portrait cropを一体で拡大し、通常編はアダム、サメ編はひよりを維持。

基準SHA: `3fa40d0baee66672acdfcb8b3c2a3fcb64b0d951`。`baseline-1280.png` は変更前に本checkoutの実ブラウザから取得。他PNGは本PRのCSSを読み込んだ実Chromium画面。描画後の検証SHA・静的書出しは validation.json を参照。

`measurements.json` は通常/サメ両編の1280×720、800×600、390×844、844×390、詳細、助力、結果の実ビューポート寸法。操作領域は44px相当以上（浮動小数の丸め許容0.1px）。修正後は全画面比率で判定中だけステージクリップを外し、縦持ちでは回転案内も外す。縦持ちQAは横持ちで卓を開始して判定中に端末を回転した操作を再現。探索画面の縦持ち回転案内は既存通り。

検証: モデル/確率/キャンペーン30件、保存自動/手動移行と異常値43fixture、会話lint、既存browser trpg/experience/main、専用tabletop。Tab/ShiftTab/Enter/Space、Escapeの可否とフォーカス復帰、読み上げstatus、長押し/二重入力、reduced-motion、両編結末/保存分離は既存回帰を維持。専用テストは実操作で助力のON/OFF/使用/連携札枯渇、振り直し可否、3段階結果、継続、装飾3画像のdecode、画像欠落fallbackを確認。装飾はCSS pseudo/backgroundでアクセシビリティツリーや入力に参加しない。

目視: 枠の四隅、透明縁、紙が操作を覆わないこと、正規の肖像/サメ編背景、通常/縦持ち/横持ちの読みやすさを確認。紙は狭い画面で非表示。フェルトが失敗しても暗色背景と1px境界、明色テキスト、focus outlineを保持。

実機Safari・物理スマートフォン未実施。タッチはChromiumエミュレーション。利用枠補助は既存のliteral-backslash-n構文エラーのため不明（修正対象外）。

親レビュー修正: 初回7e4f21cの矩形検査は800×600の祖先クリップを見逃した。旧直下PNGとmeasurementsは初回履歴であり、現在の視認性の根拠には使わない。修正版の全58状態・枠/見出し/操作の祖先クリップと四隅内側6pxのhit-testは `review-fix/` を参照。本文の操作はスクロールして完全表示を確認。両編4サイズの助力付き詳細・実ロール/振り直し/続行を実行。固定ソース2b73b090b4cf145d455e3f0ff293d18f897a98ebの独立静的配信でも同じsuiteがPASS。3種の原PNG/配信用WebPは変更なし。旧overflowを再適用した負対照で祖先clipを検出した。

CIリサイズ修正: `ci-resize-fix/` にLinux失敗ログ、同一矩形を再現した5点の実DOM対象、遅延resizeの負・正対照、恒久遮蔽対照、同期修正後の58状態を記録。runtime変更なし。`setViewportSize` 後、preview.fitのscale・viewport・rotate状態が一致してから元の全境界/5点assertを行う。
