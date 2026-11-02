# Codex への依頼: 地図アイコン13枚の生成と組み込み（MPI01・MPI03）

このファイルは Codex がそのまま実行する依頼書。まず `AGENTS.md`（Git・通信量・LFS・PR の決まり）と同じフォルダの [README.md](README.md)（作るもの・画風の基準・組み込み手順）を読む。

## オーナー決定（2026-11-02）

- 画像は **Codex で生成する**（この依頼）。
- **スマホは1枚を共用**（第3章「地元と連絡」`ch3_tokyo_lime`・第5章「博士に連絡する」`ch5_call`）。**新幹線の駅も1枚を共用**（`ch5_to_tokyo` 橙須駅・`ch5_tokyo_home` 東京駅）。
- **路上占いは、建物・壁・庇・店の窓を描かない持ち運びの出店**にする。今の紫×金の月と星、赤い椅子、暖色のランタンは残す。

## 作るもの

README の「作るもの」の表の13枚。プロンプトは各 `*-prompt.txt` を**そのまま**使う（言い換えない）。1回の生成で1枚、正方形 1024x1024、透過背景。

## 参照画像（画風をそろえるために添付する）

既存の地図アイコンから1〜2枚を切り出して添付する。切り出し位置は `remake/js/daily/facility-icons.js` の `FACILITY_ICONS[...].rect`（`extra: true` は `assets/ui/map-facilities-extra-579.webp`、それ以外は `assets/ui/map-facilities-579.webp`）。画像は LFS なので、要る3枚だけ取る:
`git lfs pull --include="assets/ui/map-facilities-579.webp,assets/ui/map-facilities-extra-579.webp,assets/ui/map-rojiura-cinema.webp"`

| 作るアイコン | 添付する既存アイコン |
|---|---|
| 路上占い | 今の路上占い（`fortune`。**配色の参考だけ**。建物・庇・窓は真似しない）＋喫茶こはく（`kohaku`。単品の置き方） |
| mukaiの奥の部屋・屋根裏・宿のロビー | 自宅（`home`）＋ボドゲカフェ（`trpg_bar`） |
| スマホ | 喫茶こはく（`kohaku`） |
| 公園・路地裏の神社・新幹線の駅・スーク・クリーク沿い・風の回廊モスク・旧市街の宿・公式練習会場 | 観音堂（`kannondo`）＋斧投げBar（`axe_bar`） |

## 検品（1枚ずつ。合わなければ作り直す）

- 透過になっていて、縁に背景色が残っていない。
- 人物・動物・文字・数字・ロゴ・実在の商標・**シーシャ機材（台・ホース・ボウル）**が無い。
- 既存8種と並べて浮かない（線の太さ・暖色の灯り・斜め上からの視点・細かさ）。
- 96px に縮めて形が読める。
- 個別: 占いに建物・壁・庇・窓・棚・鉢植え・舗装の台が無い／宿にドームと回廊が無い（モスクと区別）／ロビーは屋内／奥の部屋は平らな壁（屋根裏と区別）／公式練習会場の机は空。

## 保存と組み込み

README の「組み込み手順」1〜6 のとおり。要点:

1. 原画を無加工で `asset_sources/map-icons-1102/<名前>-source.png`（名前はプロンプトのファイル名から `-prompt.txt` を除いたもの）に保存し、`generation.json` にプロンプトのファイル名・使ったツール・サイズ・SHA-256・添付した参照を書く（`asset_sources/cinema-956/generation.json` と同じ形）。
2. 13枚と既存8種を並べた比較画像を `asset_sources/map-icons-1102/qa/new-icons-contact.jpg` に置く（96px に縮めた列も入れる）。
3. ゲーム用の透過 WebP（長辺384px）を README の予定ファイル名で `assets/ui/` に置き、`FACILITY_ICONS`・`SPOT_ICONS` とテスト（`remake/test/facility_icons.mjs`・`remake/test/browser/facility_icons.mjs`・`tools/ci/suites.json` の paths）を更新する。
4. 第3章の東京・第4章のドバイ・第5章の地元と東京の地図を実画面で開き、アイコンが出ること・名札が重ならないことを確かめる。

## PR

- 最新 `origin/main` から branch を作り、Ready for review で出す。**比較画像を PR に貼り、オーナーの採用確認が済むまでマージしない**（不採用の絵は差し替える）。
- 台帳 `docs/owner_requests.md` の MPI01・MPI03 を、採用されたら ✅ にする。

## 追加分（MPI06・2026-11-02）

最初の13枚は採用済み（12枚を組み込み、神社は保留）。後から入ったドバイの行き先3つにも絵が無いので、同じ手順で作る。参照画像は観音堂（`kannondo`）＋斧投げBar（`axe_bar`）、それに今回採用した旧市街の宿 `assets/ui/map-facilities-dubai-inn.webp`（ドバイの画風の基準）。

| アイコン | 地図の行き先 id | プロンプト | ゲーム用の予定ファイル |
|---|---|---|---|
| 砂漠ツアーのデスク | `ch4_dubai_tour_desk` | `desert-tour-desk-prompt.txt` | `assets/ui/map-facilities-desert-tour-desk.webp` |
| 砂丘（サンドボード） | `ch4_dubai_dunes` | `desert-dunes-prompt.txt` | `assets/ui/map-facilities-desert-dunes.webp` |
| ラクダレース場 | `ch4_dubai_camel`（レース場の段階だけ。誘われる前の「Dr.fookah の店先」は会話の場所なので絵を付けない） | `camel-race-track-prompt.txt` | `assets/ui/map-facilities-camel-race-track.webp` |

- 1種につき3案を作って比較画像を貼り、オーナーの採用を待つ（13枚のときと同じ）。
- ラクダレース場だけは、乗り手のいないラクダを1頭だけ描いてよい（ほかの動物・人物は不可）。
