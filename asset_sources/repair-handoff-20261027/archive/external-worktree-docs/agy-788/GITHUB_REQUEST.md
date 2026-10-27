# GITHUB_REQUEST.md — Issue #788 GitHub操作依頼書

コーディネーター実行用のGitHub操作依頼書です。
本workerセッションではGitコミット・push・PR作成・台帳操作は一切行っていません。

---

## 1. Issue及び予約情報
- **Issue**: #788 TRPG・斧投げの採用済み専用BGMを接続（OP曲は追加しない）
- **Branch**: `agy/788-20261021` (base `origin/main ea0229db`)
- **Worker**: `agy-g38fh-20261021-788-7a1c`
- **Claim run**: `39513034145` (台帳一致確認済み)

---

## 2. 依頼事項

### 2.1 パッチの適用
`PLAN.md` に記載されている以下の最小パッチ案について、既存owner（#573, #489, #540）との競合状態および未push差分を確認のうえ、適用をお願いいたします。
- `remake/js/core/audio.js`（BGM_GAIN 及び SYNTH_FALLBACK への2キー追加）
- `remake/js/daily/trpg.js`（入店時の `playBgm("bgm_trpg")` 接続）
- `remake/js/daily/axe-bar.js`（ソロ来店時の `playBgm("bgm_axe")` 及び終了時復帰）
- `remake/js/daily/hiyori-axe.js`（ひより対戦時の `playBgm("bgm_axe")` 及び終了時復帰）

### 2.2 素材の追加（約6.6MB）
原本音源から生成した `.bgm` ファイル（計約6.6MB）をリポジトリに含めるかどうかの判断とコミットをお願いいたします。
- 追加対象:
  - `assets/audio/bgm/bgm_trpg.bgm`
  - `assets/audio/bgm/bgm_axe.bgm`
  - `remake/data/manifest.json`（`build_manifest.py --audio-only` で更新）
- 元音源は公開リポジトリへコミットせず、変換後の `.bgm` のみを追加します。

### 2.3 コミット・PR作成
上記パッチ適用とテスト（`TEST_REQUEST.md`）の完了後、作業ブランチ `agy/788-20261021` から PR の作成をお願いいたします。
- **PRタイトル案**:
  `feat(audio): Issue #788 TRPG・斧投げの採用済み専用BGMを接続（BGM_GAIN音量補正・復帰制御）`
- **コミットメッセージ案**:
  ```text
  feat(audio): connect TRPG and axe throwing BGM with gain balancing (#788)
  
  - Add bgm_trpg (Shared Discovery) and bgm_axe (Aiming groove)
  - Balance playback levels via BGM_GAIN (bgm_axe: 0.95, bgm_trpg: 1.0)
  - Ensure correct BGM switching and restoration on finish/interrupt
  - Add local test remake/test/bgm_minigame_788.mjs
  ```
