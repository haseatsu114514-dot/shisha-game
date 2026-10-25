# 久世朔・服装と表情の改訂

2026-10-25〜26生成。オーナー提供の王馬小吉の画像は、普段と勝負中の表情差・大胆な顔芸の参考として確認した。衣装や髪色・目の色・柄・ポーズはそのまま写さず、久世の店「煙幕」と既存立ち絵をもとに作成。

| 原画 | 表示画像 | 用途 |
| --- | --- | --- |
| `normal-matte-source.png` | `assets/sprites/characters/kuze/chr_kuze_normal.png` | 首をまっすぐにして客を迎える、少し意味ありげな好青年 |
| `nervous-matte-source.png` | `assets/sprites/characters/kuze/chr_kuze_nervous.png` | 大会序盤、ノートを抱いて緊張する顔 |
| `smug-matte-source.png` | `assets/sprites/characters/kuze/chr_kuze_smug.png` | 大会で相手を読む顔 |
| `wild-matte-source.png` | `assets/sprites/characters/kuze/chr_kuze_wild.png` | 相手の手が動いた瞬間の顔芸 |

新しい四表情の原画は各1084×1451、透過。従来の `*-b-final-source.png` は前段階として保存。表示版は896×1200へ比率を保って縮小し、中央へ透過パディングした。WebPと立ち絵の計測値は `python3 remake/tools/build_manifest.py --portraits-only kuze` で生成。最初の `normal-source.png` / `smug-source.png` / `wild-source.png` はスカーフ付きの履歴、`*-v2-source.png` はスカーフを外して首をまっすぐにした中間版として保存。顔芸は大会の調整場面で、はじめの手が動く瞬間に接続。`childhood-flashback-source.png` から `assets/cgs/cg_kuze_mashiro_childhood.png` を制作し、幼なじみの公園の記憶として使用。

## 通常時の衣装候補

- **A `candidate-a-long-coat.png`**: 長めのリバーシブル作業コート。普通のポケットと隠しポケット、片側だけ見えるえんじの裏地で「表と裏」を描く。店主の落ち着きが強い。
- **B `candidate-b-short-jacket.png`**: 斜めに3本留める短い仕事着。ずれた留め具、切れた四角いステッチ、白紙の味カードで「予想を外す」軽快さを描く。より悪戯っぽい。

オーナーは **B** を選択。短いジャケットと斜めの三本留め具、白紙の味カードを三表情で揃えた。首元は無装飾。通常時はまっすぐ立ち、少し丸い顔と柔らかい目、片側だけ上がる笑顔で可愛さと控えめな胡散臭さを両立。勝負中の表情差分も同じ衣装へ作り直した。

生成指示は [prompt.txt](prompt.txt)。
