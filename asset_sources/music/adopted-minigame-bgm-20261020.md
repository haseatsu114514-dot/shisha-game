# 採用したミニゲームBGM（TRPG・斧投げ／2026-10-20採用）

2026-10-20に、オーナーがユーザー添付の2曲をTRPG用と斧投げ用に採用した（#788）。
2026-10-21に、リポジトリへの追加と既存の `.bgm` 形式での保存をオーナーが承認。新規の生成・差替えはしていない。OP用の別曲は対象外で、追加していない。

## 音源と使用先

| 曲（ファイル名） | 出典 | 使用先 | 元音源 |
|---|---|---|---|
| Shared Discovery（`Shared Discovery.mp3`） | ユーザー添付（配布元・作者は未記入） | `assets/audio/bgm/bgm_trpg.bgm`：ボドゲカフェ（TRPG）の入店から退店まで | MP3・48 kHz・ステレオ・198.16秒・4,528,970 bytes・カバーアート埋込あり |
| Aiming groove（`Aiming groove.mp3`） | ユーザー添付（配布元・作者は未記入） | `assets/audio/bgm/bgm_axe.bgm`：斧投げBARの入店から退店まで、ひよりとの斧投げの実プレイ中 | MP3・48 kHz・ステレオ・91.00秒・2,127,635 bytes・カバーアート埋込あり |

byte数は #788 の採用記録と一致。元MP3は公開リポジトリに置かず、[大会BGMと同じ形式](confirmed-tournament-bgm-20261009.md#利用条件と保存形式)（`SUIENBGM1`・AES-256-GCM）に変換した。元音源のバイト列は変更していない（再圧縮・カバーアート除去なし）。

元音源のSHA-256：

```text
Shared Discovery: ebb517047cb706879953610bba7005c944e60274ba9b0e1b228fba022418b4fa
Aiming groove:    e1ad7a541a099dc363baab666c04109fd0e974190b4a3d901857a9713cbccbac
```

```bash
python3 remake/tools/pack_bgm.py "/tmp/Shared Discovery.mp3" assets/audio/bgm/bgm_trpg.bgm
python3 remake/tools/pack_bgm.py "/tmp/Aiming groove.mp3" assets/audio/bgm/bgm_axe.bgm
python3 remake/tools/build_manifest.py --audio-only
```

## 音量補正

FFmpeg `ebur128` で、設定音量を掛ける前の Integrated LUFS と True Peak を測定した。切替の前後の曲より大きくならない倍率を選んでいる。

| 曲 | 元のLUFS | 曲別倍率 | 補正後LUFS | 補正後True Peak（dBTP） | 前後の曲 |
|---|---:|---:|---:|---:|---|
| Shared Discovery（TRPG） | −15.7 | **1.00**（既定・追加なし） | −15.7 | −3.5 | マップ「間接照明とブラックコーヒー」−13.65 から入り、退店時に同曲へ戻る。補正なしで約2 dB小さい |
| Aiming groove（斧投げ） | −15.3 | **0.79**（オーナー決定） | −17.35 | −6.5 | tonari −17.34 に合わせる。マップ −13.65 から入る場合も大きくならない |

補正後値は入力値に `20 × log10(倍率)` を加えた値。TRPGの倍率は1.0を超えて上げない。`HTMLAudioElement.volume` が1以下になるように、倍率は減衰側だけで使う。
斧投げの倍率0.79は `remake/js/core/audio.js` の `BGM_GAIN` に1項目だけ追加した（[#573](https://github.com/haseatsu114514-dot/shisha-game/issues/573) に告知）。

## 検証

```bash
node --experimental-vm-modules remake/test/bgm_packaged.mjs   # 両曲の復元SHA-256一致、TRPG倍率・切替・再入場・ミュート
node --experimental-vm-modules remake/test/bgm_gain.mjs
node remake/test/browser/trpg_main.mjs
node remake/test/browser/axe_bgm_788.mjs   # 斧投げBAR・ひよりの斧投げで開始・終了・中断・再入場
```

## プリクラ（2026-10-24追加採用・#948）

オーナー添付「プリクラ A｜平成ユーロビート.mp3」を採用。`assets/audio/bgm/bgm_purikura.bgm`へ既存のゲーム用形式で保存。元MP3とカバー画像は再圧縮・改変せず内包する。出典はユーザー添付、作者・外部配布ページの記入はない。

48 kHz、ステレオ、189.84秒、4,605,022 bytes。元音源SHA-256は `6c92ac5296b732dffb2d197e7301c987fd30426fc3955f04628fef5071232c40`。FFmpeg ebur128で −14.8 LUFS、True Peak −3.2 dBFS、曲別倍率1.0。BGM設定・ミュートは既存処理を使う。

プリクラ演出a/bの開始からシールを渡す直前まで再生し、終了時に元の店舗曲へ戻す。SKIP・動き軽減で演出を省く場合は曲も変えない。LOADで新しい場面へ移った場合、その曲を戻さない。復元SHAと再生・終了・中断は `bgm_packaged.mjs` / `purikura_motion.mjs` で検証。

追加添付B「渋谷系バブルガム・ポップ」とD「懐かしいプリクラ機・ゲーセン風」も採用。撮影ごとにA/B/Dの3曲から等確率で1曲だけ選ぶ。同曲が続く場合もある。演出a/bの選択とは独立で、セーブに曲順を加えない。

| 曲 | 保存先 | 長さ | 元bytes | SHA-256 | LUFS / peak |
|---|---|---:|---:|---|---|
| B | `bgm_purikura_b.bgm` | 151.632秒 | 3,622,466 | `d348ce8a91d7cad1da14c71b51870ea2c20f44c379f5277213d80f0eac6e805e` | −15.2 / −2.6 dBFS |
| D | `bgm_purikura_d.bgm` | 139.584秒 | 3,441,265 | `4848a6ffbccf9f3bc4911ef1043cd3143fbaf73a6f789d5181137477dcb899dc` | −15.0 / −4.1 dBFS |

追加曲もユーザー添付・既存ゲーム用形式・再圧縮なし・曲別倍率1.0。3曲の音量差は0.4 LUFS以内。
