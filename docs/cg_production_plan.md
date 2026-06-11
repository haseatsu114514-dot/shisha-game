# CG（スチル）制作プラン

恋愛・日常シーンのスチル一覧。**ゲーム側の `show_cg` 組み込みは全箇所済み**なので、
このファイル名で `assets/cgs/` にPNGを置いて再ビルドすれば自動で表示される
（素材が無い間は何も表示されない安全設計）。

## 制作ルール

- ファイル名は下表の `cg_id`.png に**完全一致**させる
- 推奨サイズ: 1280x720（16:9）。ビルド時にJPEG圧縮されるので大きめでもOK
- スタイル統一は既存方針どおり「プロンプトで頑張らず後処理で揃える」。
  ドット絵調にするなら `tools/pixelize.py`（未作成）パス、そのままイラスト調でも可
- キャラの同一性: 立ち絵を参照画像にして image-to-image で生成
- 生成後: `python3 web/build_data.py && python3 web/build_standalone.py`

## 一覧（優先度順）

| # | cg_id | 章 | 表示シーン（組込済） | 構図・内容 |
|---|---|---|---|---|
| 1 | `cg_minto_casual` | ch1 | outing_minto_1 冒頭 | 私服みんと初見せ。フリルブラウス＋ロングスカート、駅前で振り返って手を振る。コンカフェ衣装とのギャップが主役 |
| 2 | `cg_tsumugi_smoke_color` | ch1 | ch1_tsumugi_smoke_color | つむぎの見る世界。tonariの席、煙が藍色〜虹色に光って見える共感覚の画。彼女の横顔は静かに微笑む |
| 3 | `cg_oneesan_first_smoke` | ch1 | ch1_tutorial_oneesan | 素のみんと（ura）の一服の横顔。カウンター越し、夜のtonari。**クリア後に意味が変わる一枚**（正体を知って見返す） |
| 4 | `cg_minto_cheki` | ch1 | interaction_minto_noon_01 | チェキ写真そのものの画。白フレーム＋手書き「♡PEPERMINT」落書き。みんとがピース、はじめは見切れ気味（一人称なので顔は写さないか後頭部） |
| 5 | `cg_mashiro_double_apple` | ch3 | ch3_double_apple_incident | 「はい。──ダブルアップル」。薄暗いmukai、ホースを差し出すましろの手元と、眠たげなのに核心を見抜く目 |
| 6 | `cg_tsumugi_confession` | 告白 | confession_tsumugi_accept | 服の裾をぎゅっと掴む潤み目の上目遣い |
| 7 | `cg_minto_confession` | 告白 | confession_minto_accept | 素の栞の顔で泣き笑い |
| 8 | `cg_ageha_confession` | 告白 | confession_ageha_accept | いつも強気なアゲハが目を逸らして頬を掻く |
| 9 | `cg_mashiro_confession` | 告白 | confession_mashiro_accept | ふにゃっと崩れた満面の笑み（ダウナーが解ける瞬間） |
| 10 | `cg_tsumugi_epilogue` | 結 | epilogue_tsumugi | 夜の公園。絡めた指、肩に頭。吐息が白い |
| 11 | `cg_minto_epilogue` | 結 | epilogue_minto | バックヤードで飛びつき抱きつき |
| 12 | `cg_ageha_epilogue` | 結 | epilogue_ageha | ホテル最上階ラウンジ、ドレスで振り返る |
| 13 | `cg_mashiro_epilogue` | 結 | epilogue_mashiro | 膝の上で「充電」。煙がゆっくり天井へ |
| 14 | `cg_shuraba` | 結 | ending_shuraba | ギャグスチル。無言で隣の席をアピールする4人の圧と、固まるはじめ視点 |

## 生成プロンプト案（image-to-image、立ち絵参照前提・英語）

共通サフィックス: `anime style, cinematic lighting, 16:9, high detail, shisha lounge atmosphere`
（一人称視点のため**主人公の顔は描かない**。写る場合は後ろ姿・手元のみ）

1. cg_minto_casual — `young woman in beige frilled blouse and long skirt, hair down, turning around waving at viewer, station square at noon, soft sunlight, gentle mature smile, casual private look`
2. cg_tsumugi_smoke_color — `quiet girl with iPad at a dim lounge table, watching shisha smoke that glows in indigo and faint rainbow colors (synesthesia visualization), profile view, soft neon, wonder in her eyes`
3. cg_oneesan_first_smoke — `elegant woman in casual clothes at a bar counter at night, exhaling shisha smoke slowly, eyes closed, warm low light, viewed from behind the counter`
4. cg_minto_cheki — `instant photo (cheki) with white frame, cute woman doing peace sign in a pastel shisha cafe, handwritten doodles and heart on the frame, slightly blurred flash photo look`
5. cg_mashiro_double_apple — `sleepy-looking girl offering a shisha hose toward viewer across a dim counter, red double-apple flavor package nearby, half-lidded eyes that see everything, quiet night cafe`
6-9 confession — 各立ち絵参照＋`blushing, teary eyes, night street / lounge background, emotional close-up`
10-14 epilogue/shuraba — 上表の構図メモ参照

## 運用メモ

- CGが10枚を超えたあたりでタイトルGALLERYを実装する（閲覧済みCGの解放管理は `state.flags` に `_cg_seen_*` を足すだけ）
- `cg_oneesan_first_smoke` はギャラリーでの表示名を最初「たまに来るお姉さん」、ch1クリア後に「？」が取れる演出が可能
