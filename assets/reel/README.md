# 日常リール「MOKU!MOKU!パッキー」図柄の差し替え

このフォルダに図柄画像を置くと、リールの図柄が CSS プレースホルダから
**画像生成したものに自動で差し替わります**。

## ファイル名（このとおりに置くだけ）

| ファイル名 | 図柄 | 役 |
|---|---|---|
| `sym_seven.png` | 赤7 | BIG |
| `sym_bar.png` | BAR | REG（バケ） |
| `sym_bell.png` | ベル | 常連小役（ジャグラーのぶどう枠） |
| `sym_cherry.png` | チェリー | 角チェリー |
| `sym_replay.png` | リプレイ（シーシャの水＝青） | 再遊技 |
| `sym_smoke.png` | 煙 | ブランク（ハズレ目） |
| `sym_pakki.png` | パッキー柄 | ピエロ（激レア） |

- **推奨サイズ**: 正方形 256×256px 程度、**透過PNG**（背景なし）。
- 一部だけ置いてもOK（置いた図柄だけ画像になり、残りはCSS描画のまま）。

## 反映手順

```bash
python3 web/build_data.py          # 置いた図柄を data.js に登録
python3 web/build_standalone.py    # スタンドアロンにも埋め込み（要 pillow）
```

リロードすれば差し替わります。元に戻したいときはPNGを消して再ビルド。

## 仕組み（参考）

- `web/js/reel.js` の `symHtml()` が、`GAME_DATA.reel_symbols` または
  `ASSET_DATA["assets/reel/sym_<id>.png"]` の有無を見て `<img>` / CSS を切り替える。
- 中央＋斜めの有効ラインや回転制御は **システム側** が持つので、画像は見た目だけ。
  （リールの動き・停止・揃い判定はコードが制御＝画像差し替えで挙動は変わらない）
