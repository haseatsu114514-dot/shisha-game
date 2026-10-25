# 【全案没】会話ウインドウ・6路線の再生成履歴

**2026-10-25 本人「今やった新しいのは没」により、以下の6案はすべて不採用です。採用候補・今後の画風の基準として使用しません。本編には未組み込みです。**

名前札・操作枠・本文枠を含めて生成した原画と比較資料を、没案の履歴として保持しています。

[没案6枚の履歴](comparison.png)

![全案没・再生成6案の履歴](comparison.png)

同じ実ゲームの背景・ひよりの立ち絵に、新しい原画と実フォントの本文2行を重ねています。背景と人物は生成し直していません。名前や操作文字はHTMLで描いています。

| 路線 | 今回の意匠 | 原寸プレビュー | 文字なしの原画 |
| --- | --- | --- | --- |
| 11 煙だけの輪郭 | 淡い白金の細い光と、墨色を包む煙。名前と操作も同じ煙の素材 | [表示](smoke-preview.png) | [PNG](smoke-source.png) |
| 11 紫の煙 | 深い紫の面と、薄紫の煙・小さな光点 | [表示](smoke-purple-preview.png) | [PNG](smoke-purple-source.png) |
| 16 ペーパーラウンジ | 墨紫の折り紙と重なる端。文字領域は静かな無地 | [表示](paper-preview.png) | [PNG](paper-source.png) |
| 25 琥珀ラウンジ | 濃い琥珀のガラス、真鍮の縁と控えめな隅飾り | [表示](amber-preview.png) | [PNG](amber-source.png) |
| 28 重なる薄紙 | 生成りの紙と炭色の本文面。名前と操作は折った紙の札 | [表示](tissue-preview.png) | [PNG](tissue-source.png) |
| ゴージャス | 墨紫の漆に金の細工。装飾を隅と札の接合部へ集める | [表示](classic-preview.png) | [PNG](classic-source.png) |

## 生成と組み合わせ

`*-source.png` は画像生成の出力そのものです。原画の透明度と縁・光・紙の層を保持したまま、ブラウザで背景へ重ねます。素材ごとの中央の本文面を基準に高さを揃え、本文28px・名前22px・操作16pxを置いています。▼は暗い本文面の内側へ配置しています。これは意匠を比較する静止画で、会話エンジンへの組み込みや操作の実装ではありません。

本文は11・紫版・28が同梱のZen Kaku Gothic New、16・25・ゴージャスがZen Old Mincho。名前は同梱のZen Old Mincho Boldです。ライセンスは `remake/fonts/OFL-ZenKakuGothicNew.txt`、`OFL-ZenOldMincho.txt`、`ZenOldMincho-Name-OFL.txt`。

生成指示は各 `*-prompt.txt`、参照・原画SHA-256・文字位置は [generation.json](generation.json)。PNGは外側を透過し、本文面は暗く不透明な領域にしています。煙・紫煙・紙2種は既存の原画を素材感の参照に使用し、琥珀・ゴージャスは文章から新規生成しました。

ローカルHTTPでは [preview.html](preview.html) を `?theme=smoke`／`smoke-purple`／`paper`／`amber`／`tissue`／`classic` で切り替えられます。[capture.mjs](capture.mjs) で文字の2行表示・名前／操作／▼との非重複・画面内への収まりを確認してPNGを撮影します。全6案の原画と文字入りプレビューを目視確認しています。
