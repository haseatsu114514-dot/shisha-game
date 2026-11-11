# てつこ・しぐさ原画の生成記録（Issue #2690）

## 依頼文と参照

依頼文は PR #2679 のブランチ `claude/sharp-gauss-bm5ru3` にある `asset_sources/tetsuko-care/README.md` の「猫のしぐさ TKT-CAT01〜12」を採用した。`origin/main` に同 README は存在しない。1回の生成で1しぐさ・1枚とし、共通文と対応する `POSE` を英語・日本語で伝えた。共通指示は「採用済みてつこの立ち絵と同じ猫、同じ描き手。暗褐色の輪郭線、明確な2〜3段の影、少数のまとまった毛束。写真的な毛、グラデーション、グロー、3D、文字、小物、床、影を描かない。猫の長辺1000px以上、背景は単色マゼンタ #FF00FF」。各案の指定姿勢は下記のとおり。

毎回添付した参照画像（SHA-256 は実体 PNG の値）:

1. `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` — 柄・顔・耳・目・体格・画風の正本（同一性＋画風）。`9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00`
2. `assets/sprites/characters/tetsuko/chr_tetsuko_smile.png` — 同一性・表情。`3df30e566cd75707c686621a87e5071fe11e1ef6cf5faab441d6fb8348959c10`
3. `assets/sprites/characters/tetsuko/chr_tetsuko_sleep.png` — 同一性・丸い体の形と毛の塗り。`7cbba9787ff8228d44b188f55f9154f40e1dcba9beba010d8958ce395381876e`

画風固定の実行指示: `STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.`

同一性の実行指示: `A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Chubby and soft. Do not change markings, ear shape, eye color or face.`

| TKT | 原画 | しぐさの個別指示 |
|---|---|---|
| CAT01 | `cat_loaf` | 香箱座り。四肢を胸の下に収納、半目で穏やか、やや左向きの斜め姿。 |
| CAT02 | `cat_crouch` | 狙う姿。前を低く、腰をやや高く、右上を注視、しっぽを低く。 |
| CAT03 | `cat_reach` | 座って前足の片方を右上へ伸ばし、指を開く。もう片方は接地、伸ばした足を見る。 |
| CAT04 | `cat_hug` | 横向きで寝転び、両前足を胸の前に丸めて抱えこむ。おもちゃは描かず、後ろ足は蹴る前のように縮める。 |
| CAT05 | `cat_groom` | 座って上げた前足をなめる。閉じた目、少し見える舌。 |
| CAT06 | `cat_yawn` | 座って大あくび。口を大きく開け、小さい牙と桃色の舌、目を閉じ、耳をやや後ろへ。 |
| CAT07 | `cat_belly` | へそ天で眠る。白い腹を見せ、前足を空中で緩く曲げ、後ろ足を開き、目を閉じる。 |
| CAT08 | `cat_rub` | 左へ歩く横姿。見えない脚へ頬を寄せるように頭を突き出し、目を閉じ、しっぽを上へ。脚は描かない。 |

## 原画と検品

16枚とも Codex の画像生成機能で生成。既存の会話用立ち絵と原寸で並べ、折れ耳・金眼・白い逆V・橙縞・白い胸と足・太い尾・丸い体形を確認した。文字、道具、テカり、グロー、明らかな擬似文字、量産顔は見られない。顔や縞の細部には個体差があり、既存立ち絵と完全一致ではない。A段8種の姿勢は各2案揃った。B段は任意につき未生成。

**要修正:** 全画像の背景はマゼンタ系だが、隅の RGB 値が #FF00FF ではなく画面内でも変動する。単色背景の必須条件は不合格。画像生成機能で背景のみ均一化する試行も同じ結果だったため、修正済みと扱わない。採用時は背景色の是正と再検品が必要。透過・縮尺合わせ・ゲーム組み込みは実施していない。

| 原画 | サイズ | SHA-256 | 画素寸法 | 左上背景 RGB |
|---|---:|---|---|---|
| `cat_belly_a.png` | 1,596,617 B | `7c9f526f50b502a1ed9252166977cbe261b23a690b3240bdc3cebf1e5574124c` | 1084×1451 | `(240, 13, 238)` |
| `cat_belly_b.png` | 1,546,247 B | `be0e4a5ca0a8d937850a51eef4d15a79d74ce49791baba2d7c012e6583bf8f64` | 1084×1451 | `(239, 13, 239)` |
| `cat_crouch_a.png` | 1,526,790 B | `80868aae1e4b3990836b3e165c12068a01f7ee643f9d8c430cb6f1ba8a641245` | 1672×941 | `(240, 16, 242)` |
| `cat_crouch_b.png` | 1,561,555 B | `45899183d2c8e1505d24686086f1ff6ad2e5aefbf89e79b83abd96b23408bd50` | 1536×1024 | `(242, 15, 243)` |
| `cat_groom_a.png` | 1,526,746 B | `9db53254fcec53040d73bbd1febf4ccb626f077ff88127824c24f23bda679dc0` | 1084×1451 | `(242, 13, 240)` |
| `cat_groom_b.png` | 1,629,302 B | `f8b4e535fcc45c56a3064579668a7dcb5f6ea1505490c8f33857981d75fa73dd` | 1084×1451 | `(242, 14, 241)` |
| `cat_hug_a.png` | 1,524,896 B | `5945b29414fa6312aa3ac053a128733b4a028f4d869ddac1d352a35753ce224a` | 1084×1451 | `(240, 14, 240)` |
| `cat_hug_b.png` | 1,480,876 B | `700c142cc3375b22f16fa403d002386a6b4945b1ded1949d4b18faa0c8632c4f` | 1084×1451 | `(239, 13, 240)` |
| `cat_loaf_a.png` | 1,724,626 B | `1db47c3a1fd026ac3923d65ec3e660cce2e03005e96d5983dd0a8606e993e40e` | 1536×1024 | `(241, 12, 241)` |
| `cat_loaf_b.png` | 1,656,787 B | `2c44b202978578e5d3da9cdd874c4919617b6675fc827e7ed49763d5ec701eee` | 1536×1024 | `(242, 17, 241)` |
| `cat_reach_a.png` | 1,643,405 B | `14217f76b17d52d2478d820baf0dcedfc4ccb4090af44f6b8a0fe3e23127eb47` | 1084×1451 | `(243, 13, 242)` |
| `cat_reach_b.png` | 1,562,314 B | `ad763fb5b677e4141d04b611414b2b5331018d7a1713f747d8a686f003efb53f` | 1084×1451 | `(240, 13, 241)` |
| `cat_rub_a.png` | 1,464,836 B | `e9689ac0fdfbe0c86d306c22563704730b6c48c5dbecbd57e15c3c4a8e66b0c6` | 1536×1024 | `(242, 15, 243)` |
| `cat_rub_b.png` | 1,613,198 B | `95d683a9ab2da0c1bcaf4e22a495819ebde6517b1b5e8156fab83659d0b1a5c7` | 1451×1084 | `(241, 13, 240)` |
| `cat_yawn_a.png` | 1,527,424 B | `b9a4deddb5fe743d811f3d7a893368f0b84c79c7c9038771c729da0b7c03ff1d` | 1084×1451 | `(241, 13, 241)` |
| `cat_yawn_b.png` | 1,528,639 B | `e38279fe1643f0a1165ca975b6899afbcd15b942fdc120dc9e5c860e5d007c36` | 1084×1451 | `(241, 15, 241)` |
