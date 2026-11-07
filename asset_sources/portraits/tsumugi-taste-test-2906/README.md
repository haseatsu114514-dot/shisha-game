# Issue #2906 立ち絵テイスト試作

採用未定の候補です。ゲームへの組み込みや現行画像の差し替えはしていません。Codex の画像生成で、各キャラを新規に描き起こしました。

| 役割 | 正本 |
| --- | --- |
| 画風の正本 | `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png`（ベース版つむぎ） |
| はじめの外見の正本 | `assets/sprites/characters/hajime/chr_hajime_normal.png` |
| ひよりの外見の正本 | `assets/sprites/characters/hiyori/chr_hiyori_normal.png` |

画風固定の指示: 「塗り、陰影の形、線の太さと質感、顔の描写密度をベース版つむぎの画風に固定する。各キャラの顔・髪・服装・装飾は現行立ち絵に厳密に合わせる。装飾の追加、美化、別人化を避ける」。`character_variants/new/` の画像は参照、加工、流用していません。

| 候補 | 内容 |
| --- | --- |
| `chr_hajime_normal_tsumugi_taste.png` | 逢縁はじめ、normal、全身、透過、896×1200 |
| `chr_hiyori_normal_tsumugi_taste.png` | 泡沫ひより、normal、全身、透過、896×1200 |

生成時は各キャラの現行立ち絵を外見の正本、ベース版つむぎを画風の正本と明示して2枚ずつ入力しました。画像生成の出力を画面比率を維持して896×1200に縮小しました。両画像の四隅のアルファ値は0で、人物の全身はキャンバス内に収まっています。シーシャ機材は描かれていないため、HMDとボウルトップの形状判定は対象外です。最終採否は司令塔の実ファイル検品とオーナー判断に委ねます。
