# 立ち絵の画質・顔の大きさ・画風そろえ（2026-10-10・制作記録）

オーナー指示「画質がみんな同じでかつ身長矛盾しないようにしたい」「必要であれば後々差し替える」「生成のし直しが必要ならコーデックス用に依頼を作っておいて」。
**デザイン・表情・ポーズ・身長は変えず、描き込みの細かさ（解像度）だけを、くっきりしているキャラにそろえる**ための依頼。
2026-10-10に「立ち絵そろえ」を実行。最初の通常3枚への「いいと思います」と、続く「一旦確認もそこまでいらないからガンガン進めて」により、残りの検品・組み込みまで委任を受け、6人34表情の制作・組み込み・PC／スマホ確認を完了した。進捗は [progress.md](progress.md)、実行英文は各 `<id>-remaster-v2/<face>-prompt.txt`、生成原画・参照4枚のSHA256・試行履歴・原寸検品は各 `generation.json` に記録した。

## 制作結果と確認画像

[PR #259](https://github.com/haseatsu114514-dot/shisha-game/pull/259) に制作・組み込み・検証結果をまとめた。

- 全34枚の無加工原画はRGBAで、人物高1325〜1444px。ゲーム用896×1200へ縮小し、元の人物高・足元に合わせて配置した。身長設定と `spriteScale` は変更していない。
- つむぎ7表情はPU05に従って元の小柄な頭身へ再制作。ましろ6表情はPU04の少し大きめの丸い顔・頬を保持した。採用前の候補も `attempts/` に保存し、採用した試行番号を `generation.json` に記録した。
- 色の基準は各表情の元絵。原画への彩度・明度加工は行っていない。全34枚で表示用WebPとゲーム用PNGのRGBA画素が完全一致することを検証した。
- 表情切り替え時の位置ずれは9枚だけ画像全体を横へ3〜7px移動して補正。顔アイコン6枚、設定用シート6枚、顔サイズ比較・背比べ図も更新した。
- 実際の会話画面で34表情×PC（1280×720）／スマホ（591×1280）の計68表示を検証。読み込み失敗・ページエラー・画像端の欠け・頭の見切れは0。表情切り替え時の配置枠も固定された。

[PC・全34表情](qa/game-all34-1280.jpg) ／ [スマホ・全34表情](qa/game-all34-591.jpg) ／ [顔アイコン一覧](qa/face-icons-sheet.png)

スマホ一覧はゲームの16:9表示部分を切り出して比較している。通常絵は6人とも加工していない画面全体のスクリーンショットも保存した：
[つむぎ・PC](qa/tsumugi-1280-normal.png) ／ [つむぎ・スマホ](qa/tsumugi-591-normal.png) ／ [ましろ・PC](qa/mashiro-1280-normal.png) ／ [ましろ・スマホ](qa/mashiro-591-normal.png)。

[つむぎ7表情の設定用シート](../../reference-sheets/tsumugi/tsumugi-reference-sheet.png) ／ [ましろ6表情の設定用シート](../../reference-sheets/mashiro/mashiro-reference-sheet.png)

全原画と生成ツール出力のSHA256、参照・プロンプト、元絵のバックアップ、縮小後の画素と横移動、PNG／WebPの画素一致を検証した結果は [production-qa.json](production-qa.json)。会話画面の実測値は [browser-measurements.json](qa/browser-measurements.json)。再確認コマンド：

```bash
python3 remake/tools/serve_preview.py --port 8123
CHROME_BIN=/usr/bin/chromium SHOTS=/tmp/portrait-qa node remake/test/portrait_unify.mjs
```

## 2026-10-10の実制作で優先する指定

- 対象はつむぎ7、サメちゃん6、上園5、スミさん5、ましろ6、南雲5の計34表情。各原画は無加工で保存し、人物1300px以上・透過・元絵との原寸比較を検品する。ゲーム用は896×1200のまま、元の人物高と足元に合わせて縮小・配置する。
- つむぎはPU05により頭身変更を撤回。元の大きめの丸い頭、小柄な体格、短い胴と脚へ戻し、解像度と画風だけをそろえる。参照②にも元の通常絵を使い、体格を変えた候補から再生成を重ねない。
- ましろはPU04により少し大きめの丸い顔・ふっくらした頬・眠そうな可愛さを優先。以前の8%縮小は強制しない。
- 色は常に各表情の元のランタイム画像を基準にする。生成候補を色の基準にして、繰り返すたびに薄くしない。採用原画への後付けの彩度・明度加工は行わない。
- 実際に使った参照の役割は `generation.json` が正本。女性はみんと・アゲハ、男性はアダム・みんとを参照する。旧調査・旧ひな形にある凛参照や±10%判定より、PU04・PU05と実行記録を優先する。

以下は依頼を作成した2026-10-09時点の調査とひな形。原画の旧解像度や旧目標は履歴として残す。

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
| 上園 | 819px | 1116px | **1.36倍** | 836 | **対象A（目で見ても一番ぼやける）** |
| 南雲 | 846px | 1119px | **1.32倍** | 821 | **対象A** |
| スミさん | 852px | 1079px | **1.27倍** | 811 | **対象A** |

- 「表示1単位あたりの原画の細かさ」＝原画の人物の高さ ÷ spriteScale。画面上で同じ高さに換算したときの描き込みの量。
- みんと営業姿・アゲハ・パッキーは原画シートがリポジトリに無く未計測（同時期のみんと私服から、引き伸ばしは小さいと推定）。依頼対象には入れていない。
- 身長は今回 `data/dialogue/samechan.json` のサメちゃんの `spriteScale` を 1 → 0.91（156cm）へ直し、全員が身長設定どおりになった。背比べ図は [height-lineup.png](../../reference-sheets/height-lineup.png)。**画質の作り直しでは身長・表示倍率は変えない。**

## 依頼の方針（2026-10-09 オーナー決定で更新）

**画質・顔の大きさ・画風を1回の作り直しでまとめて直す。** 対象は、ゲーム画面での顔の大きさが中央値から±10%を超える6人：つむぎ・上園・スミさん・ましろ（大きい）、南雲・サメちゃん（小さい）。画風はみんと・アゲハに合わせる（サメちゃんのつやの強い塗り、上園の平たい塗りを基準へ）。
顔の大きさの比較は [face-size-ingame.png](../../reference-sheets/face-size-ingame.png)。完成版のプロンプト（34表情）は [prompts.md](prompts.md)。

1. **1回の生成で1人・1表情**。縦長（約1085×1450）で、人物の高さを**1300px以上**にする。
2. いまの採用済み画像を「編集」する。顔立ち・表情・ポーズ・衣装は変えず、変えるのは解像度・頭の大きさ・画風の3点だけ。全身の高さ（身長）は変えない。
3. 1キャラの全表情を作り終えたら、並べて同じ人物・同じ頭の大きさかを確認してから提示する。
4. 上の表で「対象B」としたキャラ（はじめ・アダム・なる・博士）は、顔の大きさが±10%以内なので今回は対象外。ぼやけが気になったら同じ形で追加する。

## 添付する画像（役割をプロンプトに書く）

| 番号 | 画像 | 役割 |
|---|---|---|
| 1 | 対象の表情の現行PNG `assets/sprites/characters/<id>/chr_<id>_<face>.png` | **最優先。** 人物・表情・ポーズ・衣装・頭身をこのとおりに |
| 2 | 同じキャラの通常 `chr_<id>_normal.png` | 顔の同一性の補助（通常の依頼では1と同じなので省略可） |
| 3 | 凛 `assets/sprites/characters/rin/chr_rin_normal.png` | **画質・線の細かさだけ**の参照（1人ずつ高解像度で作った例） |
| 4 | みんと `assets/sprites/characters/minto/chr_minto_normal.png` | **画質・陰影の段階だけ**の参照（採用済みの基準） |

3・4の顔・髪・体型・衣装は写さない。

> **そのまま貼れる完成版（6人・34表情）とチャットでの手順は [prompts.md](prompts.md)。** 以下は画質だけを上げる旧ひな形（対象外のキャラを追加するとき用）。

## ひな形（表情ごとに `<…>` を差し替えて1回ずつ）

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Character: <CHARACTER LINE>
Expression to keep exactly as image 1: <EXPRESSION LINE>

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality — fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from hair top to shoe bottom. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background (also between limbs). No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.
```

### キャラごとの差し替え文

**上園**（5表情：normal / smile / serious / surprise / excited）
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

1. 原画を `asset_sources/portraits/<id>-remaster-v2/` に保存し、プロンプト・参照・ハッシュを記録する。
2. 896×1200へ**縮小**して配置する。人物の高さ・足元の位置（下端）・左右の位置は現行PNGに合わせる（`spriteScale` は変えない）。
3. オーナーの採用後に `assets/sprites/characters/<id>/` を差し替え、`python3 remake/tools/build_manifest.py`、`python3 tools/make_face_icons.py <id>`、`python3 tools/make_reference_sheet.py`（`facesize` で顔の大きさが±10%以内になったか確認）を実行する。
4. 会話画面で表情を切り替え、立ち位置のずれ・見切れが無いかを確認する（portrait-fix スキル）。
