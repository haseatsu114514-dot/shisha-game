# 朝霧ひよりの登場背景

オーナー指定の線香花火と儚さを、乳白色・淡い桃色・薄い藤色の明るい配色で制作。
暗い初案から明るい色へ変更した生成原画を採用。人物・名前は画像に焼き込まず、現在のレース衣装の立ち絵と正本の紹介文をゲームで重ねる。

- 原画: `source.png`（1672×941）
- 生成指示と記録: `prompt.txt`、`generation.json`
- 採用PNG: `assets/ui/character_intros/hiyori.png`
- 配布画像: `remake/img/ui/character_intros/hiyori.webp`
- 台詞・表情: `data/characters.json` の `hiyori.intro_cutin`

初対面で「朝霧ひより」と名乗った直後、一度だけ登場する。背景・人物・文字がゆっくり現れ、火玉の光がかすかに揺れる。動きを減らす設定ではアニメーションを停止。既読は通常のセーブへ保存する。
PC・スマホの実画面、クリックで表示時間が短縮されないこと、セーブ後の再表示抑止を `remake/test/hiyori_intro.mjs` で確認する。

検証: mainのSKIP・タイトル改善（#302）取り込み後、登場紹介3項目と本編接続7項目がPASS。PRのCI・マージ・公開確認は継続作業。
