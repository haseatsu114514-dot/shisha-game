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
