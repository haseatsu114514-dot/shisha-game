# 第3章タイトル画 候補（2026-10-29、選定待ち）

第3章だけ章タイトル画が無く、文字表示のみで表示されている（素材棚卸しで判明）。現行の第3章仕様に合わせて新規候補を5枚制作した。**最終選定はオーナー。本パッケージはゲームへ未接続**（採用時は `remake/img/ui/chapters/ch3-title.webp` への配置と `remake/js/core/chapter-title-art.js` への第3章エントリ追加が別途必要）。

## 既存の章タイトル画の実測（実コード確認）

| 項目 | 内容 |
|---|---|
| 表示箇所 | `remake/js/core/ui.js` の `chapterTitle()`。`chapterTitleArt(no)` で画像があれば画像表示（タイトル文字は画像に含まれるため重ね描きしない）、無ければ文字表示にフォールバック |
| 登録簿 | `remake/js/core/chapter-title-art.js` の `CHAPTER_TITLE_ART`（第1・2・4・5章のみ。第3章は「オーナー指定で保留」とコメントされ未登録） |
| 実ファイル | `remake/img/ui/chapters/chN-title.webp`、いずれも **1280×720** |
| 原画形式 | 制作時の原画は **1672×941**、納品時に Pillow `ImageOps.fit`（LANCZOS・中央）で 1280×720 化（`asset_sources/chapter-title/ch2-5-style-studies-385-20261013/generation.json` の delivery 記録） |
| 画風 | 厚塗りアニメ調キービジュアル。題字は生成カットアウト＋別組版をレイヤー合成。左側にタイポグラフィ（ゲームタイトル小／CHAPTER n／章名の大明朝／英題イタリック）、右側に主題 |
| 旧第3章案 | 旧章題「虚ろな王冠」時代の銀灰色・王冠プレート（同フォルダ `type-polish/plates/ch3-art.png`）が承認済みだが未納品。現行の第3章とは章題自体が異なるため本候補では使っていない |

## 現行の第3章タイトル仕様（正本）

`remake/js/chapters/ch3.js` の `chapterTitle()` 呼び出しより:

- no: 第三章
- name: **嘘つきたちの夜**
- read: **SMOKE AND MIRRORS**
- sub: **HAZE: NATIONAL TOKYO 編**（東京・全国大会編。主要人物は久世朔／スティーブ／ヴォルク、ましろと作戦会議）

## 候補一覧

原画（文字なし）= `originals/`、タイポグラフィ合成済みプレート（1280×720）= `plates/`、比較シート = `comparison.png`。

| # | ファイル（originals / plates） | コンセプト | 原画バイト数 |
|---|---|---|---|
| cand1 | ch3-cand-1.png / ch3-title-cand-1.png | ましろと鏡像。鏡の中の映りだけが笑う（Smoke and Mirrors の直球表現）。窓の外に東京タワーとネオン | 2,382,722 |
| cand2 | ch3-cand-2.png / ch3-title-cand-2.png | 久世朔の大写し（手帳とペン、観察者の余裕）と左下に小さなはじめの背中。全国大会アリーナ | 2,026,451 |
| cand3 | ch3-cand-3.png / ch3-title-cand-3.png | 観客席で手帳を取るヴォルク。遠くの舞台に一人と水タバコ。第2章からの「名乗らない観察者」 | 1,659,472 |
| cand4 | ch3-cand-4.png / ch3-title-cand-4.png | 東京の屋上ではじめとましろの作戦会議。二筋の煙、東京タワー、満月 | 2,078,042 |
| cand5 | ch3-cand-5.png / ch3-title-cand-5.png | 人物なし静物。鏡面テーブルに映る水タバコと空の優勝席、二筋の煙。※他候補より写実寄りの質感 | 2,032,331 |

- 全候補とも原画 1672×941。タイポグラフィは採用プレート（第2章）のレイアウトに倣い別合成（フォントは Noto Serif CJK / Liberation Serif で代用。本採用時は既存工程どおりの組版に差し替え可能）。
- 生成は Codex A の画像生成（参照立ち絵つき）。プロンプトは `prompts/`、生成記録は `generation.json`。
- glint（題字マスク）やモーション用レイヤーは採用決定後に既存工程（`remake/js/motions/chapter-title.js` の座標解析）で作る前提で、本候補には含めていない。
