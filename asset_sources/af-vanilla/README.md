# AF バニラ

ユーザー指示「今ドバジバニラになってるのをAFバニラに戻して画像生成して」に対応。基準 main: `3efd027ea83135d0d6e1963bc8bae75eee5a591d`。

- `original.png`: 正式な `image_gen.imagegen` による新規生成の無加工原画（1254×1254 RGBA）。生成時に現行 `remake/img/shop/heaven10/cinnamon.webp` と `mint.webp` を実画像で添付した。
- `prompt.txt`: 実際の生成指示。黒い閉じた紙箱・白い翼と独立した輪・味の筆帯を現行AFから継承し、クリーム色の帯とバニラの花・莢を描いた。文字・実在メーカーのロゴ・UI・箱外の小物は描かない。
- 配信用: `remake/img/shop/af-vanilla/vanilla.webp`（512×512）。`python3 tools/build_af_vanilla_art.py` で縮小・WebP変換と表示窓計測のみを行う。原画の描き直し・切り抜き・紋章合成は行っていない。
- `validation.json`: 原画と配信画像のSHA256、完全デコード、透過、可視領域、表示窓、容量。`--check` で再現確認できる。

既存AF10点の採用元・紋章合成履歴は `../shop-art-issue586/runtime-heaven10-adoption/README.md` と `../shop-art-issue586/wing-only-heaven10-v6/README.md` が正本。この追加で既存10点やその生成・検証スクリプトを変更しない。旧ドバジ版と歴史資料も保持し、現行ショップ／制作の共有描画で新AF版を優先する。

データの `vanilla` ID、価格、葉固有数値、レシピ、台詞、在庫、熟練度、セーブschemaを保持。メーカーは明示的に `af` へ戻すので温度帯幅・メーカー補正は既存AF仕様となる。ドバジ幅の回帰は実在する `dobaj_double_apple` で継続検証する。AFの他のフレーバー固有設定、別メーカーの同名フレーバーは変更しない。

くじの「AF バニラ（25g）」は今回の復元後に一致するため維持。PR #1828 のバニラをドバジへ変える行は今回の指示に反するため併合時に採用しない（同PRのローズ・台詞修正は本変更の対象外）。

原画と配信画像を目視し、箱の全体・余白・独立した翼と輪・筆帯・バニラ図案・文字なしを確認。GitHub draft PR に配信用画像と実画面を掲示する。マージは行わない。
