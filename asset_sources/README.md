# Asset Sources

このフォルダは、実ゲーム用の `assets/` へ反映する前の元データ置き場です。

外部素材サイトの候補と、ライセンス・クレジット・GitHub保存の確認手順は [`docs/prompts/external_asset_sources.md`](../docs/prompts/external_asset_sources.md) を参照。**外部素材を無条件に元データとしてコミットしない**こと。

- [ヒロインアートの採用候補一覧](title-daily-heroines-20261009/README.md)：新19案・旧15案のキャラ別画像、原画、タイトル配置の比較、別チャットの制作中の候補へ進めます。採用はオーナーの選定後。

- `asset_sources/images/` : 元画像（背景・UI・立ち絵など）
- `asset_sources/music/` : 元音源（BGM・SEなど）

## 運用ルール
- ゲームで使う最終ファイルは `assets/` 側へコピーして参照する。
- 元データはここに残して、差し替え履歴を追えるようにする。
- タイトル用アートは `asset_sources/title-art/` などに原画を置き、採用分を
  `assets/ui/title_arts/` へ反映する。
- 外部画像を取り込むときは
  `./tools/import_asset_image.sh <元ファイル> <group> [出力名]`
  が使える（`asset_sources/images/<group>/` と `assets/<group>/` へ同じ画像をコピー）。
- `assets/` の画像を追加・差し替えたら `python3 remake/tools/build_manifest.py` を実行する。

## 例

```bash
./tools/import_asset_image.sh ~/Desktop/背景/bg_new.png backgrounds
./tools/import_asset_image.sh ~/Desktop/背景/bg_new2.png backgrounds bg_new_night.png
```
