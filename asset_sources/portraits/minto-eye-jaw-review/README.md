# みんと通常：両目の左右差を修正

ユーザーの「改善した画像も目のサイズの左右差が気になる、直して」に対応。**通常v4をローカルの素材PNG・配信用WebP・顔アイコンへ反映した。公開は未反映。** 以前のv1/v2は改善不足、v3はまぶたの開きの差が残ったため不採用。

[修正前／反映したv4の顔](normal-v4-face-compare.png)は、白・灰・暗背景で拡大150%・原寸・50%を比較。[全身比較](normal-v4-full-compare.png)、[実ゲーム・スマホ寸法](../../../docs/qa/portrait-jawline/runtime-review/minto-after-844.jpg)、[全表情の切り替え確認](../../../docs/qa/portrait-jawline/runtime-review/minto-all-expressions.png)も保存。

v4は頭を正面・直立寄りに描き直し、両目の幅・縦の開き・虹彩の見かけの大きさを揃えた。顎と首も連続した絵として再描画。黒髪・緑の瞳・角と羽・黒×ミントの衣装・ハートのチョーカー・頬に添えた手・穏やかな閉じ口の微笑みを維持した。**頭の傾きは変わり、目と頬が丸く、描線が少し滑らかな印象になる。目のサイズだけの変更ではない。** 別AIは「片眼の潰れが解消、肌の継ぎ目なし、先行1枚を反映して比較できる品質」と評価。最終版へのユーザーの見た目確認は未了。

原画の人物高1462pxを既存の938pxへ均一縮小し、896×1200へ配置。足元の横アンカーを合わせるため全体を左へ3px平行移動した。原画は無加工で保存し、顔・顎の帯マスク合成やPythonによる描き直しは使用していない。spriteScaleは不変。PNG/WebPの全RGBA一致、足元の変化は1px未満。顔アイコンも通常だけ更新し、私服アイコンは維持。

`generation.json` と各 `*-prompt.txt` に生成・状態を記録。統合検査は [integration-check.json](../../../docs/qa/portrait-jawline/integration-check.json)、実ブラウザ確認は [check-runtime.cjs](../../../docs/qa/portrait-jawline/check-runtime.cjs)。PC1280×720・スマホ844×390で通常と全10表情の切り替えを確認した。

他表情は未変更。`smile` は同型の目の左右差が残る修正候補。`sad`・`ura_smug` の半目、`wink` の閉眼は表情なので機械的に開かない。全キャラの結果は [点検一覧](../../../docs/qa/portrait-jawline/audit/README.md)。

v1〜v3、`current-vs-candidate.png`、`normal-face-comparison.png`、`background-comparison.png`、`game-current-*` / `game-candidate-*`、旧 `browser-check.json` / `check-browser.cjs` は**不採用候補の履歴**。現行v4と取り違えない。元の通常は `../jawline-cleanup/minto-normal-before.png`。GitHub接続はForbiddenで、push・PR・公開反映は未実施。
