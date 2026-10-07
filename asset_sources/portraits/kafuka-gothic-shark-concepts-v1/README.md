# サメちゃん：ストリートシスター＋サメの3案

2026-10-07、オーナー「3パターン作ってみて まずは一枚ずつ」。全身の通常表情を各1枚制作した比較案。生成元は無加工で保存し、896×1200の確認用配置と原寸の顔を用意した。

| 案 | 衣装の違い | 元画像 | 確認用 |
|---|---|---|---|
| ① 深海シスター | 黒・アイボリー・青緑。ケープ風の肩と短いベール、ヒレと尾の装飾 | [source](deep-sea/source.png) | [preview](deep-sea/preview.png) |
| ② サメ映画好きのシスター | ボルドー、アイボリーの大きな袖。フィルム・映画リール・サメのピン | [source](shark-cinema/source.png) | [preview](shark-cinema/preview.png) |
| ③ スケーター風シスター | くすんだ水色。ナイロン風の服、大きなポケットとストラップ、太い靴紐 | [source](skater/source.png) | [preview](skater/preview.png) |

[3案の全身と原寸の顔](comparison.png)／[暗い背景](comparison-dark.png)。各フォルダに `prompt.txt`・`generation.json`・`review.png` を保存。生成は3回で、2案目の `first-pass/` は透過確認時の同一画像の記録。背景の光に見えた生RGBは透明画素内の色で、明暗背景の合成は正常。`unused-alpha-correction-prompt.txt` は未実行の検討メモで、修正生成はしていない。

本人の可愛い青い瞳・ギザ歯・王冠のコロちゃんを保ち、服・髪・配色を今回の指示で変更。通常の表情と立ち方を揃えた。同じ顔の基準として2・3案には1案目を添付したが、未採用案を画風の確定基準には使っていない。画質基準は採用済みのみんと・あげは。

ブリジットの[公式アート](https://www.guiltygear.com/ggst/jp/character/bgt/)は、フード／コイフと大きなストリートジャケットの構成だけを参考にした。実参照とSHA-256・公式出典URLは各生成記録にある。外部作品の原画はこのリポジトリに転載していない。

ゲーム内の立ち絵・丸アイコン・WebP・manifest・人物設定・台詞は変更していない。採用案が決まった後に必要な表情と組み込みへ進む。画像の保存・透過・足元と参照一覧の検証は [validation.json](validation.json)。
