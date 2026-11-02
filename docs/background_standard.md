# 背景の規格（大きさ・画風・時間帯）

2026-11-02 オーナー「キャラ生成で顔や画像の大きさ、並んだときの違和感がちょくちょく起きる。参考資料をリポジトリで管理して防ぎたい。背景も同様に統一感を出したい」。
立ち絵は [立ち絵の規格](portrait_standard.md) に数値の規格と記録がある。背景には規格も台帳も無く、107枚を測ると画素数が4種類（1280×720が60枚、1672×941が23枚、1920×1080が22枚、ほか2枚）に分かれ、画風の指示も資料ごとに「ドット絵調」と「painterly」で食い違っていた。
そこで**数値の規格と、背景ごとの記録**を作り、比較図とCIの検査をその記録から自動で出すようにした。

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

規格制定前の既存絵（1280×720・1672×941）は、台帳に `accepted` を書いて今のまま使う。**描き直すときに規格へ合わせる**。既存絵を一括で作り直す指示は出ていない。

## 2. 画風の基準画像

採用済みの中から、場面の種類ごとに1枚ずつ基準にする（台帳の `anchors`。比較図では「★基準」と出る）。

| 種類 | 基準 | 見るところ |
|---|---|---|
| 店内・暖色の間接照明 | `bg_eden_shop.png` | 木と布の質感、ランプの光の落ち方、2〜3段の明暗 |
| 店内・昼の外光 | `bg_tonari_inside_day.png` | 窓からの光と室内の色、モザイクランプの不揃いな配置 |
| 屋外・夜 | `bg_street_night.png` | 看板の光と濡れた路面、紺の空に暖色の差し色 |
| 第4章ドバイ・昼の屋外 | `bg_dubai_souq_day.png` | 強い日差しと彩度の高い布・陶器、遠景の密度 |

共通する見た目：やや写実寄りのパースと素材感、はっきりした光源、線画は目立たせず面の塗りで形を作る。暖色の照明が基本で、冷色は夜の空・ネオン・水族館など場面の理由があるときだけ。

生成のプロンプトには、場面の指定のあとに次の英文をそのまま足す。

```
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

参照画像の渡し方：**画風**＝基準画像のうち同じ種類の1枚（店内なら店内の基準）、**同じ場所の既存絵**＝昼夜差分を足すときはその場所の採用済みの絵（構図を変えない）、**機材の見た目**＝siryou の日本の店の写真（§4.3）。早見表・比較図・この表は渡さない。

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

## 5. 2026-11-02 の測定結果

| 項目 | 結果 |
|---|---|
| 画素数 | 1920×1080：22枚、1672×941：23枚、1280×720：60枚、2048×768：1枚（`bg_dj_red_room.png`）、1279×720：1枚（`bg_yuzugaya_c_station.webp`） |
| 画風 | 大半はアニメ調の描き込んだ一枚絵で揃っている。古いドット化の絵が7枚残る：`bg_ageha_shop.png`・`bg_choizap.png`・`bg_home.png`・`bg_kannon_day.png`・`bg_title.png`・`bg_tonari_inside.png`・`eden.png`。このうち `bg_home.png`・`bg_tonari_inside.png`・`eden.png` は昼夜差分や別名への置き換えで本編ではほぼ使われない |
| 明るさ | 平均輝度30未満は `bg_dj_red_room.png`（12）だけ。演出として `accepted` |

古いドット化の絵を描き直すかはオーナーの判断。描き直すときはこの規格で作る。

## 6. 参考写真の置き場（非公開リポジトリ siryou）

内装の実物写真は、機材の写真と同じく非公開リポジトリ `siryou` の `shisha-hardware-reference/web-refs/images/`（日本の店の内装29枚を含む）にある。背景用の内装・街並みの写真を増やすときも siryou に置き、ゲームのリポジトリには採用済みの基準画像と比較図だけを置く（各サイトの著作物の写真を公開リポジトリに入れないため）。
