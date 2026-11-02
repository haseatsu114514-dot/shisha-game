# 成長（経験値・レベル・心得の盤）の資料

> このフォルダの決定は [ADDENDUM-BOARD-LAYOUT.md](ADDENDUM-BOARD-LAYOUT.md)、実装仕様は [SPEC.md](SPEC.md)（第2版）。第2版の3能力は `GROWTH_BOARD=false` の裏で未公開。下は 2026-11-02 に `remake/README.md` から移した実装メモ。

## 2026-10-30 経験値・レベル・火種（心得の盤 第二弾の芯・未公開）

- `core/growth.js` の `GROWTH_BOARD` は `false`。盤の画面ができるまでプレイヤーには見えず、能力の伸び方（旧しくみ）も変えない。開発中は URL に `?growth=1`（戻すときは `?growth=0`）を付けるか `__remake.dev.growth(true)` で、その端末だけ有効にできる。`__remake.dev.addExp(400)` で経験値を足せる。
- 有効時: 体力を使った自由行動で経験値（30×新鮮さ、はじめての相手・場所＋40、行動中の好感度の段＋30、章倍率）。チップは1行動1枚。HUD の情報カードに Lv と次のレベルまでのゲージ（濃い金＝精算済み、薄い金＝今日の分、満タンで「今夜 Lv UP」）。寝る直前（夜明けの幕の前）に精算し、初回・節目・2つ以上上がった夜はフル演出、それ以外は短い帯。火種は1レベル1つ、節目は2つ目が系統限定。未使用の火種は五角形ボタンに琥珀色の個数で出す。
- 仕様の正本は `docs/stat-design/SPEC.md`（案A、ブランチ `muse/stat-design-docs-1030`）とレベルアップ使用感評価 `docs/stat-design/levelup-ux/REPORT.md`（ブランチ `claude/levelup-ux-evaluation-fo4d7g`）の推奨 R1・R4〜R7。盤の画面・セーブ schema 23 への移行・スロットの追い風・X5以降の経験値源は後続。
- 心得の盤の画面（試作・画像なし）: MENU の「心得の盤」、フルのレベルアップの「心得の盤を開く」、`__remake.dev.board()` で開く（`__remake.dev.addHidane(5)` で火種を足せる）。盤の形と規則は `core/growth-board.js`（能力45＋スキル14＝火種86、輪は章で開く、払いは限定の火種が先）、画面は `daily/growth-board-screen.js`。輪・扇・線は SVG、ノードは HTML ボタン。仮置き→決定で確定し、STEP UP／SKILL のカードを出す。**試作の間は盤の解放を能力（state.stats）に書き戻さず、スキルの効果も未実装**。組み直し・チュートリアル・スマホでの拡大は後続。
- 検証: `node remake/test/growth_levelup.mjs`、`node remake/test/growth_board.mjs`、`node remake/test/browser/growth_levelup.mjs`。
