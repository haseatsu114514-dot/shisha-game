# あげは タイトルアート候補 6–8 生成レポート

- 使用ツール：内蔵 `image_gen`。2枚の参照画像を入力した新規場面生成（既存画像の部分修正ではない）。
- 参照：`sprite_normal.webp` を容姿の主参照、`titleart_ref.webp` を顔・衣装の補助参照として、毎回両方を指定。
- 3枚とも PNG、1024×1536、縦横比2:3。サイズ変更・切り抜き・形式変換なし。
- 全候補を生成後に目視確認。自己評価は5点満点。

| 候補 | 場面 | 生成方法 | サイズ | ファイルのバイト数 | 再生成 | 明らかな破綻 | キャラの一貫性 | 場面の再現度 |
|---|---|---|---|---:|---|---|---|---|
| `cand_6.png` | perfect_coal_moment | 参照付き新規生成 | 1024×1536 | 2408917 | なし | 目視ではなし | 5/5 | 4/5 |
| `cand_7.png` | tropical_bowl_parfait | 参照付き新規生成 | 1024×1536 | 2541564 | なし | 目視ではなし | 5/5 | 4/5 |
| `cand_8.png` | peach_cloud_wink | 参照付き新規生成 | 1024×1536 | 2332391 | なし | 目視ではなし | 5/5 | 4/5 |

## 個別確認

### cand_6.png

金髪の長いツインテール、左右のクマ飾り、琥珀色の瞳、ヒョウ柄ジャケット、ピンクのハート柄トップス、チョーカーとハートのネックレスを維持。右手の空のトング、肩付近の左手の小さな拳、並べた炭、金属ステムとガラスベースが読める。顔と両手に明らかな崩れや余分な指は見当たらず、文字や追加人物もなし。指定の「小さな安堵の笑顔」より明るく口を開いた笑顔になっており、背景も淡いパステルより濃いピンクと金色が強い。

### cand_7.png

同一の髪型・飾り・顔・衣装を維持。未加熱の陶器ボウルを胸の高さで持ち、反対の開いた手で紹介している。中央穴のあるシーシャボウル、2つの無地の材料皿、置かれたフォーク、クリーム色のホース、待機中のステムとガラスベースを確認。クリームや明確な果物の切片、文字、追加人物なし。葉は琥珀色と赤褐色の細かな粒状・刻み状表現で、葉らしい繊維感はやや弱い。ベースとステムの右端が画面外に切れる。

### cand_8.png

同一の容姿・衣装を維持し、ウインク、肩近くのマウスピース、揃えた膝、左下のシーシャ、手元につながるホースを確認。煙は右手前の丸い房状で、顔を隠さず、輪や頭の周囲のハローにはなっていない。顔と見える手指に明らかな破綻はなく、文字や追加人物なし。煙は右下だけでなく画面右中央にも大きく広がり、指定のクッション状の輪郭より柔らかく拡散した表現。座位はやや身体を傾けている。

## 使用プロンプト

各候補には `prompts.md` の対応番号の英語プロンプト全文を省略せず使用。その前に共通で以下を付加した。参照画像の構図やピクセル調の質感を引き継がず、新規の場面と指定の画風を優先するための指定である。

```text
Use case: stylized-concept. Create a NEW scene illustration, portrait 1024x1536, using both input images ONLY as character identity references. Image 1 sprite_normal.webp is primary identity; image 2 titleart_ref.webp secondary face/costume reference. Match honey-gold long wavy twin ponytails, pink bear clip viewer-left and cream bear clip viewer-right, soft youthful face, amber eyes, gold hoop earrings, black choker with gold ring, gold heart pendant, orange-black leopard jacket, pink outlined-heart top, high-waisted black pleated skirt. Do not reuse reference pose or scene; do not imitate pixel texture from image 2. Follow this full scene prompt:
```

対応：`cand_6.png` = 番号6、`cand_7.png` = 番号7、`cand_8.png` = 番号8。`transparent_background=false`、参照入力順序は `sprite_normal.webp`、`titleart_ref.webp`。

## 保存範囲

このフォルダ内に作成した成果物は `cand_6.png`、`cand_7.png`、`cand_8.png`、`report.md` の4点。参照画像、`INSTRUCTIONS.md`、`prompts.md` は編集していない。内蔵生成ツールは自身の管理領域に生成画像を自動保存する仕様のため、その出力を本フォルダにコピーした。ツール管理領域の自動保存を除き、フォルダ外のファイルを編集していない。
