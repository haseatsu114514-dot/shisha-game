# Suno AI用 BGM発注プロンプト集（曲待ちプレースホルダ9曲・2026-07-04／07-12追加）

`assets/audio/bgm/` の0バイトプレースホルダぶん（初回5曲＋2026-07-12採用の追加4曲）。
**各ブロックをそのままSunoに貼れる**。
すべて **Instrumental（歌なし）** 指定。ループ端のフェードはコード側（sfx.js）が
処理するので、曲側にフェードアウトを入れないこと。

受け取り後の組み込み（Claude側の仕事）:
1. `assets/audio/bgm/<キー名>.mp3` に上書き配置（キー名は変えない）
2. 1ファイル配布版に載せる曲だけ `web/build_standalone.py` の `BGM_FILES` に追加
   （埋め込みは先頭約75秒で切ってループ＋起動時間が延びるので厳選。
   推奨: **bgm_map のみ埋め込み**、大会系3曲とrival_shopは分割版専用でよい）
3. 未配線の曲は配置後に鳴らす場所を配線する:
   - `bgm_map` → `showMap()` の `SFX.bgm("daily_part")` を差し替え
   - `bgm_rival_shop` → `doVisit()` のライバル店（naru/adam/minto/ch2勢）で `SFX.bgm`
   - 追加4曲（#6〜#9）の配線先は各セクション末尾の「配線」を参照
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

## 追加4曲（2026-07-12 オーナー採用。スロット/くじ/ミニゲーム曲は不採用＝日常の一部なので日常曲のまま）

## 6. bgm_defeat.mp3 — 敗北・ゲームオーバー画面

機能: 大会敗北（`showDefeat()`）と章途中のゲームオーバー（`#screen-gameover`）。
結果発表前の無音（`bgmStop`）→敗北コール→この曲、という流れで入る。
優勝側の bgm_result_emotional と対になる曲だが、**再挑戦ボタンがある画面**なので
絶望一辺倒にしない＝「悔しさの中に、もう一回やるかという火種」を残す。

```
Instrumental only, no vocals. Quiet defeat-screen music for a shisha crafting
tournament game. Sparse melancholic piano with long decays over soft low strings,
gentle tape hiss, a faint warm pad underneath that keeps a small ember of hope.
Sad and frustrated but not hopeless — sitting alone after losing, then deciding
to try one more time. 68 BPM. Solo piano intro of 2 bars, main theme within the
first 30 seconds, stays calm and subdued throughout — no drum kit, no build-ups,
no sudden loud hits, no full-stop ending. Seamless loop where the final chord
resolves back into the opening. About 1 minute 30 seconds.
```

配線: `showDefeat()` の冒頭に `if (window.SFX) SFX.bgm("bgm_defeat")`、
`onGameOver` の `showScreen("#screen-gameover")` 側にも同様に。埋め込み不要（分割版専用）。

## 7. bgm_date.mp3 — 恋愛・デートイベント

機能: 恋人とのデート（`playLoverDate()`）・告白/恋人成立・私服デート系イベント
（`ch1_minto_fifth` 等）の特別曲。日常曲/店曲から切り替わることで「特別な時間」を作る。
会話を読ませる場面なので甘いが控えめに。tonari曲（アコースティックの温かさ）と
姉妹になりすぎないよう、キラキラ成分（グロッケン）で「ときめき」側へ寄せる。

```
Instrumental only, no vocals. Sweet romantic date theme for a visual-novel style
adventure game set around cozy shisha lounges. Warm nylon guitar arpeggios, soft
Rhodes piano chords, gentle glockenspiel sparkles, light brushed percussion, round
quiet bass. Tender, a little shy, quietly happy — an evening walk with someone
special under amber street lights. 90 BPM. 2-bar intro, melody blooms softly within
the first 30 seconds, then stays gentle with small variations — no drum fills,
no build-ups, no sudden loud hits. Seamless loop ending that resolves back into
the opening chord. About 2 minutes.
```

テイスト違い予備案: 「glockenspiel sparkles」を「music-box melody」にすると
より少女漫画的な甘さになる（つむぎ・みんと寄り）。

配線: `playLoverDate()` の冒頭＋恋人マイルストーンイベント再生時＋私服デート系
dialogue の再生呼び出し前。イベント終了後は元の場面の曲へ戻す。埋め込み不要（分割版専用）。

## 8. bgm_serious.mp3 — シリアス・緊張の会話（物語の重い場面）

機能: 優勝の夜にスミさんが採点表を突きつけるLIME後の対峙、ライバルとの因縁、
不穏な前フリなど「物語の影」の場面。bgm_tournament_wait（イベント前の高揚を含む
「まだ始まらない」圧・脈打つ系）とは別物で、こちらは**静止した重さ**。
ch2以降（神崎・チャコール博士など）でも使い回す汎用アンダースコア。

```
Instrumental only, no vocals. Dark, still underscore for heavy story conversations
in a shisha adventure game. Low sustained cello and double-bass drones, sparse
single low piano notes with long decay, airy dark pad, very subtle smoky room
ambience, an occasional distant clock-like tick. Heavy, quiet and intimate — hard
truths being spoken late at night. 62 BPM feel, almost beatless. Starts directly
on the drone with no intro build, keeps an even low intensity with only slight
swells — no percussion kit, no melody hooks, no build-ups, no sudden loud hits.
Seamless ambient loop. About 2 minutes.
```

配線: シーン個別（該当 dialogue の再生呼び出し前後で `SFX.bgm`／終了時に元の曲へ）。
本命は `type:"bg"` 行と同様の **`type:"bgm"` 行を engine に追加**して台詞データ側から
切り替えられるようにすること（曲が届いた組み込み時に実装）。埋め込み不要（分割版専用）。

## 9. bgm_rin_shop.mp3 — 凛の店（問屋街 Dr.fookah）

機能: Dr.fookah 来訪〜凛との会話（`bg_fookah_showroom`）。海外メーカー
NIGHTSIDE 代理店のショールーム＝**輸入物のオリエンタルな空気＋年上の余裕**で、
bgm_rival_shop（都会的チルホップ）とも bgm_tournament_edm（中東風でも祭りのEDM）
とも差別化する。会話と仕入れ選択の画面なので控えめに。

```
Instrumental only, no vocals. Exotic oriental lounge track for a hookah wholesale
showroom run by a stylish older woman in an adventure game. Downtempo groove with
soft darbuka hand percussion, warm oud and kanun phrases in short tasteful licks,
airy breathy flute pad, deep relaxed bass, subtle incense-smoke ambience.
Sophisticated, mysterious, a little playful and teasing — imported goods and
grown-up confidence. 88 BPM. 2-bar intro, steady hypnotic groove with small
variations — no build-ups, no drops, no sudden loud hits. Seamless loop ending.
About 2 minutes.
```

配線: `doVisit("rin")` ／ Dr.fookah 来訪フローの会話開始前で `SFX.bgm`、
退店時に `daily_part`（将来は bgm_map）へ戻す。埋め込み不要（分割版専用）。

---

補足（発注時の注意）:
- Sunoは当たり外れがあるので、各曲2〜3テイク生成して良い方を採用するのが安全。
- 75秒地点でぶつ切りに聞こえないか（＝埋め込み候補の bgm_map は特に）確認してから採用する。
- 歌・ボーカルチョップが混ざったテイクは不採用（台詞と喧嘩するため）。
