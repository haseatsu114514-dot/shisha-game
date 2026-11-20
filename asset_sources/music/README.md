# 元音源（BGM・SE）

ゲームで鳴らす最終ファイルはBGMが `assets/audio/bgm/`、SEが `assets/audio/se/`。ここはBGMの出典台帳と元データの控え。

制作・吸引・UIのCC0録音SEは [shisha-se/README.md](shisha-se/README.md) に出典・加工・原音と代用の区別を記録する。
TRPGの効果音・シナリオ別BGM（CC0・2026-11-10の仮採用）は [trpg-audio/README.md](trpg-audio/README.md)。

ミニゲーム（斧投げ）の仮SE（CC0・2026-11-10・オーナー試聴待ち）は [minigame-se/README.md](minigame-se/README.md)。

本編の仮BGM・UI効果音（CC0・2026-11-10。あとで差し替えやすい中央対応表）は [main-placeholder-audio/README.md](main-placeholder-audio/README.md)。

本編の効果音 第1弾・第2弾（CC0・2026-11-11／11-13。拍手・コイン・ガラス・シャッター・猫・炭・好感度のベル・セーブ・店の扉・入手・朝の小鳥。オーナー試聴待ち）は [main-se-20261111/README.md](main-se-20261111/README.md)。

## ゲーム用BGMの出典（40ファイル）

`assets/audio/bgm/` の実ファイルを [再生目録](../../remake/data/manifest.json) の `bgm` と照合した。「記録の所在」は今回の追記前の参照先も示す。取得日を確認できない場合は「不明」とし、確認できた採用日・生成日・出典確認日は括弧に記した。

| ファイル | 曲名 | 作者 | 配布・提供元 | 利用条件 | 取得日 | 記録の所在 | 補足 |
|---|---|---|---|---|---|---|---|
| `bgm_aftermath.bgm` | 今日の一台、そのあと | オーナー | オーナー提供（[Suno](https://suno.com/song/60d792cf-45c7-4fbf-8ae7-415e5485dd0d)） | [Suno Pro 生成時の商用利用可](https://help.suno.com/en/categories/550145-ownership) | 2026-10-25（原本提供・採用） | この README に今回追記 | [採用記録](../../docs/prompts/bgm_suno_prompts.md#2026-10-25-採用審査待ち大会後味覚不調全a候補1) |
| `bgm_axe.bgm` | Aiming groove | オーナー（`atk114514`） | オーナー添付（Suno） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 2026-10-20（添付・採用） | この README に既存行 | [ミニゲーム採用記録](adopted-minigame-bgm-20261020.md) |
| `bgm_camel_race.bgm` | Firebrand | Kevin MacLeod | [incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100830) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 不明（2026-11-10 採用） | この README に既存行 | [採用・加工記録](camel-race-firebrand.md) |
| `bgm_ch5_duel.mp3` | The Rush | tebruno99 | [OpenGameArt](https://opengameart.org/content/the-rush) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_continue_urgent.mp3` | EMGコール | BGMer | [BGMer](https://bgmer.net/music/163/) | [利用規約](https://bgmer.net/terms/)。ゲーム利用・編集可、表記任意 | 2026-10-23 | この README に今回追記 | [同梱記録](../../docs/archive/continue_voice_music_premium_20261010.md#2026-10-23-同梱配信への切替850) |
| `bgm_dubai.mp3` | Desert theme | yd | [OpenGameArt](https://opengameart.org/content/desert-theme) | CC0 1.0 | 2026-11-12 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_ending.mp3` | Daisy | Kistol | [OpenGameArt](https://opengameart.org/content/daisy) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_ethnic05.bgm` | 民族05 | 森田交一 | [魔王魂](https://maou.audio/bgm_ethnic05/) | [利用条件](https://maou.audio/rule/)。商用ゲーム・加工可、音源単体の再配布不可、クレジット推奨 | 不明（2026-11-07 採用） | この README に今回追記 | 砂漠ライド・なる戦。[#2796](https://github.com/haseatsu114514-dot/shisha-game/issues/2796)・[#2802](https://github.com/haseatsu114514-dot/shisha-game/pull/2802) |
| `bgm_ethnic08.bgm` | 民族08 ピラミッド アレンジ版 | 森田交一 | [魔王魂](https://maou.audio/bgm_ethnic08/) | [利用条件](https://maou.audio/rule/)。商用ゲーム・加工可、音源単体の再配布不可、クレジット推奨 | 不明（2026-11-07 採用） | この README に今回追記 | 砂漠ライド・ヌール戦。[#2796](https://github.com/haseatsu114514-dot/shisha-game/issues/2796)・[#2802](https://github.com/haseatsu114514-dot/shisha-game/pull/2802) |
| `bgm_ethnic12.bgm` | 民族12 アラブの商人 | 森田交一 | [魔王魂](https://maou.audio/bgm_ethnic12/) | [利用条件](https://maou.audio/rule/)。商用ゲーム・加工可、音源単体の再配布不可、クレジット推奨 | 不明（2026-11-07 採用） | この README に今回追記（既存記録はキーのみ） | 砂漠ライド・練習。[#2796](https://github.com/haseatsu114514-dot/shisha-game/issues/2796)・[#2802](https://github.com/haseatsu114514-dot/shisha-game/pull/2802) |
| `bgm_judging.bgm` | 票が開くまで | オーナー | オーナー提供（[Suno](https://suno.com/song/89da7026-8057-47f4-8114-a4c48e00c149)） | [Suno Pro 生成時の商用利用可](https://help.suno.com/en/categories/550145-ownership) | 2026-10-25（原本提供・採用） | この README に今回追記 | [採用記録](../../docs/prompts/bgm_suno_prompts.md#2026-10-25-採用審査待ち大会後味覚不調全a候補1) |
| `bgm_map.mp3` | Chill lofi inspired | omfgdude | [OpenGameArt](https://opengameart.org/content/chill-lofi-inspired) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_purikura.bgm` | プリクラ A｜平成ユーロビート | オーナー（`atk114514`） | オーナー添付（Suno） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 2026-10-24（添付・採用） | この README に今回追記（[TRPG README](trpg-audio/README.md#シナリオ別bgm) はキーのみ） | [ミニゲーム採用記録](adopted-minigame-bgm-20261020.md)・埋め込みタグ |
| `bgm_purikura_b.bgm` | プリクラ B｜渋谷系バブルガム・ポップ | オーナー（`atk114514`） | オーナー添付（Suno） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 不明（タグ上の生成日 2026-10-24） | この README に今回追記 | [ミニゲーム採用記録](adopted-minigame-bgm-20261020.md)・埋め込みタグ |
| `bgm_purikura_d.bgm` | プリクラ D｜懐かしいプリクラ機・ゲーセン風 | オーナー（`atk114514`） | オーナー添付（Suno） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 不明（タグ上の生成日 2026-10-24） | この README に今回追記 | [ミニゲーム採用記録](adopted-minigame-bgm-20261020.md)・埋め込みタグ |
| `bgm_result_emotional.mp3` | Daisy | Kistol | [OpenGameArt](https://opengameart.org/content/daisy) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_rival_shop.mp3` | Cool City | MintoDog | [OpenGameArt](https://opengameart.org/content/cool-city) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_smoke_lab.mp3` | Dark Horse | Centurion_of_war | [OpenGameArt](https://opengameart.org/content/dark-horse) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_taste_distant.bgm` | 香りが遠い夜 | オーナー | オーナー提供（[Suno](https://suno.com/song/54000e7a-69e9-41ae-899b-d031809f65b5)） | [Suno Pro 生成時の商用利用可](https://help.suno.com/en/categories/550145-ownership) | 2026-10-25（原本提供・採用） | この README に今回追記 | [採用記録](../../docs/prompts/bgm_suno_prompts.md#2026-10-25-採用審査待ち大会後味覚不調全a候補1) |
| `bgm_tetsuko_time.bgm` | 月明かりの灯台 | 甘茶 | [甘茶の音楽工房](https://amachamusic.chagasi.com/music_tsukiakarinotodai.html) | [利用規約](https://amachamusic.chagasi.com/terms.html)。商用・非商用ゲームのBGM可、音源単体の販売・二次配布不可、表記任意 | 不明（2026-11-07 採用） | この README に今回追記 | てつこといっしょ。[#2796](https://github.com/haseatsu114514-dot/shisha-game/issues/2796)・[#2802](https://github.com/haseatsu114514-dot/shisha-game/pull/2802) |
| `bgm_tournament_craft.bgm` | Mind Duel | shimtone | [OpenTracks](https://opentracks.com/bgm/detail/15427) | [OpenTracks 規約](https://opentracks.com/help/articles/license/) | 2026-10-09 | この README に既存行 | [大会曲の記録](confirmed-tournament-bgm-20261009.md) |
| `bgm_tournament_edm.bgm` | Overture! | 秋山裕和 | [H/MIX GALLERY](https://www.hmix.net/) | [利用ガイド](https://www.hmix.net/music_gallery/info.htm)。個人・同人ゲーム利用可、単体再配布不可 | 2026-10-09 | この README に既存行 | [大会曲の記録](confirmed-tournament-bgm-20261009.md) |
| `bgm_tournament_wait.mp3` | Tension Theme | Umplix | [OpenGameArt](https://opengameart.org/content/tension-theme) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_trpg.bgm` | Shared Discovery | オーナー（`atk114514`） | オーナー添付（Suno） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 2026-10-20（添付・採用） | この README に既存行・[TRPG README](trpg-audio/README.md#シナリオ別bgm) | [ミニゲーム採用記録](adopted-minigame-bgm-20261020.md) |
| `bgm_trpg_castle.mp3` | Apparitions Ball | Bobjt | [OpenGameArt](https://opengameart.org/content/apparitions-ball) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_fox.mp3` | Hot Springs Town | Kistol | [OpenGameArt](https://opengameart.org/content/hot-springs-town) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_heist.mp3` | Covert Action | congusbongus | [OpenGameArt](https://opengameart.org/content/covert-action) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_island.mp3` | Treasure Hunter | TAD | [OpenGameArt](https://opengameart.org/content/treasure-hunter) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_leaf.mp3` | musicbox2_cute_tune | Aureolus_Omicron | [OpenGameArt](https://opengameart.org/content/4-music-box-tracks) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_magic.mp3` | Magic Town | controllerhead | [OpenGameArt](https://opengameart.org/content/magic-town) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_mansion.mp3` | musicbox1_spooky_waltz | Aureolus_Omicron | [OpenGameArt](https://opengameart.org/content/4-music-box-tracks) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_shark.mp3` | Chest of Adventure | Eldritch Grim | [OpenGameArt](https://opengameart.org/content/chest-of-adventure) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_space.mp3` | Space Music: Out There | yd | [OpenGameArt](https://opengameart.org/content/space-music-out-there) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_trpg_stage.mp3` | Death Waltz | northivanastan | [OpenGameArt](https://opengameart.org/content/death-waltz) | CC0 1.0 | 2026-11-10 | [TRPG README](trpg-audio/README.md#シナリオ別bgm) | — |
| `bgm_world_stage.mp3` | Dare The Bustloro Way | Spring Spring | [OpenGameArt](https://opengameart.org/content/dare-the-bustloro-way) | CC0 1.0 | 2026-11-10 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `bgm_yuzugaya.mp3` | Mocha Frapp | Pro Sensory | [OpenGameArt](https://opengameart.org/content/mocha-frapp) | CC0 1.0 | 2026-11-12 | [本編仮音源 README](main-placeholder-audio/README.md) 経由の [sources.json](main-placeholder-audio/sources.json) | — |
| `kansetsu_shomei_to_black_coffee.bgm` | 間接照明とブラックコーヒー | オオヒラセイジ | [OpenTracks（旧 DOVA-SYNDROME）](https://dova-s.jp/bgm/detail/17173) | [OpenTracks 規約](https://opentracks.com/help/articles/license/) | 不明（2026-11-18 出典確認） | この README に既存行 | [出典確認記録](kansetsu-shomei-opentracks-20261118.md) |
| `sweets_or_sweets.mp3` | おいしいお菓子を捧げよ！ | Napi | [M-ART](http://mart.kitunebi.com) | 不明 | 不明（2026-10-06 採用・収録） | この README に既存行（元 OGG の行） | OGG からゲーム用 MP3 に変換 |
| `title.mp3` | Hookah Midnight Loop | オーナー（`atk114514`） | [Suno](https://suno.com/song/77d338fd-359c-4915-b280-50d2bf8c1369)（埋め込みタグ） | [Suno のプラン別条件](https://help.suno.com/en/categories/550145-ownership)。生成時のプランは不明 | 不明（タグ上の生成日 2026-06-08 UTC） | この README に今回追記 | タイトル画面・スタッフロール |
| `tonari.mp3` | 不明 | 不明（artist タグは `Asahina akari`） | 不明 | 不明 | 不明 | この README に今回追記 | tonari 店内 |

OpenTracks の2曲はゲームBGMとして利用可。単体公開や容易に取り出せる状態での利用を避けるため、ゲーム用形式で保存している。魔王魂・甘茶の4曲も、採用時の指示に従ってゲーム用形式で収録した。

### 配布元が不明のファイル

| ファイル | 確認できた情報 |
|---|---|
| `tonari.mp3` | tonari 店内で再生。埋め込みタグに `Asahina akari` とあるが、曲名・作者を裏付ける配布ページ、利用条件、取得日の記録は見つからなかった。 |

### 現行の40ファイルに含まれない曲

| ファイル・キー | 曲名 | 作者 | 配布元 | 利用条件 | 取得日 | 状態 |
|---|---|---|---|---|---|---|
| `bgm_ethnic09.bgm` | 民族09 揺れる提灯 | 森田交一 | [魔王魂](https://maou.audio/bgm_ethnic09/) | [利用条件](https://maou.audio/rule/) | 不明（2026-11-07 採用） | 旧くじBGM。再生を [#3835](https://github.com/haseatsu114514-dot/shisha-game/pull/3835) で外し、オーナー判断を受けて音源・目録・クレジットを [#3891](https://github.com/haseatsu114514-dot/shisha-game/pull/3891) で削除済み。 |
| `morning_cafe.mp3` | morning cafe（ファイル名） | 不明 | 不明 | 不明 | 不明 | 元音源のみ保管。用途決定まで保留。 |

## スタッフロールと再生の照合

[スタッフロールの使用楽曲](../../remake/js/scenes/staff-roll.js) と [本編BGM対応表](../../remake/js/core/story-audio.js) を比較した。対応表の外で鳴る曲は、各機能の再生キーを確認した。ここでの再生先はコード上の指定。

| 再生先・キー | 音源 | 使用楽曲欄 | 照合結果 |
|---|---|---|---|
| `title`・`staffRoll` → `title` | Hookah Midnight Loop | 掲載なし | スタッフロール自体が再生する曲。オーナーの Suno 自作曲。 |
| `judging`・`aftermath`・`tasteDistant` | 票が開くまで／今日の一台、そのあと／香りが遠い夜 | 掲載なし | オーナーの Suno 自作曲。 |
| `shopHome` → `tonari` | 不明 | 掲載なし | 配布元と曲名が不明。 |
| `map` → `bgm_map` | Chill lofi inspired | 掲載あり | 対応表と目録に登録済みだが未使用。地図は第1・3章が `dailyCity`、第2章が `yuzugaya`、第4章が `dubai`、第5章が `shopHome`。 |
| `resultWin`・`ending` | Daisy | 1曲として掲載 | 別々の2ファイルに同一曲。 |
| 砂漠ライド・てつこといっしょ | 民族12／08／05、月明かりの灯台 | 掲載あり | 本編対応表の外で再生。魔王魂3曲の作者欄は推奨クレジットの「魔王魂」、公式の作曲者名は森田交一。 |
| ラクダレース・TRPGのシナリオ10曲 | Firebrand、OpenGameArt の10曲 | 掲載あり | 本編対応表の外で再生。砂漠ライド練習の民族12とラクダレースの Firebrand は別曲。 |
| コンティニュー → `bgm_continue_urgent` | EMGコール | 掲載なし | 本編対応表の外で再生。BGMer のクレジットは任意。 |
| ボドゲカフェ・斧投げ・プリクラ | Shared Discovery／Aiming groove／プリクラ A・B・D | 掲載なし | 本編対応表の外で再生するオーナーの Suno 自作曲。 |
| 旧くじ → `bgm_ethnic09` | 民族09 揺れる提灯 | 削除済み | #3726 の照合コメントは削除前の状態。現行は再生・掲載ともなし。 |

本編対応表のその他の使用曲は、台帳の曲名と使用楽曲欄が一致する。Suno 自作曲の扱いは [#3726 の2026-11-18オーナー決定](https://github.com/haseatsu114514-dot/shisha-game/issues/3726#issuecomment-6968423219) に従う。
