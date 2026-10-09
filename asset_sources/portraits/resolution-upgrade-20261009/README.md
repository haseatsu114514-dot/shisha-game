# 立ち絵の画質そろえ：Codex依頼（2026-10-09・未着手）

オーナー指示「画質がみんな同じでかつ身長矛盾しないようにしたい」「必要であれば後々差し替える」「生成のし直しが必要ならコーデックス用に依頼を作っておいて」。
**デザイン・表情・ポーズ・身長は変えず、描き込みの細かさ（解像度）だけを、くっきりしているキャラにそろえる**ための依頼。
採用済みの立ち絵を差し替えるのはオーナーが確認・採用してから。この文書は依頼の準備で、まだ生成していない。

## なぜ画質に差があるか（調査結果）

ゲームは立ち絵の余白に関係なく、全身の高さを `spriteScale`（身長設定 ÷ はじめ172cm）に比例させて表示する（`remake/js/vn/engine.js` の `frame()`）。
表示倍率は全員ほぼ同じ（はじめ＝1.00 に対して 0.90〜1.03）なので、差の原因は**生成した原画の解像度**。

- 5表情を**横1枚のシート**で作ったキャラは、人物1人が高さ約800〜880pxしかない。それをゲーム用の896×1200へ**1.2〜1.4倍に引き伸ばした**ため、線が太めで少しぼやける。
- **1人ずつ縦長**で作ったキャラ（凛・サメちゃん）や、引き伸ばしの少ないキャラ（つむぎ・みんと）はくっきりしている。

| キャラ | 原画の人物の高さ | ゲーム用の高さ | 引き伸ばし | 表示1単位あたりの原画の細かさ（大きいほど精細） | 判定 |
|---|---|---|---|---|---|
| 凛 | 1407px（1人ずつ縦長） | 1004px | 0.71倍（縮小） | 1450 | 基準より精細 |
| サメちゃん | 925px | 913px | 0.99倍 | 1016 | 基準 |
| つむぎ | 886px | 878px | 0.99倍 | 1007 | 基準 |
| みんと（私服） | 887px | 948px | 1.07倍 | 975 | 基準 |
| ましろ | 793px | 905px | 1.14倍 | 881 | 対象B |
| なる | 887px | 1058px | 1.19倍 | 870 | 対象B |
| はじめ | 861px | 1023px | 1.19倍 | 861 | 対象B |
| 博士 | 877px | 1098px | 1.25倍 | 860 | 対象B |
| アダム | 871px | 1056px | 1.21倍 | 846 | 対象B |
| 前園 | 819px | 1116px | **1.36倍** | 836 | **対象A（目で見ても一番ぼやける）** |
| 南雲 | 846px | 1119px | **1.32倍** | 821 | **対象A** |
| スミさん | 852px | 1079px | **1.27倍** | 811 | **対象A** |

- 「表示1単位あたりの原画の細かさ」＝原画の人物の高さ ÷ spriteScale。画面上で同じ高さに換算したときの描き込みの量。
- みんと営業姿・アゲハ・パッキーは原画シートがリポジトリに無く未計測（同時期のみんと私服から、引き伸ばしは小さいと推定）。依頼対象には入れていない。
- 身長は今回 `data/dialogue/kafuka.json` のサメちゃんの `spriteScale` を 1 → 0.91（156cm）へ直し、全員が身長設定どおりになった。背比べ図は [height-lineup.png](../../reference-sheets/height-lineup.png)。**画質の作り直しでは身長・表示倍率は変えない。**

## 依頼の方針

1. **1回の生成で1人・1表情**。縦長（約1085×1450）で、人物の高さを**1300px以上**にする（凛v12と同じ作り方）。5表情を横1枚に並べると人物が小さくなるので、シートでは作らない。
2. **新しく描き起こさない。いまの採用済み画像を「編集」して高解像度化する。** 顔・髪・衣装・小物・表情・手や肩の位置・頭身はそのまま。
3. 優先順：**A（前園→南雲→スミさん）**を先に。Aの結果を見てから、B（はじめ・アダム・なる・博士・ましろ）を続けるか決める。
4. 1キャラ5表情を作り終えたら、5枚を並べて顔が同じ人物かを確認してから提示する。

## 添付する画像（役割をプロンプトに書く）

| 番号 | 画像 | 役割 |
|---|---|---|
| 1 | 対象の表情の現行PNG `assets/sprites/characters/<id>/chr_<id>_<face>.png` | **最優先。** 人物・表情・ポーズ・衣装・頭身をこのとおりに |
| 2 | 同じキャラの通常 `chr_<id>_normal.png` | 顔の同一性の補助（通常の依頼では1と同じなので省略可） |
| 3 | 凛 `assets/sprites/characters/rin/chr_rin_normal.png` | **画質・線の細かさだけ**の参照（1人ずつ高解像度で作った例） |
| 4 | みんと `assets/sprites/characters/minto/chr_minto_normal.png` | **画質・陰影の段階だけ**の参照（採用済みの基準） |

3・4の顔・髪・体型・衣装は写さない。

## Codexに貼る文（表情ごとに `<…>` を差し替えて1回ずつ）

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Character: <CHARACTER LINE>
Expression to keep exactly as image 1: <EXPRESSION LINE>

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality — fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from hair top to shoe bottom. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background (also between limbs). No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.
```

### キャラごとの差し替え文

**前園**（5表情：normal / smile / serious / surprise / excited）
- CHARACTER LINE：`Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.`
- EXPRESSION LINE（現行画像のとおり）：
  - normal：`gentle small closed-mouth smile, SCREEN-LEFT hand lifted in greeting, SCREEN-RIGHT hand in pocket`
  - smile：`both eyes closed, joyful open-mouth smile, same greeting hand`
  - serious：`thoughtful brows, SCREEN-LEFT hand against chin, SCREEN-RIGHT hand in pocket`
  - surprise：`round open eyes, small O-shaped mouth, SCREEN-LEFT palm raised, SCREEN-RIGHT hand in pocket`
  - excited：`both eyes open, big delighted open-mouth grin, SCREEN-LEFT fist near shoulder, SCREEN-RIGHT fist near waist, leaning forward slightly`

**南雲**（5表情：normal / smile / serious / surprise / thinking）
- CHARACTER LINE：`Nagumo, 45-year-old stern Japanese male executive and judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.`
- EXPRESSION LINE：各表情の現行画像のとおり（顔・手の位置を画像1から読み取る）と書く。

**スミさん**（5表情：normal / smile / serious / surprise / thinking）
- CHARACTER LINE：`Sumi (Sumida Joichiro), 46-year-old Japanese male shisha shop owner, black flat cap, black rectangular glasses, short stubble beard and moustache, warm tan skin, black shirt with rolled sleeves, long brown work apron, black slacks and black leather shoes.`
- EXPRESSION LINE：各表情の現行画像のとおり。thinking は顎ひげに手、反対の腕で肘を支える。

（Bを進めるときは、各キャラの `asset_sources/portraits/<id>-remaster-v1/prompt.txt` から人物の行を写して同じ形で追加する。）

## 生成後チェック（1枚ごと）

- [ ] 原画の人物の高さが1300px以上。透過がきれい（手足の間も）
- [ ] 現行画像と並べて、顔・表情・手と肩の位置・衣装・小物・頭身が変わっていない（重ねて見比べる）
- [ ] 線が細くくっきりし、ぼやけ・のっぺり・粗いドット・AI的な艶が出ていない（凛・みんとと原寸で比べる）
- [ ] 1キャラの5枚が同じ人物に見える

## 受け取った後（こちら側）

1. 原画を `asset_sources/portraits/<id>-resolution-v1/` に保存し、プロンプト・参照・ハッシュを記録する。
2. 896×1200へ**縮小**して配置する。人物の高さ・足元の位置（下端）・左右の位置は現行PNGに合わせる（`spriteScale` は変えない）。
3. オーナーの採用後に `assets/sprites/characters/<id>/` を差し替え、`python3 remake/tools/build_manifest.py`、`python3 tools/make_face_icons.py <id>`、`python3 tools/make_reference_sheet.py` を実行する。
4. 会話画面で表情を切り替え、立ち位置のずれ・見切れが無いかを確認する（portrait-fix スキル）。
