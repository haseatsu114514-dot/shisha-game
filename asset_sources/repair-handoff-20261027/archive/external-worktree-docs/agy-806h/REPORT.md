# REPORT: Issue #806（ひより部分・ショールーム遭遇除外）

## 1. DONE
- Issue #806 の項目2（ひより）について、最新仕様に基づき Dr.fookah のショールーム（`spot.kind === "shop"`、凛のショールーム）でひよりと会わないように変更しました。
- ショールームではひよりの全遭遇イベント（初対面 `meeting`、再会 `relay` / `cracks`、相席 `repeat`）が発生しないようにし、ショールーム専用の初対面台詞は追加していません。
- 他の適切な店（`rival` 各店・`samechan`・`c_station`）での登場、初対面と再会の区別、連絡先交換、既読、好感度、進行、同日1回制限、seedによる抽選の非再抽選を維持しました。
- 旧セーブで `_hiyori_meeting_shop` がショールームID（`"shop"`）のままでも進行や整合性が壊れないことを確認・テスト化しました。
- `docs/spec/hiyori_implementation.md` の初対面候補からショールームを除外する該当1行を更新しました。

### レビュー指摘対応（#806h 1回目）
1. **フィクスチャ前提の修正（`remake/test/hiyori_showroom_806.mjs`）**:
   - `reset()` の前提を `hiyori_frequency.mjs` と一致させ、`met: { hiyori: true }` を設定して `hiyoriFirstMeetingReady()` および `meeting` の `ready` 状態を正しく成立させました。
   - 初対面前（全500seedで non-null = 500）、初対面後（relay / cracks）、相席（repeat）、旧セーブ互換の各段階において、`hiyoriShopLocation()` が実際に他店を返すこと（`nonNullCount > 0`）をアサートした上でショールームが選ばれないことを検証し、空振りテストを排除しました。
2. **旧コードとの対照検証**:
   - `calcRoll()` を用いて、旧コード条件（shop が候補に入る）であれば昼夜とも shop が最小 roll になる seed が確実に存在すること（`oldWouldPickShop > 0`）を明示検証した上で、新コードではその全 seed においても shop が除外され他店舗が選ばれることを確認しました。
3. **`remake/test/hiyori_frequency.mjs` の stub 復元**:
   - `shops` リストの `{ id: "shop", kind: "shop" }` を復元し、`allSpots()` に shop が含まれる状態で `hiyoriShopEligible` による除外が機能することを保証しました。
   - `firstLocations` が shop を含まず他4店を網羅すること、および全2800スロットの遭遇ループ・昼夜スロットで shop が選ばれないことを検証しました（PASS確認済み）。

### レビュー指摘対応（#806h 2回目）
1. **モック環境での連絡先アサート適正化（`remake/test/hiyori_showroom_806.mjs`）**:
   - セクション3（他店舗での初対面進行）において、モックされた VN エンジンでは台本内の `{ "type": "set_flag", "flag": "_lime_contact_hiyori" }` が実行されないため、`hiyoriHasContact()` に依存する `state.contacts.includes("hiyori")` が `false` になる事象を解消しました。
   - 指摘に基づき、連絡先の検証は「ショールームでは連絡先が増えないこと」（セクション2）に限定し、他店での連絡先交換の確認は本番 VN エンジンで実行されるブラウザテスト `hiyori_encounters.mjs` の既存検査に任せる構成に整理（コメントを明記）。
2. **ファイル全体の精査**:
   - セクション4〜7の全アサーションを再確認し、同種のモック依存の期待値（VN台本内の副作用フラグへの依存等）が存在しないことを確認しました。
3. **製品コード・他ファイルの維持**:
   - 製品コード（`remake/js/daily/hiyori.js`、`docs/spec/hiyori_implementation.md`）およびその他ファイルは一切変更していません。

## 2. 変更ファイルと関数
1. `remake/js/daily/hiyori.js`（変更なし）
   - [`hiyoriShopEligible`]([local path omitted]): `spot.kind === "shop"` を除外。
   - [`hiyoriShopLocation`]([local path omitted]): `candidates` からショールーム関連の条件 `(spot.kind !== "shop" || !rinUnavailable(state))` を整理。不要となった `rinUnavailable` のインポートを削除。
2. `docs/spec/hiyori_implementation.md`（変更なし）
   - 初対面店舗の列挙行（第8行）からショールームを除外し、通常の買い物やショールームでは発生しない記述に更新。
3. `remake/test/hiyori_frequency.mjs`（PASS済み・変更なし）
   - `shops` リストに `{ id: "shop", kind: "shop" }` を復元。
   - `firstLocations` が shop を含まないこと（`!firstLocations.has("shop")`）および他4店（`naru`, `adam`, `minto`, `c_station`）を網羅することのアサーションを追加。
   - 遭遇ループ内および夜スロットで `location !== "shop"` のアサーションを追加。
4. `remake/test/hiyori_showroom_806.mjs`
   - セクション3のモック環境依存の連絡先アサートを整理し、セクション2の「ショールームでは連絡先が増えない」検証に集約。
5. `remake/test/hiyori_encounters.mjs`（変更なし）
   - `all-shops-and-prerequisites` テストケースで `shop` を訪問先リストから除外し、`excluded` リストへ追加。

## 3. TODO
- コーディネーターによるテスト実行（`TEST_REQUEST.md` 参照）。
- コーディネーターによる git commit / push / PR 作成（`GITHUB_REQUEST.md` 参照）。

## 4. TEST_REQUEST
- `node --experimental-vm-modules remake/test/hiyori_showroom_806.mjs`
- `node --experimental-vm-modules remake/test/hiyori_frequency.mjs`（1回目でPASS確認済み）
- （ブラウザテスト可能環境の場合）`node remake/test/hiyori_encounters.mjs`
※ 詳細な確認観点は [`TEST_REQUEST.md`](asset_sources/repair-handoff-20261027/archive/external-worktree-docs/agy-806h/TEST_REQUEST.md) に記載しています。

## 5. 要確認
- なし。

## 6. 編集禁止ファイルへのパッチ案
- なし（編集禁止ファイルへの変更は不要です）。
