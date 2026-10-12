# セットB：第1章の店舗・施設

Issue #360。main `eca6a3d12ec4bb8918ef8eb773f08bf816da16b5`から、セットAを含まない独立ブランチ `codex/issue-360-set-b-facilities`。
worker `codex-visual360-20261012-ac3264e05686`、claim `38258863589`、着手前status `38262476985` SUCCESS。

## 棚卸しと制作

現行 `SPOTS`・訪問・ショップ・第1章台本の到達先と画像の実物を照合。全背景の判定は `facility-inventory.json`。

| 対象 | 採用 | 個性・理由 |
| --- | --- | --- |
| C.STATION | 晴れ/曇天×昼夜4枚、ロビーは従来通り昼原画共用 | 大衆向けチェーン店のティール客席・石床・通常照明。巨大植物壁と植栽の反復を外し、窓・家具の位置を保持 |
| Dr.fookah 2階 | 1枚 | 在庫倉庫的な旧画像を、ネイビー金属枠・ガラス展示・相談席のショールームへ |
| Dr.fookah 1階 | 1枚 | ラウンジ的な旧画像を、卸の商品棚・封入袋・規則的な密閉容器・陳列カウンターへ |
| KEMURIKUSA | 1枚 | なるのオリーブ色の客席・実用作業照明・整列保管。蔦と花柄を外す |
| PEPPERMINT | 1枚 | みんとのミント/桃色・ハート意匠・異なる形の照明。植物を共通の飾りにしない |
| 大会ステージ | 1枚 | 4人の制作台・審査席・階段を保持し、紫/青/琥珀の光と材質を精細化 |
| EDEN・カフェ昼夜・観音堂・ジム | 維持 | 固有の内装/屋外構図と画風が成立。カフェの植栽は庭の屋外席に理由があり、全店の飾りへ反復しない |
| 自宅/となり・大須マップ・SHISHARK・タイトル等 | 維持 | PR #369、最近採用した高品質素材、セットAの対象。旧名・予備・第1章未使用も保持 |

画像生成機能 `image_gen.imagegen`を19回使用し、採用した固有原画は9枚、ロビー共用込み10画像IDを接続。卸店初版の緑の葉は不採用とし、実物の湿った褐色葉を添付して修正した。原生成1672×941は `generated/`、全指示は `prompts.json`・`weather-prompts.json`、旧PNG/WebPは `previous/`。再描画後に1920×1080へ正規化しており、ネイティブFHDとは区別する。

## オーナーの縮尺修正

2026-10-12の追加2写真を実生成機能へ直接添付。卸店・KEMURIKUSA・PEPPERMINTのタッパーを小さく浅くし、ショールーム・2店舗・大会の裸の先端を短い金属接続部＋小さい黒いゴムへ修正した。大会で皿まで消えた案や先端の大きさが残った案は不採用。5枚を修正し、既存のID・家具配置・高品質完成素材を保護。`generated/rejected-owner-scale/`に修正前と不採用案、`owner-scale-corrections.json`に全指示と実際の写真添付方法を保存。永続ルールは共通機材資料のREADMEへ追加し、設定整理中の#425が対象とするbrand/docs本文は編集しない。

## 機材と接続

実物参考・早見表・構造/HMD/ホース/容器の制作規則を確認。展示台は短い金属接続部と小さな黒いゴムの準備状態で、ボウル・HMD・炭・ホース・ハンドル・煙なし。使用中CGの完成状態とは区別する。実製品写真は構造・比率だけ参照し、ブランドや独自柄をコピーせず、写真自体を再配布しない。出典とSHA256は `external-references.json`。

既存8 IDを維持し、曇天2 IDだけ背景限定ビルドで追加。C.STATIONの曇り/雨は曇天画を使い、雨だけ既存窓マスク内へ描く。窓のない店は従来通り固定内装・夜補正なし。ロビーは大会到着/大会中の場面で従来の昼原画を共用する。台詞・天気抽選・セーブスキーマ・到達条件を変更しない。

配信WebPはq62/method6。旧8ファイル合計1,656,804→曇天込み新10ファイル1,415,638 bytes（14.6%減）。追加の一括先読みなし。PNG/WebPの全寸法・SHA256・容量は `encoding.json`。`encode.py` は採用原稿から同じ配信用PNG/WebPを再現する。manifestは `generated`・`backgrounds`・`webp` 以外が一致。

BG01/HF08の未受領透過台は、実PNGとmanifest登録が空であることを確認。存在しない台を参照せず、完成扱いにしない。

## 動作確認

- PC1920×1080/スマホ横844×390で10背景ID、窓内雨の昼夜も含め24/24 PASS。実ゲームの会話エンジン・正規立ち絵・台詞から抜いた表示fixtureを使用。FHDデコード、UIの収まり、画像/ブラウザエラーなし、永続セーブ不変を検査。自然なイベント入口の完走とは分ける。
- 大会回帰8/8 PASS。画像の遅延/失敗フォールバック、実VNのSKIPから大会へ、炭配置・2回調整、在庫/準備/セーブ、PC/横/縦の結果表示を確認。
- データローダ35 JSON、JS/Python構文、差分空白、Git Safety PASS。画像更新で台本やセーブコードを編集していない。
- C.STATIONの雨の日に晴れ空が残ることを目視で見つけ、曇天昼夜を実生成して追加後、表示24項目を再実行して全PASS。最新の雨画面は台詞表示も待って撮影。

`validation.json`と `review/` に結果と実画面。独立の `Chapter 1 facility art` CIで表示24項目を継続検証する。既存の別workerが変更している共通CIや `ch1.js`・`phone.js`・`spots.js`・日常CSSには触れない。

```sh
python3 asset_sources/ch1-visual-quality-issue360/set-b-facilities/encode.py
python3 remake/tools/build_manifest.py --backgrounds-only bg_c_station_overcast_day.png bg_c_station_overcast_night.png
NODE_PATH="$PWD/remake/test/browser/node_modules" BASE_URL=http://127.0.0.1:8360/remake/ ARTIFACT_DIR=asset_sources/ch1-visual-quality-issue360/set-b-facilities/review node remake/test/ch1_facility_art.mjs
```

## 残作業

セットCの古い横長CG・第1章で現行参照される仮/未登録CGを、本人性とイベント内容・器具構造を確認して別PRで制作する。現行タイトル/章タイトル/紹介絵/チェキは維持。セットA/Bはレビュー待ちで、mainへマージしていない。
