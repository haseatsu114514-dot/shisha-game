# 採用したミニゲームBGM（TRPG・斧投げ／2026-10-20採用）

2026-10-20に、オーナーがユーザー添付の2曲をTRPG用と斧投げ用に採用した（#788）。
2026-10-21に、リポジトリへの追加と既存の `.bgm` 形式での保存をオーナーが承認。新規の生成・差替えはしていない。OP用の別曲は対象外で、追加していない。

## 音源と使用先

| 曲（ファイル名） | 出典 | 使用先 | 元音源 |
|---|---|---|---|
| Shared Discovery（`Shared Discovery.mp3`） | ユーザー添付（配布元・作者は未記入） | `assets/audio/bgm/bgm_trpg.bgm`：ボドゲカフェ（TRPG）の入店から退店まで | MP3・48 kHz・ステレオ・198.16秒・4,528,970 bytes・カバーアート埋込あり |
| Aiming groove（`Aiming groove.mp3`） | ユーザー添付（配布元・作者は未記入） | `assets/audio/bgm/bgm_axe.bgm`：斧投げ（場面への接続は #573・#489・#540 との合意待ち） | MP3・48 kHz・ステレオ・91.00秒・2,127,635 bytes・カバーアート埋込あり |

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
斧投げの倍率0.79は `remake/js/core/audio.js` の `BGM_GAIN` に入る予定。#573 の担当との編集順の合意を待っている（[#573](https://github.com/haseatsu114514-dot/shisha-game/issues/573)）。

## 検証

```bash
node --experimental-vm-modules remake/test/bgm_packaged.mjs   # 両曲の復元SHA-256一致、TRPG倍率・切替・再入場・ミュート
node --experimental-vm-modules remake/test/bgm_gain.mjs
node remake/test/browser/trpg_main.mjs
```
