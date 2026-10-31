# 登場カットインのグラフィック絵柄（2026-10-31 試作）

目を髪で隠した、色数を絞った平面ポスター調の人物絵。設定「登場カットインの絵柄」で旧（立ち絵）へいつでも戻せる。

- `owner_originals/` オーナー作成の原画（黒背景）。合格: サメちゃん・あげは(v1は上が切れるため作り直し)・凛。パッキー・ひより・なる・スミさん・はじめは背景だけ塗り替えて使用。
- `portraits/` 生成した原画（切り抜き用のマゼンタ背景、ひよりのみ緑）。モデル gpt-image-2.5-sunburst。
  - 指示文: `portrait_prompt.txt`（BGCOLOR を背景色に置換）＋ `characters.tsv` の人物欄。画風見本はサメちゃん・あげは(v1)・凛の原画、人物見本は現行の normal 立ち絵。
  - 年齢・体型を厳守させる文、目元を「黒い帯」にしない文を入れる。お姉さんはみんとと別のポーズ・配色にする（正体を伏せる）。
- `backgrounds/` 背景の描き直し（mashiro / nagumo ほか初期の試作）。指示文 `background_prompt.txt`。
- `chatgpt-20261031/` オーナーが ChatGPT で作った作り直し分（人物10・背景22、#2144）。採用した案は `picks.json`。これで全24人の人物と背景がそろった。
- 切り抜き: `python3 key_background.py <原画> <出力.png> m|g`（m=マゼンタ, g=緑）。黒背景の原画は外周からつながる黒だけを抜く。
- 採用素材: `remake/img/ui/character_intros/graphic/<id>.webp`（1024×1024・透過）、`bg_<id>.webp`（1672×941）。一覧は `remake/js/vn/intro-graphic.js`。
