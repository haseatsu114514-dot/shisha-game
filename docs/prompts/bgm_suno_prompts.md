# Suno AI用 BGM発注プロンプト集（曲待ちプレースホルダ5曲・2026-07-04）

`assets/audio/bgm/` の0バイトプレースホルダ5曲ぶん。**各ブロックをそのままSunoに貼れる**。
すべて **Instrumental（歌なし）** 指定。ループ端のフェードはコード側（`remake/js/core/audio.js`）が
処理するので、曲側にフェードアウトを入れないこと。

受け取り後の組み込みは `.claude/skills/suno-bgm-prompt/SKILL.md` の Step 3（配置 → `python3 remake/tools/build_manifest.py` → 鳴らす場所の確認）に従う。

---

## 1. bgm_map.mp3 — マップ画面（行き先選択・毎日見る画面）

機能: 日常のハブ。1プレイで何十回も聞くので**主張しない心地よさ**が最優先。
tonari店内曲（アコースティック系の温かさ）より少しだけ外の空気・街の気配。

```
Instrumental only, no vocals. Chill lo-fi downtempo for a cozy city-map screen in a
shisha lounge adventure game. Warm Rhodes piano chords, soft round bass, dusty
vinyl texture, light shaker and finger-snap percussion, faint evening-city ambience.
Amber neon, smoky, relaxed and slightly nostalgic. 82 BPM. Short 2-bar intro, main
groove starts immediately and stays even — no build-ups, no drops, no sudden loud
hits. Seamless loop: the ending resolves naturally back into the opening chord.
Keep energy low and unobtrusive throughout. About 2 minutes.
```

テイスト違い予備案: 上記の「Rhodes piano」を「nylon guitar and warm marimba」に
差し替えると tonari 曲との姉妹感が出る。

## 2. bgm_tournament_wait.mp3 — 大会会場入り〜控室（緊張の待ち時間）

機能: 会場入りの高揚と控室の緊張。**開幕コールでEDM（次曲）へ切り替わる**ので、
この曲は静かな圧＝「まだ始まらない」感を保つ。会話を読ませる場面なので控えめに。

```
Instrumental only, no vocals. Tense, restrained waiting-room track for a competition
venue in a shisha battle game. Low pulsing synth bass like a slow heartbeat, sparse
muted percussion, airy dark pads, occasional distant crowd-murmur-like texture,
a single repeating marimba or plucked motif that never resolves. Suspenseful but
quiet — no drums fills, no risers into drops, no sudden loud hits. 96 BPM. 2-bar
intro, then a steady hypnotic loop with only subtle variation. Seamless loop ending.
About 2 minutes, main tension established within the first 60 seconds.
```

## 3. bgm_tournament_edm.mp3 — 大会本番（開幕コール後〜審査）

機能: MCの開幕コールで bgm_tournament_wait から切り替わる**本番の熱**。
ミニゲーム操作中に鳴るので、派手だがダイナミクスの落差は小さめに（急な無音・急な爆音NG）。

```
Instrumental only, no vocals. Energetic electro-house stage anthem for a shisha
crafting tournament. Driving four-on-the-floor beat, punchy but warm synth bass,
Middle-Eastern flavored lead phrases (phrygian scale, oud- or flute-like synth),
hand-clap layers, festival stage atmosphere. Confident and fun, not aggressive.
125 BPM. Start at full groove within 4 beats — no long intro, no breakdown longer
than 4 bars, keep intensity consistently high through the first 75 seconds, no
sudden silence, no huge drop contrasts. Seamless loop ending back to the top.
About 2 minutes.
```

テイスト違い予備案: 「electro-house」を「big-beat / breakbeat」にすると
レトロゲーム調UIとの相性が上がる。

## 4. bgm_result_emotional.mp3 — 優勝リザルト（南雲コール後の余韻）

機能: 優勝コール＋紙吹雪の直後、リザルト画面の**涙腺曲**。1〜2分だけ流れる
一発場面なので、冒頭から感情を張ってよい（山を前に置く）。

```
Instrumental only, no vocals. Emotional victory afterglow for a tournament result
screen. Gentle piano melody over warm strings, slow build that blooms within the
first 30 seconds, subtle glockenspiel sparkles, soft sustained bass. Triumphant
but tearful — pride, relief, and gratitude rather than fanfare. 74 BPM. Short
piano-only intro (2 bars), emotional peak between 0:30 and 1:10, then settle into
a warm sustained outro chord that can loop quietly. No drums kit, no sudden hits,
no full stop ending. About 1 minute 45 seconds.
```

## 5. bgm_rival_shop.mp3 — ライバル店の店内（KEMURIKUSA/EDEN/PEPPERMINT共通）

機能: よその店の滞在曲。tonari（わが家の温かさ）との対比で、
**少しよそゆき・都会的でクール**。会話を読む場面なので控えめに。

```
Instrumental only, no vocals. Cool urban chill-hop for visiting rival shisha
lounges in an adventure game. Mid-tempo head-nod beat, jazzy electric piano stabs,
smooth muted trumpet or synth lead in short phrases, deep lazy bass, soft vinyl
crackle, faintly smoky late-night mood. Slightly mysterious and stylish — a shop
that is not your home turf. 92 BPM. 2-bar intro, steady groove with small
variations, no build-ups, no drops, no sudden loud hits. Seamless loop ending.
About 2 minutes.
```

---

補足（発注時の注意）:
- Sunoは当たり外れがあるので、各曲2〜3テイク生成して良い方を採用するのが安全。
- 75秒地点でぶつ切りに聞こえないか（＝埋め込み候補の bgm_map は特に）確認してから採用する。
- 歌・ボーカルチョップが混ざったテイクは不採用（台詞と喧嘩するため）。


## 2026-10-25 採用：審査待ち・大会後・味覚不調（全A候補1）

オーナーが3曲ともA候補1を採用し、MP3原本を提供。Suno Proで生成した音源をゲームへ取り込む。

- `bgm_judging`：票が開くまで｜A.mp3 — https://suno.com/song/89da7026-8057-47f4-8114-a4c48e00c149。元SHA-256 `99e9b3190ced628a3395458cd8b6a80f1182451f34a69d35cbedf2e671a13eaa`。
- `bgm_aftermath`：今日の一台、そのあと｜A.mp3 — https://suno.com/song/60d792cf-45c7-4fbf-8ae7-415e5485dd0d。元SHA-256 `a679f9722f464b3d5a16141f12f7e8998a8715d0f8283dad7fa8eb817f0596b4`。
- `bgm_taste_distant`：香りが遠い夜｜A.mp3 — https://suno.com/song/54000e7a-69e9-41ae-899b-d031809f65b5。元SHA-256 `7e524ec761c1b59f9ecbd543b94cc3e8f963c9eeb3dbb9bc025d77d53f612eb6`。

原本を保持したまま、生成曲の前奏・終端フェードを避けて8秒位置から32小節を使用。1拍分を余分に取り、末尾と先頭を線形クロスフェードして循環させる。-18 LUFS / -2 dBTP目標、44.1 kHzステレオ192 kbps MP3を既存SUIENBGM1形式へ変換。元MP3の単体公開はしない。音の内容と音楽的な継ぎ目はAIの耳では未試聴。波形・デコードと場面接続を検査する。

審査待ちは全章の最終審査と第2・3章の途中投票に接続し、会場入りの既存曲は保持。大会後は第1章の既存余韻場面、第2章の別れ、第3章の勝利後に接続。味覚不調は第2章の不調会話2箇所で会話中だけ切替え、既存VN機構で前の曲へ復帰する。

---

## 2026-11-02 第4・5章とエンディングの新曲（#2209・Suno MCP 待ち）

第4章（ドバイ・世界大会）と第5章（SMOKE LAB・SHISHA-9000戦・エンディング）は今、第1〜3章の曲の流用（ドバイでも地元の `tonari`）。下の6曲を Suno で作る。Suno の MCP が届いたら、各ブロックをそのまま渡して**1曲につき2〜3テイク**生成し、良いテイクを選ぶ。

- 共通: **Instrumental（歌なし）**。ボーカル・ボーカルチョップ・語りが混ざったテイクは不採用。
- MCP の入力欄が短い「Style」だけのときは、各曲の **Style（短）** の行を使う。長い説明を受け付けるときは **説明（長）** のブロックを使う。題名は **Title** の行。
- 1〜4・5 はループで鳴らす曲（曲側にフェードアウト・完全終止を付けない）。6 のスタッフロールだけは**1回流して終わる曲**（ちゃんと終わってよい）。

### 曲の一覧と組み込み先

| # | キー（案） | 用途 | 鳴らす場面（コード） | 今鳴っている曲 |
|---|---|---|---|---|
| 1 | `bgm_dubai` | ドバイの街（到着・自由行動・訪問・宿） | `remake/js/chapters/ch4-progress.js` の `CH4_DEFAULT_BGM` と、`ch4.js` 入口の `playBgm("tonari")`。**日本の4場面（`ch4_sumi_training`・`ch4_strategy`・`ch4_sumi_return`・`ch4_two_tables`）と次回予告の後は `tonari` のまま**にするため、その4つを `CH4_SCENE_BGM` に `tonari` で足す | `tonari` |
| 2 | `bgm_world_stage` | 世界大会の会場 FESTA（開幕前・前夜祭） | `CH4_SCENE_BGM` の `ch4_tournament_start`、`ch4_wang_reception`（前夜祭） | `bgm_tournament_wait` |
| 3 | `bgm_smoke_lab` | 第5章の会場 SMOKE LAB（到着・二杯目の前） | `CH5_SCENE_BGM` の `ch5_match_day_arrival`・`ch5_relationship_before_second_cup` | `bgm_tournament_wait` |
| 4 | `bgm_ch5_duel` | SHISHA-9000 との対決（制作中） | `CH5_SCENE_BGM` の `ch5_copy_first_cup`。二台目の制作（`ch5.js` の `craftSecondCup`）は今 `playBgm` が無く前の曲が続くので、開始時に `playBgm("bgm_ch5_duel")` を1行足す | `bgm_tournament_craft` |
| 5 | （#517 で決める。案 `bgm_ending`） | エンディングの会話（`ending_start`・`ending_normal`・`epilogue_*`・`ending_daily_smoke`） | #517 の実装に合わせて `CH5_SCENE_BGM` に足す | `tonari` |
| 6 | （#517 で決める） | スタッフロール | #517 のスタッフロール画面。**曲の長さ＝流れる時間**にするか、流れる時間に合わせて曲を選ぶ | なし |

- 世界大会の**制作中と審査**（`bgm_tournament_craft`・`bgm_judging`）は全章共通のままにする。操作中の曲は章をまたいで同じ方が手に馴染み、どこで鳴るかの手がかりにもなる。章の違いは会場入り（2）で出す。
- 3 と 4 は第5章の勝負の前後で温度差を作る組（研究所の冷たい静けさ → 対決の熱）。

### 1. bgm_dubai — ドバイの街

機能: 第4章の大半で鳴る日常曲（地図・訪問・宿で何度も聞く）。地元の `tonari` と違う「遠くへ来た」空気を出しつつ、会話を読ませるので主張しない。

```
Title: Souq at Golden Hour
Style（短）: instrumental, Arabic chill downtempo, oud, darbuka, warm pads, 88 BPM, loopable, no vocals
説明（長）:
Instrumental only, no vocals. Warm Arabic-flavored chill downtempo for wandering a
desert city in a shisha lounge adventure game. Gentle oud melody in maqam hijaz,
soft darbuka and riq groove, deep round bass, airy warm pads, a faint distant
market ambience, golden late-afternoon heat haze. Curious, open and a little far
from home, but relaxed. 88 BPM. Short 2-bar intro, the groove stays even with
small variations — no build-ups, no drops, no sudden loud hits. Seamless loop:
the ending flows back into the opening phrase. About 2 minutes 30 seconds.
```

テイスト違い予備案: 「oud melody」を「ney flute and qanun」に替えると夜寄りの静けさになる（宿・路地裏のカフェ向き）。

### 2. bgm_world_stage — 世界大会の会場（FESTA）

機能: 第1〜3章の会場曲（`bgm_tournament_wait`）より大きな舞台。開幕前の高揚と緊張。会話を読む場面なので、派手でも音数は抑える。前夜祭にも使う。

```
Title: FESTA Before the Bell
Style（短）: instrumental, cinematic world-music, tense pulse, frame drums, strings ostinato, 100 BPM, no vocals
説明（長）:
Instrumental only, no vocals. Grand but restrained pre-competition track for a
world shisha championship held in a huge festival hall in Dubai. Low pulsing
synth bass and frame drums like a slow heartbeat, a short string ostinato, a
lonely oud or ney phrase answering it, distant crowd-like texture, warm golden
light. Proud, tense and expectant — the biggest stage of the journey, before it
begins. 100 BPM. 2-bar intro, then a steady loop with gradual layering but no
drop, no risers, no sudden loud hits. Seamless loop ending. About 2 minutes.
```

テイスト違い予備案: 「frame drums」を「four-on-the-floor kick at low volume」にすると、第1章の開幕曲（EDM）との地続き感が出る。

### 3. bgm_smoke_lab — SMOKE LAB（第5章の会場）

機能: 博士の研究所での勝負の前後。冷たく清潔で、機械が静かに見ている感じ。敵意ではなく「測られている」緊張。二杯目の前の短い回想にもかかるので、感情は押しつけない。

```
Title: Clean Room Air
Style（短）: instrumental, minimal ambient electronica, soft arpeggio, glassy pads, 90 BPM, sterile, no vocals
説明（長）:
Instrumental only, no vocals. Minimal ambient electronica for a quiet, spotless
research lab where an AI robot waits for a shisha duel. Soft glassy pads, a slow
clean synth arpeggio like a measuring instrument, subtle low hum of machines,
tiny precise clicks and ticks, a faint warm note underneath so it never feels
hostile. Cool, clinical, curious and tense. 90 BPM. Short 2-bar intro, steady
and hypnotic with only subtle variation — no drums kit, no drops, no sudden loud
hits. Seamless loop ending. About 2 minutes.
```

テイスト違い予備案: 「synth arpeggio」を「music-box like celesta」にすると、9000の無垢さが出る。

### 4. bgm_ch5_duel — SHISHA-9000 との対決

機能: 最後の勝負の制作中（ミニゲーム操作中）。全章で一番の熱だが、操作を邪魔しないよう落差は小さく。人の手の温かさ（生楽器）と機械の正確さ（電子音）がぶつかる曲。

```
Title: Two Bowls, One Room
Style（短）: instrumental, driving electro-acoustic, live percussion vs synth arpeggio, 128 BPM, no vocals
説明（長）:
Instrumental only, no vocals. Driving final-duel track for a shisha crafting
battle between a young craftsman and a precise AI robot. Live hand percussion,
warm plucked guitar or oud riffs and handclaps (the human side) trading phrases
with tight sequenced synth arpeggios and clean digital bass (the machine side),
both locking into one groove. Determined and heartfelt, not aggressive. 128 BPM.
Full groove within 4 beats, no long intro, no breakdown longer than 4 bars, keep
intensity consistently high, no sudden silence, no huge drop contrasts. Seamless
loop ending back to the top. About 2 minutes 30 seconds.
```

テイスト違い予備案: 「oud riffs」を「electric guitar riffs」にすると、第1章の大会曲寄りの明るさになる。

### 5. エンディングの会話（案 bgm_ending）

機能: 9000戦のあと、tonari に戻った夜の締めくくりと後日談（恋人ごとの後日談を含む）。会話を読む場面。`tonari` の家の温かさの延長で、少しだけ大きく、終わりの予感がある。

```
Title: The Usual Night, Again
Style（短）: instrumental, warm acoustic lo-fi, nylon guitar, Rhodes, soft brushes, 76 BPM, nostalgic, no vocals
説明（長）:
Instrumental only, no vocals. Warm, quietly emotional ending-scene music for a
shisha lounge adventure game: the hero is back in his small home shop after the
last duel, the usual night has returned. Nylon guitar and soft Rhodes piano,
gentle brushed drums, round upright bass, a light string pad that swells only a
little, amber lamplight, faint smoke. Gratitude, relief and a soft ache that the
journey is over. 76 BPM. Short 2-bar intro, even and gentle, no big climax, no
sudden loud hits. Seamless loop ending. About 2 minutes 30 seconds.
```

### 6. スタッフロール

機能: エンディングのあと、縦に流れる文字＋曲（#517。初回は飛ばせない）。**ループさせず1回流して終わる**ので、イントロ→盛り上がり→穏やかな終止まで1曲で完結させる。旅の曲（地元・東京・ドバイ）を思わせる楽器を少しずつ重ねると振り返りになる。

```
Title: Smoke Drifts Home
Style（短）: instrumental, emotional cinematic lo-fi, piano, strings, oud, nylon guitar, 80 BPM, full ending, no vocals
説明（長）:
Instrumental only, no vocals. Emotional end-credits theme for a shisha lounge
adventure game. Opens with solo piano and soft vinyl texture, then nylon guitar
joins (the home shop), a light city lo-fi beat (Tokyo), and a short oud and
frame-drum passage (Dubai), all gathering into one warm melody carried by
strings. Grateful, bittersweet and hopeful. 80 BPM. Builds gently to a heartfelt
peak around two-thirds of the way, then settles into a calm, complete ending
on a sustained chord (a real ending is OK — this track does not loop). No
sudden loud hits. About 3 minutes.
```

テイスト違い予備案: 楽器の重ね方をやめ、ピアノと弦だけの静かな版にすると、文字を読む邪魔をしない。

### 受け取った後（組み込み）

1. 元のMP3は公開リポジトリに置かない（Suno 曲も既存と同じ扱い。上の「2026-10-25 採用」節）。ループ曲は前奏・終端を避けた区間を切り出し、末尾と先頭を短くクロスフェードしてから、`python3 remake/tools/pack_bgm.py <元.mp3> assets/audio/bgm/<key>.bgm` でゲーム専用形式にする。スタッフロールは切り出さず、曲の終わりまで使う。
2. `python3 remake/tools/build_manifest.py --audio-only` で目録に載せる。
3. 音量: FFmpeg `ebur128` で Integrated LUFS を測り、切り替え前後の曲（`tonari` −17.34、大会制作 補正後 −14.07 など。`asset_sources/music/confirmed-tournament-bgm-20261009.md`）より大きくならない倍率を `remake/js/core/audio.js` の `BGM_GAIN` に足す（1.0 を超えない）。
4. 上の表の「鳴らす場面」を書き換える。採用の記録（Suno の曲URL・元SHA-256・切り出し区間）は `asset_sources/music/` に新しい採用記録として残す（「2026-10-25 採用」節と同じ項目）。
5. 確認: `node --experimental-vm-modules remake/test/bgm_packaged.mjs`、`node --experimental-vm-modules remake/test/bgm_gain.mjs`、第4章・第5章の通しテスト（`tools/ci/suites.json` の `ch4-full-flow`・`ch5-full-flow`）。ループの継ぎ目と音量は耳で確かめる。

### フリー音源を使うか（結論: 新しくは入れない。Suno で作る）

- **今のゲームにもフリー音源はある**: 大会の開幕「Overture!」（H/MIX GALLERY・秋山裕和）と大会の制作「Mind Duel」（OpenTracks・shimtone）は「楽曲単体の再配布は禁止」型の条件で、元MP3を公開リポジトリに置かず `.bgm` 形式にして同梱している（`asset_sources/music/confirmed-tournament-bgm-20261009.md`）。サメちゃんの曲（M-ART・Napi）と日常の「間接照明とブラックコーヒー」はMP3のまま置かれていて、後者は配布元・作曲者の記録が無い（`asset_sources/music/README.md`）。
- **新しく足すなら曲ごとに確認が要る**: ①ゲームでの利用（個人・同人の有償配布を含む）、②公開リポジトリへの同梱（`.bgm` で単体再配布を避けても許されるか）、③ループのための切り出し・つなぎ（改変）の可否、④クレジットの要否。サイト単位でなく曲ごとに条件が違う（`docs/prompts/external_asset_sources.md`）。Mixkit の音楽のように「ゲーム利用不可」もある。
- **スタッフロールとの両立**: オーナー指示はスタッフロールを全部「あつき」。**クレジット表記が必須の音源（CC BY・OtoLogic 等）は採用できない**。任意の音源でも、他人の曲を「作曲：あつき」と書くのは事実と違うので、音楽の欄は「選曲・音響」などの書き方にするか、使用楽曲の欄を別に置くかを #517 で決める（今あるフリー音源の曲もこの扱いが要る）。
- **推奨**: Suno の MCP が今日届くので、6曲とも Suno で作る。フリー音源は仮でも新しく入れない（確認と記録を2回やることになり、仮の曲が残りやすい）。MCP が遅れて先に音を付けたい場合は、新しい曲を探さず、**すでに入っている曲を仮に当てる**（スタッフロールは `title` のタイトル曲、ドバイは今のまま `tonari`）。
