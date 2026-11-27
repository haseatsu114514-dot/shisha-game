# 縦画面の試作の店番で使う、モブの客の絵（2026-11-27）

オーナー「あとモブがつむぎとか他キャラと比べると画風違うので再生させて　かなりパターン作りたい」（要望台帳 VPM29）。
そのあと「シーシャ屋のモブでおばあちゃんいるのは変　20〜30代メインに　いてもたまに40.50」「後モブキャラの拡大率もレアキャラと同じにして」（VPM31）で、年配に見えた6人を描き直し、全員を顔のアップに切り直した（下の「VPM31」）。

いまの店番の客の絵（`remake/img/ui/tonari-floor/guest-*.webp`。tonari の15種）は、主要キャラの立ち絵と画風が違い、1種に1人しかいなかった。
そこで、**主要キャラの立ち絵を画風の手本にして、店ごと・客の種類ごとに2人ずつ（2パターン）** 作り直した。

- 作り方: OpenAI の画像 API（`/v1/images/edits`・モデル `gpt-image-2.6-sunburst`）、1536×1024、品質 medium、背景は透過（`background: transparent`）
- 1回の生成で1人。左半分に「ふだん」、右半分に「笑顔」の同じ人物を並べて描かせ、2枚に切り分けた（表情を変えても同じ人・同じ服・同じ位置になるように）
- 人数と枚数: **66人・132枚**（tonari 15種×2人＝30人、mukai 9種×2人＝18人、dubai 9種×2人＝18人。1人＝ふだん・笑顔の2枚）
- 試作が読む絵: `remake/previews/portrait-stage/img/mob/<id>.webp`・`<id>-happy.webp`（256×256・RGBA の WebP 品質90・透明度100。1枚 11.3〜19.5KB、132枚で約1.9MB）
- 絵の一覧: `remake/previews/portrait-stage/mob-art.mjs` の `MOB_ART`（店 → 本編の客の絵のID → パターンの並び）。キーは本編の `GUESTS`（`remake/js/daily/tonari-floor-data.js`）・`MUKAI_GUESTS`・`DUBAI_GUESTS`（`remake/js/daily/floor-venues.js`）と同じ。二人連れ（party 2）は `種類-a`・`種類-b`
- このフォルダ: 原画（1536×1024・RGBA・WebP 品質95。`<id>-original.webp`。66枚で約13.5MB。Git LFS）
- **本編の画面にはまだ組み込んでいない**（いまの `guest-*.webp` はそのまま）。試作の店番（`floor.mjs` の `guestImg`。VPM30）だけが読む。客ごとに、営業の種と客の ID でパターンが決まる

## 構図（切り出し）

**顔のアップ**（VPM31）。レアで来る本編の人物の顔アイコン（`remake/img/ui/face_icons/new/face_<id>.webp`）と同じ見た目の大きさにした。席のカードの丸い顔（直径 約4.3rem）と、下の画面の客の丸い顔に、`object-fit: cover` で出る。

- 頭頂が上から1%、あごが上から85%（256×256 で頭の高さ 約215px）。ふだんと笑顔は同じ倍率・同じ枠で切る
- この割合の決め方: 顔アイコンの主要キャラは目が低く、ほおの幅が広い描き方なので、頭頂〜あごの割合をそろえても（頭頂7%・あご79%で試した）モブの顔は小さく見えた。目の高さのほおの幅（顔アイコンは枠の約55%、頭頂7%・あご79%のモブは約47%）を比べて、もう約1.18倍寄せた
- 帽子・ニット帽・キャップ・束ね髪・お団子の上の端は、絵の上の端で少し切れる（顔アイコンのスミさんの帽子・はじめのキャップと同じ）。肩は左右で切れる
- 前の構図（VPM29。胸から上で、頭頂4%・あご64%。いまの `guest-*.webp` と同じ）は使っていない。原画から、下の表の値でいつでも切り直せる
- あごは原画を原寸で目盛りと並べて目で読んだ（あごひげの人は、ひげの先ではなく輪郭から推定した）
- 頭頂は「髪の上端」と「目の高さ〜あご × 係数」の平均（髪のボリュームの差で顔の大きさがばらつかないように）。係数は帽子の無い人の中央値で、女性 2.87・男性 2.60
- 帽子・ニット帽・ベレー帽・グトラ（頭布）・シャイラ（スカーフ）・高い位置のお団子や束ね髪の人は、髪の上端が見えないか高すぎるので、目〜あごから推定した（束ね髪の下に髪の上端が見える人は、その値と半々）
- 笑顔の側は、頭の輪郭（髪・帽子・顔の外形）をふだんに重ねて、いちばん重なる位置で切った（原画でのずれは全員 0〜2px）
- 縮小は LANCZOS だけ（透明度を掛けてから縮めて、縁の色のにじみを防いだ）。原画へ彩度・明度は足していない

人ごとの値（原画の左半分＝ふだんの座標。y は上から）は下の表の「あご」「頭頂」。この2つと構図の割合から、切り出しを作り直せる。

## 依頼文（全員に共通の部分）

`{person}` に下の表の人物の説明（英文）が入る。参照に渡した絵は、女性が `ref_minto`・`ref_ageha`・`ref_tsumugi`・`ref_sumi`、男性が `ref_minto`・`ref_ageha`・`ref_sumi`・`ref_adam` の4枚。

```text
Create a character sheet for a background customer (a minor, unnamed guest) of a Japanese 2D visual-novel game about a shisha lounge.

The attached images are approved main-cast portraits of this game. Use them ONLY as the art-style target: the same line weight, the same flat cel shading, the same way of drawing eyes, noses, mouths, hair bands and clothing folds, the same color finish. Do NOT copy their faces, hairstyles, hair colors, outfits or accessories (no horns, no wings, no bear hair clips, no leopard print, no heart pendants). The new person must look like an ordinary customer drawn by the same artist.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

THE PERSON: {person}
An adult, clearly over 20 years old. Ordinary everyday look, plain clothes without any logo, letters or brand marks.

LAYOUT: one wide image with the SAME person drawn twice, side by side, same size, same clothes, same hair, same angle:
- LEFT half: calm neutral expression, mouth closed, relaxed.
- RIGHT half: a happy satisfied smile (eyes softly smiling, a natural closed or slightly open smile). Same person, only the expression changes.
Each drawing is a half-body portrait facing the viewer (front or very slight three-quarter), head upright, centered in its half.
Framing in each half (important): the figure is drawn smaller than a typical close-up. The top of the hair is about 8 percent below the top edge of the image, the chin is at half of the image height (50 percent), and below the chin the neck, both shoulders, the chest and the upper arms continue down to the bottom edge. Both shoulders are completely inside their own half, with a little empty space to the left and to the right of each figure. The two figures do not touch or overlap, and nothing crosses the vertical center line of the image. Arms hang down naturally at the sides. No hands, no arms raised, no props held in the hands, no speech bubbles, no text, no labels, no frames, no divider line.

BACKGROUND: fully transparent (alpha) background, nothing behind the two busts.
```

STYLE STANDARD の段落は [立ち絵の規格](../../../docs/portrait_standard.md) の3節の英文と同じ。頭身の段落（HEAD-TO-BODY）は、胸から上の絵なので入れていない。

## 参照に渡した絵

主要キャラの立ち絵の胸から上を 768×768（白い背景）に切り出したもの。顔・髪型・服・小物は写さず、画風（線・影・目の描き方・色の仕上げ）の手本だけに使うと依頼文に書いた。

| 参照 | 人物 | 元の立ち絵 |
|---|---|---|
| `ref_minto` | みんと | 新バージョンの通常（`remake/img/sprites/character_variants/new/minto/chr_minto_normal.webp`）と縮小比較で一致 |
| `ref_ageha` | あげは | 照合できていない（手元に実体の無い立ち絵があり、どの版か確かめられなかった） |
| `ref_tsumugi` | つむぎ | 新バージョンの通常（`…/new/tsumugi/chr_tsumugi_normal.webp`）と一致 |
| `ref_sumi` | スミさん | 照合できていない（同上） |
| `ref_adam` | アダム | 新バージョンの通常（`…/new/adam/chr_adam_normal.webp`）と一致 |

## 生成した回数・作り直した人・外した人

- 前の作業者の分: 生成の記録（ログ）から数えて約110回（記録に残らない試しの生成を除く）。最初の版（tonari 30人・mukai 13人）は作り直されて、採用していない（作り直した理由の記録は残っていない）。tonari-worker-1 は背景が透過にならず（半透明の画素が多い）、もう一度作った
- 点検の後の作り直し: **5人・7回**（作り直しの上限15人の内）

| 人 | 作り直した理由 | 直し方 |
|---|---|---|
| tonari-first-2 | 丸い顔・大きな丸い目で10代に見えた | 大人の顔立ち（長めのあご・頬骨・大人の首・ふつうの大きさの目）の指定を足した |
| tonari-walkers-b-2 | 10代に見えた。1回めの作り直しは大人になったが、男性に見えた | 大人の顔立ちの指定、2回めは女性らしい顔立ち・小さなピアス・耳にかかるショートボブ |
| tonari-students-a-2 | 丸い顔・大きな丸い目で10代に見えた。1回めの作り直しは背景が透過にならず、半透明のもやが残った | 大学院生・24歳にして大人の顔立ちの指定を足した。もやの絵は捨てて、もう一度作った |
| mukai-new_tokyo-2 | 10代に見えた | 27歳にして大人の顔立ちの指定を足した |
| dubai-traveler-1 | 「日焼けした鼻」が頬と鼻の赤いぼかし（エアブラシ状のグラデーション）になった | 日焼けをやめ、頬と鼻は肌と同じ色・赤みなしと指定した |

- **外した人: なし**（66人全員を置いた。`MOB_ART` の全30種に2パターンずつ）

## 生成後に確かめたこと（VPM29。構図は前の胸から上の時）

目で見たもの:

- 原画66枚をすべて並べ、顔のまわりを拡大して見た: 線は外側がやや太く内側が細い濃い輪郭線、影は2〜3段のベタ塗り、髪のハイライトは帯状の数か所。肌のテカリ・エアブラシのぼかし・リムライト・光の粒は無い（dubai-traveler-1 の1回めだけ赤いぼかしがあり、作り直した）
- 主要キャラ（新バージョンの通常のつむぎ・みんと・あげは・なる・アダム・ひより・スミさん）を同じ構図（頭頂4%・あご64%）で切って並べ、同じ描き手に見えること（輪郭線の太さ・影の段・目の描き方・色の仕上げ）。モブの髪と服の描き込みは主要キャラより少なめ
- 全員が成人に見えること（作り直した4人のほかは、年齢の設定どおりに見える。若い人も大人の顔立ち）
- 服・帽子・小物に文字・ロゴ・擬似文字が無い。手・持ち物・吹き出し・枠は無い
- ふだんと笑顔が同じ人物（顔・髪・服・色が同じで、表情だけが違う）
- 切り出した132枚を、目安の線（頭頂4%・あご64%）つきで並べた一覧と、ゲームと同じ丸い窓（6rem・3.6rem 相当の 96px・58px。背景 `#f3e9d6`）で、いまの `guest-*.webp` と並べた一覧で、頭の大きさ・位置がそろっていること。ずれて見えた mukai-coffee_lover-1（ニット帽で顔が小さく見えた）は頭頂を直した
- 透過の縁を、暗い背景・明るい背景の上で4倍に拡大して、白いふち・色のにじみ・取り残しが無いこと

数えたもの:

- 原画の背景: 半透明の画素（透明度 9〜127）の、不透明の画素に対する割合が全員 0.3〜0.9%（輪郭のなめらかな縁だけ。もやの残って捨てた絵は 15〜69% あった）
- 切り出した絵の縁: 左右・内側にまっすぐな切れ目（左右の2人の境目で切れた跡）が無い。上の端で切れるのは、上に書いた束ね髪・お団子の先だけ
- 容量: 132枚すべて 20KB 以下（最大 19.0KB）

試作の店番の画面の中での見え方は、VPM30（組み込み）・VPM31（顔のアップ）で確かめた。

## 人物（people.json の要約）

性は f＝女性・m＝男性。あご・頭頂は原画（1536×1024）の左半分の y（px）。頭頂は上の「構図」の決め方で出した値で、帽子の人は帽子の下の推定。

| id | 店 | 種類 | 性・年齢 | 見た目 | あご | 頭頂 |
|---|---|---|---|---|---|---|
| tonari-first-1 | tonari | first | f・24 | 初めての来店。あご丈の茶色のボブ・前髪、少し緊張した目。クリーム色のケーブルニット | 523 | 47 |
| tonari-first-2 | tonari | first | m・26 | 初めての来店。耳まで隠れる黒いマッシュ、細い眉。グレーのパーカーにベージュのコーチジャケット | 497 | 55 |
| tonari-worker-1 | tonari | worker | m・35 | 仕事の合間。黒髪の短い七三、少し疲れたやさしい目。水色のシャツ・ノーネクタイ | 475 | 31 |
| tonari-worker-2 | tonari | worker | f・32 | 仕事帰り。耳上の短いこげ茶の髪。紺のジャケットに白いブラウス | 551 | 36 |
| tonari-train-a-1 | tonari | train-a | m・28 | 昼休み。グレーのキャップ、短い黒髪。青いパーカー | 473 | 23 |
| tonari-train-b-1 | tonari | train-b | f・29 | 昼休み。まん中分けの長いこげ茶の髪。えんじ色のニット | 478 | 44 |
| tonari-train-a-2 | tonari | train-a | f・31 | 終電前。ベージュのキャップ、低いポニーテール。カーキのワークジャケットに白T | 525 | 9 |
| tonari-train-b-2 | tonari | train-b | m・33 | 終電前。耳にかけた肩までの黒髪、面長、眠そうな目。オリーブのシャツジャケットに黒T | 492 | 50 |
| tonari-reader-1 | tonari | reader | f・28 | 読書好き。肩までのこげ茶のウェーブ、細い丸めがね。モスグリーンのカーディガン | 508 | 62 |
| tonari-reader-2 | tonari | reader | m・32 | 本好き（VPM31 で描き直し）。耳にかかる少し長いこげ茶のウェーブ、細い楕円のめがね。紺のセーターに白い襟 | 476 | 50 |
| tonari-walkers-a-1 | tonari | walkers-a | f・36 | 散歩帰り。栗色の高いポニーテール。黄緑のジップパーカー | 574 | 93 |
| tonari-walkers-b-1 | tonari | walkers-b | m・38 | 散歩帰り。ごく短い黒髪、薄い無精ひげ、幅の広い顔。チャコールのウインドブレーカー | 436 | 78 |
| tonari-walkers-a-2 | tonari | walkers-a | f・34 | 散歩帰り（VPM31 で描き直し）。肩にかけた低い横のポニーテールのこげ茶の髪。ラベンダーのフリースベスト | 532 | 62 |
| tonari-walkers-b-2 | tonari | walkers-b | f・27 | 散歩帰り。耳にかかる黒いショートボブ、小さなピアス。黄色のウインドブレーカーに白T | 516 | 40 |
| tonari-nose-1 | tonari | nose | f・33 | 香り好き。頭の上のお団子、細い顔、切れ長の目。水色のシャツ | 563 | 105 |
| tonari-nose-2 | tonari | nose | m・39 | 香り好き。後ろで小さく結んだ黒髪、整えた短いひげ。濃い青緑のヘンリーネック | 460 | 97 |
| tonari-students-a-1 | tonari | students-a | m・21 | 大学生。茶色のパーマの巻き毛、半分閉じた目。オリーブのパーカー | 492 | 40 |
| tonari-students-b-1 | tonari | students-b | m・22 | 大学生。グレーのキャップ、短い黒髪。青いパーカー | 480 | 58 |
| tonari-students-a-2 | tonari | students-a | f・24 | 大学院生。明るい茶色の巻き毛のボブ。からし色のトレーナー | 527 | 54 |
| tonari-students-b-2 | tonari | students-b | f・22 | 大学生。黒いキャップ、肩までの黒髪、落ち着いた目。デニムジャケットに白T | 533 | 52 |
| tonari-talkers-a-1 | tonari | talkers-a | f・29 | 話し好き。長い黒茶の髪、目の下のほくろ。ワインレッドのトップス | 508 | 61 |
| tonari-talkers-b-1 | tonari | talkers-b | f・28 | 話し好き。片耳にかけた茶色のボブ。青緑のブラウス | 520 | 46 |
| tonari-talkers-a-2 | tonari | talkers-a | m・42 | 話し好き。後ろへ流した長めの髪、目じりのしわ、幅の広い顔。からし色のカーディガンに白T | 445 | 45 |
| tonari-talkers-b-2 | tonari | talkers-b | f・45 | 話し好き。まっすぐな前髪のボブ、目もとの細いしわ。コーラルのブラウス | 552 | 45 |
| tonari-elder-1 | tonari | elder | m・36 | 長居する常連（VPM31 で描き直し。試作の呼び名は「常連の方」）。茶色の中折れ帽、短い黒髪、薄い無精ひげ、太い眉。オリーブのフィールドジャケット | 515 | 68 |
| tonari-elder-2 | tonari | elder | f・31 | 長居する常連（VPM31 で描き直し。試作の呼び名は「常連の方」）。紺のバケットハット、肩までのまっすぐな黒髪、小さな銀のピアス。ライラックのカーディガン | 562 | 26 |
| tonari-friends-a-1 | tonari | friends-a | f・25 | 友だち連れ。ゆるくまとめた茶色のお団子。コーラルのトップス | 567 | 94 |
| tonari-friends-b-1 | tonari | friends-b | f・25 | 友だち連れ。黄色のシュシュの横ポニーテール。淡い黄色のセーター | 513 | 70 |
| tonari-friends-a-2 | tonari | friends-a | m・26 | 友だち連れ。短いちょんまげ風の結び髪、刈った横。黒Tに開いたえんじのシャツ | 488 | 99 |
| tonari-friends-b-2 | tonari | friends-b | m・26 | 友だち連れ。後ろで低く結んだ黒髪、太い眉。白Tに開いたデニムシャツ | 478 | 72 |
| mukai-remote-1 | mukai | remote | m・32 | 作業中。少しぼさぼさの黒髪、細い四角のめがね。グレーのトレーナー | 484 | 45 |
| mukai-remote-2 | mukai | remote | f・31 | 作業中。丸めがね、ハーフアップの黒髪。大きめのベージュのシャツ | 528 | 54 |
| mukai-office-1 | mukai | office | m・28 | 会社員。短く整えた黒髪。紺のスーツに白シャツ、ゆるめたえんじのネクタイ | 484 | 18 |
| mukai-office-2 | mukai | office | f・33 | 会社員。耳にかけたショートヘア。グレーのジャケットに水色のブラウス | 514 | 31 |
| mukai-after_work-a-1 | mukai | after_work-a | m・36 | 打ち合わせ帰り。黒いキャップ、薄い無精ひげ。黒いオーバーシャツ | 496 | 25 |
| mukai-after_work-b-1 | mukai | after_work-b | f・34 | 打ち合わせ帰り。つややかな黒いボブ。ベージュのトレンチコートに白いニット | 526 | 39 |
| mukai-after_work-a-2 | mukai | after_work-a | f・29 | 同僚連れ。オリーブのキャップ、肩にかかる長い髪。グレーのジャケットに白T | 519 | 40 |
| mukai-after_work-b-2 | mukai | after_work-b | m・43 | 同僚連れ。あご丈のウェーブ、たれ目、あごひげ。深緑のコーデュロイジャケット | 476 | 62 |
| mukai-coffee_lover-1 | mukai | coffee_lover | m・44 | コーヒー好きの常連。茶色のニット帽、短いあごひげ。デニムシャツ | 490 | 50 |
| mukai-coffee_lover-2 | mukai | coffee_lover | f・38 | コーヒー好きの常連。えんじのベレー帽、短いウェーブの黒髪。クリーム色のタートルネック | 555 | 59 |
| mukai-new_tokyo-1 | mukai | new_tokyo | f・23 | 初めて寄った。毛先が内巻きのボブ。淡いピンクのカーディガンに白いトップス | 532 | 68 |
| mukai-new_tokyo-2 | mukai | new_tokyo | m・27 | 初めて寄った。やわらかいマッシュ。薄いグレーのニットポロ | 468 | 78 |
| mukai-critic-1 | mukai | critic | m・45 | シーシャ通。頭の上で結んだ髪、やぎひげ、細い丸めがね。黒いタートルネック | 504 | 97 |
| mukai-critic-2 | mukai | critic | f・36 | シーシャ通。低いお団子、切れ長の目、小さなピアス。チャコールのスタンドカラーシャツ | 536 | 46 |
| mukai-night_pair-a-1 | mukai | night_pair-a | f・26 | 夜の街歩き。アッシュブラウンの高いポニーテール。黒いライダースジャケット | 555 | 103 |
| mukai-night_pair-b-1 | mukai | night_pair-b | m・26 | 夜の街歩き。まん中分けの肩より長い黒髪。えんじのブルゾンに黒T | 470 | 62 |
| mukai-night_pair-a-2 | mukai | night_pair-a | m・29 | 夜遊び帰り。刈り上げに上だけ結んだ髪。からし色のシャツジャケット | 480 | 82 |
| mukai-night_pair-b-2 | mukai | night_pair-b | f・28 | 夜遊び帰り。長いウェーブの青みがかった黒髪。オフホワイトのブラウス | 493 | 66 |
| dubai-traveler-1 | dubai | traveler | m・34 | ヨーロッパからの観光客。白いキャップ、明るい茶色の髪、短い無精ひげ、青灰色の目。水色の麻のシャツ | 480 | 48 |
| dubai-traveler-2 | dubai | traveler | f・27 | 東アジアからの観光客。ベージュのキャップ、長い黒髪。白Tに薄い緑のカーディガン | 506 | 45 |
| dubai-souq_shopper-1 | dubai | souq_shopper | f・42 | 南アジア系。市場帰り。短い黒髪。オレンジのチュニックにクリーム色のスカーフ | 488 | 59 |
| dubai-souq_shopper-2 | dubai | souq_shopper | m・35 | アフリカ系。市場帰り。ごく短い髪、幅の広い顔。明るい黄色のポロシャツ | 440 | 44 |
| dubai-local_regular-1 | dubai | local_regular | m・41 | 首長国の常連。白いグトラに黒いアガール、短い黒ひげ。白いカンドゥーラ | 440 | 37 |
| dubai-local_regular-2 | dubai | local_regular | m・29 | 首長国の若い常連（VPM31 で描き直し）。赤と白の格子のグトラに黒いアガール、細い口ひげと短い無精ひげ。薄いグレーのカンドゥーラ | 453 | 20 |
| dubai-vip-1 | dubai | vip | m・38 | 国際的な若い実業家の VIP（VPM31 で描き直し）。後ろへ流したこげ茶の髪、ひげなし。チャコールのスーツに水色の開襟シャツ | 466 | 40 |
| dubai-vip-2 | dubai | vip | f・45 | 首長国の女性の VIP。細い金縁めがね、黒いシャイラ、黒いアバヤ | 499 | 43 |
| dubai-majlis-a-1 | dubai | majlis-a | f・34 | アラブ系。友だちと語らう。低いお団子の黒髪。オリーブのブラウス | 519 | 54 |
| dubai-majlis-b-1 | dubai | majlis-b | f・33 | アラブ系。友だちと語らう。長いウェーブのこげ茶の髪。えんじのワンピース | 469 | 72 |
| dubai-majlis-a-2 | dubai | majlis-a | m・37 | アラブ系。後ろで結んだ黒髪、整えたあごひげ。薄いグレーのカンドゥーラ（頭布なし） | 440 | 97 |
| dubai-majlis-b-2 | dubai | majlis-b | m・36 | アラブ系。肩までのウェーブの黒髪、薄い無精ひげ。深緑のシャツ | 458 | 63 |
| dubai-pair_tour-a-1 | dubai | pair_tour-a | f・26 | ヨーロッパからの二人旅。金髪のポニーテール、そばかす、緑の目。淡い黄色のブラウス | 539 | 116 |
| dubai-pair_tour-b-1 | dubai | pair_tour-b | m・27 | ヨーロッパからの二人旅。赤茶色の巻き毛、そばかす。青緑のTシャツ | 470 | 70 |
| dubai-pair_tour-a-2 | dubai | pair_tour-a | f・31 | アフリカ系の二人旅。高い位置でまとめた巻き毛。コーラルのトップス | 566 | 119 |
| dubai-pair_tour-b-2 | dubai | pair_tour-b | m・33 | ラテン系の二人旅。短い黒い巻き毛、口ひげ。白い麻のシャツ | 470 | 86 |
| dubai-business-1 | dubai | business | f・36 | 東アジア系の会社員。あご丈のボブ。グレーのジャケットに白いブラウス | 546 | 42 |
| dubai-business-2 | dubai | business | m・44 | 南アジア系の会社員。耳にかかる七三の黒髪、口ひげ。薄いグレーのスーツ・ノーネクタイ | 448 | 44 |

民族衣装（グトラ・アガール・カンドゥーラ・シャイラ・アバヤ）は「ふだんの服として敬意をもって描く」と依頼文で指定した。

## VPM31: 年配に見えた人の描き直しと、顔の大きさ

オーナー「シーシャ屋のモブでおばあちゃんいるのは変　20〜30代メインに　いてもたまに40.50」「後モブキャラの拡大率もレアキャラと同じにして」。

- **描き直した6人**（1人1回ずつ・作り直しなし。依頼文・参照の絵・設定は上と同じ。人物の説明に「白髪なし・しわなし」を足した人がいる）

| 人 | 前 | 後 |
|---|---|---|
| tonari-elder-1 | 68歳の男性（中折れ帽・白髪・しわ） | 36歳の男性（中折れ帽・黒髪・無精ひげ） |
| tonari-elder-2 | 67歳の女性（バケットハット・銀髪） | 31歳の女性（バケットハット・黒髪） |
| tonari-walkers-a-2 | 55歳の女性（白髪まじり） | 34歳の女性 |
| tonari-reader-2 | 46歳の男性（ごま塩頭） | 32歳の男性 |
| dubai-local_regular-2 | 63歳の男性（白いひげ・深いしわ） | 29歳の男性（格子のグトラ） |
| dubai-vip-1 | 54歳の男性（白髪） | 38歳の男性 |

- これで66人の年齢: 20代・30代が57人、40代が9人（約14%。どれも30代後半〜40代前半に見える）、50代以上は0人
- 本編の tonari の客の種類「年配の方」（`elder`）は、試作では「常連の方」と呼ぶ（`floor.mjs` の `GUEST_NAME`。規則・来る順は本編のまま）。本編（横）の呼び名と絵（`guest-elder.webp`）は変えていない
- **顔の大きさ**: 66人・132枚を、原画から顔のアップに切り直した（上の「構図」）。笑顔の側のずらしは、前に測った値を使った（構図の割合を変えても、ずらしは変わらない）
- 確かめたこと: 6人の原画を原寸で見て、全員が20〜30代の大人に見えること・画風がほかの客とそろっていること・文字や手が無いこと。切り直した132枚を、顔アイコン11人と同じ丸い窓で並べて、顔の大きさがそろっていること。試作の店番の画面（3店）で、席のカードと下の画面の客の顔
