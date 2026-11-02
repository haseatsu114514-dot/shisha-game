# 第4章ドバイ・ラクダレース（CAMEL RACE）の画像素材 ── Codex への依頼（2026-11-02）

Claude は画像を生成しない。ここにある依頼文を Codex にコピペして生成し、届いた画像をこのフォルダに原画として保存してから組み込む。
仕様と用途は [docs/spec/camel_race.md](../../docs/spec/camel_race.md)。採用済みの絵が読めない環境では、`remake/js/minigames/camel-race.js` が Canvas の描画（ラクダ・ロボット騎手・SUV）に戻る。

共通の画風: `tools/bg_prompts.txt` の先頭の指針（`bg_eden_shop.png` を基準にした温かい2Dドット絵〜ピクセルペインター調。写真調・滑らかな3D調にしない）。立ち絵は `.claude/skills/character-portrait-remaster/SKILL.md`（1回の生成で1人・1表情・人物の高さ1300px以上・マゼンタ #FF00FF 背景）と `docs/prompts/image_generation_guide.md`。
焼き込み禁止（全素材共通）: 文字・ロゴ・数字・ゲージ・watermark。レース画面の順位・距離・スタミナ・合図の輪・PERFECT 等の表示はコードが描く。シーシャ台は写さない（この題材では機材の描写は不要）。実在の競走場・人物・車種のロゴを模写しない。

> 2026-11-02 CR08: レース画面のUI素材（順位の札・メダル・計器板・ゲージ・リモコンのボタン・出走表のカード・判子・遊び方の絵）の依頼は [ui-request.md](ui-request.md)。

## 採用の記録（2026-11-02）

Codex が2回に分けてギガファイル便で渡した候補から選んだ。1回目は PR #2304 のコメント（背景3・ラクダ3・騎手3・SUV3。ZIP SHA-256 `569ea24f…`）、2回目はオーナー経由（SUV の修正版・回転用の車輪・サイフとラシードの通常各3案。ZIP SHA-256 `ced7ee26…`）。どちらも同梱の SHA256SUMS と全ファイルが一致した。オーナー「確認して選定して」で Claude が選んだ。

| 素材 | 採用 | 理由 | ゲーム用 |
|---|---|---|---|
| CR-BG01 背景 | **A** | 文字・ロゴ・人影なし。手前の柵は立ち絵の後ろに隠れる。C のテント下の影は停めた車の影程度で、A が最も明るく見通しがよい | `assets/backgrounds/bg_dubai_camel_track_morning.png`（候補 1280×720 をそのまま） |
| CR-GM01 ラクダ | **A** | 4コマとも背の線（x=240）が 100〜101px で、ずれ 1px 以内。B は 27px、C は 15px 上下する。3コマ目の胴が詰まって見えるのは脚を引き寄せる瞬間で、実際のギャロップに近い | `assets/ui/camel_race/camel_{1..4}.png`（512×384） |
| CR-GM01 騎手 | **B** | いちばん簡潔な箱型。コブの頂点（x=260）の 45px 後ろ・背の線に鞍の底を合わせ、ラクダの 0.9 倍で自然に座ることを確認（`review/jockey-B-on-camel-A-fit.png`） | `assets/ui/camel_race/jockey.png`（160×160） |
| CR-GM02 SUV | **C の修正版（generic-v2）** | 1回目の3案は前の顔と背面のスペアタイヤが実在の車種にそっくりだったので、前の顔を四角い灯と平らなグリルにした修正版を採用。背面のスペアなし | `assets/ui/camel_race/suv.png`（720×360） |
| 回転用の車輪 | 採用 | 車体の車輪（後 167,259・前 581,259）の上に 137/160 倍で重ね、地面を流れる速さで回す | `assets/ui/camel_race/wheel.png`（160×160） |
| サイフ 通常 | **A** | 正本の「短く刈った黒髪・細い整えた髭・よく笑う」に最も近い（B は髪が長め、C は茶色がかった髪） | `assets/sprites/characters/saif/chr_saif_normal.png`（896×1200） |
| ラシード 通常 | **B** | 日焼けと深いしわ、口数の少ない調教師らしい硬い表情。小さなリモコンが見える | `assets/sprites/characters/rashid/chr_rashid_normal.png`（896×1200） |

- ゲーム用は Codex の候補（縮小と配置だけ・拡大なし）をそのまま使い、`tools/pixelize.py` は通していない（ヨルの立ち絵と同じ扱い）。WebP は `remake/tools/build_images.py` の `encode`、立ち絵と背景の目録は `build_manifest.py --portraits-only saif rashid` と `--backgrounds-only`。
- 立ち絵の顔の位置は `data/portrait_metrics.json` に記録した。**サイフ 8.62 頭身、ラシード 9.75 頭身で、規格（標準 6.4〜7.7）より頭が小さい**。既存のシェイク 8.88・太陽 9.08 と同じ帯で、CI は警告だけ。表情差分を作る前に、規格どおり約7頭身で通常を作り直すかはオーナー判断（`docs/portrait_standard.md`）。ラシードの頭頂はグトラの下なので推定（目〜あごの長さから）。
- **2026-11-02 オーナー「任せる」→ 作り直す。** 表情差分を作る前に、2人の通常を約7頭身で作り直す。依頼文は [standard-20261102/prompts.md の TS13](../portraits/standard-20261102/prompts.md)（頭の大きさを px で指定・画風は立ち絵の規格）。原画は `asset_sources/portraits/{saif,rashid}-remaster-v2/` に置く。下の CR-SP01・CR-SP02 は最初の依頼の記録で、画風の指定（「太い輪郭にしない」）が規格より前のもの。新しく作るときは TS13 を使う。
- 顔アイコンは `python3 tools/make_face_icons.py saif rashid`。サイフは身長 183cm なので `spriteScale` 1.05（スミ 182cm と同じ）。
- 表情差分は未制作。台本の smile／surprise／excited／wink は、無い表情として normal で表示される。
- 不採用の候補は `review/` の比較図（contact-1〜3・saif/rashid-comparison・suv-wheel-sand）に残す。採用分の原画は `originals/`。生成指示と検証は `review/*.json`。

| 原画（`originals/`） | 寸法 | SHA-256 |
|---|---|---|
| `CR-BG01-A.png` | 1672×941 | `d0addb7a80fd271c1b26c663dfb020f5f2caaa06314bccb49ea753759e87deb2` |
| `CR-GM01-camel-A.png` | 1448×1086（2×2） | `cc4324d90bd3c7fe22346cd6842a4e1c3a326528421f4579d18afe8604a4213a` |
| `CR-GM01-jockey-B.png` | 1254×1254 | `cdfd2055067174fa41475a9a97948c5c0e9b05f1aa97bd48ad4b496aab2f7804` |
| `CR-GM02-C-generic-v2.png` | 1774×887 | `24d918323aa19c5af57b077b63b505fde86b511d013a6b1d127f52d282a806ad` |
| `CR-GM02-wheel.png` | 1254×1254 | `43d888db865649b8e3fd1ef9b736fd05f30b377392dbcb5be2bd723a2f058dd5` |
| `saif-normal-A-v2.png` | 887×1774 | `0308bfb8af01fc40a2a0b8a5af5bfe375740fd0b5ab30152e75095b016f676d5` |
| `rashid-normal-B.png` | 887×1774 | `d2c02f934120075cec198a64e96e87a80146e4f0882e8538dd29a1f9faafa33b` |

## 一覧

| ID | ファイル名（保存先） | 用途・使う場所 | サイズ・透過 | 必要なパーツ |
|---|---|---|---|---|
| CR-BG01 | `assets/backgrounds/bg_dubai_camel_track_morning.png` | 見学・結果・再挑戦の会話の背景（`ch4-camel-progress.js` の `CAMEL_TRACK_BG`。今は `bg_dubai_map` を流用） | 1280×720・不透過 | 砂漠のレースコース、柵、白い日よけテント、朝の光。人物なし。中央下は立ち絵のため空ける |
| CR-SP01 | `assets/sprites/characters/saif/chr_saif_{normal,smile,surprise,excited,wink}.png` | 会話の立ち絵（話者 `saif`） | 原画は人物1300px以上・マゼンタ背景。`tools/pixelize.py --char saif` で 896×1200 透過へ | 通常／笑顔／驚き／熱弁（excited）／ウインク。店のポロシャツ姿1セット |
| CR-SP02 | `assets/sprites/characters/rashid/chr_rashid_{normal,smile}.png` | 会話の立ち絵（話者 `rashid`） | 同上 | 通常／笑顔（口元だけ少し緩む）。カンドゥーラ＋砂色ベスト＋グトラ |
| CR-GM01 | `assets/ui/camel_race/camel_body_{1..4}.png`・`camel_jockey.png` | レース画面のラクダ（自分・AI 3頭は色相を変えて使う）とロボット騎手 | 各 512×384・透過 PNG。騎手は 160×160・透過 | 側面（右向き）走りの4コマ（脚の位相違い）。騎手は別レイヤーで、こぶの後ろに座る位置で合成 |
| CR-GM02 | `assets/ui/camel_race/suv_side.png` | 並走する白いSUV | 720×360・透過 | 側面（右向き）。運転席側の窓から調教師が腕を出し、小さなリモコンのアンテナ。車輪は別レイヤーでも可（回転はコード） |
| CR-GM03 | `assets/ui/camel_race/dust_{1..3}.png`・`finish_gate.png`・`tent.png` | 砂煙（任意）・ゴールゲート・テント | 砂煙 256×256 透過×3、ゲート 400×480 透過、テント 320×240 透過 | 砂煙は輪郭の柔らかい塊3種。ゲートは FINISH の横断幕だが**文字は描かない**（コードで描く） |
| CR-GM02-v3 | `assets/ui/camel_race/suv.png`（差し替え） | 並走する白いSUV。**リモコンを持つのは後ろの窓のはじめ**（オーナー「何で今はじめがリモコンじゃないんだっけ」2026-11-02） | 720×360・透過（今の絵と同じ寸法・同じ車体の位置） | 今の絵は運転席のラシードが窓からリモコンを出している（最初の依頼が本番レースの調教師の姿だったため）。練習レースではリモコンをはじめに貸しているので、ラシードは両手でハンドルを握るだけにし、後ろのドアの窓は下ろして空けておく（はじめは CR-GM04 をコードで重ねる）。車輪は今と同じ別レイヤー |
| CR-GM04 | `assets/ui/camel_race/hajime_window_{normal,shout}.png` | SUV の後ろの窓から身を乗り出すはじめ（今は立ち絵の切り抜きで代用。オーナー「車がはじめが見えない」2026-11-02） | 各 320×320・透過 | 横向き（右）の上半身。黒いキャップと黒いパーカー。片手に小さなリモコン（短いアンテナ）。通常と、口を開けて叫ぶ顔の2枚。窓の下の縁より下は描かない（車体で隠す） |

## 依頼文（コピペ用）

### CR-BG01 背景

`tools/bg_prompts.txt` の「CR01/1: bg_dubai_camel_track_morning.png」をそのまま使う。

### CR-SP01 サイフ（マスター1枚 → 表情を1枚ずつ）

> 旧依頼（記録）。作り直し・表情差分は prompts.md の TS13 を使う。

```
ゲームの立ち絵用キャラクターイラストを1枚。
【キャラ】24歳のエミラティの青年。背が高く細身、浅黒い肌、短く刈った黒髪に細い整えた髭。大きな目でよく笑う。
Dr.fookah のスタッフの黒いポロシャツ（胸に小さなロゴの位置だけ・文字は描かない）と砂色のチノパン、手首に細い革の紐。片手に葉の缶。
明るく人をからかうが、相手の話を本気で聞く人なつこい雰囲気。実在の人物に似せない。
【構図】全身、正面やや斜め、直立。人物の高さは1300px以上。
【画風】採用済みのみんと・アゲハの立ち絵と同じ高密度のドット絵調（太い輪郭にしない）。
【背景】完全な単色マゼンタ(#FF00FF)。キャラの影や光を背景に落とさないこと。
画面に文字・ロゴ・フレームを入れないこと。
```

表情（マスター画像を添付して1枚ずつ）: 笑顔（smile）／驚き（surprise・目を見開く）／熱弁（excited・両手で葉の缶くらいの大きさを作る）／ウインク（wink）。

```
添付画像とまったく同一の人物・画風・服装・頭身で、表情だけを（表情名）に変えた全身の立ち絵を1枚。
人物の高さは1300px以上。背景は単色マゼンタ(#FF00FF)。文字を入れない。
```

### CR-SP02 ラシード（マスター1枚 → 笑顔）

> 旧依頼（記録）。作り直し・表情差分は prompts.md の TS13 を使う。

```
ゲームの立ち絵用キャラクターイラストを1枚。
【キャラ】56歳のエミラティの男性。日に焼けた顔に深いしわ、白いものが混じる短い髭。白いカンドゥーラの上に古い砂色のベスト、
頭に白と赤の格子のグトラを無造作に巻く。片手に車のキーほどの小さなリモコン。口数の少ない調教師の落ち着き。実在の人物に似せない。
【構図】全身、正面やや斜め、直立。人物の高さは1300px以上。
【画風】採用済みのみんと・アゲハの立ち絵と同じ高密度のドット絵調（太い輪郭にしない）。
【背景】完全な単色マゼンタ(#FF00FF)。キャラの影や光を背景に落とさないこと。
画面に文字・ロゴ・フレームを入れないこと。
```

### CR-GM01 ラクダとロボット騎手（ゲーム内スプライト）

```
Game sprite sheet asset, side view facing right, high-density pixel-painter style matching the game's portraits (no thick outlines, no photo realism, no glossy 3D).
A racing dromedary camel (one hump) in full gallop, drawn as 4 separate frames of the leg cycle, each frame 512x384 on a fully transparent background, the camel's body in the same position in every frame (only legs, neck bob and tail change). Light sand-colored coat, long legs, neck raised and head held forward. NO rider on the camel in these frames.
Separately, a small robot jockey as its own 160x160 transparent sprite: a light grey box-shaped body about the size of a small backpack, a rounded white head with a blue visor, a thin antenna with a small red light, one thin mechanical arm holding a short soft whip, strapped on a dark red saddle pad. Drawn to sit just behind the camel's hump.
No text, no logos, no numbers, no ground shadow (the game draws shadows), no background.
```

### CR-GM02 SUV

```
Game sprite asset, side view facing right, 720x360, fully transparent background, high-density pixel-painter style (no thick outlines, no photo realism).
A white desert SUV driving fast on a sand track, seen from the side. Tinted windows; from the front passenger window a man in a white kandura leans out holding a small remote controller with a short antenna. Wheels drawn as separate circles so they can be rotated by code. Slight dust is NOT needed (the game draws dust). No brand badges, no license plate text, no logos, no text.
```

### CR-GM02-v3 SUV（ラシードは運転だけ・後ろの窓は空ける）

今の `assets/ui/camel_race/suv.png` を添付し、車体の形・大きさ・位置・車輪の位置を変えないように頼む。

```
Edit the attached game sprite (image 1, a white SUV, side view facing right, 720x360, transparent background). Keep the car body, its exact size and position on the canvas, the colors, the painterly pixel style and the wheel positions identical. Change only the people: the driver (a 56-year-old Emirati man in a white kandura and a red-and-white checkered ghutra) sits normally with BOTH hands on the steering wheel; remove his arm, hand and the remote controller from the window. Roll the rear side door window fully down so its opening is empty and clear (a passenger will be drawn there separately by the game). No other passengers, no remote controller anywhere, no text, no logos, no license plate text, no dust.
```

### CR-GM04 窓から身を乗り出すはじめ

正本の立ち絵 `assets/sprites/characters/hajime/chr_hajime_normal.png` を本人の参照として添付する。

```
Game sprite asset, 320x320, fully transparent background, same hand as the game's character sprites (Japanese 2D visual-novel art, confident dark outlines, flat colors with two to three cel-shadow steps; no glossy 3D, no photo realism).
The attached image is the canonical character Hajime: keep his face, black baseball cap, black zip hoodie over a black T-shirt and his age exactly. Draw ONLY his upper body leaning out of a car's rear side window toward the right (three-quarter view facing right), from the top of the cap down to just below the chest, cut off flat at the bottom where the window sill will hide him. One hand holds a small black key-fob sized remote controller with a short antenna, raised near his face as if calling into it. Two separate images: (1) focused, mouth closed; (2) shouting with an open mouth and a determined face. No car, no window frame, no text, no logos, no watermark.
```

### CR-GM03 砂煙・ゴールゲート・テント

```
Game effect/prop sprites, fully transparent backgrounds, high-density pixel-painter style.
1) Three soft sand-dust puffs, 256x256 each, pale sand color with soft edges, different shapes, no hard outline.
2) A camel-race finish gate, 400x480: two dark wooden posts with a plain white banner across the top (leave the banner blank, no letters), small flags on the posts.
3) A white sun-shade tent of a desert racetrack, 320x240, side view, simple poles, no people, no text.
```

## 受け取った後（こちら側の作業）

1. 原画をこのフォルダに保存（`originals/`）。生成に使った実際のプロンプトと日付を `generation.json` に残す。
2. 背景: `python3 tools/pixelize.py <原画> --key none --grid 360 --out assets/backgrounds/bg_dubai_camel_track_morning.png` → `ch4-camel-progress.js` の `CAMEL_TRACK_BG` を差し替え → `python3 remake/tools/build_manifest.py`。
3. 立ち絵: `python3 tools/pixelize.py <原画> --char saif`（rashid も同じ）→ portrait-fix スキルの位置合わせ → `build_manifest.py` → 会話で確認。
4. ゲーム内スプライト: `remake/js/minigames/camel-race.js` の `drawCamel`／`drawSuv`／砂煙を画像描写へ差し替え（画像が無い環境では今の Canvas 描写に戻すフォールバックを残す）。
5. `node remake/test/browser/ch4_camel_race.mjs` と試遊ページで PC／スマホ横持ちを確認。
