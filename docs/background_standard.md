# 背景の規格（大きさ・画風・時間帯）

2026-11-02 オーナー「キャラ生成で顔や画像の大きさ、並んだときの違和感がちょくちょく起きる。参考資料をリポジトリで管理して防ぎたい。背景も同様に統一感を出したい」。
立ち絵は [立ち絵の規格](portrait_standard.md) に数値の規格と記録がある。背景には規格も台帳も無く、107枚を測ると画素数が4種類（1280×720が60枚、1672×941が23枚、1920×1080が22枚、ほか2枚）に分かれ、画風の指示も資料ごとに「ドット絵調」と「painterly」で食い違っていた。
そこで**数値の規格と、背景ごとの記録**を作り、比較図とCIの検査をその記録から自動で出すようにした。

2026-11-12 オーナー「背景に統一感が微妙。どうすれば市販クオリティに近づけるか」「推奨のやり方で」（要望台帳 BGU01〜05）。112枚とゲーム画面を見直し、足りなかった**構図（カメラ・立ち絵の立つ所・会話の帯）と光・描き込み量・質感**の規格を足した（1節の下の表・2節の2つ目の英文）。画風の外れた絵は、採用済みの描き直し（#3282）の組み込みから順に置き換える（4.1節・5.1節）。

- 背景の記録：[data/background_catalog.json](../data/background_catalog.json)（規格の数値と画風の基準画像の一覧もここが正本）
- 道具：`tools/background_catalog.py`（測る・確かめる・表と比較図を出す）
- 比較図：[asset_sources/reference-sheets/backgrounds/](../asset_sources/reference-sheets/backgrounds/)（同じ場所の昼・夜・曇りを1行に並べる。7枚）
- 生成の依頼文の置き場：[tools/bg_prompts.txt](../tools/bg_prompts.txt)（良い依頼文はここへ追記して資産にする）

## 1. そろえるもの

| 項目 | 規格 | 確かめ方 |
|---|---|---|
| 画素数 | **1920×1080 のRGB PNG**（16:9）。生成は 2048×1152 以上で行い、LANCZOS で縮小だけして保存する。拡大しない | `python3 tools/background_catalog.py check` |
| 画風 | 2節の基準画像4枚と同じ作品に見えること。アニメ調の描き込んだ一枚絵で、ドット化（`tools/pixelize.py`）はしない | 比較図で基準画像と並べて見る |
| 時間帯 | ファイル名の末尾で表す：`_day` / `_night` / `_dusk` / `_morning`。曇りは `_overcast_day` / `_overcast_night`。昼夜の切替は `remake/js/core/data.js` の `sceneBg()` が名前から行う | 台帳の `time` / `weather` |
| 明るさ | 夜でも暗さを絵に焼き込まない。影の中もディテールが読めること。平均輝度30未満（ほぼ真っ黒）は警告。夜の暗さはゲーム側（`.night-tint`）が重ねる | 台帳の `luma` |
| 人物・文字 | 人物なし。文字・ロゴ・看板の文字・透かし・UIを描かない（店名のロゴはコードが重ねる） | 生成後の目視 |
| シーシャ機材 | 台・ハガル・HMD・炭・ホースが写るなら [画像生成の必須手順](shisha_reference.md#4-画像生成の必須手順機材の形と構造) に従う。機材と内装は日本のシーシャバーが基準 | 同 §4.4 のチェック |
| 店ごとの個性 | 同じ「木棚・バー照明・観葉植物」の型を全店に繰り返さない。[店ごとの個性と照明](asset_ai_guidance.md#店ごとの個性と照明オーナー指示) | 比較図で全店を並べて見分けがつくか |

### 構図・光・描き込み量（2026-11-12 追加・BGU02）

背景は、上に立ち絵と会話の帯が重なって初めて完成する。絵だけで見て良くても、人物を乗せると浮く・隠れる・うるさい、が起きていたので、乗せた状態から決める。

| 項目 | 規格 | 確かめ方 |
|---|---|---|
| カメラ | **立っている人の目の高さ**（床から約1.5m）で水平に構える。目線の高さの線（地平線）は画面の**上から 30〜45%**。縦の線はまっすぐ立てる（見上げ・見下ろし・魚眼にしない）。広角は控えめ（35mm 判で 28〜35mm 相当） | ゲーム画面で立ち絵と並べる（立ち絵の目は上から約35%） |
| 立ち絵の立つ所 | 画面の中央（**左右 30〜70%・上から 10〜65%**）は静かな面にする。一番明るい灯り・細かい強い模様・顔の絵やポスターを置かない。灯りと飾りは左右と上の端へ寄せる。人物より手前にあるはずの物（手前の机の天板・椅子の背・カップ）を中央の下に描かない。屋外の名所など主題が中央に来る絵は、主題を奥に置き、中央の下を石畳や階段などの静かな面にする | 立ち絵を1人（中央）・2人（30%と70%）出して見る |
| 会話の帯 | 画面の**下 1/3 は会話の帯で隠れる**。見せたい物は上から 65% までに置き、下 1/3 は床・机の天板などの静かな面にする | 同上 |
| 光 | **主な光源は1つ**で、向きが分かること（窓・看板・主照明のどれか）。ほかの灯りは弱い補助にする。光のにじみ（グロー）・レンズフレア・光の筋は絵に描き込まない（ゲームが重ねる） | 原寸の目視 |
| 描き込み量 | 描き込みは奥の壁と左右に寄せ、中央と下は少なくする。床や机を**濡れたように照り返させない**（雨の屋外など理由があるときだけ）。同じ小物を機械的に並べて増やさない | 原寸の目視 |
| 質感 | 筆の跡が残る塗り。ドット・網点・輪郭線・ハッチングを出さない。写真や3DCGに見える質感（写真のようなコンクリートや金属の肌）にしない | 原寸で基準画像と並べる（`reference-sheets` の比較図は縮小なので質感は分からない） |
| 明るさの目安 | 平均輝度 45〜150（台帳の `luma`）。暗い店でも 45 を目安にし、暗さはゲーム側に任せる。人物の明るさは、ゲームが背景の色から自動で合わせる（新版の「場所の光」・BGU01） | `python3 tools/background_catalog.py report` |

**Codex の内蔵生成は 1672×941 までしか出ないことが多い**（#3254・#2810・#3282 の記録）。その場合は拡大せず、原寸のまま保存して使い、台帳の `accepted` に書く（2026-11-11 オーナーが #3282 の10枚をこの大きさで全採用）。1280×720 の絵からは十分な底上げになる。

規格制定前の既存絵（1280×720・1672×941）と、上の表を足す前の絵は、台帳に `accepted` を書いて今のまま使う。**描き直すときに規格へ合わせる**。描き直しは一度に全部ではなく、4.1節の手順で数か所ずつ、5.1節の順に進める（2026-11-12 オーナー「推奨のやり方で」）。

## 2. 画風の基準画像

採用済みの中から、場面の種類ごとに1枚ずつ基準にする（台帳の `anchors`。比較図では「★基準」と出る）。

| 種類 | 基準 | 見るところ |
|---|---|---|
| 店内・暖色の間接照明 | `kemurikusa.png` | 木と布の質感、灯りの落ち方、暗い店でも奥の棚まで形が読める明るさ |
| 店内・昼の外光 | `bg_tonari_inside_day.png` | 窓からの光と室内の色、モザイクランプの不揃いな配置 |
| 屋外・夜 | `bg_street_night.png` | 看板の光と濡れた路面、紺の空に暖色の差し色 |
| 第4章ドバイ・昼の屋外 | `bg_dubai_souq_day.png` | 強い日差しと彩度の高い布・陶器、遠景の密度（1280×720 なので、色と塗りの見本にだけ使い、鮮明さの見本にはしない） |

2026-11-12 に、店内・暖色の基準を `bg_eden_shop.png` から `kemurikusa.png` へ替えた。`bg_eden_shop.png` は 1280×720 で、原寸で見ると網点の質感が残っていて、ほかの基準と塗りが違ったため（基準どうしが揃っていないと、「基準と同じに」と頼んでも揃わない）。EDEN の絵は描き直す（BGU03）。

共通する見た目：やや写実寄りのパースと素材感、はっきりした光源、線画は目立たせず面の塗りで形を作る。暖色の照明が基本で、冷色は夜の空・ネオン・水族館など場面の理由があるときだけ。

生成のプロンプトには、場面の指定のあとに次の英文をそのまま足す。

```
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

構図の規格（1節の下の表）は、次の英文を続けて足す。

```
COMPOSITION STANDARD (the game draws characters and a dialogue band over this picture): camera at the eye level of a standing adult (about 1.5 m), held level so vertical lines stay vertical; horizon line between 30% and 45% from the top; moderate wide angle (28-35 mm equivalent), no fisheye, no bird's-eye view, no low angle. Keep the middle of the picture (30%-70% across, 10%-65% down) calm: no brightest lamp, no busy pattern, no poster or painted face there, and nothing in the lower middle that would stand in front of a person (no foreground table top, chair back or cup). Put lamps and decoration toward the left, right and top edges. The bottom third is covered by the dialogue band: only quiet floor or table surface there. One main light source with a readable direction; other lamps are weak accents. Do not paint glow, bloom, lens flare or light shafts (the game adds light). Concentrate detail on the far wall and the sides; no wet-looking mirror reflections on floors or tables unless it is actually raining outdoors. Visible brushwork everywhere: no pixel art, no dithering, no outlines or hatching, no photographic or 3D-render surfaces.
```

参照画像の渡し方（役割を書いて渡す）：
- **画風**＝基準画像のうち同じ種類の1枚（店内なら店内の基準）。真似るのは塗り・光・質感だけで、部屋の中身は写さない。
- **場所**＝同じ場所の採用済みの絵。昼夜差分を足すとき・描き直すときに渡す。真似るのは間取り・家具・小物・配色で、**画風の外れた絵を渡すときは「塗り・質感は真似しない」と書く**。
- **機材の見た目**＝siryou の日本の店の写真（§4.3）。

早見表・比較図・この表は渡さない。

## 3. 記録と検査

背景を足した・差し替えたときは、台帳を測り直す。記録が古いままだと CI（quick の `tools`）が止まる。

```bash
python3 tools/background_catalog.py sync      # 画像を測って台帳に足す・更新する（git lfs pull --include="assets/backgrounds/*" が先）
python3 tools/background_catalog.py check     # 規格の判定（規格外は WARN。CI は止めない。記録漏れ・古い記録は止める）
python3 tools/background_catalog.py sheet     # 比較図を作り直す（asset_sources/reference-sheets/backgrounds/）
python3 tools/background_catalog.py report    # 全件の表
```

- `sync` は場所・時間帯・天候・画素数・平均輝度・git上の版を自動で書く。手書きの `accepted`・`prompt`・`note` は消えない。
- 新しい背景は `prompt` に依頼文の場所（`tools/bg_prompts.txt` の番号）を書く。
- 規格外のまま使うときは `accepted` に理由と日付を書く（オーナー判断）。

## 4. 新しい背景を作るときの手順

1. 場所の名前と時間帯を決め、ファイル名を `assets/backgrounds/bg_<場所>_<時間帯>.png` の形にする（昼夜差分は `_day` / `_night` のペア）。その店固有の内装・材質・配色・照明の理由を一言決める（§1「店ごとの個性」）。
2. `tools/bg_prompts.txt` の書式で依頼文を書き、2節の英文を足す。機材が写るなら `shisha_reference.md` §4 の「生成前に決める8行」と貼る文も入れる。
3. 2048×1152 以上で生成し、原画を `asset_sources/backgrounds/<場所>-<日付>/` に無加工で保存する（依頼文と参照画像のパスも一緒に）。
4. LANCZOS で 1920×1080 へ縮小して `assets/backgrounds/` に置き、`python3 remake/tools/build_manifest.py` を実行する。
5. `python3 tools/background_catalog.py sync` → `check` → `sheet`。比較図で同じ場所の既存絵・基準画像と並べ、画風と明るさが揃っているか原寸でも見る。
6. ゲームで昼夜を切り替えて表示し、見切れ・tint の二重掛かりが無いか確認する。依頼文は `tools/bg_prompts.txt` に追記する。

### 4.1 既にある場所を描き直すときの手順（2026-11-12・BGU05）

オーナー「画像生成はコーデックス経由なら何してもいいけど効率的でクオリティ保てるもので」。場所の作り（間取り・家具・小物・配色）はオーナーが一度採用したものなので、**作りは引き継ぎ、画風・大きさ・構図だけを規格へ寄せる**。文だけで作り直すより当たりやすく、選び直しも少ない。

1. **場所の参照を1枚決める。** 同じ場所に規格の画風の別の時間帯・天候の絵があれば、それを使う（構図がそのまま使える。例: #3282 の観音堂の昼は、曇りの絵から起こした）。無ければ今の絵を渡し、「間取り・家具・小物・配色だけ引き継ぐ。塗り・質感は真似しない」と書く。
2. **画風の参照は基準画像1枚**（2節）。場所の参照と役割を分けて書く。
3. **昼の原画を先に決め、夜はその原画から作る**（構図を変えない）。曇りの絵は、いま曇りの絵がある場所を描き直すときだけ作る（無い場所はゲームの色調補正に任せる）。
4. **候補は1か所につき2案まで**: a＝場所の参照に忠実（COMPOSITION STANDARD は貼らない）、b＝構図の規格（COMPOSITION STANDARD）を貼り、灯りと家具の位置を動かす。場所の作りを変えたくない絵は a だけでよい。
5. **1回の依頼は、同じ条件の数か所にまとめる**（依頼は Issue、原画は `asset_sources/backgrounds/<依頼名>-<日付>/originals/` に、依頼文・参照・SHA-256 の記録 `GENERATION.md` と一緒に）。Codex は原画だけを届け、縮小・組み込みはしない。
6. **選ぶのはゲーム画面で。** 届いた原画を 1920×1080 に縮め、今の絵と候補を、新版の会話（立ち絵1人・2人）に並べた比較図で見る。絵だけを並べて選ばない。
7. 採用したら、4節の 4〜6 と同じ（`assets/backgrounds/` へ置く → `build_manifest.py` → 台帳 `sync`・`check`・`sheet`）。依頼文は `tools/bg_prompts.txt` へ追記する。

## 5. 2026-11-02 の測定結果

| 項目 | 結果 |
|---|---|
| 画素数 | 1920×1080：22枚、1672×941：23枚、1280×720：60枚、2048×768：1枚（`bg_dj_red_room.png`）、1279×720：1枚（`bg_yuzugaya_c_station.webp`） |
| 画風 | 大半はアニメ調の描き込んだ一枚絵で揃っている。古いドット化の絵が7枚残る：`bg_ageha_shop.png`・`bg_choizap.png`・`bg_home.png`・`bg_kannon_day.png`・`bg_title.png`・`bg_tonari_inside.png`・`eden.png`。このうち `bg_home.png`・`bg_tonari_inside.png`・`eden.png` は昼夜差分や別名への置き換えで本編ではほぼ使われない |
| 明るさ | 平均輝度30未満は `bg_dj_red_room.png`（12）だけ。演出として `accepted` |

古いドット化の絵を描き直すかはオーナーの判断。描き直すときはこの規格で作る。

### 5.1 2026-11-12 の見直しと、置き換える順番（BGU03・BGU04・BGU06）

112枚を原寸とゲーム画面（新版の会話）で見直した。全体の6〜7割は同じ系統（筆の跡のあるアニメ調の塗り）で、外れは次の4組。旧ドット絵以外は目視の分類。

| 組 | 枚数 | 絵 | 状況 |
|---|---|---|---|
| 旧ドット絵 | 7 | 上の表の7枚 | 観音堂の昼・CHOI-ZAP の昼・あげはの店は #3282 で描き直して採用済み（2026-11-12 に組み込み）。`bg_home.png`・`bg_tonari_inside.png`・`eden.png` は昼夜差分や別名で本編に出ない。残りは `bg_title.png` |
| 網点や線が残る（色数は多いので 11-02 の測り方では拾えなかった） | 3 | `bg_eden_shop.png`・`bg_hideaway.png`・`bg_ryuji_shop.png` | 3枚とも描き直して採用済み（竜二の店・隠れ家は #3282、EDEN は #3446）。EDEN は 2026-11-13 に描き直して採用済み（Issue #3446 のa案。1672×941。原画は `asset_sources/backgrounds/eden-shop-20261112/`） |
| 写真・3DCG 寄り | 10前後 | `bg_volk_shop.png`・`bg_yohaku_shop.png`・`bg_yuzugaya_kumicho.webp`・`bg_ch2_*_entry.webp`・`bg_shop.png` など | mukai・煙幕・鉄の煙・Smoke & Glory は #3282 で昼の版を採用済み（夜は今の絵のまま）。ほかは未依頼 |
| TRPG の部屋（描き込みが飛び抜けて多い） | 13 | `trpg_*_room.png` | 別世界の演出なのでそのまま（ミニゲームは固有の見た目でよい・LK18） |

順番:

1. **採用済みの絵を組み込む**（生成は要らない）。#3282 の10枚: 観音堂の昼・CHOI-ZAP の昼・神崎煙草店・MELTY PUFF（2026-11-12 に組み込み）→ mukai・煙幕・鉄の煙・Smoke & Glory の昼（今の絵を夜の版へ改名）。続けて #3285 の専用背景13枚。隠れ家と大会会場は 2026-11-13 に組み込んだ（台を描いていない絵なので、台の絵 `assets/ui/scene_props/shisha_hideaway.png`・`shisha_c_station.png` を `remake/js/core/scene-art.js` の `SCENE_PROPS` で重ねる。座標は新しい絵の卓・作業台の天板に合わせてある）。
2. ~~EDEN を描き直す~~ → 2026-11-13 に完了（a案。b案は中央の壁が広く空きすぎて EDEN らしさが薄れるため採らなかった）。
3. 1280×720 のまま出番の多い所の底上げ（第2章の店の入口4枚・柚ヶ谷8枚・クラブSEAM・ドバイ16枚。それぞれの中では画風がそろっているので後）。
4. 写真・3DCG 寄りの夜の絵と `bg_title.png`。

`bg_tonari_inside_*`・`bg_street_*`・`kemurikusa.png` などは今のままで目標の質なので、描き直さず画風の見本として固定する。

## 6. 参考写真の置き場（非公開リポジトリ siryou）

内装の実物写真は、機材の写真と同じく非公開リポジトリ `siryou` の `shisha-hardware-reference/web-refs/images/`（日本の店の内装29枚を含む）にある。背景用の内装・街並みの写真を増やすときも siryou に置き、ゲームのリポジトリには採用済みの基準画像と比較図だけを置く（各サイトの著作物の写真を公開リポジトリに入れないため）。
