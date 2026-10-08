# ヒロインのタイトル用アート・比較案

**追加指示後の新版**: [6人・個別の台と背景・ドット感・みんと中間を含む19案](../heroine-concepts-v2-personality-pixel-20261008/README.md)。この15案は最初の比較履歴として保持。共通の台・似た背景・弱いドット感は新しい指定で見直しており、本編には採用していない。

2026-10-08 / TA01–07 / ベース `fa3d7fd`

5人それぞれに独立した縦長の一枚絵を3種類、計15案制作。各人の1案はシーシャ、2案は趣味や日常。採用済み立ち絵を人物の第一参照にした。原画は加工せず保存し、生成サービスの出力も削除しない。

今回は比較用の原画。現行 `remake/` のタイトル右側は `title_art_keyvisual_01.png` の固定表示であり、ここへ置いたPNGは自動採用されない。ゲームのタイトル・立ち絵・セーブ・開示順序は変更しない。古い `assets/ui/title_arts/README.md` の旧版ランダム表示や `web/` ビルド手順は現行仕様ではない。

| ヒロイン | 01 シーシャ | 02 | 03 |
|---|---|---|---|
| つむぎ | [煙の色を眺めて](tsumugi/01-smoke-colors.png) | [タブレットの猫](tsumugi/02-tablet-cat.png) | [夕暮れのスケッチ](tsumugi/03-twilight-sketch.png) |
| ましろ | [重い一服](mashiro/01-heavy-smoke.png) | [お茶とひと息](mashiro/02-tea-break.png) | [雨上がりの帰り道](mashiro/03-after-rain.png) |
| みんと | [ぺぱーみんとのお出迎え](minto/01-cafe-welcome.png) | [チェキの瞬間](minto/02-instant-photo.png) | [私服の窓辺](minto/03-private-window.png) |
| アゲハ | [プロの顔](ageha/01-professional-taste.png) | [買い出しの笑顔](ageha/02-grocery-smile.png) | [モデルのひとコマ](ageha/03-model-moment.png) |
| 凛 | [試香のひととき](rin/01-night-tasting.png) | [サンプルを選ぶ](rin/02-flavor-samples.png) | [夜更けのコーヒー](rin/03-late-coffee.png) |

みんと03は採用済み私服立ち絵を参照した別案。私生活の見せ方は本編の開示順序に従うため、この制作によってタイトルへ先行表示するわけではない。アゲハ01・03は目を開いたプロの表情、02は初遭遇に合う笑顔。凛の試料は細かく刻まれた黒く湿ったダークリーフを指定。

## 器具の実物参照

- [Oduman Japan の製品ページ](https://odumanjapan.com/product/oduman-atomic)に掲載されているN2 Travel写真：透明ガラスの台、金属ステム、皿、ホースの接続と比率。写真の右側にある収納バッグは絵に入れない。
- [Kaloud Lotus I+ 公式製品写真](https://kaloud.com/products/kaloud-lotus-i-1)：HMD単体と、適合するSamsaris系ハガルに載せた状態。
- [Kaloud Japan の使い方](https://kaloud-japan.com/blogs/kaloud%E3%81%AE%E4%B8%96%E7%95%8C/kaloud-lotus%C2%AE-i-howto)：ハガルに葉を詰め、その上にHMD、HMD内に炭を入れ、蓋と通気を調整する順序。

全シーシャ案は蓋を閉じたHMD方式を指定。炭はHMD内に収め、ハガル・葉・皿・HMDの蓋の上へ直置きしない。台→ステム→皿→ハガルの差込部→ハガル→HMDの順と、台の側面ポート→1本のホース→手元のマウスピースを点検する。アルミ方式の絵は今回は制作していない。

写真は構造確認の資料で、ゲームの表示素材としては使用しない。製品ロゴや文字を生成原画へ複製しない。現在のましろタイトル絵は画風・照明のみの参照とし、そこにある器具の構造は参照しない。

## 制作記録

`concepts.json` に15案の識別子・場面・原画・プロンプト・参照順を保存。各 `.prompt.txt` は実際に渡した生成指示、各 `.png.generation.json` は生成元パス・原画と指示のSHA256・実参照SHA256・寸法。`references.json` は採用立ち絵の正本パス、実物写真の出典とSHA256。修正前の原画も比較履歴として残す。

縦2:3のPNGを前提に、顔・手・小物を現在のタイトル右側の表示に収まりやすい位置へ指定。顔の一致、手の形、ホースとハガル、文字・ロゴの焼き込みを目視確認し、最終結果を `validation.json` に記録する。
