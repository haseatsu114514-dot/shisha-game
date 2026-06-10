# タイトル用キービジュアル

このフォルダに `.png` を置くだけで、タイトル画面の右側に表示されます。
複数枚あれば起動ごとにランダムで1枚選ばれます。

## 推奨スペック

- 縦長アート（縦:横 = 約 4:3 〜 3:2 推奨。1024×1536 や 1200×1800 など）
- 背景込みの一枚絵でOK（送ってもらったタイプの煙＋キャラのアート）
- 透過不要（jpgでも可だがファイル名は .png 推奨）

## 表示位置

- 画面右側の `#title-art-frame`（右1%、幅50%、高さ100%）に
  `object-fit: contain` で収まる
- 縁は `art-vignette` で煙・暗幕にフェードして背景に溶け込む

## 追加するときの規約

ファイル名は何でも良いが、識別しやすいよう以下を推奨:

- `title_art_<キャラID>_<バリアント>.png`
- 例: `title_art_tsumugi_smoke.png` / `title_art_minto_window.png`

追加したら `python3 web/build_data.py && python3 web/build_standalone.py`
で `D.title_arts` に自動登録される。
