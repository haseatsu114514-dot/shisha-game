# 本編の効果音 第1弾（2026-11-11）

オーナー依頼「ゲーム全体で効果音やBGMを足りないところがあったり変えた方が良さそうなのがあれば変えていきたい。フリー素材で探して」（[要望台帳](../../../docs/owner_requests.md) の OTO）で入れた録音の出典。

ライセンスはすべて CC0（商用利用・加工・ゲーム同梱・公開リポジトリへの同梱が可、クレジット義務なし）。義務はないが、スタッフロール（`remake/js/scenes/staff-roll.js` の `STAFF_SOUND_MAIN`）とこの台帳に作者・題名・配布元を載せる。

| ゲームでの音（`SE.◯◯`） | ファイル（`assets/audio/se/`） | 原音 | 鳴る場面 |
|---|---|---|---|
| `crowd` 拍手 | `crowd_applause_01.mp3`・`_02.mp3` | eXpl0it3r「Applause in a large hall or church」 | 大会の結果発表・ゲーム冒頭の会場・ガラガラくじ・会話の `sfx: crowd` |
| `money` コイン | `coin_01.wav`・`coin_02.wav` | Spring Spring「Purchasing Sound Effect」／syncopika「coin sounds」 | 所持金が動いた時（`daily/hud.js`） |
| `parin` ガラス | `glass_break.wav` | Till Behrend「Glass Break」 | 大会で負けた時に画面が割れる |
| `shutter` | `camera_shutter.wav` | themightyglider「Camera」 | てつこの写真 |
| `mew` 鳴き声 | `cat_mew_01.wav`・`_02.wav` | Kerzoven「Cat Purr & Meow」／IgnasD「Meow」 | てつこが鳴く |
| `crackle` 炭 | `fire_crackle_01〜03.wav` | AntumDeluge「Fire Crackling」 | 炭を焼き始める・家シーシャ・くじ・占い |
| `affinity`・`affinityUp` ベル | `heart_bell.wav` | Spring Spring「Pleasing Bell Sound Effect」 | 好感度の通知（段階アップ・恋人は高さを変えて2回） |
| `save` | `ui_save.wav` | Kenney「Interface Sounds」confirmation_002 | セーブ完了 |

配布ページ・取得URL・原音の SHA-256・切り出し区間は [sources.json](sources.json)、ゲーム用ファイルの SHA-256 と長さは [game_files.json](game_files.json)。Kenney の原ライセンス文は [main-placeholder-audio/Kenney_Interface_Sounds_License.txt](../main-placeholder-audio/Kenney_Interface_Sounds_License.txt)（同じパック）。

## 選び方と、まだ確かめていないこと

- 作者の説明・タグと、長さ・音量の推移・帯域の測定で選んだ。**耳での確認はしていない**（オーナーの試聴待ち）。試聴は `remake/audio-preview.html`（新しい音と前の合成音を並べて聴ける）。
- 合わない音は、`remake/js/core/audio.js` の `RECORDED_SE` からその行を消せば前の合成音へ戻る（ファイルと台帳の行も消す）。
- 見送った音: 心音（Independent.nu「Heartbeat」）・爆発（NenadSimic「Muffled Distant Explosion」）・猫のゴロゴロ（Kerzoven）は、250Hz より下の音だけでできていて、スマホのスピーカーではほとんど聞こえないため入れていない。
- 拍手はホールの拍手（歓声は入っていない）。歓声の入った CC0 の録音は斧投げの `minigame/axe_cheer.wav`（qubodup）がある。

## 再生成

原音はリポジトリに置かない（拍手の原音だけで約7MB）。次のコマンドが sources.json の URL から取得し、SHA-256 を照合して作り直す（`ffmpeg` が必要。同じ入力からは同じファイルができる）。

```
python3 asset_sources/music/main-se-20261111/prepare.py
```

音量は、切り出したあとの最大値を dBFS で合わせている（拍手・コイン −9、ガラス −10、シャッター・セーブ −14、鳴き声・ベル −15、炭 −16）。ゲーム側の倍率（`gain`）はすべて 1。

確認: `node --experimental-vm-modules remake/test/main_se_20261111.mjs`（台帳とファイルの一致・クレジット・録音で鳴ること・録音が無い時の合成音）。
