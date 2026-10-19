# 制作左画面・初回温度計（#703 元12/13/14/21）

PR #718。基準mainは `82694ca674a7b2c1df77131244b980cc06e8a730`。先行PR #716の成果は統合済み。

## 表示変更と境界

- 初回レッスン（`mode: tutorial`、保存からの再開も含む）の温度計と配合温度プレビューを非表示。温度の更新・判定は継続する。初回の案内・ヘルプも見えない温度計を参照しない。再表示の時期は未指定のまま。日付・好感度の条件や保存フラグは追加しない。通常練習・大会の既存の表示は維持する。
- ミックスのプレビューをfooterから外し、吸い出しと同じ左座標の縦管にする。共通の温度計・適温/最適温モデルを再利用し、矢印と現在温度は出さない。未選択は灰色、選択後は緑・虹・中心線。配合比率の%は保持する。
- 左の作業風景を下の台詞欄の背後まで広げ、顔・台詞を前景に重ねる。台詞・操作を変更する全面UI案ではない。
- 吸い出し・吸引中・熱管理で、既存の本体/ステム/受け皿/ボウルをすべて表示。130pxの下瓶の切り取りと上部の非表示を外す。既存人物絵・機材部品・fallbackを使い、画像生成・交換・固定個数の炭の追加はしない。
- DSでもプレビュー/吸い出しの座標を揃え、短い画面の温度計枠は管の実寸に追従。小さい左画面では本体全体を縮小して台詞と上端の間に収める。右の既存760pxパネルとスクロールの設計は維持する。`game-ds.css` は別PRの変更があるため編集しない。

## 同じ状態の前後画面

配合はダブルアップル9g＋ミント3g、装備は同じ初期装備、吸い出し開始温度は0.54、蒸らし成績100。PCは1280×720、横持ちタッチは844×390。状態と温度帯は [comparison.json](comparison.json)。NEW GAMEからの通しではなく、本番 `newSession/openBench/stepMix/runPull` を使った独立fixture。配合は実ボタン入力、吸い出しは開始カウント終了後に撮影する。

beforeのみ、基準mainの変更対象6ファイルの全内容をブラウザrouteで返す。他のファイル・素材・モデル・入力処理は差し替えない。afterは作業ブランチの本番配信ファイル。元のPNGや試行ログは作業用とし、GitHubには比較用JPEGを保存する。

| 条件 | 配合 前 | 配合 後 | 吸い出し 前 | 吸い出し 後 |
| --- | --- | --- | --- | --- |
| PC | [画像](before-pc-mix.jpg) | [画像](after-pc-mix.jpg) | [画像](before-pc-pull.jpg) | [画像](after-pc-pull.jpg) |
| 横持ちタッチ | [画像](before-touch-mix.jpg) | [画像](after-touch-mix.jpg) | [画像](before-touch-pull.jpg) | [画像](after-touch-pull.jpg) |

## 回帰

- `ds_packing.mjs` の旧期待だけを「デンスパック」へ更新。実click/tap、aria-pressed、内部pack、caption/aria-label、はみ出し、穴あけへの遷移assertをすべて維持する。
- `craft_layout_703.mjs` は通常PC/横持ちタッチ、DS PC/横持ち/縦持ちの5条件で、温度管のx/y/幅/高さ一致、台詞の前景と可読性、本体4部品の可視/包含、実吸引中と終了後を検証する。初回/文書reload＋実save/loadから再構築したレッスン、ヘルプ、工程画像decode失敗時のfallbackも検査する。
- 既存 `mix_temperature.mjs` の座標取得だけを実DOMの縦/横へ対応させ、温度帯・配合比率・装備/メーカー変更・蒸らし→吸い出し→熱管理・旧保存のassertを維持する。温度モデルは変更しない。
- `worker_scenes.mjs` の既存工程絵/表情/実吸引/穴あけ/準備待ち/fallback/動きを減らす設定も回帰対象。
- `.github/workflows/ds-packing.yml` に専用表示回帰を追加し、CIにも残す。

コマンド（既存依存・システムChromium、previewは8123）:

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ds_packing.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/craft_layout_703.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/mix_temperature.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/worker_scenes.mjs
node --experimental-vm-modules remake/test/mix_temperature.mjs
```

最終結果はPR本文と [validation.json](validation.json) に記録する。実機Safari・公開版・全章通しは未実施。再表示時期の判断・レビュー/統合は未完として、Issue #703と予約を保持する。
