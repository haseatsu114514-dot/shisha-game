# naru 画像生成レポート

- 生成日: 2026-10-28
- 使用ツール: 組み込み image_gen（CLI/API フォールバック不使用）。
- 方法: 全候補とも sprite_normal.webp を容姿参照として入力し、場面・構図を新規生成。立ち絵のポーズは流用していない。
- titleart_ref.webp: フォルダ内に存在しないため未使用。
- 容姿の基準: 銀灰色の短いレイヤーヘアと非対称の前髪、金茶色の切れ長の瞳、若い男性の輪郭、黒白のストリートジャケット、重ねたネックレスと矩形ペンダント、銀のリング。服装は各場面の指定を優先。
- 仕様: 全候補 PNG、1024×1536 px、縦横比2:3。リサイズ・切り抜き・形式変換なし。
- 参照画像、INSTRUCTIONS.md、prompts.md は変更していない。手動で作成・変更するファイルは当フォルダ内の候補5枚と本レポートのみ。生成ツールが自動保存した画像は指定フォルダへコピーした。
- 評価は目視による5段階（5が最良）。顔・手指・人物数・文字・場面を各画像で確認。

| 候補 | 場面 | 生成方法 | サイズ | 再生成 | 明らかな破綻 | キャラ一貫性 | 場面再現度 |
|---|---|---|---|---|---|---|---|
| cand_1.png | pastry_oven | 参照付き新規生成 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_2.png | watch_my_hands | 参照付き新規生成 | 1024×1536 | なし | なし | 5/5 | 5/5 |
| cand_3.png | bakery_morning | 参照付き新規生成 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_4.png | iced_lemonade_summer | 参照付き新規生成 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_5.png | tasting_notes_night | 参照付き新規生成 | 1024×1536 | 1回（差し替え済み） | 最終版に明らかな破綻なし | 4/5 | 5/5 |

## 候補別の目視所見

- **cand_1.png**: 髪・瞳・顔立ちを維持。ミトンで天板を両側から持ち、クロワッサン・カスタード菓子・湯気、バニラの莢と泡立て器を確認。明らかな顔や手の破綻、文字、他の人物は見当たらない。オーブンから取り出す瞬間よりも、焼き上がりを見せる動作が中心。
- **cand_2.png**: 黒白ジャケット、ネックレス、複数のリングを維持。片手の温度計をボウルへ向け、もう一方でボウルを支える。秤と箔、暖色照明と青緑の光を確認。画面や機器の小さなマークは判読不能。明らかな指の増減、文字列、他の人物は見当たらない。
- **cand_3.png**: 参照に近い衣装と顔立ち。パン屋の窓、無地の紙袋、かじり跡のあるパン、朝の日差しを確認。口はパンから離れており、噛みつく瞬間より試食直後の表情。目立つ手指の異常や文字、他の人物は見当たらない。
- **cand_4.png**: 全身の座り姿、白いTシャツ、腰に結んだ黒白ジャケット、カーゴパンツ、白いスニーカーを確認。レモン・ミント・氷入りグラスを額付近に当て、結露を表現。片目を閉じた笑顔で、指定の半目とは少し異なる。目立つ解剖学的破綻や文字、他の人物は見当たらない。

- **cand_5.png**: 初回はノートに文字状の筆跡があり、指定外のジャケットも着ていたため、1回再生成して差し替えた。最終版は黒いTシャツ、頬杖とペン、抽象的な点・線・円だけのノート、バニラ・キャラメル・バナナ・秤・マグ、夜の照明を確認。髪の流れる向きや分け目は参照とやや異なるが、銀髪・金茶の目・顔立ち・アクセサリーは保たれている。最終版に読める文字や明らかな手指の本数異常、他の人物は見当たらない。

## 使用プロンプトセット

prompts.md の共通スタイルと各番号の英文場面指定をもとに、組み込みツール用に整理した。全呼び出しで sprite_normal.webp を参照画像として指定し、下記の共通指定を使用した。新規場面の生成であり、元画像の背景や立ちポーズを再現する指示はしていない。

### 全候補の共通指定

```text
Use case: illustration-story. Generate one finished title-screen key visual, portrait 2:3, 1024x1536. The supplied sprite_normal.webp is the character identity and outfit reference ONLY: invent the scene and pose as specified, do not repeat the standing sprite composition. Match his exact silver-ash short layered tousled hairstyle, asymmetrical parted bangs and dark undercut, golden amber narrow eyes, warm light skin, angular youthful face, confident smile, small silver ear piercings, layered dark/silver necklaces with rectangular pendant, rings. When jacket is worn match its black and white color-block streetwear design, without any branding. Exactly one adult man. Warm anime-style visual novel illustration, clean confident linework, soft painterly cel shading, gentle bloom, rich soft colors, detailed face, anatomically correct hands. Character large (60-80% of frame height), softly detailed background. No readable text, letters, numbers, logos, watermarks, extra people, bystanders, silhouettes, suggestive posing. All screens blank or blurred, packaging blank. 
```

### 場面ごとの整理・追加指定

1. pastry_oven: 元の英文場面指定を使用。ミトンが手を自然に覆うことを補足。
2. watch_my_hands: 元の英文場面指定を使用。「watch everything」は表情の意味として指定。店名は一切描かず、温度計・秤に数字を描かないよう補足。
3. bakery_morning: 元の英文場面指定を使用。文字や店の看板、紙袋のロゴを禁止。
4. iced_lemonade_summer: 元の英文場面指定を使用。参照の黒いカーゴパンツ・ポケットチェーン・白いスニーカーと、腰に結ぶ黒白ジャケットを補足。
5. tasting_notes_night: 初回は元の場面指定にノートの非言語的な線と秤の表示ぼかしを補足。再生成では以下を最終プロンプトとして使用。

### 候補5の最終投入プロンプト（共通指定を含む全文）

```text
Use case: illustration-story. Generate one finished title-screen key visual, portrait 2:3, 1024x1536. The supplied sprite_normal.webp is the character identity and outfit reference ONLY: invent the scene and pose as specified, do not repeat the standing sprite composition. Match his exact silver-ash short layered tousled hairstyle, asymmetrical parted bangs and dark undercut, golden amber narrow eyes, warm light skin, angular youthful face, confident smile, small silver ear piercings, layered dark/silver necklaces with rectangular pendant, rings. When jacket is worn match its black and white color-block streetwear design, without any branding. Exactly one adult man. Warm anime-style visual novel illustration, clean confident linework, soft painterly cel shading, gentle bloom, rich soft colors, detailed face, anatomically correct hands. Character large (60-80% of frame height), softly detailed background. No readable text, letters, numbers, logos, watermarks, extra people, bystanders, silhouettes, suggestive posing. All screens blank or blurred, packaging blank. Scene 5 tasting_notes_night. A 23-year-old Japanese man with exact reference face and hairstyle, short dyed silver-ash hair, sharp focused amber eyes, multiple silver rings, dark layered necklace, wearing ONLY an oversized plain dark T-shirt with no lettering. Bare forearms. Late at night in his small room, sitting at a desk under a warm desk lamp, chin resting on one hand, pen in the other, writing in an open notebook. On the desk a vanilla pod, a small dish of caramel, a ripe banana, a tiny digital scale and a mug. Serious absorbed expression with a hint of excitement, eyes looking down to notebook. Three-quarter view, waist-up framing, he fills the vertical frame. Warm lamplight against a cool dark room, quiet focused mood. CRITICAL: Do not wear the reference jacket in this scene; reference is for identity only. CRITICAL: Notebook has ONLY sparse tiny abstract dots, short disconnected nonlinguistic strokes, small circular doodle diagrams, rendered soft out-of-focus. NO words, cursive, handwriting, letters, numbers, labels or pseudo-text strings. Absolutely no text anywhere. Digital scale screen blank and softly blurred. Maintain two natural anatomically correct hands, one supporting chin, other holding pen.
```

元の場面プロンプト全文は、変更していない同フォルダの [prompts.md](prompts.md) を参照。

## 保存先

- [cand_1.png](cand_1.png)
- [cand_2.png](cand_2.png)
- [cand_3.png](cand_3.png)
- [cand_4.png](cand_4.png)
- [cand_5.png](cand_5.png)

全候補を保存後に目視確認した。自動画像解析やOCRによる無欠陥の保証ではなく、上記は目視で確認できる範囲の評価。

