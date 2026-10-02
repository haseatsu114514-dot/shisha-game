# 歩行テスト（実験・本編未接続）

マップを「横長の通りを歩く」形にする案の前段として、次の3点だけを確かめる独立ページ。

- 斜め移動が自然にできるか（8方向）
- 歩いている様子（2コマの歩行アニメ・速度・コマ送り）
- 歩行グラフィックの絵の質（生成AIのドット絵がどこまで使えるか）

主人公の代わりに、仮でつむぎを歩かせている。本編（`web/index.html` / `web/js/*`）には一切つながっていない。
ヘッドレステストの一覧にも含めない。

## 起動

```bash
python3 -m http.server 8123   # リポジトリルートで
# → http://localhost:8123/web/proto/walk/index.html
```

push 済みのブランチなら raw.githack でも開ける:
`https://raw.githack.com/haseatsu114514-dot/shisha-game/<ブランチ名>/web/proto/walk/index.html`

## 操作

- 矢印キー / WASD で8方向に移動（Shift で速歩き）
- クリック / タップした場所へ歩く（押したままドラッグで向きを変えられる）
- 右上の設定パネル: キャラの大きさ（32px / 48px）・表示倍率・向きの絵（8方向 / 4方向で代用）・コマ送り・移動速度
- 「一覧（8方向）」: 8方向×（歩行アニメ / コマA / コマB）を並べて、コマごとのブレを確認する画面

## ファイル

| パス | 内容 |
|---|---|
| `web/proto/walk/index.html` | 実験ページ本体（JS・CSS埋め込み） |
| `tools/proto_walk_sheet.py` | 生成AIの歩行シート（マゼンタ背景）→ 足元を揃えたゲーム用シートに変換 |
| `asset_sources/images/proto_walk/pose_reference_sheet.png` | 画像生成AIに渡す「向きの並び・足の位置」の参照（仮スプライトを8倍にしたもの） |
| `asset_sources/images/proto_walk/` | 生成AIの元画像の置き場 |
| `assets/proto_walk/tsumugi_walk_{32,48}.png/.json` | 変換後の歩行シート（置くとページが自動で使う） |

## 歩行シートの形式

- 5列×2行。列 = 下 / 右下 / 右 / 右上 / 上（背中）、行 = 歩行コマA / コマB
- 左・左下・左上は右側の絵を左右反転して使う（シートに含めない）
- セル: 32px版 24×36、48px版 36×52。足元の基準点は下端中央（`anchor`）
- 画像が無いあいだは、コードで描いた仮スプライトで表示する（ステータス欄に「仮スプライト」と出る）

## 生成画像を入れる手順

1. 生成した歩行シートを `asset_sources/images/proto_walk/tsumugi_walk_sheet.png` に保存
2. `python3 tools/proto_walk_sheet.py`（Pillow・numpy・scipy が必要）
   - コマごとに大きさがバラバラなら `--per-frame-fit`
   - 確認用に `asset_sources/images/proto_walk/preview_walk.png` も出る
3. ページを再読み込みすると、設定パネルの表示が「生成画像」に変わる
