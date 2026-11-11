# 成長（経験値・レベル・心得の盤）の資料

> このフォルダの決定は [ADDENDUM-BOARD-LAYOUT.md](ADDENDUM-BOARD-LAYOUT.md)、実装仕様は [SPEC.md](SPEC.md)（第2版）。**2026-11-02 から通常プレイで有効**（`GROWTH_BOARD=true`。オーナー「観音やモスクで割り振れるように実装して」SBD97）。開発・検査で旧しくみを見る時だけ `?growth=0`。下は 2026-11-02 に `remake/README.md` から移した実装メモ。

## 2026-11-11 レベルアップはその場で（SBD108〜123）

- 経験値が入ったその場でレベルが上がり、火種は手持ちに入る（`core/growth.js` の `applyLevels`）。その場で画面の上に短い札が出る（`daily/levelup.js`。操作は止めない）。寝る前・観音堂でまとめて見せる画面は無い（SBD122）。火種を盤に灯すのは観音堂などの内省（`daily/reflection.js`）。
- 盤・レベルアップの画面は絵と数が中心で、説明は「？」の絵つきの見方（`daily/growth-board-help.js`）とチュートリアルにある（SBD116〜119）。
- 火種4種・レベルアップの札の板と光・盤の札・マスの印の台・丸いボタンなどは Codex の絵（[依頼文と使い所](../../asset_sources/ui/growth-board-20261111/README.md)・SBD121・SBD123）。火種は A案で組み込み済み（B案へは `convert.py --fire b`）。絵が読めない時は CSS の形のまま動く。
- 節目・♥5は色の火1＋白火1、大会の優勝で白火3つ、近くの帯×2、K20 は＋4%。仕様は SPEC 1.5・1.7・3.7・6.3。
- 確認: `node remake/test/growth_levelup.mjs`、`node --experimental-vm-modules remake/test/kannon_growth.mjs`、`node remake/test/browser/growth_fx.mjs`。

## 2026-11-11 バランス調査と演出の強化（SBD101〜107）

- 調査の結果と判断待ちは [BALANCE-REVIEW-20261111.md](BALANCE-REVIEW-20261111.md)。
- レベルアップ・盤の演出の部品は `remake/js/daily/growth-fx.js`（火種の粒・火の粉・光の輪・道を走る光・飛ぶ火種・決定のカットイン）。規則・保存には触れず、動きを減らす設定では何も出さない。見せ方は SPEC 6.2・6.3。
- 確認: `node --experimental-vm-modules remake/test/growth_board_screen.mjs`、`node remake/test/browser/growth_fx.mjs`（プレビューサーバーが必要）。

## 2026-10-30 経験値・レベル・火種（心得の盤 第二弾の芯・未公開）

- （2026-11-02 更新）`core/growth-mode.js` の `GROWTH_BOARD` は `true`。旧しくみ（能力の直接成長）に戻すのは URL の `?growth=0` か `__remake.dev.growth(false)` で、その端末だけ（印 `suien_growth_preview=0`）。`?growth=1` で既定に戻す。以下の 10-30 の記述の「未公開」は当時のもの。`__remake.dev.addExp(400)` で経験値を足せる。
- 有効時: 体力を使った自由行動で経験値（30×新鮮さ、はじめての相手・場所＋40、行動中の好感度の段＋30、章倍率）。チップは1行動1枚。HUD の情報カードに Lv と次のレベルまでのゲージ（濃い金＝精算済み、薄い金＝今日の分、満タンで「今夜 Lv UP」）。寝る直前（夜明けの幕の前）に精算し、初回・節目・2つ以上上がった夜はフル演出、それ以外は短い帯。火種は1レベル1つ、節目は2つ目が系統限定。未使用の火種は五角形ボタンに琥珀色の個数で出す。
- 仕様の正本は `docs/stat-design/SPEC.md`（案A、ブランチ `muse/stat-design-docs-1030`）とレベルアップ使用感評価 `docs/stat-design/levelup-ux/REPORT.md`（ブランチ `claude/levelup-ux-evaluation-fo4d7g`）の推奨 R1・R4〜R7。盤の画面・セーブ schema 23 への移行・スロットの追い風・X5以降の経験値源は後続。
- 心得の盤の画面（試作・画像なし）: MENU の「心得の盤」、フルのレベルアップの「心得の盤を開く」、`__remake.dev.board()` で開く（`__remake.dev.addHidane(5)` で火種を足せる）。盤の形と規則は `core/growth-board.js`（能力45＋スキル14＝火種86、輪は章で開く、払いは限定の火種が先）、画面は `daily/growth-board-screen.js`。輪・扇・線は SVG、ノードは HTML ボタン。仮置き→決定で確定し、STEP UP／SKILL のカードを出す。**試作の間は盤の解放を能力（state.stats）に書き戻さず、スキルの効果も未実装**。組み直し・チュートリアル・スマホでの拡大は後続。
- 検証: `node remake/test/growth_levelup.mjs`、`node remake/test/growth_board.mjs`、`node remake/test/browser/growth_levelup.mjs`。

## 2026-11-02 恩恵の単位の補正と「灯した結果」の表示（#2166 の続き）

- 1マスの恩恵の単位を SPEC 3.2〜3.4 の上限（ジャスト帯 ×1.35・ゲージ ×1.30・最大体力 ＋60）に合わせて直した（SPEC 3.7「単位の補正」）。第1章の大会での勝率は `node remake/tools/balance/measure.mjs --board` で測る（基準74.2%: 感覚盤に寄せると＋2.5pt、理論盤＋1.6pt、才能盤は日常の体力で得をし大会は第2章以降の「華」から）。
- 盤の右のパネルに「恩恵の合計：いま → 灯すと」、決定後のカードに増えた恩恵（「最大体力 ＋8・寝た時の回復 ＋4%」）、HUDの経験値の行に「◎目標まで 火種N」。検査は `remake/test/browser/growth_levelup.mjs` の perk-totals-and-target。
- 注意: `tools/ci/run.mjs` は実行中に変わった追跡ファイルを実行後に元へ戻す。検査の実行中にファイルを編集しない。

## 心得の盤の音

- 盤の閲覧・内省・組み直し中は、専用の静かな合成BGM（`bgm_growth_board`）を流す。柔らかな和音と疎らな高音のオリジナルループで、追加の音源取得はない。
- 仮置きが増えた時に短い火種の音、実際にマスを確定した時に上昇する和音を鳴らす。取り消し・目標設定などの操作音は従来のまま。閲覧だけで習得音は鳴らさない。
- 閉じると直前の曲へ戻す。LOAD・成長モード解除では古い曲を復活させず、別の場面がすでに選んだ曲も上書きしない。BGM/SEの音量とミュートは共通設定に従う。
- 確認: `node --experimental-vm-modules remake/test/growth_board_audio.mjs`、`node --experimental-vm-modules remake/test/growth_board_screen.mjs`。
