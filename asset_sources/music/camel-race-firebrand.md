# ラクダレースBGM（Firebrand / 2026-11-10採用）

オーナーが2026-11-10に、キャメルレース用の差し替え候補から Kevin MacLeod の「Firebrand」（CC BY 4.0）を選んだ。レース中のBGMだけを差し替える。砂漠ライドの練習BGM（`bgm_ethnic12`）は別ミニゲームなのでそのまま。

## 音源

| 項目 | 内容 |
|---|---|
| 曲名 | Firebrand |
| 作曲 | Kevin MacLeod（incompetech.com） |
| ライセンス | Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/ |
| 公式ページ | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100830 |
| 公式BPM / 長さ | 164 BPM、5:59（原曲） |
| 使用先 | `assets/audio/bgm/bgm_camel_race.bgm`：ラクダレースの出走〜リザルトを閉じるまで |

元のMP3は公開リポジトリに置かない。ゲーム専用形式（`SUIENBGM1`）で保存する。

## 加工

原曲は320kbps・約14MB。レース用に、公式164BPMの小節に合わせた64小節（約93.66秒）を切り出し、1拍（約0.366秒）のクロスフェードでループしやすい形にした。開始はエネルギーが上がる80小節目（約117.07秒）から。192kbps・44.1kHzステレオへ再エンコードし、FFmpeg `loudnorm` で約 −14 LUFS、True Peak −1.2 dBTP にそろえた。曲別倍率は既定の 1.00。

切り出し後の元MP3: 93.701秒、2,249,627 bytes。SHA-256:

```text
a93af4ddbf2e85aa7519fa55a4135dab50f3ffbdfc83828691e284a07be2904d
```

```bash
python3 remake/tools/pack_bgm.py /tmp/firebrand-loop.mp3 assets/audio/bgm/bgm_camel_race.bgm
python3 remake/tools/build_manifest.py --audio-only
```
