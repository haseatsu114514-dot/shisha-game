# スプリングウォーターの商品画像

サメちゃんの好きな単体フレーバー。ゲーム内はアフサール。実在のAfzal Natural Spring Waterを味の参考とし、実物ロゴ・包装は複製しない。

- `afsahr-source.png`: image_gen修正原画（1254×1254 RGBA）。既存アフサールのライチ箱を参照し、淡い水色の箱・日の出のマーク・斜め帯・湧き水の絵に統一。
- 配布: `remake/img/shop/character-flavors/spring-water.webp`（512×512、ロスレス、透過）。
- 原画と512px版を目視。文字・実在ロゴ・人物なし、箱全体が画像内に収まる。
- 制作記録: `generation.json`。参照は既存アフサールのライチ箱の形状・画風・ブランドマーク。旧 `source.png` と `black-carton-generation.json` は、メーカー意匠が異なるため不採用とした黒い箱の履歴。

実装は `data/flavors.json`、`data/dialogue/samechan.json`、`shop-catalogs.js`、`shop-art-character-flavors.js`。

GitHubのCLI認証が無効のため画像のGit LFSアップロードは未完。原画・配布画像の実体はこの作業環境に保存済み。アップロード完了まで公開しない。

認証復旧後、このcheckoutで現在の採用画像2件と保存済み旧原画の3オブジェクトだけを送る（約3MB）。

```sh
git lfs push --object-id origin ea30758bf15ba5c593c0b24ac020086c166533a4887bfed80f51d3e1f9b4e0d2 b8f10256e53f42cf652291a444145e0c3b8478a18e583cbdc78465377ba4dd33 e05a8092232e55fbff9da04335feb8c2f65d1305e776cadaa2f19e1f06c772b0
```

検証: 熟練度・在庫・SAVE/LOADのVM検査と商品表示検査、台詞lintが成功。PC・横タッチの購入・新画像decode・会話経験値の一度だけ付与・配合操作のassertionは通過。ブラウザ検査全体は依存PR #1023の既存商品画像4枚を取得できないためresource検査で失敗。画像送信後に `CASE_FILTER=spring-water-pc` / `spring-water-touch` で `remake/test/browser/flavor_mastery.mjs` を再確認する。
