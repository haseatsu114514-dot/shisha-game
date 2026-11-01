# GITHUB_REQUEST: Issue #806 ひよりショールーム遭遇除外

コーディネーターによる Git / GitHub 操作を依頼します。

- **Worktree**: `[local path omitted]`
- **Branch**: `agy/806h-20261021` (base: `origin/main ea0229db`)
- **予約**:
  - owner: `agy-g38fh-20261021-806h-7a1c`
  - claim run: `39513300651`

## コミット対象ファイル
1. `remake/js/daily/hiyori.js`
2. `docs/spec/hiyori_implementation.md`
3. `remake/test/hiyori_encounters.mjs`
4. `remake/test/hiyori_frequency.mjs`
5. `remake/test/hiyori_showroom_806.mjs`

※ 以下の管理用ファイル（必要に応じてコミットに含めるか判断してください）：
- `PLAN.md`
- `TEST_REQUEST.md`
- `REPORT.md`
- `GITHUB_REQUEST.md`

## コミットメッセージ案
```
fix(daily/hiyori): exclude Dr.fookah showroom from Hiyori encounters (#806)

- Exclude spot.kind === "shop" (Dr.fookah showroom) from hiyoriShopEligible
- Remove obsolete showroom timing checks from hiyoriShopLocation
- Update docs/spec/hiyori_implementation.md accordingly
- Update existing encounter/frequency tests and add hiyori_showroom_806 test
```
