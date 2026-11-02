# DESERT RIDE — 第4章ドバイ編・サンドボードのミニゲーム（2026-11-02）

オーナー依頼（2026-11-02）: 第4章ドバイ編の14日間の自由行動（#2273・#2021）で遊べる任意の寄り道として、現地の人と仲良くなったきっかけで砂漠へ遊びに行くサンドボードのアクションミニゲームを作る。14日化が未完成なので、独立したミニゲームとして完成させ、今の第4章（到着日〜前夜日の自由行動）に昼の寄り道として接続した。旧5日構成の固定日数には依存しない。

- ゲーム本体: `remake/js/minigames/desert-ride-model.js`（規則・採点、DOMなし）／`remake/js/minigames/desert-ride.js`（Canvas の疑似3D・入力・HUD・練習・リザルト）／`remake/css/desert-ride.css`
- 本編接続: `remake/js/chapters/ch4-desert-progress.js`（進み具合・記録・地図の行き先。純粋関数）／`remake/js/chapters/ch4-desert.js`（会話・外出・保存）／`remake/js/chapters/ch4-map-model.js`（行き先を1行で追加）／`remake/js/chapters/ch4.js`（`visit()` の分岐1つ）
- 台詞: `data/dialogue/ch4_desert.json`。人物: `data/characters.json` の `noor`（`brand/character_profiles.md` の「ヌール」）
- 単体ページ: `http://127.0.0.1:8123/remake/desert-ride.html`（本編の保存を読み書きしない。自己ベストはページ専用の localStorage）
- 検証: `node --test remake/test/desert_ride.mjs remake/test/ch4_desert.mjs`、`node remake/test/browser/desert_ride.mjs`（プレビューサーバーが必要）。CI は `desert-ride-rules`（quick）と `desert-ride`（browser）

## 1. ストーリー（現地ガイド「ヌール」）

宿の隣に砂漠ツアーのデスクがあり、現地の女性ガイド **ヌール**（27・`noor`）が座っている。日本の観光客から覚えた日本語の単語（「アツイ」「スゴイ」「ヤクソク」）を混ぜて話す、よく笑う人。好感度・恋愛・LIMEの対象にしない（斧崎マキ・六角サイ・針間ヨルと同じ「街の遊び場の店主」の扱い）。

| 回 | 場面 | 内容 |
|---|---|---|
| 1 | `ch4_noor_meet` | 壁の写真を見ていたはじめに声をかける。名乗り（`_met_noor` → 登場カットイン）。日本から世界大会に出に来たと話す。「暇な日にまたおしゃべりしに来て」 |
| 2 | `ch4_noor_talk2` | 砂丘の道は風で毎日変わる、砂を見てその日の線を決めるという仕事の話。大会前は「準備は順調？ ここのお客さんは正直」、大会後（`tournament_finished` 章4）は「父が日本の子がすごかったって」。「見せたいものがある」 |
| 3 | `ch4_noor_invite` | デスクにサンドボード。「砂の上を、滑る？」。「せっかくドバイに来たなら、砂漠へ行こう」。日本語の練習台になる約束。読了で地図に「ヌールと砂丘へ」 |
| 外出 | `ch4_desert_arrive` → ゲーム → `ch4_desert_sunset_first` | 四輪駆動で砂丘へ。足は肩幅・先の砂を見る・起伏の手前で膝を伸ばす・着地の直前に膝を曲げる。練習→本番。夕日の砂丘で「大会のこと、今日は一度も考えなかった」。大会前は「顔が変わった」、大会後は「アリガトウ」。教訓は押しつけない |
| 2回目以降 | `ch4_desert_again` → ゲーム → `ch4_desert_sunset_again` | 短い到着と、日が沈むまで砂を見る |

会話は1日1つ（同じ日は「今日はもう話した」）。3回目までは「デスクをのぞく／ヌールと話す」、誘われた後はデスクが地図から消えて「ヌールと砂丘へ（サンドボード）」に替わる。今の5日構成では DAY1・2・3 で話して DAY3 から行ける。14日化の後も同じ関数のまま、ゆとりが増えるだけ。

## 2. 遊び方

後方視点の疑似3D（Canvas 1280×720）。砂丘の1本のコース（`DEFAULT_SEED = 7`、約1,700m・45〜60秒）を自動で滑り下りる。

| 操作 | PC | スマホ |
|---|---|---|
| 左右移動 | ← →（A/D） | 画面左下の大きな「◀ 左へ」「右へ ▶」ボタン（押している間） |
| ジャンプ | Space（↑/W） | 右下の大きな「ジャンプ／着地」ボタン。画面の上の方をタップしても同じ |
| 着地直前に姿勢を整える | 空中でもう一度 Space | 空中でもう一度ジャンプボタン |
| やめる | Esc／「やめる」 | 「やめる」 |

- **慣性**: 横移動は加速と砂の抵抗で少し遅れてついてくる（`STEER`）。カーブでは外へ流れる。空中は効きが弱い。
- **起伏（ジャンプチャンス）**: 手前（`JUMP.bumpWindow`=0.36秒）で押すと大ジャンプ（滞空約1.15秒・速いほど長い）。押さずに乗ると小さく跳ねて少し減速（転倒ではない）。平地で押すと小さなホップ（小岩だけ越えられる。得点なし。普通の着地で少し減速するので連打は得にならない）。
- **着地**: 空中で押した時点の残り滞空時間が 0.3秒以内＝完璧（加速＋250）、0.6秒以内＝良い（+120）、押さない＝普通（少し減速）。
- **岩**: 大岩・小岩。地上で触れると転倒 → 速度42%・コンボ解除・−150点、約1.1秒で自分で起き上がる（ゲームオーバーなし）。岩のすぐ横（+0.22）を抜けると「かすめた」+60。大ジャンプ中はどの岩も越える。
- **コース端**: |x|>0.86 の深い砂で減速。
- **絵**: 遠景（空・陸）・主人公の背面・岩・旗竿・ゴールの幕・砂煙は Codex 生成の採用画像（§4）。起伏・路面・太陽・夕方の色は Canvas。
- **練習**: 初めての外出は練習コース（まっすぐ→岩→起伏→岩→起伏）から。画面上の説明が「← → で左右に動こう」→「岩に当たると転ぶ…」→「起伏の手前で Space」→「着地の直前にもう一度 Space」と進み、跳び損ねたら「次の起伏でもう一度」。終わると「本番を滑る」。
- **採点**: 完走 1,200／時間ボーナス（72秒を切った秒×30）／大ジャンプ 150＋滞空秒×120／着地 完璧250・良い120／かすめ60／転倒 −150。ジャンプ・着地・かすめが続くとコンボ（×1＋0.15×コンボ、最大×3）。転倒で解除。
- **評価**: S ≥ 9,000／A ≥ 6,500／B ≥ 3,800／C。同じコースを自動操作のボットで照合: 転倒なし・全起伏で大ジャンプ・着地すべて完璧＝S（約10,800）、着地が「良い」止まり＝A（約8,800）、転倒2回＝B、跳ばずによけるだけ＝C（約2,100）。seed 1〜30 のどのコースも理想操作なら転倒なしで完走できる（理不尽な配置がない）ことをテストで確かめる。
- **リザルト**: 合計点・評価（S/A/B/C と一言）・滑走時間・最高コンボ・転倒・大ジャンプ・着地（完璧／良い）・かすめた回数・自己ベスト。「もう一度滑る」「砂丘を下りる」。
- **演出**: 進むほど空が夕方になり、太陽が地平線へ下りる（ゴールの夕日）。遠景の砂丘3層のパララックス、路面の風紋、コース端の旗竿、板の後ろの砂煙（速いほど多い）、着地・転倒の砂煙、速度線（速い時）、転倒時の画面の揺れと閃光。
- **動き軽減**: `prefers-reduced-motion` か設定「揺れ・閃光を減らす」（`config.reduceShake`）で、揺れ・閃光・速度線を止め、砂煙を1/3に、HUDのポップを静止表示にする（`data-reduced-motion`）。

## 3. 本編への接続（第4章）

- 入口は2つ。**14日のドバイ（版2・日常ループ `ch4-dubai-daily.js`）**では、ドバイの地図に「砂漠ツアーのデスク」（宿・FESTA・Dr.fookah の間）→誘いの後は「ヌールと砂丘へ」（左下＝街の外）が出る（`desertDailySpots`。行き先の処理は `performDesertSpot`）。版2より前の保存（5日の自由行動）は従来のカードの一覧（`ch4-map-model.js` → `desertDestinations`）。どちらも昼の寄り道で、大会・本線には関係しない。
- デスクの会話は時間を使わない（1日1回）。砂丘は昼だけ・1日1回。日常ループでは、外出の確定で `slot` を使い済みなので、日常ループに追加の消費をさせない（`slotsUsed: 0`）。体力は使わない（日常ループが外出のたびに経験値を足さないようにし、育成は初回完走の分だけにする）。
- **行動枠**: 砂丘へ出かけると昼の行動を1つ使う（`value.slot` を 1 にする。ラクダレースと同じ判定で、同じ日の昼にサンドボードとラクダレースの両方へは行けない）。同じ日は二度行けない（`flags._ch4_desert.lastOutingDay`）。宿で日を終えればまた行ける。日常ループ化（#2273・runDaily）の後も、同じ slot を calendar が進めるだけでよい。
- **同じ外出の中のリトライ**は何度でも、追加の消費なし（ゲームの「もう一度滑る」）。
- **記録**: `state.desert = { runs, best（readResult の形）, bestRank, firstClear: {chapter, day}, rewarded }`。完走ごとに保存。途中でやめた滑走は記録しない。
- **報酬（初回完走だけ）**: `core/growth.js` の `awardActionExp({ key: "desert_ride", place: "dubai_dunes", person: "noor" })`（心得の盤 `GROWTH_BOARD` が有効な時だけ経験値が入る。無効なら何も入らない）。2回目以降は呼ばない（`rewarded`）。能力値の直接加算（`earnStat`/`applyStats`）はしない。Aランク以上の自己ベストで、寝る前の「遊びのご褒美」（`growth-board-data.js` の `PLAY_REWARDS` `desert-a`: 体の火種1）。
- **SAVE/LOAD・中断**: 外出は到着の場面を読み終えた時点で確定して保存。その後に LOAD・タイトルへ戻る・再読込しても外出の消費は残り、未完走の記録は増えない。会話は読み終えた時だけ確定。
- **時系列**: 大会前提の会話（2回目・初回の夕日）は `tournament_finished`（章4）の分岐を持つ。
- 地図の座標はデスク（20,18）・砂丘（92,86）。ラクダレース（別チャット）の人物・地点とは別IDにしてある（`noor` / `tour_desk` / `dunes`）。

## 4. Codex への画像生成依頼（Claude は画像を生成しない）

**2026-11-02 受領・採用**（PR #2306 のコメントで3回に分けて受け渡し。選定・加工・SHA は `asset_sources/desert-ride-2306/README.md`）:

| # | 状態 | 採用 |
|---|---|---|
| 1 遠景・昼 | ✅ 採用（B） | 空と陸の2枚に分け、空→太陽→陸の順に重ねる。夕方はゲーム中に色をかける |
| 2 遠景・夕 | ✅ 採用（第4弾・2026-11-02） | 遠景Bと同じ構図（1画素以内）。ゴールへ近づくほど昼の上に重ねる。陸の透明度は昼と同じ |
| 3 会話の背景 | ✅ 昼（C → `bg_dubai_dunes_day`）・夕（第4弾 → `bg_dubai_dunes_dusk`）を採用 | 夕日の場面は `bg_dubai_dunes_dusk`（右に夕日） |
| 4 背面 | ✅ 基準 `rider_ride`（B）と差分5枚（第4弾: 画面の左・右・ジャンプ・着地の構え・転倒）を採用 | 背面Bと同じ縮尺。姿勢は `desert-ride-art.js` の `riderPose`（横の速さで左右、空中はジャンプ、押した後と着地直後0.18秒は構え、転倒中は転倒）。基準点は姿勢ごとの板の重心（転倒は体の中心と下端） |
| 5 岩 | ✅ 採用（大A・小A） | 当たり判定より少しだけ広く描く |
| 6 砂煙 | ✅ 採用（C） | |
| 7 旗竿・ゴール | ✅ 採用（旗A・幕A） | |
| 8 ヌールの立ち絵 | ✅ normal を採用（2026-11-02 オーナーが A を選定）。smile・surprise・登場カットインの一枚絵は依頼中 | `assets/sprites/characters/noor/chr_noor_normal.png`（896×1200）。台詞の smile・surprise は届くまで normal で表示し、登場カットインは立ち絵を使う型で出る。頭身は 7.96（標準の 6.4〜7.7 より頭が少し小さい。portrait_metrics の WARN）。B・C は採用しない |

次の依頼: ヌールの smile・surprise を1枚ずつ（**採用した normal A の原画** `raw/phase4/noor-candidates/noor_normal_A-raw.png` を添付し、同じ服・同じ足元で表情と小さな首の傾きだけ変える）、そのあと登場カットインの一枚絵。寸法・透過・画風の条件は下の表のとおり。

以下は最初の依頼（2026-11-02）。絵が読み込めない間・失敗した時は Canvas の図形で描く（`desert-ride.js` の `drawPlayer`・`drawRock`・`drawDunes`・`drawParticles`。絵の寸法と基準点は `desert-ride-art.js`）。既存の画風に合わせるため、背景は `tools/bg_prompts.txt` の共通指針（painterly・`bg_eden_shop.png` の筆致）、人物は `docs/prompts/image_generation_guide.md` と `character-portrait-remaster` の書式に従う。シーシャ機材は写らないので `docs/shisha_reference.md` §4 の手順は不要。

| # | 用途 | 保存先 | サイズ・透過 | 内容 |
|---|---|---|---|---|
| 1 | ゲームの遠景（空＋砂丘）昼 | `assets/ui/desert_ride/backdrop_day.png`（採用版は空・陸に分けた `backdrop_day_sky.png`・`backdrop_day_land.png`） | 2560×720、不透明（横に長く、カメラの向きで横スクロール） | ドバイ郊外の砂丘。地平線まで続く明るい砂、遠くに薄い砂丘の稜線、雲の少ない青空。人物・車・建物・文字なし。下 1/3 は平らな砂にする（路面はコードが描く） |
| 2 | 遠景 夕方 | `assets/ui/desert_ride/backdrop_dusk.png` | 2560×720、不透明 | #1 と同じ構図で夕方。オレンジ〜紫の空、低い太陽は描かない（太陽はコードが描く） |
| 3 | 会話の背景（砂丘・昼／夕） | `assets/backgrounds/bg_dubai_dunes_day.png`・`bg_dubai_dunes_dusk.png` | 1280×720、不透明 | VN背景。風紋の光る砂丘と、脇に停めた砂色の四輪駆動の車（ロゴなし）。人物なし。中央手前を空ける。夕方版は同じ構図で夕日 |
| 4 | 主人公の背面（サンドボード） | `assets/ui/desert_ride/rider_ride.png` ほか差分 `rider_lean_left`・`rider_lean_right`・`rider_jump`・`rider_brace`・`rider_fall` | 各 512×768、透過PNG、足元中央を基準（6枚） | はじめ（22歳・黒髪・白いシャツに濃い色のパンツ）の背面。オレンジのサンドボードに乗る。滑走・左右に体重をかける・跳ぶ（膝を抱える）・着地の構え（膝を深く曲げる）・転倒（砂に横倒し）。通常VNの立ち絵と区別するため顔は見せない。影は描かない |
| 5 | 岩（大・小） | `assets/ui/desert_ride/rock_large.png`・`rock_small.png` | 512×384、透過 | 砂に半分埋もれた赤茶の岩。影は描かない（コードが描く） |
| 6 | 砂煙のパーツ | `assets/ui/desert_ride/sand_puff.png` | 256×256、透過 | 柔らかい砂色の煙の塊1つ（白っぽい砂）。コードが拡大・回転・重ねて使う |
| 7 | 旗竿・ゴール | `assets/ui/desert_ride/flag_pole.png`・`goal_banner.png` | 128×512／1024×192、透過 | コース端の細い旗竿（オレンジの小旗）、ゴールの白い横断幕（文字なし） |
| 8 | ヌールの立ち絵 | `assets/sprites/characters/noor/chr_noor_normal.png`・`_smile`・`_surprise` | 既存立ち絵と同じ規格（人物1300px以上、マゼンタ #FF00FF 背景→スクリプトで透過、`remake/tools/build_manifest.py`） | 27歳の日焼けした女性。黒い髪をゆるく後ろで束ね、薄いベージュのスカーフを首に、カーキのアウトドアシャツの袖をまくり、サングラスを頭に乗せる。大きな笑顔。宗教的な象徴や実在の人物に似せない。表情は normal／smile／surprise の3枚（1回の生成で1表情、採用済みを添付して同一人物性を保つ）。登場カットインの一枚絵（`ui/character_intros/noor.png`）は立ち絵が決まってから |

コピペ用プロンプト（背景 #3 の例。#1・#2 も同じ指針で横長にする）:

```
Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. Sand dunes outside Dubai at midday: bright golden sand with wind ripples catching the light, dune ridges rolling to the horizon, a clear pale-blue sky. At the left edge a sand-colored 4x4 tour car parked on the dune shoulder, no logos, no plates. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no signs, no logos, no watermark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque. File: assets/backgrounds/bg_dubai_dunes_day.png
```

```
Same place and composition as the attached bg_dubai_dunes_day.png, now at sunset: orange-to-violet sky, long blue shadows across the ripples, the dune crests rim-lit in warm light, the sun just touching the horizon on the right. Same 4x4 car at the left edge. Keep the center foreground open. Fine pixel-painter texture matching bg_eden_shop.png, not photographic. No people, no text, no logos, no watermark. 16:9, 1280x720, opaque. File: assets/backgrounds/bg_dubai_dunes_dusk.png
```

```
Game sprite, back view of a 22-year-old Japanese man riding a bright orange sandboard down a dune: black short hair, plain white short-sleeve shirt, dark slim pants, sneakers strapped to the board, knees slightly bent, arms out for balance. Camera from behind and slightly above, his face not visible. Clean anime style matching the game's character portraits (attached chr_hajime reference for hair and build), soft cel shading, no outline noise. Solid magenta #FF00FF background for keying, no ground shadow, no sand, no text. 512x768, the board's center at the bottom center. File: assets/ui/desert_ride/rider_ride.png. Then the same character and camera for: leaning hard left (rider_lean_left), leaning hard right (rider_lean_right), in the air with knees tucked and board tilted (rider_jump), deep crouch bracing for landing (rider_brace), tumbling sideways with the board flying off (rider_fall) — one image per generation, attach rider_ride.png each time.
```

## 5. 14日化・ラクダレースとの関係

- 日常ループ化（#2273）では、`desertDestinations(value, day)` を昼の行き先に、`visitDesert` を `performSpot` 相当から呼び、`beginDesertOuting` が true を返したら昼の slot を進める。夜は出さない。
- ラクダレース（別チャット）とは、人物ID（`noor`）・地図ID（`tour_desk`/`dunes`）・保存キー（`flags._ch4_desert`・`state.desert`）・台詞ファイル（`ch4_desert.json`）を分けた。共通ファイルの変更は `ch4-map-model.js`（1行）・`ch4.js`（`visit()` の分岐1つ）・`growth-board-data.js`（`PLAY_REWARDS` 1行）・`growth.js`（判定1行）・`index.html`（CSS 1行）・`tools/ci/suites.json`（2件）だけ。
