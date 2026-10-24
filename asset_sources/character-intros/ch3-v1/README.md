# 第3章以降の登場カット — 制作済みデザイン分

採用済みの立ち絵がある第3章のましろ・ヴォルクを制作。既存の登場カットと同じイラスト背景・斜めの白帯・太い呼び名・二つ名・一言の構成です。人物は現在の `assets/sprites/characters/` のPNGを拡縮・配置するだけで、再描画・反転・色フィルタはありません。呼び名だけを表示し、本名は加えていません。紹介文・表情は `data/characters.json` の正本を使用しています。

| キャラ | 完成画面 | 背景のモチーフ |
|---|---|---|
| ましろ | [1280×720](mashiro/preview.png) | お茶・湯気・リネン。ましろの正体を先に明かさない |
| ヴォルク | [1280×720](volk/preview.png) | 精密な目盛り・ノギス・ダークミント。冷たい鋼青 |

[2人の一覧](comparison.png) / [動くプレビュー](index.html) / [ダウンロードして開ける単体HTML](mockup.html)

背景・帯・立ち絵・文字が順に現れ、切替・再生・一時停止・連続再生が可能です。背景生成原画・全指示は `backgrounds/`、人物・背景のSHA-256と配置は `characters.json` に保存。Noto Sans JPはOFLライセンスの必要文字サブセットを同梱し、外部通信は不要です。既存の組版CSSとプレビューJSを再利用します。

後半のナンディ・スティーブ・エミル・ムカイさん・王煙楼・シェイク・ダ・シルヴァ太陽・SHISHA-9000は、現行の採用済み人物PNGが未登録なので今回の対象から外しています。デザインを推測して描き足していません。第2章のREI・神崎のカットインは別作業（#921）です。

今回は紹介画面の素材制作です。第3章本編は未接続であり、本編進行や初対面・既読フラグ、manifest、台詞・人物設定は変更していません。接続時はこの背景・配色を `introArt` に登録し、正本の紹介文と現行立ち絵を重ねてください。

再書き出し: リポジトリrootで `python3 asset_sources/character-intros/ch3-v1/build.py` → `node asset_sources/character-intros/ch3-v1/render.cjs`。Pillow・NumPy・Playwright・Chromiumが必要。確認結果は `render-validation.json`。
