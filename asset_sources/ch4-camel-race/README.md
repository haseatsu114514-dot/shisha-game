# 第4章ドバイ・ラクダレース（CAMEL RACE）の画像素材 ── Codex への依頼（2026-11-02）

Claude（Fable）は画像を生成しない。ここにある依頼文を Codex にコピペして生成し、届いた画像をこのフォルダに原画として保存してから組み込む。
仕様と用途は [docs/spec/camel_race.md](../../docs/spec/camel_race.md)。届くまでゲームは `remake/js/minigames/camel-race.js` の Canvas 描写（砂漠・ラクダ・ロボット騎手・SUV・砂煙）で動く。

共通の画風: `tools/bg_prompts.txt` の先頭の指針（`bg_eden_shop.png` を基準にした温かい2Dドット絵〜ピクセルペインター調。写真調・滑らかな3D調にしない）。立ち絵は `.claude/skills/character-portrait-remaster/SKILL.md`（1回の生成で1人・1表情・人物の高さ1300px以上・マゼンタ #FF00FF 背景）と `docs/prompts/image_generation_guide.md`。
焼き込み禁止（全素材共通）: 文字・ロゴ・数字・ゲージ・watermark。レース画面の順位・距離・スタミナ・合図の輪・PERFECT 等の表示はコードが描く。シーシャ台は写さない（この題材では機材の描写は不要）。実在の競走場・人物・車種のロゴを模写しない。

## 一覧

| ID | ファイル名（保存先） | 用途・使う場所 | サイズ・透過 | 必要なパーツ |
|---|---|---|---|---|
| CR-BG01 | `assets/backgrounds/bg_dubai_camel_track_morning.png` | 見学・結果・再挑戦の会話の背景（`ch4-camel-progress.js` の `CAMEL_TRACK_BG`。今は `bg_dubai_map` を流用） | 1280×720・不透過 | 砂漠のレースコース、柵、白い日よけテント、朝の光。人物なし。中央下は立ち絵のため空ける |
| CR-SP01 | `assets/sprites/characters/saif/chr_saif_{normal,smile,surprise,excited,wink}.png` | 会話の立ち絵（話者 `saif`） | 原画は人物1300px以上・マゼンタ背景。`tools/pixelize.py --char saif` で 896×1200 透過へ | 通常／笑顔／驚き／熱弁（excited）／ウインク。店のポロシャツ姿1セット |
| CR-SP02 | `assets/sprites/characters/rashid/chr_rashid_{normal,smile}.png` | 会話の立ち絵（話者 `rashid`） | 同上 | 通常／笑顔（口元だけ少し緩む）。カンドゥーラ＋砂色ベスト＋グトラ |
| CR-GM01 | `assets/ui/camel_race/camel_body_{1..4}.png`・`camel_jockey.png` | レース画面のラクダ（自分・AI 3頭は色相を変えて使う）とロボット騎手 | 各 512×384・透過 PNG。騎手は 160×160・透過 | 側面（右向き）走りの4コマ（脚の位相違い）。騎手は別レイヤーで、こぶの後ろに座る位置で合成 |
| CR-GM02 | `assets/ui/camel_race/suv_side.png` | 並走する白いSUV | 720×360・透過 | 側面（右向き）。運転席側の窓から調教師が腕を出し、小さなリモコンのアンテナ。車輪は別レイヤーでも可（回転はコード） |
| CR-GM03 | `assets/ui/camel_race/dust_{1..3}.png`・`finish_gate.png`・`tent.png` | 砂煙（任意）・ゴールゲート・テント | 砂煙 256×256 透過×3、ゲート 400×480 透過、テント 320×240 透過 | 砂煙は輪郭の柔らかい塊3種。ゲートは FINISH の横断幕だが**文字は描かない**（コードで描く） |

## 依頼文（コピペ用）

### CR-BG01 背景

`tools/bg_prompts.txt` の「CR01/1: bg_dubai_camel_track_morning.png」をそのまま使う。

### CR-SP01 サイフ（マスター1枚 → 表情を1枚ずつ）

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
