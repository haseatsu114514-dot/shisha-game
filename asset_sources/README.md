# Asset Sources

このフォルダは、実ゲーム用の `assets/` へ反映する前の元データ置き場です。

- `asset_sources/images/` : 元画像（背景・UI・立ち絵など）
- `asset_sources/music/` : 元音源（BGM・SEなど）

## 運用ルール
- ゲームで使う最終ファイルは `assets/` 側へコピーして参照する。
- 元データはここに残して、差し替え履歴を追えるようにする。
- タイトル画像は `asset_sources/images/title/` に置いてから
  `assets/title/` へ反映する。
- 外部画像を取り込むときは
  `./tools/import_asset_image.sh <元ファイル> <group> [出力名]`
  を優先して、Godot の `execute_editor_script` に頼らない。

## 例

```bash
./tools/import_asset_image.sh ~/Desktop/タイトル/mashiro1.png title
./tools/import_asset_image.sh ~/Desktop/タイトル/mashiro2.png title hero.png
```
