# PLAN: Issue #806 「ひより」ショールーム遭遇除外

## 1. 目的と概要
Issue #806 のうち項目2（ひより）に対応し、ひよりとは Dr.fookah のショールーム（`spot.kind === "shop"`、凛のショールーム）で会わないようにする。
ショールームでは初対面（`meeting`）・再会（`relay` / `cracks`）・相席（`repeat`）の全イベントが発生しないようにし、ショールーム専用の台詞は書かない。
他店（`rival` 各店、`samechan`、`c_station`）での遭遇、進行、初対面/再会の区別、連絡先交換、好感度、同日1回制限、seedによる抽選の非再抽選を維持する。

## 2. 変更内容
1. `remake/js/daily/hiyori.js`:
   - `hiyoriShopEligible`: `spot.kind === "shop"` を除外。
   - `hiyoriShopLocation`: ショールームが非適格となったことに伴い、`candidates` の `(spot.kind !== "shop" || !rinUnavailable(state))` を整理し、不要となった `rinUnavailable` インポートを削除。
2. `docs/spec/hiyori_implementation.md`:
   - 該当1行（初対面候補の記述）からショールームを除外。
3. `remake/test/hiyori_encounters.mjs`:
   - 訪問先リストから `shop` を除外し、`excluded` リストに `shop` を追加。
4. `remake/test/hiyori_frequency.mjs`:
   - `shops` リストから `shop` を除外し、ショールームが選ばれないこと・非適格であることのアサーションを追加。
5. `remake/test/hiyori_showroom_806.mjs`:
   - 新規作成。ショールーム除外、初対面前後、再会・相席、旧セーブ互換（`_hiyori_meeting_shop === "shop"`）、SAVE/LOAD 前後の不変性を網羅検証。

## 3. 要ユーザー確認
- なし（指示に従い、最小差分で矛盾なく実装完了）。

## 4. 編集禁止ファイルへのパッチ案
- なし（編集禁止ファイル `remake/js/daily/calendar.js`, `spots.js`, `tonari.js`, `tsumugi-story.js`, `spot-people.js`, `data/dialogue/hiyori.json` 等の変更は不要でした）。
