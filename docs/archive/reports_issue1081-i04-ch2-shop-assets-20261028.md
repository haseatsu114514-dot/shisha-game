# #1081 I04「第2章の店舗カットイン・ロゴ・アイコン」棚卸し報告書

作成日: 2026-10-28  
対象ブランチ: `agy/1081-i04-ch2-shop-assets-20261028`  
対象Issue: #1081 I04（第2章の店舗カットイン・ロゴ・アイコンの棚卸しと真の不足分の抽出）

---

## 1. 概要とサマリー

第2章（柚ヶ谷 / HAZE: OPEN CLOUD編）に登場する全8店舗・スポットについて、ゲーム内実装コード（`remake/js/`）、台本・定義データ（`data/`）、画像素材（`assets/`、`remake/img/`、`asset_sources/`）を網羅的に照合・棚卸しを実施した。

### 区分定義
- **採用済み**: コードから明示的に参照され、参照先ファイルが実在して正常に表示される。
- **候補のみ**: ファイルは実在するが、現行コードからは直接参照されていない（旧版・別候補など）。
- **未接続**: コードやマニフェストから参照があるが、ファイルが存在しない／パスや拡張子の違いで読込に失敗する。またはファイルが存在するがマニフェスト未登録でAPI経由で取得できない。
- **不足**: コード・素材のどちらにも存在せず、機能・演出上欠落している。

### 集計結果
- **店舗ロゴ**: **8店舗中 8店舗すべて採用済み**（実在ファイルあり、正常表示）。
  - `MELTY PUFF`, `神崎煙草店`, `零-ZERO-`, `都市型水族館`, `銭湯・サウナ`, `ボドゲカフェ/TRPG BAR` は単独WebP（768×512）。
  - `C.STATION 柚ヶ谷店`, `Dr.fookah 柚ヶ谷店` は既存PNGスプライトシートから切り出し採用。
- **アイコン（顔アイコン・施設アイコン）**:
  - 顔アイコン: あげは・神崎は**採用済み**。REIは**ファイル実在だがmanifest未登録のため未接続**。六角サイは**不足**（ファイルなし）。
  - 施設アイコン: `trpg_bar` は**採用済み**（`map-facilities-extra-579.webp` に切り出し定義あり）。水族館・銭湯は**不足**（未定義、マップではロゴまたはglyph一文字を表示）。
- **カットイン画像**:
  - キャラクター初登場カットイン背景: あげは・神崎・REI・六角サイの4名とも**採用済み**（`ui/character_intros/*.png` 実在、manifest登録済み）。
  - 店舗カード/入店演出カットイン: 全店**採用済み**（`storeLogo` による演出）。
  - 店舗内装・外観背景: 全店**採用済み**（1920×1080の高解像度アートが実在）。店舗専用の独立した外観カットイン画像は現行設計上**不要（ロゴ＋内装背景＋人物カットインで演出完結）**。

---

## 2. 第2章 店舗別素材状況一覧

| 店舗名 (ID) | 分類 | カットイン画像 | ロゴ | アイコン | 備考・根拠 |
|---|---|---|---|---|---|
| **MELTY PUFF**<br>(`ageha` / `ch2_ageha`) | ライバル店<br>(店主: あげは) | **採用済み**<br>・人物: `ui/character_intros/ageha.png`<br>・カード: `storeLogo('ch2_ageha')`<br>・内装: `bg_ch2_ageha_entry.webp` | **採用済み**<br>`assets/ui/store_logos/melty-puff.webp` | **採用済み**<br>・顔: `face_ageha.png`<br>・施設: 該当なし (glyph: 煙) | ・`store-logos.js:12`<br>・`ch2-city-data.js:11, 19`<br>・`manifest.json:407, 1208` |
| **神崎煙草店**<br>(`kumicho` / `ch2_kumicho`) | ライバル店<br>(店主: 神崎竜二) | **採用済み**<br>・人物: `ui/character_intros/kumicho.png`<br>・カード: `storeLogo('ch2_kumicho')`<br>・内装: `bg_ch2_kumicho_entry.webp` | **採用済み**<br>`assets/ui/store_logos/kanzaki.webp` | **採用済み**<br>・顔: `face_kumicho.png`<br>・施設: 該当なし (glyph: 煙) | ・`store-logos.js:13`<br>・`ch2-city-data.js:12, 19`<br>・`manifest.json:422, 1314` |
| **零-ZERO-**<br>(`rei` / `ch2_rei`) | ライバル店<br>(店主: 零-REI-) | **採用済み**<br>・人物: `ui/character_intros/rei.png`<br>・カード: `storeLogo('ch2_rei')`<br>・内装: `bg_ch2_rei_entry.webp` | **採用済み**<br>`assets/ui/store_logos/zero.webp` | **未接続** (顔)<br>・実体 `face_rei.png` あり<br>・`manifest.faceIcons` 未登録<br>・施設: 該当なし (glyph: 煙) | ・`store-logos.js:14`<br>・`ch2-city-data.js:13, 19`<br>・`manifest.json:1347`<br>・`faceIconUrl` で読込失敗 |
| **C.STATION 柚ヶ谷店 / 県大会ホール**<br>(`c_station` / `ch2_c_station`) | 大会会場 / チェーン店<br>(会長: 南雲修二) | **採用済み** (内装・演出)<br>・内装(昼): `bg_yuzugaya_c_station.webp`<br>・内装(夜): `bg_yuzugaya_c_station_night.webp`<br>・南雲カットイン: `nagumo.png` | **採用済み**<br>`assets/ui/store_logos/c-station.png`<br>(シート切り出し) | **不足** (施設)<br>・施設アイコン未定義<br>・マップはロゴまたは glyph: "C" / "会" | ・`store-logos.js:10, 18`<br>・`ch2-outings.js:21-25`<br>・`city-locations.js:15-16` |
| **Dr.fookah 柚ヶ谷店**<br>(`ch2_shop`) | ショップ<br>(卸直営店支店) | **採用済み** (内装・演出)<br>・内装: `bg_yuzugaya_shop.webp`<br>・直接 `openShop` が開く | **採用済み**<br>`assets/ui/store_logos/dr-fookah.png`<br>(シート切り出し) | **不足** (施設)<br>・施設アイコン未定義<br>・マップはロゴまたは glyph: "卸" | ・`store-logos.js:9, 17`<br>・`ch2-outings.js:18-20`<br>・`city-locations.js:15-16` |
| **ボドゲカフェ / TRPG BAR**<br>(`trpg_bar`) | お出かけ / TRPG<br>(店長: 六角サイ) | **採用済み**<br>・人物: `ui/character_intros/sai.png`<br>・内装: `bg_yuzugaya_trpg.webp` | **採用済み**<br>`assets/ui/store_logos/trpg-bar.webp` | **採用済み** (施設)<br>`map-facilities-extra-579.webp`<br>**不足** (顔)<br>`face_sai.png` 未制作 | ・`store-logos.js:21`<br>・`facility-icons.js:16`<br>・`ch2-outings.js:6-8`<br>・`manifest.json:1465` |
| **都市型水族館**<br>(`ch2_aquarium`) | お出かけスポット<br>(紹介: あげは) | **採用済み** (内装・演出)<br>・内装: `bg_yuzugaya_aquarium.webp` | **採用済み**<br>`assets/ui/store_logos/ch2-aquarium.webp` | **不足** (施設)<br>・施設アイコン未定義<br>・マップはロゴまたは glyph: "魚" | ・`store-logos.js:19`<br>・`ch2-outings.js:9-12`<br>・`city-locations.js:15-16` |
| **銭湯・サウナ**<br>(`ch2_sento`) | お出かけスポット<br>(紹介: 神崎) | **採用済み** (内装・演出)<br>・内装: `bg_yuzugaya_sento.webp` | **採用済み**<br>`assets/ui/store_logos/ch2-sento.webp` | **不足** (施設)<br>・施設アイコン未定義<br>・マップはロゴまたは glyph: "湯" | ・`store-logos.js:20`<br>・`ch2-outings.js:13-16`<br>・`city-locations.js:15-16` |

---

## 3. 拡張子違い・パス揺れ・読込失敗リスクの分析

### (1) `face_rei.png` のマニフェスト未登録（重要バグ要因）
- **現象**:
  `assets/ui/face_icons/face_rei.png` の画像ファイル自体はリポジトリ内に実在する（確認済み）。
  しかし、`remake/data/manifest.json` の `faceIcons` リスト（行405〜423）に `"face_rei.png"` が含まれていない。
- **影響**:
  `remake/js/core/data.js` 行298〜304 の `faceIconUrl(id)` は `DB.manifest.faceIcons.includes("face_" + folder + ".png")` で判定しているため、`face_rei.png` が存在しても `null` を返し、人影アイコン（？マーク）として描画される。
- **対策**:
  マニフェスト更新スクリプト `python3 remake/tools/build_manifest.py` の実行、または `manifest.json` の `faceIcons` 配列へ `"face_rei.png"` を追加することで即時解消可能。

### (2) 内装背景 `.webp` とマニフェスト / `sceneBg()` の互換性制約
- **現象**:
  - `bg_ch2_ageha_entry.webp`
  - `bg_ch2_kumicho_entry.webp`
  - `bg_ch2_rei_entry.webp`
  これら3ファイルは `remake/data/manifest.json` の `backgrounds` 配列に未登録（`build_manifest.py` のデフォルト探索が `pattern="*.png"` のため）。
- **影響**:
  `remake/js/core/data.js` の `sceneBg()` や `bgUrl()` を経由して指定するとマニフェスト未登録により `null` と判定され読込失敗する。
- **現行の回避策**:
  `remake/js/chapters/ch2-city-data.js` 行19 にて `ROOMS` オブジェクトとして相対URL（`../assets/backgrounds/bg_ch2_${id}_entry.webp`）を直接指定し、`imageReady` や `setBg` に直接渡すことで回避している。また `ch2-story-data.js` 行7 にも「`.webp` の店内画は `metadata.bg` で指定できないため `room` プロパティを使う」旨が明記されている。

### (3) 神崎煙草店の内装背景の二重存在と選定履歴
- **ファイル**:
  - `assets/backgrounds/bg_ch2_kumicho_entry.webp`: 採用済み内装（シーシャ台設置前、初期応接室）
  - `assets/backgrounds/bg_yuzugaya_kumicho.webp`: 街の店舗画像（テーブル上にシーシャ設置済み）
- **経緯**:
  Issue #962 で一時的に `bg_yuzugaya_kumicho.webp` へ差し替えられたが、LFSポインタ問題や演出意図から #1081 A02 / #1044 A04 にて「内装としては採用しない。`bg_ch2_kumicho_entry.webp` を使う」と整理されている。`ch2-city-data.js:16-18` および `city-locations.js:13-14` に注記あり。

### (4) 店舗ロゴの拡張子混在（`.png` と `.webp`）
- **現象**:
  第1章店舗（tonari, KEMURIKUSA, EDEN, PEPPERMINT, Dr.fookah, C.STATION, チョイザップ）は `.png`、第2章新規店舗・スポット（MELTY PUFF, 神崎煙草店, 零-ZERO-, 水族館, 銭湯, ボドゲカフェ）は `.webp` となっている。
- **影響**:
  `remake/js/core/store-logos.js` 行25〜26 の `storeLogoUrl` で `STORE_LOGOS[id].ext || "png"` により分岐しているため、ランタイム上の読込失敗は発生していない。ただし将来の拡張で `ext: "webp"` の指定を忘れるとデフォルトの `.png` が読まれ 404 になるリスクがある。

---

## 4. 真に不足するものと制作候補一覧

棚卸しの結果、「店舗ロゴ」や「店舗内装背景」、「主要店主の登場カットイン背景」は既に高品質な素材が制作・採用されており、**店舗ロゴや店舗カットインの新規制作は不要**であることが判明した。

真に不足・未整備であるのは以下の項目である：

### 【必須・軽微】即時解消可能な項目
1. **REIの顔アイコンの manifest 登録**
   - **状態**: 素材は実在（`assets/ui/face_icons/face_rei.png` 128×128）。
   - **作業**: `remake/data/manifest.json` の `faceIcons` リストに追加するだけ（画像制作不要）。

### 【真に不足】新規画像制作の候補
2. **六角サイの顔アイコン（`face_sai.png`）**
   - **必要性**: ボドゲカフェ店長・六角サイの顔アイコンが未制作。会話時やマップ上の表示で人影アイコン（？マーク）になっている。
   - **推奨サイズ**: 128×128 px（PNG、透過背景、円形や正方形の中央に配置）。
   - **置き場所**: `assets/ui/face_icons/face_sai.png`
   - **参照すべき既存素材**:
     - 立ち絵: `assets/sprites/characters/sai/chr_sai_normal.png`（この立ち絵から `tools/make_face_icons.py` で顔部分を切り出し生成可能）
     - 設定: `data/characters.json:1063-1065`（黒髪横分け、糸目、柔らかな笑顔）

3. **第2章お出かけスポットのマップ施設アイコン（水族館・銭湯）**
   - **必要性**:
     - `都市型水族館` (`ch2_aquarium`): 現状は一文字 `glyph: "魚"` または店舗ロゴで代用。
     - `銭湯・サウナ` (`ch2_sento`): 現状は一文字 `glyph: "湯"` または店舗ロゴで代用。
     - ※`trpg_bar` は既に `assets/ui/map-facilities-extra-579.webp` に切り抜き定義あり。
   - **推奨仕様**:
     - 単独アイコンとして追加する場合: 512×512 px WebP/PNG（先行事例: 路地裏シネマの `assets/ui/map-rojiura-cinema.webp` 512×512）。
     - 推奨置き場所: `assets/ui/map-ch2-aquarium.webp`, `assets/ui/map-ch2-sento.webp`
     - 参照すべき既存素材:
       - `assets/ui/store_logos/ch2-aquarium.webp`（マンタと波・街並みモチーフ）
       - `assets/ui/store_logos/ch2-sento.webp`（富士山と湯気・瓦モチーフ）
       - `remake/js/daily/facility-icons.js`（`CINEMA_ICON` と同様の単独画像読み込みロジックを接続可能）

### 【制作不要】現行仕様で充足している項目
- **店舗登場カットイン画像**:
  第2章の初日配達・見学イベントでは、`renderStop`（`ch2.js:247`）により `storeLogo`（768×512の高解像度ロゴ）を中央に配したスタイリッシュな店舗カードUIが表示され、移動時は `withStoreArrival`（`store-arrival.js:13`）でロゴ入店演出が行われる。さらに店主との初対面時は `ui/character_intros/*.png` による全画面イラストカットインが発動する。
  したがって、店舗外観専用の独立カットイン画像を新規作成する必要はなく、現行の演出構成で完全に仕様を満たしている。

---

## 5. 司令塔への実行依頼テストコマンド

本セッションはターミナル/シェルコマンド禁止のヘッドレス環境で実施されたため、各種検証コマンドは実行していません。
司令塔にて以下のテストの実行をお願いします。

- `TEST:` 未実施（コマンド不可）
- 司令塔実行推奨テスト:
  1. `node remake/test/ch2_city_smoke.mjs`（第2章の街歩き・スポット接続確認）
  2. `node remake/test/browser/ch2_day1_flow.mjs` または `bash tools/ci/browser-sem.sh --suites ch2_city`（第2章初日〜配達・店舗カード表示のブラウザ回帰）
  3. `python3 remake/tools/build_manifest.py`（`face_rei.png` のマニフェスト反映検証）
