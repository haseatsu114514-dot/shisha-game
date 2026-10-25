# 久世朔・童顔店主と勝負の表情

久世朔の新しい通常立ち絵と大会用 `smug` 差分。ユーザー指定の「ましろに近い年齢の幼馴染」「可愛げのある悪戯っ子に見え、大会で楽しげに豹変」を反映し、23歳の成人として描いた。ましろの長い金髪三つ編みや眠そうな目と区別し、久世は短い濃茶髪、跳ね毛、覚めた目、袖の長い仕事着と手帳を目印にした。

- `normal-source.png`: 現行の久世立ち絵を画風・エプロンの参照として `image_gen.imagegen` で再設計した原画（1084×1451、透過）。指示は `normal-prompt.txt`。
- `smug-source.png`: 新通常原画を参照して同ツールで作った大会用の表情・姿勢差分（1084×1451、透過）。指示は `smug-prompt.txt`。
- `build-sprites.py`: 原画を縦横比を保って 896×1200 に収め、低アルファの孤立ノイズのみを除く再現手順。人物・服装を描き足さない。
- `assets/sprites/characters/kuze/chr_kuze_{normal,smug}.png`: ゲーム用PNG。`remake/img/sprites/characters/kuze/` のWebPと `remake/data/manifest.json` は `build_manifest.py --portraits-only kuze` で作る。

通常は本心の柔らかい笑顔、大会では目つき・口角・手帳の持ち方が変わる。顔、両手、両足、ノート、透過背景を目視確認した。原画のごく薄い彩色ノイズは配布PNGで除いた。シーシャ器具や喫煙を描いていない。
