# 確定した大会BGM（2026-10-09）

オーナー指定の2曲を公式配布元から取得。タイトル曲は既存のまま。

## 音源と再生場面

| 曲／作者 | 公式配布元 | 使用先 | 元音源 |
|---|---|---|---|
| Overture!／秋山裕和（Hirokazu Akiyama） | [H/MIX GALLERY](https://www.hmix.net/)・[n142.mp3](https://www.hmix.net/music/n/n142.mp3) | `bgm_tournament_edm`：開幕挨拶の直前から選手入場の終了まで | MP3・44.1 kHz・ステレオ・70.992秒・1,423,995 bytes |
| Mind Duel／shimtone | [公式曲ページ](https://opentracks.com/bgm/detail/15427)・[作者](https://opentracks.com/creator/detail/290) | `bgm_tournament_craft`：ROUND 1の開始前からROUND 3終了の会話まで | 公式ループ対応のtrack 1・MP3・44.1 kHz・ステレオ・115.909秒・3,710,122 bytes |

Overture!は[ユーザー指定動画](https://youtu.be/8U7XRoRWTbA)のタイトル「【フリーBGM】楽しいイベントのオープニングなどに！【Overture !】」と照合。
[紹介記事](https://3freebgm.com/archives/column/post11)も同じ動画IDを埋め込み、公式のn142.mp3を案内している。
動画音声を抽出せず、公式MP3を使用した。Mind Duelは公式ダウンロード画面から取得。

元音源のSHA-256：

```text
Overture!: 3ed10a23e30bada9814d9401371ac9643cce6825d66cb626997f4b14398920d1
Mind Duel: fd9856eb18725aff6c91d25f90522d0e9be82ed3f9e09ea5c026e00fe577b050
```

会場到着・FLAVOR TRIALの審査・結果曲は引き続き選定待ちの合成BGM。
制作曲は審査開始前に止める。店舗曲の未採用候補は追加していない。

## 利用条件と保存形式

2026-10-09に公式ガイドと作者の条件を確認：

- [H/MIX利用ガイド](https://www.hmix.net/music_gallery/info.htm)：個人制作・同人／インディーゲームは有償配布を含め無料・申請不要。クレジットは任意。法人の商用製品等は別ライセンス。楽曲単体の再配布は禁止。
- [OpenTracksライセンス](https://opentracks.com/help/articles/license/)：ゲームBGMでの有償・無償利用と形式変換・ループ加工を許可。shimtoneは同ライセンスに準拠し、追加条件なし。禁止事項7・8は、音源の単体配布や、変換せず音声ファイルへ容易にアクセス・複製できる状態での利用を禁じる。

公開GitHubへ元MP3を置かず、ゲーム専用の `.bgm` に変換した。
形式は `SUIENBGM1`（9 bytes）＋ランダムnonce（12 bytes）＋AES-256-GCMの暗号文と認証タグ（16 bytes）。ヘッダーを追加認証データに使用。
ゲーム内で復元し、`audio/mpeg`のBlobとして再生。既存のMP3再生も維持する。
形式キーはコード内に公開されており、完全な抽出防止や秘密鍵管理を目的としない。単体MP3をそのまま配布する形を避けるためのゲーム組み込み形式。
HTTPS（GitHub Pages）またはlocalhostのWeb Crypto APIを使用する。

再取得時は上の公式ページからダウンロードし、公開リポジトリ外の一時フォルダで扱う。

```bash
# pack_bgm.pyの依存: cryptography
python3 remake/tools/pack_bgm.py /tmp/Overture.mp3 assets/audio/bgm/bgm_tournament_edm.bgm
python3 remake/tools/pack_bgm.py /tmp/Mind_Duel.mp3 assets/audio/bgm/bgm_tournament_craft.bgm
python3 remake/tools/build_manifest.py --audio-only
```

取得失敗時は再試行可能。再生時も失敗した場合は従来の大会用合成音へ戻し、ゲーム進行を止めない。
大会到着中に先読みし、曲切替後に届いた古い音源が再生されないようにする。

## 音量補正

FFmpeg `loudnorm`で全曲の入力Integrated LUFSとTrue Peakを測定。
設定音量を掛ける前の値で比較し、新しい2曲は既存のタイトル・日常・サメちゃん曲に近い約−14 LUFSへ減衰させた。
既存曲の倍率と全体の初期設定は変更しない。音源の再圧縮・リミッター・ダイナミクス変更も行っていない。

| 曲 | 元のLUFS | 曲別倍率 | 補正後LUFS | 補正後True Peak（dBTP） |
|---|---:|---:|---:|---:|
| タイトル | −14.36 | 1.00（既存） | −14.36 | +0.01 |
| tonari | −17.34 | 1.00（既存） | −17.34 | −1.05 |
| 間接照明とブラックコーヒー | −13.65 | 1.00（既存） | −13.65 | +0.55 |
| おいしいお菓子を捧げよ！ | −8.56 | 0.55（既存） | −13.75 | −3.62 |
| Overture! | −8.12 | **0.51** | **−13.97** | **−4.01** |
| Mind Duel | −10.59 | **0.67** | **−14.07** | **−2.09** |

補正後値は入力値に `20 × log10(倍率)` を加えた値。初期設定BGM音量0.5では、各値からさらに約6.02 dB下がる。
設定変更・フェード中でも同じ倍率を使う。前曲のフェードインを取り消してからフェードアウトし、短時間の切替で前曲の音量が戻ることを防ぐ。
