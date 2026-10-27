# TEST_REQUEST: Issue #806 ひよりショールーム遭遇除外（レビュー2回目反映後）

コーディネーターによるテスト実行を依頼します（必要最小限の局所テストのみ）。

## 1. 実行依頼コマンド

### (1) 局所テスト（高速・軽量、最優先）
```bash
node --experimental-vm-modules remake/test/hiyori_showroom_806.mjs
```
- **目的**: Issue #806 専用の新規テスト。
  - 1回目の指摘対応: フィクスチャ前提を `hiyori_frequency.mjs` と揃え（`met: { hiyori: true }` を設定）、全段階で `nonNullCount > 0` をアサートした上でショールーム（`"shop"`）が選ばれないことを検証。旧コードなら shop が選ばれていた seed が存在すること（昼夜とも `oldWouldPickShop > 0`）を実証。
  - 2回目の指摘対応: セクション3のモック環境依存アサート（`contacts.includes("hiyori")`）を整理。ショールームでは連絡先が増えないこと（セクション2）を担保し、他店での連絡先交換は本番VNエンジンが動く `hiyori_encounters.mjs` に任せる構成に修正。ファイル全体でモック依存の不要な期待値がないことを精査済み。

### (2) 既存ユニットテスト（店舗選定・頻度回帰）
```bash
node --experimental-vm-modules remake/test/hiyori_frequency.mjs
```
- **状況**: 1回目で PASS 確認済み。変更なし。

### (3) ブラウザテスト（ブラウザ環境が利用可能な場合）
```bash
node remake/test/hiyori_encounters.mjs
```
- **目的**: 本番モジュールを使った訪問・報告・LIME・セーブの回帰テスト（他店での連絡先交換を含む）。

---

## 2. 確認観点
1. **ショールームでの非遭遇**:
   - 初対面前（`meeting` 未完了）：ショールーム（`spot.kind === "shop"`）が滞在先として選ばれず、他店舗が確実に選ばれる。
   - 初対面後（`sumi_message` 完了後、`relay` / `cracks` / `repeat`）：ショールームが選ばれず、他店舗が確実に選ばれる。
   - 各段階のループで `nonNullCount > 0` であること。
   - `visitHiyoriAtShop` をショールームに対して直接呼び出しても `false` が返り、イベントが発火しない（連絡先も増えない）。
2. **空振り防止（旧コードとの対照）**:
   - 修正前コード条件（shop が候補に入る）なら昼夜とも shop が最小 roll になる seed が存在した（`oldWouldPickShop > 0`）のに対し、新コードではそれらの seed でも shop が除外され他店舗が選出される。
3. **他店での正常動作維持**:
   - `rival` 各店（naru, adam, minto）、`samechan`、`c_station` では正常に遭遇・進行・好感度獲得が行われる。
   - seed による抽選結果の安定性（ロードや再描画で再抽選しない）。
4. **SAVE / LOAD 後の整合性**:
   - SAVE / LOAD 前後で予定滞在先が変わらず、ショールームが選ばれないこと。
5. **旧セーブ互換性**:
   - 旧セーブデータで `state.flags._hiyori_meeting_shop` が `"shop"` に設定されている場合でも、エラーや停止が発生せず、他店での再会が正常に選出・進行すること。
6. **表記**:
   - 「アルファーヘブン」。
