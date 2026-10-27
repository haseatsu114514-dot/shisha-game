# スティーブ・レトロ菓子研究家の立ち絵

第3章スティーブの改稿立ち絵。30歳の白人アメリカ人、ふくよかな体格、レトロな柄シャツ、眼鏡、タイマーとレシピカードを見せる。体格を笑いの種にせず、大きな手で小さな道具を正確に扱う個性を出した。

- `first-pass.png`: 旧採用立ち絵 `assets/sprites/characters/steve/chr_steve_normal.png` を参照し、image_gen.imagegen で再設計した原画。`first-prompt.txt` を使用。
- `normal-source.png`: 初回原画を参照して帽子を外し、髪・柄シャツ・輪郭を整えた最終原画。`refinement-prompt.txt` を使用。
- `build-normal.py`: 最終原画を 896×1200 RGBA に縮小し、不可視の透過ノイズを除去する。人体・衣服の描き足しはしない。
- `assets/sprites/characters/steve/chr_steve_normal.png`: ゲーム採用 PNG。`python3 remake/tools/build_manifest.py --portraits-only steve` で WebP と目録を再生成。

立ち絵は透明背景で、顔・眼鏡・両手と小道具・両足・体型・衣服を目視確認。レシピカードの線は判読不能で、商標や喫煙器具はない。既存の Smoke & Glory 背景に立ち絵を重ねた確認画像で、縮小時の顔・眼鏡・タイマーと体型、背景との分離を確認した。

新しい WebP を読み込む実ブラウザの第3章全国大会 `four-person-craft-votes-and-win-boundary` ケースも成功。保存・投票・勝利の進行を変える素材変更ではない。

## SHA-256

- `first-pass.png`: `5ba5f2277bbb260abbf1945c86c1c46e9b28aad1c9ca8e65622d5a9ef647c0f2`
- `normal-source.png`: `f4868e00352e0117e7301b00ebd0475a73cec78943a6df32827fcc5cfa2708c2`
- `chr_steve_normal.png`: `6053510bfa3b52e3fe66dde0071af133fdae931410ad919eb47323a6b5d89735`
- `chr_steve_normal.webp`: `ec6a194aa1178b8f9940320c08555109522ce95b0778e7e4103d19438f66065f`
