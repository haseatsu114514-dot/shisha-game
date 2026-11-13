# TRPGの役衣装の絵 — 台紙つきの原画

`backing/<シナリオ>/<絵>.webp`（896×1200）は、ゲームで使う役衣装の絵 `remake/img/ui/trpg/costumes/<シナリオ>/<絵>.webp` の**背景を抜く前**の絵。平らな生成りの台紙（RGB 239,229,207）の上に全身が描かれている。
2026-11-13 に、背景抜きをやり直せるよう Git の履歴（`e7a2343c` の1つ前）から取り出して置いた（TRF22）。画像は Git LFS。見る・加工する時は `git lfs pull --include="asset_sources/trpg-costumes/**"`。

## 背景の抜き方

```bash
python3 tools/trpg_costume_cutout.py --check        # 原画・透過版・点の食い違いを一覧
python3 tools/trpg_costume_cutout.py <シナリオ>/<絵>.webp   # その絵を作り直す（--all で全部）
```

- 縁からつながる台紙は自動で抜ける。**線に囲まれたすき間（髪の房の間・腕と体の間・脚の間・弓や竪琴の弦の間）は、色だけでは生成りの服・肌・小物と区別できない**ので、人が絵を見て決めた点 `tools/trpg_costume_cutout_gaps.json` から抜く。
- 残した物（抜かない）: 生成りや白の服・襟・袖口・手袋・足袋、目の白、髪飾り、紙の小物、鎧の光、網、足元の影。迷う所は抜かない。

## 新しい役衣装を足す時

1. 台紙つきの絵（896×1200・生成りの台紙）を `backing/<シナリオ>/<キャラ>_<役>.webp` に置く。
2. `python3 tools/trpg_costume_cutout.py --survey <確認用フォルダ> <シナリオ>/<絵>.webp` で、抜き残しの候補を拡大した一覧を作る。札の文字は「種類 [x, y] 画素数」。
3. 一覧を1つずつ見て、台紙が見えている所だけ、`trpg_costume_cutout_gaps.json` のその絵の `gaps` / `rims` / `wide`（札の種類 gap / rim / wide）に `[x, y]` を書く。
4. `python3 tools/trpg_costume_cutout.py --preview <確認用フォルダ> <シナリオ>/<絵>.webp` で作り、暗い背景に載せた絵を等倍以上で見る（髪の先・すき間・白い服や目に穴が無いこと）。2〜4 を、候補に台紙が残らなくなるまで繰り返す。
5. `git add` のあと `git lfs ls-files` で、原画と透過版が LFS になったことを確かめる。
