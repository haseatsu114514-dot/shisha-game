# Suno AI用 BGM発注プロンプト集（曲待ちプレースホルダ5曲・2026-07-04）

`assets/audio/bgm/` の0バイトプレースホルダ5曲ぶん。**各ブロックをそのままSunoに貼れる**。
すべて **Instrumental（歌なし）** 指定。ループ端のフェードはコード側（sfx.js）が
処理するので、曲側にフェードアウトを入れないこと。

受け取り後の組み込み（Claude側の仕事）:
1. `assets/audio/bgm/<キー名>.mp3` に上書き配置（キー名は変えない）
2. 1ファイル配布版に載せる曲だけ `web/build_standalone.py` の `BGM_FILES` に追加
   （埋め込みは先頭約75秒で切ってループ＋起動時間が延びるので厳選。
   推奨: **bgm_map のみ埋め込み**、大会系3曲とrival_shopは分割版専用でよい）
3. 未配線の2曲は配置後に鳴らす場所を配線する:
   - `bgm_map` → `showMap()` の `SFX.bgm("daily_part")` を差し替え
   - `bgm_rival_shop` → `doVisit()` のライバル店（naru/adam/minto/ch2勢）で `SFX.bgm`
4. `python3 web/build_standalone.py` → ブラウザで切替・ループ継ぎ目・音量（BGM_BASE=0.35）を耳で確認

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
