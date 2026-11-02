# 地図アイコンの追加と路上占いの作り直し（2026-11-02 MPI）

状態: **プロンプトだけ用意。画像は未生成**。2026-11-02 にこの環境の OpenAI 画像API（`images/edits`）で生成しようとしたが、組織の残高切れ（429 `insufficient_quota` / `credit_balance_exhausted`）で1枚も作れなかった。

**オーナー決定（2026-11-02）**: 画像は Codex で生成する（依頼書 [codex-request.md](codex-request.md)）。スマホ（地元と連絡／博士に連絡する）と新幹線の駅（橙須駅／東京駅）はそれぞれ1枚を共用してよい。路上占いは建物を描かない持ち運びの出店で、今の配色（紫×金の月と星・赤い椅子・暖色のランタン）を残す。

**採用（2026-11-02 オーナー「おすすめで」）**: Codex の候補39枚（13種×3案、受け渡しは #2331 のコメント）から12枚を採用し、地図に組み込んだ。原画は `<名前>-source.png`（無加工）、採用案のプロンプトは `<名前>-adopted-prompt.txt`、来歴は `generation.json`。候補一覧は [qa/candidates-japan.jpg](qa/candidates-japan.jpg)・[qa/candidates-dubai.jpg](qa/candidates-dubai.jpg)、組み込み後の地図は [qa/adopted-map-tokyo.jpg](qa/adopted-map-tokyo.jpg)・[qa/adopted-map-dubai.jpg](qa/adopted-map-dubai.jpg)。

| アイコン | 採用案 |
|---|---|
| 路上占い | A |
| 東京の公園 | B |
| mukaiの奥の部屋 | A |
| 屋根裏 | A |
| スマホ（共用） | B |
| 新幹線の駅（共用） | C |
| スーク | A（v1） |
| クリーク沿い | B（v2） |
| 風の回廊モスク | A（v1） |
| 旧市街の宿 | A（v1） |
| 宿のロビー | A（v1） |
| 公式練習会場 | B（v2） |

- **路地裏の神社は保留**: #2166 の内省スポットの場所（池の弁天堂／高架下の稲荷／給水塔の屋上）が決まるまで、3案とも採用しない。
- ゲーム用は外周の極薄の alpha（1〜7）を消し、主体を長辺380pxに縮めて四辺に2pxの透明な余白を足した透過 WebP（長辺384px）。
- **追加の3枚（MPI06）**: 後から入ったドバイの行き先「砂漠ツアーのデスク」「砂丘（サンドボード）」「ラクダレース場」にも絵が無い。プロンプトは `desert-tour-desk-prompt.txt`・`desert-dunes-prompt.txt`・`camel-race-track-prompt.txt`（依頼書の「追加分」）。

オーナー依頼（2026-11-02）: 「シーシャ屋以外のスポットは今アイコンで作ってるけどあれ足りないのも生成したい　既存のテイストを守りつつ　あと占いのアイコンなんかイメージと違うから何処に現れても違和感ないものにしたい」。台帳 `docs/owner_requests.md` の MPI01〜04。

同じPRで、章ごとに id を分けたせいで絵が出ていなかった東京・ドバイの店（mukai・煙幕・Smoke & Glory・鉄の煙・クラブSEAM・Dr.fookah 東京店／ドバイ店・FESTA・東京のCHOI-ZAP）は既存のロゴ・アイコンへ対応づけた。実画面の前後比較は [qa/logo-aliases-before-after.jpg](qa/logo-aliases-before-after.jpg)（上から第3章の東京の夜・第5章の東京・第4章のドバイ。左が main、右が対応づけ後）。

## 画風の基準（参照画像に渡す）

- `assets/ui/map-facilities-579.webp`（観音堂・自宅・喫茶こはく）
- `assets/ui/map-facilities-extra-579.webp`（斧投げBar・CHOI-ZAP・路上占い・ボドゲカフェ）
- `assets/ui/map-rojiura-cinema.webp`（路地裏シネマ）

斜め上から見た小さな箱庭か単品の静物。手描き＋ドット感のある縁、暖色の灯り、透過背景、小さな床・台座。人物・文字・ロゴなし。シートから1枚ずつ切り出して、1〜2枚を `images/edits` の参照画像に渡す（屋内は自宅・ボドゲカフェ、屋外は観音堂・斧投げBar、静物は喫茶こはくが近い）。**シーシャ機材は描かない**（描くと `docs/shisha_reference.md` §4 の構造確認が要る）。

## 作るもの

| アイコン | 地図の行き先 id | プロンプト | ゲーム用の予定ファイル |
|---|---|---|---|
| 路上占い（作り直し） | `fortune` | [fortune-stall-prompt.txt](fortune-stall-prompt.txt) | `assets/ui/map-facilities-fortune-stall.webp` |
| 東京の公園（池） | `ch3_tokyo_park`・`ch5_tokyo_park` | [tokyo-park-prompt.txt](tokyo-park-prompt.txt) | `assets/ui/map-facilities-tokyo-park.webp` |
| 路地裏の神社 | `ch3_tokyo_shrine` | [back-alley-shrine-prompt.txt](back-alley-shrine-prompt.txt) | `assets/ui/map-facilities-back-alley-shrine.webp` |
| mukaiの奥の部屋 | `ch3_tokyo_room` | [mukai-back-room-prompt.txt](mukai-back-room-prompt.txt) | `assets/ui/map-facilities-mukai-back-room.webp` |
| 屋根裏（第5章） | `ch5_tokyo_attic` | [mukai-attic-prompt.txt](mukai-attic-prompt.txt) | `assets/ui/map-facilities-mukai-attic.webp` |
| スマホ（共用） | `ch3_tokyo_lime`・`ch5_call` | [smartphone-prompt.txt](smartphone-prompt.txt) | `assets/ui/map-facilities-smartphone.webp` |
| 新幹線の駅（共用） | `ch5_to_tokyo`・`ch5_tokyo_home` | [shinkansen-station-prompt.txt](shinkansen-station-prompt.txt) | `assets/ui/map-facilities-shinkansen-station.webp` |
| ドバイのスーク | `ch4_dubai_souq` | [dubai-souq-prompt.txt](dubai-souq-prompt.txt) | `assets/ui/map-facilities-dubai-souq.webp` |
| クリーク沿い | `ch4_dubai_creek` | [dubai-creek-prompt.txt](dubai-creek-prompt.txt) | `assets/ui/map-facilities-dubai-creek.webp` |
| 風の回廊モスク | `ch4_dubai_mosque` | [dubai-mosque-prompt.txt](dubai-mosque-prompt.txt) | `assets/ui/map-facilities-dubai-mosque.webp` |
| 旧市街の宿 | `ch4_dubai_inn` | [dubai-inn-prompt.txt](dubai-inn-prompt.txt) | `assets/ui/map-facilities-dubai-inn.webp` |
| 宿のロビー（なると会う） | `ch4_dubai_naru` | [dubai-inn-lobby-prompt.txt](dubai-inn-lobby-prompt.txt) | `assets/ui/map-facilities-dubai-inn-lobby.webp` |
| 公式練習会場 | `ch4_dubai_practice` | [dubai-practice-hall-prompt.txt](dubai-practice-hall-prompt.txt) | `assets/ui/map-facilities-dubai-practice-hall.webp` |

- 占い: 占い師は章で1〜2回、街のどこか（地元・東京）に現れる（`remake/js/daily/fortune-schedule.js`）。今の絵は壁・庇・店の窓のある「アーケード脇の店」なので、建物を描かない持ち運びの出店にする。紫×金の月と星、赤い椅子、暖色のランタンは残す。参照には今の占いの絵を配色の参考にだけ渡す。
- 屋根裏は採用背景 `bg_mukai_attic`（斜めの垂木・畳・布団と紺の毛布・段ボール・木箱の上のマグ・小窓の夕日・階段の口）に合わせる。奥の部屋は屋根裏と見分けられるよう、平らな壁と暖簾の出入口にする。
- 宿とロビーは見分けがつくように、宿＝外観（風の塔・彫りの扉）、ロビー＝屋内（低い座席・ダッラ・吊りランタン）。モスクはアーチの回廊とドーム（宿にはドームと回廊を描かない）。
- 公式練習会場にシーシャ台を描かない（机は空のまま）。

## 組み込み手順（画像が届いたら）

1. 1枚ずつ生成し、目で検品する: 透過になっている／縁に背景色が残っていない／既存8種と並べて浮かない（比較画像をこのフォルダに置く）／96px に縮めて形が読める／人物・文字・ロゴ・シーシャ機材が無い。合わなければ作り直す。
2. 原画を無加工で `<名前>-source.png` として保存し、`generation.json` にプロンプト・モデル・サイズ・SHA-256 を書く（`asset_sources/cinema-956/` と同じ形）。
3. 透明の外側を2px残して切り詰め、長辺384pxの透過WebPにして上の予定ファイル名で置く（`map-facilities-` で始まる名前は `remake/test/browser/facility_map.mjs` の前提）。新しい画像は Git LFS（`git lfs ls-files` で確認）。
4. `remake/js/daily/facility-icons.js` の `FACILITY_ICONS` に `src`・`sheetSize`・`rect`・`badge`（不透明な右の輪郭に触れる点。高さ3割ほどの行で最も右の不透明画素）を足し、`SPOT_ICONS` に行き先 id を対応づける。占いは `extra` のシートから新しい単独画像へ移す（`map-facilities-extra-579.webp` は消さない）。
5. テストを新しい画像に合わせる: `remake/test/facility_icons.mjs`（アイコン一覧・extra シートの位置検査は id で照合・バッジは各 `src` の画像で検査）、`remake/test/browser/facility_icons.mjs`（比較ページのボタン数・画像パス・配信ファイル一覧）。`tools/ci/suites.json` の facility-icons と maps-and-shop の paths に新ファイルを足す。
6. 地図で重なりを確かめる（96pxのアイコンは文字の盾より大きい）: ドバイの宿(12,24)となると会う(18,32)、風の回廊モスク(58,70)とクリーク沿い(58,86)、東京の mukaiの奥の部屋(45,63)と煙幕(45.3,49.7)の名札。
