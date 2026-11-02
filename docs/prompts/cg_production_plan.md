# CG（スチル）制作プラン

恋愛・日常シーンのスチル一覧。**ゲーム側の `show_cg` 組み込みは全箇所済み**なので、
このファイル名で `assets/cgs/` にPNGを置いて再ビルドすれば自動で表示される
（素材が無い間は何も表示されない安全設計）。

## 制作ルール

- ファイル名は下表の `cg_id`.png に**完全一致**させる
- 推奨サイズ: 1280x720（16:9）。ビルド時にJPEG圧縮されるので大きめでもOK
- スタイル統一は既存方針どおり「プロンプトで頑張らず後処理で揃える」。
  ドット絵調にするなら `tools/pixelize.py` を通す、そのままイラスト調でも可
- キャラの同一性: 立ち絵を参照画像にして image-to-image で生成
- 生成後: `python3 remake/tools/build_manifest.py`

## 一覧（優先度順）

| # | cg_id | 章 | 表示シーン（組込済） | 構図・内容 |
|---|---|---|---|---|
| 1 | `cg_minto_casual` | ch1 | outing_minto_1 冒頭 | 私服みんと初見せ。ベージュのケーブルニットのカーディガン＋ロングスカート、駅前で振り返って手を振る。コンカフェ衣装とのギャップが主役 |
| 2 | `cg_tsumugi_smoke_color` | ch1 | ch1_tsumugi_smoke_color | つむぎの見る世界。tonariの席、煙が藍色〜虹色に光って見える共感覚の画。彼女の横顔は静かに微笑む |
| 3 | `cg_oneesan_first_smoke` | ch1 | ch1_tutorial_oneesan | 素のみんと（ura）の一服の横顔。カウンター越し、夜のtonari。**クリア後に意味が変わる一枚**（正体を知って見返す） |
| 4 | `cg_minto_cheki` | ch1 | interaction_minto_noon_01 | チェキ写真そのものの画。白フレーム＋手書き「♡PEPERMINT」落書き。みんと一人を写す（2026-10-08 チェキ修正: 現行PEPPERMINT店内） |
| 5 | `cg_mashiro_double_apple` | ch3 | ch3_double_apple_incident | 制作・接続済み。閉店後のmukaiで、ましろがハンドルを差し出す一人称の近景。顔・吸い口・握る手を会話枠より上へ置く。種明かし前なので缶・味名・果物は写さない。[原画・生成指示・検品](../../asset_sources/ch3-mashiro-handoff/README.md) |
| 6 | `cg_tsumugi_confession` | 告白 | confession_tsumugi_accept | 服の裾をぎゅっと掴む潤み目の上目遣い |
| 7 | `cg_minto_confession` | 告白 | confession_minto_accept | 素の栞の顔で泣き笑い |
| 8 | `cg_ageha_confession` | 告白 | confession_ageha_accept | いつも強気なアゲハが目を逸らして頬を掻く |
| 9 | `cg_mashiro_confession` | 告白 | confession_mashiro_accept | ふにゃっと崩れた満面の笑み（ダウナーが解ける瞬間） |
| 10 | `cg_tsumugi_epilogue` | 結 | epilogue_tsumugi | 夜の公園。絡めた指、肩に頭。吐息が白い |
| 11 | `cg_minto_epilogue` | 結 | epilogue_minto | 仕事終わりの裏口で、私服（ura）の栞が胸に飛び込む。素の照れ笑い。黒髪のストレートロングと緑の瞳を維持し、コンカフェ衣装・ツノや羽のアクセサリーは描かない |
| 12 | `cg_ageha_epilogue` | 結 | epilogue_ageha | ホテル最上階ラウンジ、ドレスで振り返る |
| 13 | `cg_mashiro_epilogue` | 結 | epilogue_mashiro | 膝の上で「充電」。煙がゆっくり天井へ |
| 14 | `cg_shuraba` | 結 | ending_shuraba | ギャグスチル。無言で隣の席をアピールする4人の圧と、固まるはじめ視点 |
| 15 | `cg_ageha_first_purikura` | ch2 | remake_ch2_ageha_gyaru のプリクラ（`motions/purikura.js` の最後に出てくるシール） | #921 で作った4コマのシール（960x1440・ギャル文字と落書き入り）。演出では真ん中で左右に切って見せる。撮影から落書きまでは立ち絵で写す（2026-10-24 オーナー決定・#939）。無い環境では立ち絵の2×2で代用 |
| 16 | `cg_ch2_ageha_purikura_strip` | ch2 | ✅ #947・同上（#15 より優先） | 半分こ用の縦長シール1列分（640x1080・不透明）。同じ絵を2枚並べて中央を切り、文字・装飾を左右端から24px以上内側に収めた。上は寄って笑うあげはと驚くはじめ、下は二人の笑顔。「ハジメっち♡」「答え合わせ係」「あげ↑」を各1回。原画・生成指示・仕上げ手順・PC/横タッチ確認は `asset_sources/purikura-939/`。旧4コマと旧候補は保全 |

## 生成プロンプト案（image-to-image、立ち絵参照前提・英語）

共通サフィックス: `anime style, cinematic lighting, 16:9, high detail, shisha lounge atmosphere`
（一人称視点のため**主人公の顔は描かない**。写る場合は後ろ姿・手元のみ）

1. cg_minto_casual — `young woman with long straight black hair and green eyes in a beige cable-knit cardigan and long skirt, turning around waving at viewer, station square at noon, soft sunlight, gentle mature smile, casual private look`
2. cg_tsumugi_smoke_color — `quiet girl with iPad at a dim lounge table, watching shisha smoke that glows in indigo and faint rainbow colors (synesthesia visualization), profile view, soft neon, wonder in her eyes`
3. cg_oneesan_first_smoke — `elegant woman with long straight black hair in a beige cable-knit cardigan at the tonari shisha cafe counter at night, exhaling shisha smoke slowly, eyes closed, warm low light, viewed from behind the counter`
4. cg_minto_cheki — `instant photo (cheki) with white frame, cute woman doing peace sign in a pastel shisha cafe, handwritten doodles and heart on the frame, slightly blurred flash photo look`
5. cg_mashiro_double_apple — 採用画像と実際の生成指示は `asset_sources/ch3-mashiro-handoff/`。正規ましろの立ち絵・mukaiの内装を参照し、眠たげな普段の表情でハンドルを差し出す。中身を隠した現行台本に合わせ、旧案の赤いダブルアップル包装は描かない。一本のホースはハンドル根元から卓の裏へ自然に隠れ、台・HMD・炭は画角外。頭上の余白と会話枠上の手元を確保する。
6-9 confession — 各立ち絵参照＋`blushing, teary eyes, night street / lounge background, emotional close-up`
10-14 epilogue/shuraba — 上表の構図メモ参照

15. cg_ageha_first_purikura — #921 で生成・採用済み（原画とプロンプトは #921 の `asset_sources/ch2-city-issue921/`）。#939 では新しく生成しない

16. cg_ch2_ageha_purikura_strip（#939）。添付する参照画像: `assets/sprites/characters/ageha/chr_ageha_smile.png`・`chr_ageha_normal.png`・`assets/sprites/characters/hajime/chr_hajime_surprise.png`・`chr_hajime_smile.png`（本人の顔・服）、`assets/cgs/cg_ageha_first_purikura.png`（プリクラの盛り・ギャル文字の雰囲気だけ。4コマの配置と文字は写さない）

```
Create one game CG image. Save as assets/cgs/cg_ch2_ageha_purikura_strip.png, 640x1080 pixels (portrait), opaque, no transparency. Also save the untouched original under asset_sources/purikura-939/.
What it is: ONE vertical half of a Japanese purikura (photo-sticker booth) sheet, the strip one person keeps after the two friends cut the sheet in half. The game shows two copies of this exact image side by side and cuts between them, so this strip must be complete on its own: nothing may be cut off at the left or right edge, and every doodle, sticker and word must sit fully inside the strip with at least 24 px of clear margin from the left and right edges.
Style: same characters as the attached approved sprites (same faces, hair, outfits). Purikura beauty-filter look like the attached cg_ageha_first_purikura.png (bright flash, glossy sparkly eyes, smooth glowing skin, pink-white haze, gal handwriting doodles), but do not copy its 2x2 layout, its frame or any of its words.
Layout, top to bottom: a 40 px pink-and-leopard border band; photo 1 (600x450, 4:3 landscape, centered); a 30 px white gap; photo 2 (600x450, centered); a 110 px footer band of pink polka dots with two small leopard-print hearts and a few sparkles. A thin white frame around each photo. No text in the border or footer.
Photo 1 (the third shot): waist-up two-shot facing the camera. Left: Hajime (black cap with small emblem, short black hair, black zip hoodie over black t-shirt, silver tag necklace), surprised and flustered, eyes wide, mouth slightly open, one hand near his chest. Right: Ageha (honey-blonde twin ponytails with pink and cream bear hair clips, leopard jacket over a pink crop top, black choker, gold heart necklace), leaning in close with a joyful closed-eye smile and a peace sign by her cheek. Doodles on photo 1, exactly these and nothing else: the pink handwritten words 「ハジメっち♡」 in the top-left corner; a big glossy pink heart sticker in the top-right corner; a small gold crown sticker just above Ageha's head; a small pink bear-face sticker between their heads; a gold outlined star drawn on Hajime's chest; a translucent red gummy-bear sticker at the right edge; the orange handwritten words 「答え合わせ係」 in the bottom-left corner with a short curved yellow arrow pointing up at Hajime; the pink handwritten words 「あげ↑」 in the bottom-right corner; three or four small white sparkles.
Photo 2 (the second shot): the same two side by side, both smiling naturally at the camera, Ageha making a small heart with her fingers. Doodles on photo 2: only hearts, sparkles and a white gummy-bear sticker, no words.
Text rules: the only words anywhere in the image are 「ハジメっち♡」「答え合わせ係」「あげ↑」, each written exactly once, in clear, correctly spelled Japanese gal handwriting with a white outline. No shop names, logos, dates, numbers, letters, UI, watermark. No shisha pipe, hose or coals. No other people.
```

## 運用メモ

- CGが10枚を超えたあたりでタイトルGALLERYを実装する（閲覧済みCGの解放管理は `state.flags` に `_cg_seen_*` を足すだけ）
- `cg_oneesan_first_smoke` はギャラリーでの表示名を最初「たまに来るお姉さん」、ch1クリア後に「？」が取れる演出が可能
