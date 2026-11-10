# ラクダレース・サンドボードの効果音（2026-11-10）

オーナー依頼「キャメルレースとサンドボードの効果音はお任せでやって」（候補1を採用。サンドボードの滑走は候補2、転倒は柔らかめの候補3）。ブランチ `grok/minigame-sfx-swap`。

再生成は `python3 asset_sources/music/minigame-sfx-swap/prepare.py`（ffmpeg と cryptography が必要）。Mixkit の原音はライセンス上、素材単体での再配布ができないのでリポジトリには置かない。再生成するときは `MIXKIT_RAW` に `916.wav` / `226.wav` / `2658.wav` / `2494.wav` / `2498.wav` / `2043.wav` を置いたフォルダを渡す。CC0 の原音は [sources/](sources/)、ライセンス文は [licenses/](licenses/)、ゲーム用ファイルの一覧は [game_files.json](game_files.json)。

- 最終音源の形式は既存の録音SEに合わせた（モノラル 44.1kHz 16bit）。ピークは BGM の下に収まるよう -10〜-16 dBFS に揃えた。
- Mixkit 由来の音はゲーム専用の `.bgm` に梱包して `assets/` へ入れる（`remake/tools/pack_bgm.py`）。
- キューの表は `remake/js/core/audio.js` の `MINIGAME_SE`（ラクダ）と `DESERT_SE`（サンドボード）。ラクダは既存の `sfx("hoof")` などの ID を維持し、スロットなど他場面の合成SEは変えていない。

## ラクダレース（採用はすべて候補1）

| 場面 | ファイル | 出典 |
|---|---|---|
| カウント 3・2・1 | `count_bleep.bgm` | Mixkit「Clock countdown bleeps」（#916）から1音を切り出し |
| スタート GO | `start_cracker.wav` | Joseph Sardin（BigSoundBank）「Firecracker gun #1」（CC0） |
| 蹄 | `hoof_gallop.wav` | Joseph Sardin「Horse Gallop」（CC0）。1歩分を切り出し |
| ムチ | `whip_complete.wav` | Joseph Sardin「Complete whip #1」（CC0） |
| PERFECT / GOOD / ミス | `perfect_confirm.wav` など | Kenney Interface Sounds（CC0） |
| LAST SPURT | `spurt_horn.wav` | Joseph Sardin「Gas fog horn」（CC0） |
| 追い抜き | `overtake_whoosh.wav` | Joseph Sardin「Whoosh #8」（CC0） |
| 1着 | `fanfare_trumpet.bgm` | Mixkit「Trumpet fanfare」（#226）先頭約3.2秒 |
| 2・3着 | `place_jingle.wav` | Kenney Music Jingles「jingles_HIT03」（CC0） |
| 4着 | `crowd_applause.wav` | Joseph Sardin「Applause #1」（CC0） |
| 判子 | `stamp_drop.wav` | Kenney Interface Sounds「drop_004」（CC0） |
| ラクダの唸り（スパート時に稀に） | `grunt_camel.wav` | AntumDeluge（原音 craigsmith / Freesound 437937）（CC0） |

UIの click / select / cancel は既存のポケットサウンド録音のまま。

## サンドボード

| 場面 | ファイル | 出典（採用） |
|---|---|---|
| カウント（3・2・1を2.4秒に配置） | `countdown_bleeps.bgm` | Mixkit #916（候補1） |
| 滑走ループ | `slide_sand.bgm` | Mixkit 砂 #2494（候補2） |
| 風ループ | `wind_ambience.bgm` | Mixkit「Wind blowing ambience」#2658 中盤8秒（候補1） |
| カーブ | `carve_sand.bgm` | Mixkit 砂 #2498（候補1） |
| ジャンプ | `jump_videogame.bgm` | Mixkit「Player jumping in a video game」#2043（候補1） |
| 着地・転倒 | `drop_soft.bgm` | Kenney「drop_004」（着地は候補1、転倒は柔らかめの候補3。同じ音） |
| ブースト | `boost_whoosh.bgm` | Joseph Sardin「Whoosh #8」（CC0、候補1） |
| 粉砕 | `smash_pot.bgm` | Kenney RPG「metalPot1」（CC0、候補1） |
| かすめ・半回転・カーソル | `ui_pluck.bgm` | Kenney「pluck_001」（CC0、候補1） |
| ゲージ満タン | `gauge_powerup.bgm` | Kenney Digital「powerUp7」（CC0、候補1） |
| ゴール | `goal_fanfare.bgm` | Mixkit #226（候補1） |
| 決定 | `ui_confirm.bgm` | Kenney「confirmation_001」（CC0、候補1） |
