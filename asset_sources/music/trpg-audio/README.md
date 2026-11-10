# TRPG の効果音・BGM（仮・2026-11-10）

オーナー依頼（2026-11-10）「Trpgにも効果音とかBGMを合うもの探して一旦入れて欲しい」に合わせて、**一旦入れた仮の音**。
試聴して合わないものは差し替える前提。選定は曲・音のタグ／作者の説明と波形（音の立ち上がり・ジングルの音程の上下）で行い、**耳での試聴はしていない**。

## ライセンス

すべて **CC0 1.0**（[原文](https://creativecommons.org/publicdomain/zero/1.0/)）。商用利用・加工・ゲーム同梱・GitHubでの再配布が可能で、クレジット表記は不要。
2026-11-10 に OpenGameArt.org の各ページの License 欄が CC0 であることを確認した（複数ライセンス併記の曲は採用していない）。
Kenney の3パックは原ライセンス文を同じフォルダに保存した（`Kenney_*_License.txt`）。

原音はリポジトリに置かない。取得元URL・バイト数・SHA-256 は [sources.json](sources.json)、ゲーム用ファイルのハッシュ・音量補正は [game_files.json](game_files.json)。
BGM は CC0 なので、`.bgm`（単体再配布を避けるゲーム専用形式）にはせず、普通の MP3 で置いた。

## 鳴る場面と音

| 場面 | 種類（`js/trpg/audio-cues.js`） | 音 | 出典 |
|---|---|---|---|
| 本棚で本を選ぶ・物語の開始 | `open` | 本を開く音 | Kenney「RPG Audio」bookOpen |
| 場面が進む（探索→見立て→山場など） | `page` | ページをめくる音 ×2 | Kenney「RPG Audio」bookFlip2/3 |
| ダイスを振る | `shake`＋`land` | 手の中で振る音 → 0.74秒後に2個が卓へ落ちる音（×3からランダム）。着地は演出の780/850msに合わせた | Kenney「Casino Audio」dice-shake-1, dice-throw-1〜3 |
| 1個だけ振り直す | `rethrow` | 1個を投げる音 ×2 | Kenney「Casino Audio」die-throw-2/4 |
| 連携札を出す | `card` | 札を置く音 ×2 | Kenney「Casino Audio」card-place-1/2 |
| 手がかりのメモが卓へ滑る | `slip` | 札が滑る音 ×2 | Kenney「Casino Audio」card-slide-1/2 |
| 判定 成功 / 部分成功 / 失敗 | `success` / `mixed` / `trouble` | ピチカートのジングル（上がる / 少し上がる / 少し下がる） | Kenney「Music Jingles」PIZZA10 / 08 / 09 |
| クリティカル（20-20）/ ファンブル（1-1） | `critical` / `fumble` | 音階を駆け上がる / 長く下がるジングル | Kenney「Music Jingles」PIZZA02 / 14 |
| 結末 | `ending` | 締めのジングル | Kenney「Music Jingles」PIZZA15 |
| 手がかり発見・タップ | `clue` / `tap` | 従来の合成音のまま | — |

録音が読めない種類は従来の合成音で鳴る。音量は設定の「効果音」音量とミュートに従う（既定0.7で従来と同じ大きさ）。

## シナリオ別BGM

卓に着いたらシナリオの見た目テーマ（`presentation.theme`）の曲へ替え、卓を閉じたら入る前の曲（ボドゲカフェの `bgm_trpg`）へ戻す。音量は設定の「BGM」音量に従う。

| シナリオ | テーマ | BGM キー | 曲 / 作者 | 出典 |
|---|---|---|---|---|
| 世界一普通の一台（ordinary-cup） | harbor | `bgm_trpg` | Shared Discovery（既存の採用曲） | [adopted-minigame-bgm-20261020.md](../adopted-minigame-bgm-20261020.md) |
| サメは閉店を待たない（shark-last-order） | shark | `bgm_trpg_shark` | Chest of Adventure / Eldritch Grim | [OGA](https://opengameart.org/content/chest-of-adventure) |
| 葉っぱ耳の郵便猫（leaf-mail） | leaf | `bgm_trpg_leaf` | musicbox2_cute_tune（4 Music Box Tracks）/ Aureolus_Omicron | [OGA](https://opengameart.org/content/4-music-box-tracks) |
| 怪盗と原点の林檎（apple-thief） | heist | `bgm_trpg_heist` | Covert Action / congusbongus | [OGA](https://opengameart.org/content/covert-action) |
| サメ島の宝の地図（shark-island） | island | `bgm_trpg_island` | Treasure Hunter / TAD | [OGA](https://opengameart.org/content/treasure-hunter) |
| 朝霧の王国と、最後の一台（mist-kingdom） | mist | `bgm_trpg_magic` | Magic Town / controllerhead（fading-familiar と共用） | [OGA](https://opengameart.org/content/magic-town) |
| 星の駅の煙職人ロボ（smoke-robot） | space | `bgm_trpg_space` | Space Music: Out There / yd | [OGA](https://opengameart.org/content/space-music-out-there) |
| 試験前夜、消えかけの使い魔（fading-familiar） | magic | `bgm_trpg_magic` | Magic Town / controllerhead | [OGA](https://opengameart.org/content/magic-town) |
| 夜市と狐のお面（fox-market） | fox | `bgm_trpg_fox` | Hot Springs Town / Kistol | [OGA](https://opengameart.org/content/hot-springs-town) |
| 幕の降りない劇場（stage-ghost） | stage | `bgm_trpg_stage` | Death Waltz / northivanastan | [OGA](https://opengameart.org/content/death-waltz) |
| 月光花の古城と、終わらないアンコール（moonflower-encore） | castle | `bgm_trpg_castle` | Apparitions Ball / Bobjt | [OGA](https://opengameart.org/content/apparitions-ball) |
| 盛れない勇者と、プリ帳の魔王（purikura-hero） | sparkle | `bgm_purikura` | 既存のプリクラ曲 | [README.md](../README.md) |
| 人形館のレクイエム（doll-requiem） | mansion | `bgm_trpg_mansion` | musicbox1_spooky_waltz（4 Music Box Tracks）/ Aureolus_Omicron | [OGA](https://opengameart.org/content/4-music-box-tracks) |

作者名は OpenGameArt の投稿者名。オーナー判断（2026-11-10）で、CC0 だがスタッフロール（`remake/js/scenes/staff-roll.js`）に曲名・作者と Kenney の効果音を載せる。

## 変換と音量

- SE: 先頭の無音を削り、モノラル 44.1 kHz 16bit WAV。ピークを −10〜−16 dBFS にそろえた（`prepare.py` の表）。合計 19本・約0.9 MB。
- BGM: ステレオ 44.1 kHz・80 kbps MP3。ffmpeg `loudnorm` で測った Integrated LUFS を −16 LUFS（`bgm_trpg` の −15.7 に近い値）へ寄せ、True Peak が −1.5 dBTP を超えない範囲で増減した。曲別倍率（`BGM_GAIN`）は足していない。合計 10曲・約11.8 MB。
- 取得した原音の合計は 27,859,218 bytes（約27.9 MB）。

再生成（ffmpeg が必要。原音は `/tmp/trpg-audio-cache` に取得して SHA-256 を照合）:

```bash
python3 asset_sources/music/trpg-audio/prepare.py
```

BGM を足し替えたら `remake/data/manifest.json` の `bgm` 一覧も更新する（`python3 remake/tools/build_manifest.py --audio-only`）。

## 未確認

- 耳での試聴（曲調・音色・ジングルの明暗）。特にファンブル・失敗のジングルの暗さ、宇宙テーマ曲（元が −26.6 LUFS と小さく +6.8 dB 上げた）。
- 曲のループのつなぎ目（元がループ用に作られていない曲もある）。
- 実機スマホ/Safari での再生。
