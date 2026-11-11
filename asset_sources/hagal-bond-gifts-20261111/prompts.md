# 専用ハガル（贈り物）と、脚の無い器の作り直し — 生成プロンプト（2026-11-11）

オーナー（2026-11-11）「ハガルに関してはこの下がついてない皿みたいなのは生成ミスだから使わないで。代わりに専用で作ったやつを探して欲しい。まだない専用ハガルは生成プロンプトを作って欲しい。これまでの生成した専用ハガルのルールとかを参考に」

Codex への依頼は [Issue #3327](https://github.com/haseatsu114514-dot/shisha-game/issues/3327)。

## いまある絵（調べた結果）

| 絵 | 状態 |
|---|---|
| `assets/ui/making/bowl_empty_hiyori.png` | **ゲームに入っている唯一の専用ハガル**（#497。#504 の v1 シートから抜き出し）。脚あり。今回の全依頼の見た目の基準 |
| `asset_sources/hagal-bond-concepts-issue504/v1/*.png` | 8人の専用ハガルの**選定済みデザイン**（スミA・なるB・アダムB・凛想A・つむぎB・みんとB・サメちゃんB・ひよりB）。紙の背景と文字入りの比較シートで、ゲームの素材としては使えない |
| `assets/ui/making/bowl_empty_clay.png` | **脚の無い皿（生成ミス）**。素焼きハガル（`suyaki_hagal`）と、専用の絵が無い贈り物が使っていた |
| `assets/ui/making/bowl_empty_phunnel.png`・`bowl_packed_phunnel_{airy,normal,firm}.png` | 80beatハガル（ファンネル型）。**これも脚が無い** |

贈り物の動き（`remake/js/motions/gift.js` の `c`）は、専用の絵（`bowl_empty_<贈り主>.png`）がある贈り物だけ品を出し、無い贈り物は絵柄と名前の帯だけで見せる。`bowl_empty_clay` は出さない。

## 依頼する23枚

| # | 保存先（`assets/ui/making/`） | 作り方 | 意匠 |
|---|---|---|---|
| 1 | `bowl_empty_sumi.png` | v1 シートから抜き出し | スミA「閉店後の一服」 |
| 2 | `bowl_empty_naru.png` | 同上 | なるB「対等のしるし」 |
| 3 | `bowl_empty_adam.png` | 同上 | アダムB「双香の誓い」 |
| 4 | `bowl_empty_rio.png` | 同上 | 凛想A「夜の私物」（装備 ID は `suyaki_rio`） |
| 5 | `bowl_empty_tsumugi.png` | 同上 | つむぎB「今日の色」 |
| 6 | `bowl_empty_minto.png` | 同上 | みんとB「栞のひと息」 |
| 7 | `bowl_empty_samechan.png` | 同上 | サメちゃんB「コロちゃんの指定席」 |
| 8〜18 | `bowl_empty_{ageha,mashiro,kumicho,rei,saku,noor,steve,volk,master_hookah,da_silva,sheikh}.png` | 新しく描く | 下の各項（正本の人物・贈り物の説明から） |
| 19 | `bowl_empty_clay.png`（同名で差し替え） | 新しく描く | 飾りの無い標準の素焼きハガル（脚あり） |
| 20〜23 | `bowl_empty_phunnel.png`・`bowl_packed_phunnel_{airy,normal,firm}.png`（同名で差し替え） | 今の絵に脚を足す | 80beatハガル（ファンネル型） |

ひより（`bowl_empty_hiyori.png`）は作成済みなので依頼しない。

## 意匠の根拠（新しく描く11人）

`data/equipment.json` の贈り物の説明と `data/characters.json` から。キャラ設定を書き換えない。

| 人物 | 贈り物 | 根拠（正本の言葉） | 意匠 |
|---|---|---|---|
| あげは | ホワイトグミベア | 「縁にクマのシールつき」・ギャル・カワイイは最強 | 淡いピンクがかった生成りの土、縁の下に少しすり切れた白いクマのシール、小さなハートと点の彫り |
| ましろ | ブラックティー | いつも眠たげ・濃い葉が好き・「ほかの葉を消さない一割」 | 煤けた紅茶色の土、縁から下へ紅茶の染み、小さな茶葉1枚と細い線1本 |
| 神崎（組長） | ドラゴンフルーツ | 「兄弟の盃」・竜二・閉店後の一服 | 炭色の土、盃のように少し開いた口（脚はある）、鱗（竜とドラゴンフルーツの皮）の浅彫りの帯、縁にマゼンタの細い線。紋・文字は無し |
| レヰ | ローズ | V系・黒とワインレッド・「友達のしるし」 | 黒い土にワインレッドの染み、薔薇1輪と脚に巻く細い茨の浅彫り。髑髏・文字は無し |
| 綾取 | アールグレイ | 綾取（あやとり）・「返事の欄の続き」・福岡から持ってきた | 生成りに灰青の化粧土、器に巻くあやとりの糸の線、ベルガモットの小さな印、脚に空欄の小さな枠 |
| ヌール | ダブルアップル | 14歳で父に教わった・砂漠ツアーのガイド | 砂色の土、砂丘の風紋の線、縁の近くに小さなりんごとアニスの星 |
| スティーブ | マウンテンミスト | レトロな柄シャツ・低い熱で待つ・「縁が少し欠け」 | 生成りにレモン色とライム色の帯、柄シャツのような小さな幾何学模様、縁の外側だけ小さな欠け |
| ヴォルク | ブラストミント | 測る・「外側に配合を変えた回数の刻みが並び」 | 冷たい灰色の土に淡いミントブルー、整然と並ぶ刻み（数取りの印）、縁の下に正確な細い輪 |
| 王煙楼 | ブラックティー | 「見せるための器ではなく静かな一台」・龍の煙で有名・紅茶と木の香り | 飾りの少ない古い焦げ茶の土、龍の尾をわずかに思わせる煙の細い線1本。金は使わない |
| 太陽（ダ・シルヴァ） | パッションフルーツ | FESTA・太陽・祭りのあとの一台 | 明るい橙の素焼き、太陽の光の浅彫りの帯に黄土色、パッションフルーツの花に少しの紫 |
| シェイク | グレープ | 「王族の顔を外した夜」・地味な旅装 | 飾り気の無い淡い砂色の土、小さなぶどうの房、縁の近くに簡素な幾何学の帯、足元だけ深い紫。金・宝石・紋章は無し |

## 生成前に決める8行（`docs/shisha_reference.md` §4.3。器だけの素材なので全枚共通）

```
人物      : 各項の贈り主（意匠の根拠は上の表。人物そのものは描かない）
場面      : 単体の器（作りパートの器・贈り物の演出の素材）。空のまま
台の型    : なし（器だけ。台・受け皿・ポストは描かない）
HMD       : なし
炭        : なし
ホース    : なし
吸い口    : なし
構図      : 少し上から見下ろす斜め（bowl_empty_hiyori.png と同じ角度）・中央・透過・余白6〜8%
```

## 受け取った後（こちら側の作業）

1. 原画を `asset_sources/hagal-bond-gifts-20261111/originals/` に、採用分を `assets/ui/making/` に置き、`python3 remake/tools/build_manifest.py` で manifest と WebP を作る。
2. 贈り物の動きは `bowl_empty_<贈り主>.png` が manifest にあれば自動で出す（コードの追加なし）。作りパート（配合・詰め）で使うには、`remake/js/craft/art.js` の `BOWL_ART` に専用の器を足し、葉の位置（`rim`・`packRim`）を実画面で合わせる。
3. `bowl_empty_clay`・ファンネル型を差し替えたら、作りパートの葉の位置（`BOWL_ART` の `rim`・`w`）を実画面で合わせる。
4. 白背景・暗背景で縁の色のにじみを見て、§4.4 の器の項目（脚・口縁・穴・文字なし）を確かめる。

---

## Codex に渡すプロンプト（そのままコピー）

```
=== 共通（23枚すべての頭に付ける） ===
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

この依頼の決まり（上の指針より優先）:
- ハガル（シーシャの器）は「器（カップ）＋その下の細い脚（中空の首）」。脚は器と同じくらいかそれ以上の高さで、下へ少し広がって終わる。脚の無い皿・浅い鉢・短い高台だけの形は不可（今の assets/ui/making/bowl_empty_clay.png がこの失敗）。脚を短く潰さない。
- 実物の大きさ: 口径7〜8cm・全高9〜12cm。比率は添付①と同じ家族にする。
- 描き方・角度・光・仕上げ・画面の中の大きさは、ゲームに入っている専用ハガル assets/ui/making/bowl_empty_hiyori.png（添付①）にそろえる。細かい質感は残し、写真のような質感や滑らかなCGにしない。
- 器は空。内側は飾りの無い素焼きの肌で、底に通気の穴が5つ（真ん中に1つ・まわりに4つ）見える。口縁は途切れない円。葉・アルミ・炭・煙は描かない。
- 出力: 1254×1254 の PNG、背景は本当の透過（alpha）。器を1つだけ中央に、まわりに6〜8%の透明な余白。器の外の影は描かない。縁は自然なアンチエイリアスで、色のにじみ・白い縁取りを残さない。
- 描かないもの: 人物・手・シーシャ台・受け皿・ベース・金属ポスト・HMD・炭・アルミ・葉・煙・文字・数字・ロゴ・実在の製品・透かし。
- 添付: ① assets/ui/making/bowl_empty_hiyori.png（仕上げ・角度・大きさ・脚の比率の基準）。② 抜き出しの依頼（1〜7）は、各項の v1 シート（編集の対象そのもの）。③ 形と構造の確認に、非公開リポジトリ siryou の shisha-hardware-reference/web-refs/images/ から日本の店のボウルの写真を1〜2枚（形と構造だけを見る。写真の中の大きさ・背景・ロゴは真似しない）。
- 生成後に確かめる: 脚があり潰れていない／口縁が途切れない／底の穴が見える／文字・ロゴなし／透過の縁に色のにじみなし／①と並べて大きさと角度がそろう。1つでも外れたら直すか作り直す。

=== 1〜7: 選定済みデザインの抜き出し（共通の文） ===
Use case: background-extraction. Asset type: one transparent PNG sprite for an existing browser game's hookah bowl. Edit target: the provided approved concept sheet (Image ②). Extract ONLY the option named below, preserving that exact approved object's silhouette, slightly elevated camera angle, clay colors, porosity, fine shading, decoration, proportions, the continuous circular functional rim, the FULL slim stem down to its foot, and the visible bottom air holes. Do not redesign or reinterpret it. Remove the paper background, all Japanese text and lines, the other three bowls, and any drop shadow outside the object. Output exactly ONE complete bowl centered, large in a 1254×1254 square canvas with 6–8% transparent margin, true transparent alpha background, clean natural antialiased edge with no colored fringe. No characters, no hand, no stand, no hookah base, no HMD, no coals, no foil, no smoke, no symbols, no lettering, no watermark. The bowl is empty; keep the interior plain porous clay. Image ② is an exact edit target, not inspiration.

--- 1/23: assets/ui/making/bowl_empty_sumi.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/01_sumi_naru.png. Extract the A option in the TOP LEFT quadrant, labeled 閉店後の一服 for スミさん: a well-used reddish-brown unglazed terracotta bowl with darker worn patches, shallow carved cardamom-pod leaf shapes and small dots around the outer cup, and ringed grooves on the upper stem.

--- 2/23: assets/ui/making/bowl_empty_naru.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/01_sumi_naru.png. Extract the B option in the BOTTOM RIGHT quadrant, labeled 対等のしるし for なる: the upper cup in off-white speckled clay, the lower cup and the faceted stem in charcoal-black clay, three short incised diagonal strokes on the cup, and two pale horizontal bands around the stem.

--- 3/23: assets/ui/making/bowl_empty_adam.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/02_adam_rin.png. Extract the B option in the TOP RIGHT quadrant, labeled 双香の誓い for アダム: reddish-brown streaked clay, a row of short vertical notches below the rim, a star-anise relief on the cup, and two crossing raised bands spiraling down the stem. Keep the rim complete and continuous.

--- 4/23: assets/ui/making/bowl_empty_rio.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/02_adam_rin.png. Extract the A option in the BOTTOM LEFT quadrant, labeled 夜の私物 for 凛: dusky indigo / navy-purple clay outside with a pale grey interior, one thin line around the cup below the rim, and a wide hourglass stem.

--- 5/23: assets/ui/making/bowl_empty_tsumugi.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/03_tsumugi_minto.png. Extract the B option in the TOP RIGHT quadrant, labeled 今日の色 for つむぎ: marbled pale clay with soft lavender, sage-green and cream swirls running down the cup and stem, a tiny cat silhouette and a small leaf sprig on the cup.

--- 6/23: assets/ui/making/bowl_empty_minto.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/03_tsumugi_minto.png. Extract the B option in the BOTTOM RIGHT quadrant, labeled 栞のひと息 for みんと: creamy speckled clay, a pale mint-green rim, a shallow mint-green leaf sprig on the cup, and a knit-like leaf pattern incised on the stem.

--- 7/23: assets/ui/making/bowl_empty_samechan.png ---
Image ②: asset_sources/hagal-bond-concepts-issue504/v1/04_samechan_hiyori.png. Extract the B option in the TOP RIGHT quadrant, labeled コロちゃんの指定席 for サメちゃん: cream speckled clay, a round medallion with a cute small shark wearing a little crown on the cup, blue wave lines on both sides of it, and a blue wave band around the stem.

=== 8〜18: 新しい意匠（共通の文） ===
Asset type: one transparent PNG sprite for an existing browser game's hookah bowl: a gift bowl that one character has used for years. Create ONE new unglazed clay hookah tobacco bowl in the SAME object family, camera angle, lighting, rendering finish and on-canvas size as Image ① (bowl_empty_hiyori.png): a rounded cup with a thick, continuous rim; an empty interior of plain porous clay with five air holes in the bottom (one in the center and four around it); and below the cup a long, slim, hollow stem about as tall as the cup, flaring slightly at the foot. Never a flat dish or a shallow bowl without a stem. Keep the decoration restrained, like the approved designs on the concept sheets: shallow carving, incised lines or a little colored slip on the OUTSIDE of the cup and stem only, a few muted clay colors, signs of long use (slightly darkened clay, soft wear). Nothing inside the cup. Output exactly ONE bowl centered in a 1254×1254 square canvas with 6–8% transparent margin, true transparent alpha background, clean natural antialiased edge with no colored fringe. No characters, no hand, no stand, no hookah base, no HMD, no coals, no foil, no tobacco, no smoke, no lettering, no numbers, no logos, no watermark.

--- 8/23: assets/ui/making/bowl_empty_ageha.png ---
Design for あげは (white gummy bear flavor; the bowl has "a bear sticker on the rim"): pale pinkish-cream clay; a small, slightly worn glossy white gummy-bear-shaped sticker stuck on the outer side of the cup just under the rim; a few tiny incised hearts and dots scattered around the lower cup; a faint pastel-pink band near the foot. Cute but quiet; it is still clay, not plastic.

--- 9/23: assets/ui/making/bowl_empty_mashiro.png ---
Design for ましろ (black tea; sleepy; likes dark leaves but adds only a little): smoky dark tea-brown clay with a darker tea-stain wash fading down from the rim; a single small incised tea leaf on the cup and one thin horizontal line around the stem; matte, calm, sleepy mood.

--- 10/23: assets/ui/making/bowl_empty_kumicho.png ---
Design for 神崎 / シーシャ組長 (dragon fruit; treats sharing a session like exchanging sake cups): deep charcoal-black clay; the top of the cup opens slightly wider, like the silhouette of a sake cup (sakazuki), but it is still a proper hookah bowl with the full long stem; a band of shallow carved overlapping scales (dragon scales / dragon-fruit skin) around the cup; one thin vivid magenta-pink inlay line along the outer rim edge. No crests, no family emblems, no letters.

--- 11/23: assets/ui/making/bowl_empty_rei.png ---
Design for レヰ (rose; visual-kei café owner who dresses in black and wine red): matte black clay with a deep wine-red wash; one shallow carved rose on the cup with a thin thorny stem winding down around the stem of the bowl; gothic but simple. No skulls, no crosses, no letters.

--- 12/23: assets/ui/making/bowl_empty_saku.png ---
Design for 綾取 (Earl Grey; his surname means the string game "ayatori"; the gift continues his "reply column"): cream clay with a soft grey-blue slip; incised crossing string lines like a cat's-cradle string figure wrapping around the cup; one small bergamot (citrus) mark; a small blank incised rectangular panel on the stem, left empty like an answer box. Light and youthful.

--- 13/23: assets/ui/making/bowl_empty_noor.png ---
Design for ヌール (double apple with anise; learned from her father at fourteen; desert tour guide in Dubai): warm sand-beige clay; wavy incised lines sweeping around the cup and stem like wind ripples on desert dunes; one small apple and a tiny anise star carved near the rim; well loved, slightly darkened from years of use.

--- 14/23: assets/ui/making/bowl_empty_steve.png ---
Design for スティーブ (lemon-lime "mountain mist"; wears retro patterned shirts; waits for the heat patiently; the gift has "a slightly chipped rim"): cream clay with soft lemon-yellow and lime-green slip bands; one band of a simple retro geometric repeat (small diamonds and stripes, like a vintage patterned shirt); a tiny chip on the OUTER edge of the rim only, while the inner rim stays a continuous circle. Friendly and homely.

--- 15/23: assets/ui/making/bowl_empty_volk.png ---
Design for ヴォルク (blast mint; measures everything; "a row of notches on the outside, one for each recipe change"): cool grey clay with an icy pale mint-blue wash; neat rows of small tally notches scratched on the outside of the cup and the stem, grouped precisely; one thin exact ring line just under the rim. Clean and precise.

--- 16/23: assets/ui/making/bowl_empty_master_hookah.png ---
Design for 王煙楼 (black tea with a little wood; famous for dragon-shaped smoke, but this is "a quiet bowl, not one for show"): a very plain, old, well-used dark brown clay bowl with a slightly darker oiled patina; a single fine incised flowing smoke line around the cup that only faintly suggests a dragon's tail. Humble and quiet; no gold, no ornament.

--- 17/23: assets/ui/making/bowl_empty_da_silva.png ---
Design for ダ・シルヴァ太陽 (passion fruit; "shisha is a festa"; the sun): warm orange terracotta; a shallow carved band of sun rays around the cup with a touch of ochre-yellow slip; one small passion-fruit flower carved on the side with a hint of purple. Lively but still restrained.

--- 18/23: assets/ui/making/bowl_empty_sheikh.png ---
Design for シェイク (grape; the nights he set aside his royal face and came in plain travel clothes): plain pale sand-colored clay; a small carved bunch of grapes on the cup; a fine, simple geometric band near the rim; a soft deep-purple wash only around the foot. Humble: no gold, no jewels, no royal emblems.

--- 19/23: assets/ui/making/bowl_empty_clay.png（同名で差し替え） ---
Create the standard plain clay bowl sold in the game's shop (replace the current image, whose missing stem is the error). Same family, angle, finish and on-canvas size as Image ①: a plain reddish-brown unglazed clay bowl like a thick handmade Ukrainian-style clay bowl — thick walls, a slightly wide cup with a flat top rim surface, an empty porous interior with five bottom air holes, and a proper long slim hollow stem below, flaring slightly at the foot. No decoration, no motifs. Also attach the current assets/ui/making/bowl_empty_clay.png as Image ④ for color and clay texture ONLY (do not copy its stemless shape). Output 1254×1254 transparent PNG, single bowl centered with 6–8% margin.

--- 20/23: assets/ui/making/bowl_empty_phunnel.png（同名で差し替え） ---
Edit target: the current assets/ui/making/bowl_empty_phunnel.png (Image ⑤). Keep this phunnel bowl's look exactly — the purple glaze, gold rim, wide shallow cup and the raised central spire with its hole — but it is missing its stem: redraw it as a complete phunnel hookah bowl with a long slim hollow stem below the cup, matching the stem proportion and foot of assets/ui/making/bowl_packed_normal.png (Image ⑥: stem proportion only). Keep this image's own rendering style (it is NOT the style of Image ①). Output 1254×1254 transparent PNG, single bowl centered with 6–8% margin, empty bowl, no leaves.

--- 21/23: assets/ui/making/bowl_packed_phunnel_airy.png（同名で差し替え） ---
Same bowl as 20/23 (attach the new bowl_empty_phunnel.png as the edit target so all four match exactly). Fill the ring around the central spire with moist red-brown shredded shisha tobacco, packed LOOSELY and fluffy, slightly below the rim, the spire tip left clear. Match the leaf look of the current assets/ui/making/bowl_packed_phunnel_airy.png (attach as reference). No foil, no coals, no smoke.

--- 22/23: assets/ui/making/bowl_packed_phunnel_normal.png（同名で差し替え） ---
Same bowl as 20/23. Fill the ring around the central spire with moist red-brown shredded shisha tobacco, packed at NORMAL density, level with the rim, the spire tip left clear. Match the current assets/ui/making/bowl_packed_phunnel_normal.png leaf look. No foil, no coals, no smoke.

--- 23/23: assets/ui/making/bowl_packed_phunnel_firm.png（同名で差し替え） ---
Same bowl as 20/23. Fill the ring around the central spire with moist red-brown shredded shisha tobacco, packed FIRMLY and dense, pressed flat just under the rim, the spire tip left clear. Match the current assets/ui/making/bowl_packed_phunnel_firm.png leaf look. No foil, no coals, no smoke.
```
