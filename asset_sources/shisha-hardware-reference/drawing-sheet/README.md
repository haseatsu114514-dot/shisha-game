# シーシャ描写の早見表（画像）

**ルールの正本は [`docs/shisha_reference.md` §4「画像生成の必須手順」](../../../docs/shisha_reference.md#4-画像生成の必須手順機材の形と構造)**（2026-11-02 にここから移した）。生成前の8行・貼る文・部位ごとのNG・生成後チェックはそちらを読む。このフォルダは、人が見るための早見表の画像とその元データだけ。

> 早見表と構造図は**仕組みを理解し、生成後に検品するための資料**。生成ツールに渡さない（平板な図解の見た目が絵に移る）。渡すのは [`../photos/`](../photos/README.md) の実写。

| ファイル | 用途 |
|---|---|
| [shisha-drawing-reference.png](shisha-drawing-reference.png) | 人が読む早見表（構造・縮尺・場面・ホース・吸い口・穴・NG実例・チェックリスト・写真索引）。文面は2026-10-09時点で、現行の文は `docs/shisha_reference.md` が優先 |
| [shisha-structure-diagram.png](shisha-structure-diagram.png) | 構造図だけを切り出したもの（部品の積み順・ホース経路・比率）。検品のときに見比べる |
| [shisha-drawing-reference.html](shisha-drawing-reference.html) | 上2枚の元データ。直したら下のコマンドで書き出し直す |

```bash
node tools/render_html_png.mjs \
  asset_sources/shisha-hardware-reference/drawing-sheet/shisha-drawing-reference.html \
  asset_sources/shisha-hardware-reference/drawing-sheet/shisha-drawing-reference.png \
  --select "#anatomy" asset_sources/shisha-hardware-reference/drawing-sheet/shisha-structure-diagram.png
```
