# 一台勝負　カードデザインの依頼書（Codex用）

2026-11-11。オーナー「カードデザインが中々かっこいいの上がってこないから真剣に練ってコーデックスに考えさせたい」。
カードの見た目を決めるための依頼書です。**いちばん下のコードブロックを、そのまま Codex に貼ります。** その上は、依頼の考え方と、オーナーが出来上がりを選ぶときの物差しです。

- 対象のルール: [第0.2版ルールブック](ichidai_shobu_rulebook_v0.2.pdf)。カードの数値と文は [`cards.js`](cards.js)。
- いまの仮の見た目: [`card_samples.html`](card_samples.html)（ブラウザで開く）。**載せる情報と読む順番の見本**で、絵・枠・書体は作り直す前提。
- 今回頼むのは**第1段階（方向を決める見本）だけ**。全カードの量産は、オーナーが方向を選んでから。

## 1. 今回、進め方を変える点

これまで「かっこいい」が出なかった原因を3つに分け、それぞれ手を打ちます。

| ありがちな失敗 | 今回の手当て |
|---|---|
| カード1枚を画像生成で丸ごと描かせる。文字が崩れ、枠が毎回変わり、数字が読めない | **枠・文字・数字・温度の帯はコード（HTML/CSS/SVG）で組む。** 画像生成が描くのは「絵」と「質感」だけ |
| 1枚ずつ良さを比べる。並べるとばらばらで、卓上で読めない | **5枚ひと組**（葉2・炭・技・審査）で作り、並べた見え方と、卓に置いた見え方で比べる |
| 「かっこよく」としか伝えない。金の縁と渦巻きが増えるだけ | **方向を3つ、言葉と色と絵の描き方まで決めて競わせる。** 合否は下の物差しで見る |

## 2. このゲームのカードが、卓上でどう置かれるか

見た目は、置かれ方から決まります。ここを外した案は、絵が良くても採りません。

| カード | 置かれ方 | 見た目への要求 |
|---|---|---|
| 葉（フレーバー） | ボウルに種類ごとに重ねる。**上の端だけが見える** | 上端の帯だけで、系統（色としるし）と名前が読める |
| 主役の葉 | 重ねた山のいちばん上。**毎ラウンド、温度の帯を読む** | 温度の帯（0〜10）がこのカードの顔。腕を伸ばした距離で、ジャストと焦げの位置が分かる |
| 炭カード | 炭焼き場に縦か横で置き、炭ゾーンでは表向き・裏返し・横向きになる | 上下が一目で分かる。全面の絵（文字は最小）。表向きの炭は、裏向きのカードの列の中で光って見える |
| すべてのデッキのカードの**裏面** | 裏向きで炭ゾーンに並ぶ（種火）。10枚並ぶこともある | **裏面は「熾火」に見えること。** 並べたときに炭の列になる。上下対称 |
| 技・器具・人物・イベント | 手札では扇に持つ。**左上が見える** | 左上に火力、その下か横に使える時。「一口」のカードだけ色で分かる |
| 審査カード | 2人の間でめくる。**2人が逆向きから読む** | 判定熱の変化（+1 など）が巨大。逆さからでも読める |
| セッティング | ゲーム中ずっと場に出ている | ほかより落ち着いた見た目。能力の文が読みやすい |

## 3. カードに必ず載せる情報（読む順）

数値と文は `cards.js` から出します。**絵の中に文字や数字を描きません。**

| カード | 1番目に読む | 2番目 | 3番目 |
|---|---|---|---|
| 葉 | 系統のしるしと名前（上端） | 温度の帯 0〜10（ジャスト★・適温・ズレ・外れ・焦げの5色）と味値 | 相性のしるし、能力の文、銘柄名、1g |
| 炭 | 熱（1 か 2）と着火（1 か 2 ターン） | 名前 | 能力の文 |
| 技・器具・人物・イベント | 火力（左上。燃焼は別の見た目） | 使える時（手番／一口／準備／いつでも）と種類 | 名前、効果の文 |
| 審査カード | 判定熱の変化（±0・+1・−1・+2） | 吸い方の名前、この一口の決まり | 審査員の名前 |
| セッティング | 名前と種別（ボウル／HMD） | 能力の文 | 容量（ボウルだけ） |

色の決まり: 系統は フルーツ＝橙、清涼＝青、スパイス＝赤茶、フローラル＝紫、スイート＝黄土。温度の帯は ジャスト＝金、適温＝緑、ズレ＝淡い黄、外れ＝灰青、焦げ＝赤。色だけに頼らず、ジャストは★、焦げは形でも区別します（色の見え方が違う人にも読めるように）。

## 4. 方向の3案

どれも「日本のシーシャバーの夜」「炭・真鍮・ガラス・煙」という同じ世界の中で、印刷物としての顔つきを変えます。Codex は3案とも作り、**自分ならどれを推すかを理由つきで書きます。** もっと良い4つ目があれば、同じ提出物をそろえて足してかまいません。

### A　熾火と真鍮

暗がりに、ひとつの灯り。黒い炭の地に、真鍮の細い線。絵は暗い中に置いた静物で、下からの熾火の光だけで見せます。葉カードは系統の色が1色だけ差す。大人っぽく、高級な卓上ゲームの顔。

- 強み: 炭カードと裏面（熾火）がいちばん映える。本編の夜の店の空気に近い。
- 弱み: 全体が暗く、系統の見分けが色1色に寄る。安く刷ると沈む。

### B　フレーバー缶

葉カードを、**銘柄のラベル**として作ります。アルファーヘブン、ドバジ、アフサール、フワリ、フォースフェクタで、版面の癖（帯の入れ方・紋の形）が少しずつ違う。色数を絞った版画の刷りで、紙の地が見える。技や器具は、店の道具札や伝票の顔。

- 強み: 20種の葉を集めたくなる。明るく、卓上で見分けやすい。銘柄という本編の設定が生きる。
- 弱み: 炭や審査カードとの統一が難しい。かわいく寄りすぎると勝負の緊張が薄れる。

### C　大会ポスター

本編の登場カットイン（極太の文字・斜めの帯・ポスター調の色面）に寄せます。夜紫の地に、熱い色がひとつ。絵は低い角度から大きく、枠で切る。審査カードは実況のテロップ。

- 強み: 本編といちばん地続き。対戦の勢いが出る。「一口」のカードの緊張が出しやすい。
- 弱み: 情報が多いカード（葉）でうるさくなりやすい。温度の帯の読みやすさと衝突する。

## 5. 物差し（オーナーが選ぶとき・Codex が自分で確かめるとき）

1. **腕の長さで読めるか。** 63×88mmに刷った大きさで、火力・味値・判定熱の変化・温度の帯のジャストと焦げが読める。
2. **小さくしても種類が分かるか。** 幅120pxの縮小で、葉・炭・技・審査・裏面の区別がつく。
3. **白黒でも読めるか。** 白黒にしても、数字と帯の区別が残る。
4. **いちばん大きいものが1つか。** 1枚の中で、目が最初に行く場所が1か所に決まっている。
5. **並べて家族に見えるか。** 5枚を並べると同じゲームのカードで、しかも種類は取り違えない。
6. **卓に置いて成り立つか。** 葉を重ねた上端、炭ゾーンに並んだ裏面と表向きの炭、手札の扇の左上。
7. **飾りに理由があるか。** 意味のない渦・宝石・紋章・過剰な金縁がない。線1本にも役目がある。
8. **絵と文字が喧嘩していないか。** 文字の下に絵の明暗の強い部分が来ていない。

## 6. 絵の決まり

- 絵に文字・数字・ロゴ・透かしを描かない。実在の銘柄・製品・ロゴを描かない（銘柄名は作中のもの）。
- 第1段階の見本は、**機材と人物を描かない題材**にしてあります（葉・煙・炭だけ）。
- 炭が写る絵（キューブ炭）は、`docs/shisha_reference.md` の「4. 画像生成の必須手順」に従います。参考写真は非公開リポジトリ `siryou` の `shisha-hardware-reference/web-refs/images/`（炭の写真）。炭は指先ほどの小さな角炭、表面は灰色の灰、割れ目に少し赤、炎は出ない。
- 第2段階以降で器具（風防・ホース・HMD・ボウル）や人物を描くときは、機材は同じ必須手順、人物は `docs/portrait_standard.md` と正規の立ち絵に従います。人物カードは、新しく描き起こさず正規の立ち絵を使う案を先に試します。

## 7. 置き場と記録

| もの | 置き場 |
|---|---|
| 生成した絵・質感の原画 | `asset_sources/card_game/design-20261111/raw/<案>/`（Git LFS） |
| 生成の指示文・参照・SHA-256 | `asset_sources/card_game/design-20261111/README.md` |
| 枠の実装（HTML/CSS/SVG） | `docs/design/card_game/design/<案>/` |
| 比べる画面 | `docs/design/card_game/design/compare.html` |
| 比べる画面を写した画像 | `asset_sources/card_game/design-20261111/shots/`（Git LFS） |

## 8. Codex へ貼る依頼文

```
あなたへの依頼: カードゲーム「一台勝負」のカードの見た目を決めるための、方向の見本を3案作ってください。
今回は第1段階（方向を決める見本）だけです。全カードの量産はしません。本編（remake/・data/・assets/）は変更しません。

■ 先に読むもの（この順）
1. docs/design/card_game/card_design_brief.md … この依頼の考え方。2〜6節が条件、5節が合否の物差し。
2. docs/design/card_game/card_samples.html をブラウザで開く … いまの仮の見た目。載せる情報と読む順番の見本。これを超えること。
3. docs/design/card_game/cards.js … カードの数値と文の正本。文字はここから出す。
4. docs/design/card_game/render.js と rulebook.css の .card 以下 … いまのカードの組み方。
5. 炭を描くので docs/shisha_reference.md の「4. 画像生成の必須手順」（4.0 参考写真の置き場、4.1 の炭の行、4.2、4.4）。

■ 作り方の決まり（ここを外した案は不採用）
- カードを画像生成で丸ごと描かない。枠・文字・数字・温度の帯・しるしは HTML/CSS/SVG で組む。
- 画像生成で作るのは「絵」（1枚1題材）と「質感」（紙・真鍮・炭の地など、敷きつめられるもの）だけ。どちらにも文字・数字・ロゴ・透かしを描かない。
- カードは 63×88mm（5:7）。画面では 744×1039px を等倍とし、塗り足し3mm・安全域3mmを取る。角丸は半径3mm。
- 書体は Noto Sans JP を本文にする。見出しと数字の書体は Google Fonts の中から提案してよい（OFL のもの。案ごとに変えてよい）。
- 文字の大きさの下限（等倍で）: 効果の文 6.5pt、火力・味値・熱・判定熱の変化 14pt 以上、温度の帯の1マス 4mm 以上。
- 系統の色と温度の帯の5色は依頼書3節の決まりを守る（色みの調整はよい。役割は変えない）。ジャストは★、焦げは色以外でも区別がつくこと。
- 裏面は「熾火」に見え、上下対称で、10枚並べると炭の列に見えること。裏面はコードで描く（質感の画像を敷くのはよい）。

■ 作るもの
3案（A 熾火と真鍮／B フレーバー缶／C 大会ポスター。中身は依頼書4節）それぞれについて、次の6枚。
  1. 葉「レモン」（フルーツ）   2. 葉「ローズ」（フローラル）   3. 炭「キューブ炭」
  4. 技「熱を逃がす吸い」（使える時＝一口）   5. 審査カード「長く吸う」（千須 豪・判定熱+1）   6. 裏面
あなたが3案より良いと考える4つ目があれば、同じ6枚をそろえて「D」として足してよい。

手順:
(1) 案ごとに、絵を描く前に 5〜8 行の設計メモを書く（何を大きく見せるか・色・書体・枠の考え方・この案の弱みとその手当て）。
(2) 枠を docs/design/card_game/design/<a|b|c>/ に HTML/CSS/SVG で実装する。数値と文は cards.js から読む。絵が無くても成り立つ状態を先に作る。
(3) 絵を内蔵の画像生成で作る。1回に1枚。プロンプトは「STYLE（案ごと）＋ SUBJECT（カードごと）」をこの順でそのまま英文にする。要約・言い換え・追記をしない。
    - 絵は正方形 1024×1024。保存先は asset_sources/card_game/design-20261111/raw/<a|b|c>/<名前>.png。加工せず保存する。
    - キューブ炭は、生成の前に siryou の shisha-hardware-reference/web-refs/images/ にある炭の写真を開いて見る（渡せるなら参照として渡す）。
      プロンプトには docs/shisha_reference.md 4.2 の英文をそのまま貼り、その直後に SUBJECT を置く。
      生成後は 4.1 の炭の行と 4.4 で検品する（指先ほどの角炭／灰色の灰に少し赤／炎なし／5個以上にしない／煙が炭から出ない／文字なし）。
    - 各絵の CHECK を原寸で確かめ、外れたら同じプロンプトで作り直す（3回でだめなら、どこがだめかを記録して次へ）。
(4) 比べる画面 docs/design/card_game/design/compare.html を作る。次の4つを、案ごとに同じ並びで見せる。
    a. 6枚を等倍で横に並べたもの
    b. 卓に置いた見え方: 葉を重ねて上端だけ見せた山（レモン5枚の上にローズ3枚の山を並べる）、
       炭ゾーン（裏面4枚＋表向きのキューブ炭1枚＋横向きの裏面1枚）、手札の扇（技を3枚ずらして左上だけ見せる）
    c. 幅120pxに縮めた6枚
    d. 白黒にした6枚
(5) compare.html を画面で開いて写し、asset_sources/card_game/design-20261111/shots/ に保存する。
    写した画像を自分で見て、依頼書5節の物差し8項目を案ごとに ○△× で採点し、直せるものは直してから写し直す。
(6) asset_sources/card_game/design-20261111/README.md に、設計メモ、採点表、あなたが推す案とその理由、
    絵ごとのプロンプト全文・参照した写真・ピクセル数・bytes・SHA-256 を書く。
(7) 最新 main から作った branch で PR にする。本文に、比べる画面の画像、採点表、推す案、オーナーに選んでほしい点を書く。
    新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。

=== STYLE-A（熾火と真鍮。A案の絵の先頭にそのまま置く）===
Style: a low-key still-life illustration for a premium Japanese card game about shisha craft. Painterly gouache-and-ink look with clean shapes and a little paper grain; not photorealistic, not anime. The subject sits in near-darkness on a matte charcoal-black ground (#171311 to #2a1c16) and is lit by ONE warm ember-orange light (#f39a3c, #e2591f) from below-left, with a thin cool rim light on the opposite edge. Smoke drifts upward as two or three broad translucent ribbons with visible brush texture. One accent colour per image, given in the subject line; everything else stays in charcoal black, warm grey and a small amount of antique brass (#a8802f). One large simple silhouette, strong negative space, the subject filling about 60% of the square frame and sitting slightly below centre. The top 15% and bottom 25% of the image stay dark and quiet so that text can be placed over them. No frame, no border, no text, no numbers, no logos, no watermark, no ornaments, no jewels, no fantasy emblems.

=== STYLE-B（フレーバー缶。B案の絵の先頭にそのまま置く）===
Style: flat screen-printed label art, like the lid of a vintage Japanese tea or sweets tin redesigned by a modern Tokyo design studio. Exactly three flat inks on warm cream paper (#f7f0e3): one saturated accent colour given in the subject line, one deep charcoal (#1f1b19), and one ochre gold (#a8802f) used sparingly. Bold simplified shapes, slightly misregistered ink edges, fine halftone dots for shading; no smooth gradients, no thin outlines. The subject is a single emblem-like motif, symmetrical or nearly symmetrical, centred, filling about 70% of the square frame, with smoke drawn as two or three flat curling bands behind it. Plain cream paper around the motif. No lettering of any kind, no numbers, no logos, no borders, no badges, no ribbons with text, no watermark.

=== STYLE-C（大会ポスター。C案の絵の先頭にそのまま置く）===
Style: a bold tournament key-visual in a flat poster style. Big flat colour planes cut by ONE strong diagonal from lower-left to upper-right, heavy dry-brush ink accents, high contrast. Deep night purple (#150d22, #2e1d45) fills most of the image and one hot accent colour, given in the subject line, fills the diagonal plane; a thin line of muted gold (#e3bd6e) is the only metallic. The subject is drawn large from a low dramatic angle and is cropped by the frame on one side, cel-shaded in two tones with one crisp highlight. A sharp smoke trail sweeps along the diagonal. The upper-left quarter of the image stays simple and dark so that a number can be placed over it. No text, no numbers, no logos, no speed lines, no frame, no watermark.

--- 絵 1/5: lemon.png ---
SUBJECT: one whole lemon and one cut lemon half with two leaves. Accent colour: fruit orange (#e98222) with lemon yellow. Nothing else in the image.
CHECK: lemon 1 個と半分だけ／差し色は橙〜黄だけ／文字・数字なし／STYLE の余白（文字を置く場所）が空いている。

--- 絵 2/5: rose.png ---
SUBJECT: a single garden rose in half bloom with two leaves and a short stem. Accent colour: floral purple (#7d52ad) with dusty rose pink. Nothing else in the image.
CHECK: バラ1輪だけ／差し色は紫〜くすんだ桃だけ／文字・数字なし／余白が空いている。

--- 絵 3/5: cube_coal.png（docs/shisha_reference.md 4.2 の英文を STYLE の直後に貼ってから SUBJECT）---
SUBJECT: This image shows ONLY charcoal; do not draw the hookah, bowl, heat management device, tray, hose or any person. Three small cube-shaped coconut charcoals, each about fingertip size, standing close together, covered with a thin coat of grey ash and glowing red-orange only in the cracks and along the lower edges. No flames, no sparks, and no smoke rising from the charcoal. Accent colour: ember orange (#e2591f). Nothing else in the image.
CHECK: 角炭3個だけ（5個以上にしない）／指先ほどの大きさに見える／灰色の灰に少し赤／炎なし／炭から煙が出ていない／台・ボウル・HMD・ホース・人物なし／文字なし。

--- 絵 4/5: cool_draw.png（技「熱を逃がす吸い」）---
SUBJECT: one stream of pale cool smoke being blown away toward the upper right, starting from a soft warm glow at the lower left that is fading; the smoke turns from warm white to cool blue-white as it travels. No person, no mouth, no pipe, no hose, no charcoal, no object of any kind. Accent colour: cool blue (#2795bb).
CHECK: 煙の流れ1本だけ／左下が暖色、右上が寒色／人・口・機材・炭なし／文字なし。

--- 絵 5/5: long_draw.png（審査カード「長く吸う」）---
SUBJECT: one very long unbroken ribbon of smoke crossing the whole frame in a slow S-curve, thin where it starts and thick and bright where it ends. No person, no mouth, no pipe, no hose, no charcoal, no object of any kind. Accent colour: judge purple (#7d52ad) with a warm orange glow (#f39a3c) at the thick end.
CHECK: 途切れない煙1本だけ／S字／人・口・機材・炭なし／文字なし。

■ 終わりの報告に書くこと
- 3案（と D があれば D）の比べる画面の画像
- 物差し8項目の採点表
- あなたが推す案と、その理由（卓上でどう見えたかを根拠に）
- 推す案で、第2段階に進む前に直したい点
- 作り直した絵と、その理由
```

## 9. 第2段階以降（方向が決まってから）

1. **枠の一式**: 葉5系統、炭、技（手番／一口）、器具、人物、イベント、審査、セッティング（ボウル／HMD）、審査員、大会、裏面3種（デッキ・葉・審査）。しるしの一式（系統5・使える時4・火力・燃焼・熱・着火・帯の5色）。
2. **絵の量産**: 葉20、炭3、サポート35、審査カード7種、セッティング8、審査員5。機材と人物が入るので、6節の決まりで1枚ずつ検品する。
3. **ルールブックへの反映**: `render.js` のカードの組み方を、決まった枠に差し替える。
