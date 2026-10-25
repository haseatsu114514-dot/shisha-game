# 久世朔・服装と表情の改訂

2026-10-25生成。オーナー提供の王馬小吉の画像は、普段と勝負中の表情差・大胆な顔芸の参考として確認した。衣装や髪色・目の色・柄・ポーズはそのまま写さず、久世の店「煙幕」と既存立ち絵をもとに作成。

| 原画 | 採用画像 | 用途 |
| --- | --- | --- |
| `normal-source.png` | `assets/sprites/characters/kuze/chr_kuze_normal.png` | 店内の人懐っこい顔 |
| `smug-source.png` | `assets/sprites/characters/kuze/chr_kuze_smug.png` | 大会で相手を読む顔 |
| `wild-source.png` | `assets/sprites/characters/kuze/chr_kuze_wild.png` | 相手の手が動いた瞬間の顔芸 |

原画は各1084×1451、透過。採用版は896×1200へ比率を保って縮小し、中央へ透過パディングした。WebPと立ち絵の計測値は `python3 remake/tools/build_manifest.py --portraits-only kuze` で生成。店で働ける服として墨黒のゆるい上着、片側だけ見えるえんじの裏地、小さな幾何柄のスカーフ、作業ズボンとノート用ポーチを採用した。顔芸は大会の一場面だけに接続。

生成指示は [prompt.txt](prompt.txt)。
