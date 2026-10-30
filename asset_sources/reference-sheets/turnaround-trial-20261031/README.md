# 三面図リファレンス 代表2名の試作（#1062・2026-10-31・Grok Bot）

#1062 のオーナー決定「仮の規格で、まず代表の2人で試す」の試作。**採否・規格の確定はオーナー確認待ち**。本編画像の置き換えはしていない。

- 仮の規格（Issue 本文の案）: 1536×1024・正面／3/4／側面／背面の全身を共通の基準線上に同じ縮尺で並べ、下段に5表情（normal・smile・serious・surprise・sad）。文字なし（名前・身長などは後組み）
- 代表: はじめ（主人公）・ましろ（過去見本にある2人）。各2枚（`*_trial_1.png`／`*_trial_2.png`）
- 参照（正本）: `assets/sprites/characters/<キャラ>/chr_<キャラ>_{normal,smile,serious,surprise}.png`
- 生成: OpenAI Images API `images/edits`・**`gpt-image-2.5-sunburst`**・quality high（2026-10-31 に4枚とも作り直し。初版は gpt-image-2）（`generate.py`。プロンプト全文はその中）
- 推定で描いた所（立ち絵に写っていない背面の服・後ろ髪など）は確定設定ではない
- 確認してほしい点: 顔の本人性、頭身、三面での衣装・体格の一致、背面の推定、5表情の差
