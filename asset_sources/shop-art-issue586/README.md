# 現在の採用範囲（2026-10-16）

ユーザー04:23:41UTC採用のHeaven10のみを個別画像として統合。現行の選択・配信・在庫表は [runtime-heaven10-adoption](runtime-heaven10-adoption/README.md)。保留8種はmain採用済み植物シート、HMD3は文字表示を維持。原画・旧候補は保存する。

以下は旧Draft初版の**履歴**。このフォルダ直下の `inventory.json` / `adoption.json` / `validation.json` と旧21点WebPは当時の記録で、現行buildの入力ではない。現在の採用やHMD承認を意味しない。

---

# ショップ商品画像 (#586)

現行の果実・植物画に合わせてフレーバー18種を紙箱パッケージに揃え、文字だけだったHMD3種を商品画像へ変更。
ボウル3種と炭2種の採用画像は継続使用。ID・価格・効果・在庫計算・セーブ形式は変更していない。
実装は `remake/` のショップ表示のみ。未マージのDraft PR #587であり、公開採用は親担当の判断待ち。

WORKER: codex-c-shop-art-20261016-8e7fb2cb0e
CLAIM: 38786636524 SUCCESS / STATUS: 38786847504 SUCCESS

参照の正本は #505 / PR #510 の `asset_sources/shop-ui-issue505/flavors-original.png` と `approved-concept.png`。
原画SHA256は c6382daf4dc409e2542548d896a3b883f0d9216da81f1cc475655c47498fcc48。
現行mainの採用は箱ではなく18種植物原画。PR #147と、このfresh cloneのGitHub由来履歴でも `assets/ui/shop/` はREADMEのみ。
過去の箱パッケージPNGは確認できなかったため、旧版や古いローカルコピーを復元せず現在の果実画を基準にした。

HMDの構造参照は `asset_sources/title-art/heroine-concepts-v1-20261008/references/hmd-real-side.jpg`。
同じフォルダの `hmd-real-assembled.jpg`、v2-personality-pixel の `references/stratus-hmd.jpg` も目視。
画風は `assets/ui/making/bowl_empty_phunnel.png` を添付。実ロゴ・固有製品の完全模写は避け、汎用の金属構造で描いた。
これはショップの説明図であり、実機の性能や制作画面の装着契約を新しく定義しない。
PR #558 は #437 の機材外観カタログ準備でありフレーバーパッケージとは別。
#437 のowner・正本・カタログ・ハンドル/チップ・選択/保存は変更していない。

- `inventory.json`: 開始時の全26店頭ID・当時の画像/切出し・欠落理由・生成対象。
- `adoption.json`: 今回の選定21PNGとSHA256・配信先。親担当によるレビュー待ち。
- `generation-records.json`: 実際の組み込み `image_gen.imagegen` 全28回のプロンプト・入力・結果。追加API経路は使っていない。
- `generation-manifest.json`: 再生成用のID/絶対参照パス/出力先/プロンプトと配信仕様。実実行の記録は上記recordsを優先。
- `originals/`: 最終選定の生成PNG21点。すべて1254角/RGBA、元ファイルは無加工。
- `rejected/`: 余分な果実・別味の図柄・影・非正方形を修正する前の7点。
- `validation.json`: 元PNG/配信WebPの全デコード・寸法・alpha・bbox・SHA256・容量。
- `contact-sheet.webp`: 最終21点の比較。ゲームのスクリーンショットは [QA記録](../../docs/qa/shop-art-issue586/README.md)。

五つの初期呼出しで共通プロンプトが欠落した。実プロンプトを修正せず記録し、候補をすべて目視して必要なものを再生成。
箱の上面のミント残り、箱外の果実、マンゴーへの柑橘混入、レモンの影、葡萄/桃の非正方形は生成ツールで修正した。
アイボリー紙・植物画・同系列の縁飾りで統一し、縁色は紫を中心に苺/林檎の赤・柑橘/マンゴーの色差を残す。
商品名・価格はHTML側に置き、絵に文字・実ブランド・値札・ロゴを焼き込まない。

再現可能な配信変換: `python3 tools/build_shop_art.py`（Pillowとcwebpが必要）。
選定PNGのSHAを照合し、cwebp q88/alpha_q100/method6で512角WebPを生成する。
21点合計947,534 bytes。リサイズによりalpha最大値は254、背景0で透過を保持。元PNGは0〜255。
画像を引き伸ばさず、測定bbox＋2pxで切出し窓を作り、一覧66px/詳細112pxの中に各辺6%の余白を共通で確保する。
`.js` のURLは `remake/img/shop/packages/` と `equipment/` を直接指し、PNG原画やローカル生成フォルダには依存しない。
