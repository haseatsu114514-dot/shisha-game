# Issue #2906 作り直し立ち絵候補

採用未定の画風試験。既存のゲーム用画像は差し替えない。Codex の画像生成機能で、参照画像から新規に描き起こした。

## 参照画像の役割

- 画風の正本＝ベース版つむぎ立ち絵: `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png`
- 外見の正本＝逢縁はじめ現行立ち絵: `assets/sprites/characters/hajime/chr_hajime_normal.png`
- 外見の正本＝泡沫ひより現行立ち絵: `assets/sprites/characters/hiyori/chr_hiyori_normal.png`

既存の `assets/sprites/character_variants/new/` の同キャラ絵は参照・加工・流用していない。

## 生成指示の核

> 線は細く、輪郭線の太さと黒の強さを抑える。陰影は柔らかく、グラデーションと淡い中間色で付ける。ベタ塗り感のある平坦な塗りにしない。色づかいは淡く、彩度を上げすぎない。記号的・アイコン的な描き方（第1弾にあった輪郭の太さ・ベタ塗り感）を避け、正本の柔らかい質感に寄せる。

両画像とも、つむぎ正本は画風のみ、各キャラ現行立ち絵は顔・髪・服装・小物・ポーズの正本として指定。装飾の追加や美化は禁じ、全身・靴を収めた透過背景の縦長立ち絵として生成した。はじめの最終候補は、現行絵の控えめな笑顔に寄せるため再生成したものを選んだ。画像生成機能の出力を 896×1200 に縮小した。

## 候補

- `chr_hajime_normal_tsumugi_taste_redo.png`: 逢縁はじめ normal
- `chr_hiyori_normal_tsumugi_taste_redo.png`: 泡沫ひより normal

両方とも 896×1200・RGBA。司令塔とオーナーによる画風・外見の検品待ち。
