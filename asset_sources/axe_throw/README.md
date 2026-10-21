# 斧投げ 的の画像（#785）

- `target_board_original_1254.webp`: 元の `remake/img/ui/axe_throw/target_board.webp`（1254x1254 RGBA、約1.92MB）をバイト同一でコピーして保存したもの。
- 公開版 `remake/img/ui/axe_throw/target_board.webp` は 800x800 RGBA（約0.23MB）に縮小したもの。

## 縮小理由
#785 の読込短縮のため。画面では390px（SVG座標）で表示され、高DPIでも最大2倍（約780px）あれば十分なので、800pxに抑える。

## 変換パラメータ
- Pillow: `Image.open(元).convert("RGBA").resize((800, 800), Image.LANCZOS)`
- 保存: `save(path, "WEBP", quality=90, method=6)`（アルファ保持）
