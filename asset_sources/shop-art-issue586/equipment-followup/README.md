# 店頭のロートス型HMD・炭の表示

2026-10-25、#586の残件確認・未実施実装の依頼による差分。
フレーバー18種は `shop-art.js`（10）と `shop-art-remaining.js`（8）で接続済み。

| 店頭ID | 今回の原画・配信 | 状態 |
| --- | --- | --- |
| `lotos_hagal` | 新規 `lotos-v2.png` → `remake/img/shop/equipment-v2/lotos_hagal.webp` | 新規生成・接続 |
| `flat_charcoal` | 新規 `flat_charcoal.png` → `remake/img/shop/equipment-v2/flat_charcoal.webp` | 厚みのある角炭を再生成・接続 |
| `cube_charcoal` | 新規 `cube_charcoal.png` → `remake/img/shop/equipment-v2/cube_charcoal.webp` | 立方体を再生成・接続 |
| `tanukish_lid` | 文字HMD | 未完。B案の元画像はLibraryのみで、この環境に画像bytesなし |
| `amaburst_hms` | 文字HMD | 未完。実物参照URLの取得がHTTP 403。オレンジの炎風アクセント、側面は突起ではなく穴 |

新HMDは実写 `asset_sources/title-art/heroine-concepts-v1-20261008/references/hmd-real-side.jpg`
を目視・生成へ添付。低い円形金属容器・蓋の可動通気部・接続した短い持ち手を参照し、
ロゴ・刻印なし、銀色へ変更。人物なし／未使用単品／台なし／HMD1／炭0／ホースなし／吸い口なし／少し上からの3/4視点。
旧不採用候補は使っていない。HMD2回・炭各1回の原画と実プロンプトを無加工で保存し、実行記録は `generation.json`。
原画にはalpha=1の微小ノイズと指定より狭い余白が残るため、原画の余白合格とは記録しない。
配信変換は全原画を等比縮小し、透明余白を追加するだけ。配信512角で全alphaの外周10%以上を検査する。
表示窓は既存と同じalpha>16のbbox＋2pxで測定する。

炭は炭焼きゲームで採用済みの `assets/ui/making/heat_flat_cold.png` と `heat_cube_cold.png`
を形状・質感の参照として添付し、店頭専用の原画を各1枚新規生成した。
旧店頭の薄い図形から、十分な厚みのフラットと立方体を見分けられる表示へ直す。
参照の来歴は `asset_sources/coal-heat-ui-game/README.md` と同フォルダの `generation.json`。
未着火単品、黒い多孔質の面、フラットの厚みとキューブの正方形の側面を目視。
炭1／人物・台・HMD・ホース・吸い口なし／3/4視点。既存炭焼き・完成リグの画像は変更しない。
PR #861の6枠比較ツールに実候補6点を揃えたという意味ではなく、今回は直接実装依頼に対して2種を制作した。

再現・検査：

```sh
python3 tools/build_shop_equipment_art.py
python3 tools/build_shop_equipment_art.py --check
```

原画SHA・配信SHA・全decode・alpha・寸法・窓は `sources.json` / `validation.json`。
本編一覧66px・詳細112pxで同じ表示窓を使用。実imgのerrorでHMD／炭の文字へ戻り、購入できる。
商品ID・価格・性能・在庫・保存形式は変更しない。

実物参照の取得失敗先（再配布なし）：

- ターキッシュ：`https://www.pipe-m.com/data/pipe-m/product/20231014_dca7d0.jpg`
- アマボースト：`https://drshisha.jp/cdn/shop/products/DSC00121.jpg?v=1672829307&width=1024`

残るHMD2種の画像は取得できておらず、実物構造照合済みとはしない。旧保留画像を再採用しない。
旧機材画像3点の不使用対象IDも未確定であり、ボウルの商品や画像を推測で削除しない。
したがって #586 はopenを維持する。
