# 心得の盤 第2弾 原画・後処理記録

Issue #3408 / SBD124。画像生成は Codex 組み込み imagegen のみ。2026-11-12 UTC。原画候補はすべて 1 回につき 1 部品を生成。GBP-12 は前任の初稿、GBP-13 も前任の候補を採用した。生成前に 307,200 B ×3 のコピーと SHA-256 一致を確認した。

## 参照画像（役割・SHA-256）

- `asset_sources/ui/growth-board-20261111/contact_sheet.png` — ① 第1弾の画風と配色の正本。SHA-256 `0f20280e1e455e377240a1bbd01994a1bc7dde7c4ff91c3533791452ce5d60f9`
- `asset_sources/ui/growth-board-20261112/reference/parts2_board.png` — ② 盤の配置と部品の大きさ。桃色の印は描かない。SHA-256 `2ec6e86eb7dd00686ccc376bd04ee5a0cdf1bf5548cc57416f02a1537ea3b00e`
- `asset_sources/ui/growth-board-20261112/reference/parts2_board_selected.png` — ② GBP-12 の選択中パネル位置。SHA-256 `68c75f149cf7140065e911c57805dedfc1cf0c4acf1625460f614d023ed6cf32`
- `asset_sources/ui/growth-board-20261112/reference/parts2_help_flow.png` — ② GBP-16 の配置。SHA-256 `5e67a8dec55897e6b46385c63823ca71e020d64d2d31753b80b30446c5b771fe`
- `asset_sources/ui/growth-board-20261112/reference/parts2_levelup_milestone.png` — ② GBP-17 の配置。SHA-256 `28885d3c51c1879d20159ad10ac24cc3a4e7e27b880d7254245b6354bd158964`
- `asset_sources/ui/growth-board-20261111/originals/levelup_plate.png` — ③ GBP-12・13 の黒ガラス板と金縁の見本。SHA-256 `cd38ea920a0ca65059f96e0625c9df56c7ebc17f59b4eff571fe7888cc110a9d`
- `asset_sources/ui/growth-board-20261111/originals/gb_badge_unknown.png` — ④ GBP-16 の丸い台の見本。SHA-256 `0ef3b6fc910bc53633e69d9a66f6fd4b196ea427a8d14872ccfbe5844b89876d`
- `flow_1.png` の生成元（下表の raw SHA-256）は flow_2〜4 の同じ台・同じ線の追加見本。

## 生成指示

共通: 「水煙前線」の心得の盤の UI 部品を真正面から 1 枚。参照①と同じ描き手に見える、黒いスモークガラスと細い金のネオン線の **ART DIRECTION “neon lounge”**。細かなドットのピクセルペインター調、2〜3段の陰影、左上からの光、静かな金色 `#f4d27a`・白金 `#fff1d0`・淡白 `#f6f2ff`。参照②は配置のみで桃色の番号と線は描かない。文字・数字・記号・ロゴ・ゲージ・透かし・人物・手・シーシャ機材・植物・風景は描かない。部品外の光・煙・影を描かず、GBP-17 以外の地はマゼンタ `#FF00FF`。指定比率と九分割の縁幅を伝えた。

個別の指示:

| ファイル | 指示 | 追加参照 |
|---|---|---|
| `gb_panel_dark.png` | 1024×1024。九分割四辺128。大きな黒ガラス板、少し丸い角、細い金の外縁と淡い内縁、各隅に小さな火の粉2つ。中央は暗く平ら。 | ②選択中図、③板 |
| `gb_row_dark.png` | 768×192。九分割四辺64。板より少し明るい濃紫ガラスの細長い行、金の細縁、飾りなし。左32pxは帯を重ねる。 | ③板 |
| `gb_chip_gold.png` | 512×192。九分割左右96・上下0。丸い両端の磨いた金札、暗い細縁と内側の彫線、平らな金の面。宝石・鋲・光の筋なし。 | ②盤 |
| `gb_pill_dark.png` | 512×192。九分割左右96・上下0。丸い両端の黒ガラス札、細い金の縁、平らな面。 | ②盤 |
| `flow_1.png` | 512×512。丸い黒ガラスの台に白金の細線。3つの火の粉が上の大きな四点星へ集まる。 | ②見方、④台 |
| `flow_2.png` | 512×512。同じ台・線。上向きの山形2つ、その上に小さな丸い火の玉。 | ②見方、④台、flow_1 |
| `flow_3.png` | 512×512。同じ台・線。反った瓦屋根の線、その下の小さな灯。 | ②見方、④台、flow_1 |
| `flow_4.png` | 512×512。同じ台・線。線で結んだ丸3つ、左から明→半明→暗。 | ②見方、④台、flow_1 |
| `levelup_crest.png` | 1024×1024、真黒 `#000000`。左右から上へ伸びる細い金の炎の輪、下が明るく外へ向けて黒に消える。中央は空。レンズフレアの輪なし。 | ②節目 |

## 後処理

前任の寸法と生成背景の色差を補正した。マゼンタの画素群をクロマ判定し、最大の部品領域の外を厳密な `#FF00FF` にした。GBP-17 は外周24pxを純黒にした。GBP-12・13 は部品輪郭に沿って切り、LANCZOSで指定寸法へ縮小。GBP-13 は元の長い行を768×192に収めたため角の曲率がやや楕円になる。その他はキャンバス全体を指定寸法に縮小した。九分割の文字が載る中央を、境界に向かって滑らかに元の質感へつなげながら均した。透過化とゲーム組み込みは行っていない。

## 画素・ハッシュ検査

| ファイル | 生成元 px | raw SHA-256 | 納品 px | bytes | 納品 SHA-256 |
|---|---:|---|---:|---:|---|
| `gb_panel_dark.png` | 1254×1254 | `cb6a3ddb86b6d02b04b846d3b241d2faa9b2515707c180395dcba79d478f404d` | 1024×1024 | 730860 | `7ab6cde4ff1838064d205a8cdf8838fda2987a2c60d91b96a783a70a139a7eb9` |
| `gb_row_dark.png` | 2172×724 | `eb6142a4ecda6346e4ee1f958676db0d77b806efea4decd6289b233f9a206496` | 768×192 | 112760 | `72148a63fe36f0a66e82a8721d04106a5d07593888b196cd05e895d130148d05` |
| `gb_chip_gold.png` | 2048×768 | `083a1fd45236a6654dc8f9a828f5928e6097725060f3f81f6b8bd21e11d50547` | 512×192 | 38521 | `43e170897464f24a2ab49addecf514b504c500044b67b9fe9f3df8490837f288` |
| `gb_pill_dark.png` | 2048×768 | `6f53d4c03f613bd8cc1dc9bdd89c9b6abbc8562c70e65b5445a7a8bc8529b512` | 512×192 | 55563 | `5b0aed9325610ddb17fef3c1e5ab4cfa6f184377b98ce47d97ca776261a35b6b` |
| `flow_1.png` | 1254×1254 | `a4ee03a406f1115c8908e186456f0522c575190986ab1bafe8cf410c420c8804` | 512×512 | 181444 | `a4a5a38ed7a8f743a0a3cd0b9544f7ebc2f868b7b21b7dfe5e6fd75552ac54b0` |
| `flow_2.png` | 1254×1254 | `edb86744cf2f9c18a3831c16f8a4ac28d73e6e6a1d043774beafb7afd7494819` | 512×512 | 190190 | `a86305e18b745400ab7a4120970e49327bf3cf8ec69c89d75c9e389c9f89a8a6` |
| `flow_3.png` | 1254×1254 | `3cb13cba91da1646d0f51d4017dfeb5b9a67c46adee09c4e6068ff4ff8d4885c` | 512×512 | 182677 | `b24ef8ddc9cbc2a291bee07f1cfc65c3ae12060b6ec42ad67327bfa9d54d2951` |
| `flow_4.png` | 1254×1254 | `85bd2b4387f45b257e4ed35949d92c63de0906378052da3ea3c0e39908c0bc79` | 512×512 | 179974 | `5366eec18246b1543c5ef559f7f84acee90f0cd8829de2edc1fc346b43975a6e` |
| `levelup_crest.png` | 1254×1254 | `28e8b7558dbf900b7e101fe95e834b6def139f503d7cae9603b5b5c97602200a` | 1024×1024 | 521578 | `b0a63668ea134a0578f14be157ebdfa702c2477697e19eb8c3c015374cb1c50d` |

検品: 9枚すべて指定寸法、GBP-12〜16の四隅は `#FF00FF`、GBP-17の外周は `#000000`。4枚の丸い台は同じ輪郭と線の太さ。文字・機材・植物の混入なし。板と札の中心16×16pxのRGB標準偏差は1未満。目視で第1弾の金縁・黒ガラスと整合する。GBP-13 の横方向の圧縮は受け取り側での表示確認が必要。
