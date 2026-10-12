# Issue #407 / PR #387 QA

Worker: `codex-title407-20261012-01a12f11`。正式claim run [38219521536](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38219521536) SUCCESS。

対象は `tools/title-review/` と選別画面の配信経路。元原画・正式21枚・ゲームmanifest・ゲームコード・装備・価格・能力・内部IDは変更しない。

- `build_catalog.py --check`: 114原画パス / 92ユニーク / 22重複 / 現行21枚。全元ファイルをSHA256計算し、表示画像をデコード。
- `test.mjs`: 全画像・本人参照URL、全キャラ／系統フィルター、PC1440×1000／390×844タッチ／320×740タッチ、2/3/4比較と5枚目拒否、拡大、本人参照、判定ラベル更新、メモ・ブラウザ保存再開、JSON実ダウンロードと往復、キャンセル、破損JSON／未知IDの非破壊性、保存不能、破損保存の保護、読込失敗、修正前後、試作v3移行。
- `remake/test/title_arts.mjs`: 本編の初回ロード、連続抽選、7人21枚とひよりの確実な抽選、PC／スマホの全タイトル表示、保存不変。
- `check_agent_docs.py`、`git diff --check`、Git Safety。

検証結果JSONと代表的な画像を同フォルダに保存。公開後の同一QAは `public-results.json`。CIと公開runはIssue／PRへ記録する。

留意: 実機スマホではなくChromiumのタッチ・モバイルエミュレーション。画像の採否や機材の精密な再検品はオーナーの判断で、この画面の完了判定と区別する。旧資料の原画未保存 `ageha01` は存在しない旨を表示し、架空の画像URLを作っていない。
