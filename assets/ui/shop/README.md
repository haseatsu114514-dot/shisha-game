# ショップの商品画像（N17/N21）

このフォルダに画像を置くと、Dr.fookah のショップ画面（商品リスト＋詳細パネル）で
自動的に使われます。無ければ従来どおりCSSだけの簡易アイコン（ボウルの形・ジャー等）に
フォールバックするので、画像が届いた分から差し替わります（コード変更不要）。

## ファイル名

- フレーバー: `flavor_<フレーバーID>.png`（例: `flavor_mint.png`）。IDは `data/flavors.json` の `id`。
- 機材: `equip_<機材ID>.png`（例: `equip_silicone_bowl.png`）。IDは `data/equipment.json` の `id`。

## 推奨スペック

- 正方形、512×512px 目安。
- 背景は単色または透過（アイコンとしてカードに収まるよう `object-fit: cover` される）。
- プロンプトは `docs/shop_asset_prompts.md` を参照（Codexへそのまま渡せる形式）。

## 組み込み

```bash
python3 web/build_data.py         # D.shop_assets に一覧を焼き込む
python3 web/build_standalone.py   # 配布版にも埋め込む
```
