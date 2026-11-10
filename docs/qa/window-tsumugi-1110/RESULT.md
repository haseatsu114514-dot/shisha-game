# 会話ウィンドウ／第5章つむぎ 修正結果（2026-11-10）

## 到達点

2件とも原因を特定して修正・実画面検証済み。保存先は既存のReady PR [#3108](https://github.com/haseatsu114514-dot/shisha-game/pull/3108)、ブランチは `muse/vn-ctl-spacing-1110`。新規PR・マージは行わない。

- 調査開始時の #3108: `96a8b1d5e8806e63cc2efaafc0ade92b3b85bbcb`。
- 比較用 main を `a150c7f813a02c60b37b582ad0a5977459b365d2` に固定。
- 既存リポジトリのオブジェクトを利用する sparse worktree（`wt/`）で作業。素材原画・過去QAは取得対象から除外。

## 1. 本文と操作列の重なり

### 原因

証拠画像の文章は `data/dialogue/ch5_main.json` の `ch5_bridge_after_return` 先頭行と一致する。

`phone-density.css` は `.vn-box` の下端だけを `max(30px, (safe-area-inset-bottom + 8px) / --k)` に変更する。一方、紙テーマの `.vn-controls` は `--vn-dialogue-bottom`（16pxのまま）を使って絶対配置される。iPhoneのホームバー分だけ本文枠が上がっても、操作列は追従しない。本文は左右96pxの余白・内幅1024pxで、操作列は別要素かつ z-index 6（枠は5）のため、本文の右側に操作列が残ると長い1行目に被さる。

実ゲームを780×301 CSS px、DPR 1.5、安全領域下端21pxで再生して再現した。倍率は0.41806。本文枠の下端指定は69.369ステージpx、操作列の基準は16pxで、53.369ステージpx（22.307 CSS px）ずれる。先頭行の次にある長い地の文（行2）でも再現し、変更前後を撮影した。安全領域が0の検査だけではこのずれを十分に検出できなかった。

`remake/img/ui/paper/dialogue.webp` は2464×384pxの画像で、横罫線が焼き込まれている。表示時は枠の上下8pxの張り出しを含む192px高に縮小され、罫線は本文枠上端から約45ステージpx。本文開始は44pxで、実際の字面はそれより下。画像を編集する必要はなく、操作文字をこの罫線より上へ揃える必要があった。ボタン間の縦線は画像ではなく `.vn-ctl + .vn-ctl::before`。

### 修正とPR判断

紙テーマかつスマホ密度のときだけ、`#stage` の `--vn-dialogue-bottom` に枠と同じ安全領域込みの値を設定し、操作列を追従させる。拡大されたタップ領域を上へ伸ばしたまま、文字を下寄せし、縦線を下端からの固定位置に置く。フォーカス時の背景とAUTO／SKIP中の印も同じ文字位置に追従させる。本文の幅・改行・フォントサイズ・枠画像は変更しない。

先に #3108 の差分を確認した。同PRは同じ `ui-paper.css` の `.vn-controls` と `.vn-ctl` を変更しており、配置基準・文字・縦線の修正が同じ領域に重なる。このため、新規PRを作らず #3108 へ上乗せする。既存のボタン間隔均等化と2px上への調整も維持する。

## 2. バイト中のつむぎが通常服

### 原因

第5章の冒頭場面 `ch5_bridge_after_return` の行8「三番さん、見てきました。炭、足しますか」と行11「……はい。スミさんと、同じ言い方です」が `face: normal`／`smile` のままだった。直後の地の文にもエプロンの紐を結び直す描写があり、客席の炭を管理する勤務場面と確定できる。

エプロン素材は実在する（新規生成なし）。

- 元PNG: `assets/sprites/character_variants/new/tsumugi/chr_tsumugi_baito_{normal,smile}.png`
- 配信用: `remake/img/sprites/character_variants/new/tsumugi/chr_tsumugi_baito_{normal,smile}.webp`
- `remake/data/manifest.json` の `portraitVariants.new.tsumugi.faces` に `baito_*` 7表情が登録済み。

`portraitInfo()` → `resolvePortrait()` は `face` を衣装接頭辞込みで解決し、manifestにある新版の対応表情を選ぶ。正常例の `ch5_tsumugi_serving` ほか勤務イベント6本は既に `baito_*` を指定している。該当冒頭の2発言だけ指定漏れだった。

### 修正

2発言のみ `baito_normal`／`baito_smile` に変更。JSONの比較で、文章・条件・他場面に差分がないことを確認。実ゲームの同じ場面で2表情のエプロンを確認し、既存接客場面と第1章 `ch1_tsumugi_first` の通常服も検査した。既定の新版画風で確認しており、旧画風の既存フォールバック処理は変更していない。

## 検証

- `conversation_ui.mjs`: 全6件 PASS。最後の操作中表示の配置調整後も追加ケースを単独再実行してPASS。実ゲームの安全領域検査を同ファイルへ追加（プレビューは `phone-density.css` を読み込まないため、本編ページで検査）。1280×720、844×390、844×340、780×301、安全領域0／21／34px。本文とタップ領域の非交差、画像の見出し帯内の操作文字、38px以上のタップ高、2衣装表情・既存接客・通常服を検査。
- `ui_themes.mjs`: 固定mainは3 PASS／2 FAIL（1280・844、`command text is a quieter third level`）。修正後も同じ3 PASS／2 FAILで、失敗ラベル・assertionが一致。悪化なし。既存assertionは変更していない。
- `node tools/ci/run.mjs --kind quick --suites dialogue-lint,portrait-style`: 2/2 suites PASS。台詞リンタ・正史／リンク検査・立ち絵解決／フレーミングを含む。
- `node --experimental-vm-modules remake/test/ch5_progress.mjs`: PASS。
- JSON差分検査: 上記2件の `face` だけが変化し、文章を含む他の全フィールドは同一。`git diff --check`: PASS。
- 初回のブラウザ検証にはプレビューサーバー終了による接続拒否があり、サーバーと検査の寿命を揃えて再実行。また連続実行が環境の時間制限（exit 143）で中断されたため、テーマ検査を単独で最後まで実行し、上記結果を確認。追加検査の見出し範囲は、実物の紙画像が枠より上へ8px張り出すことを反映して調整した。

## #3108 の既存CI失敗の切り分け

対象: [CI run 42751039263](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/42751039263)（修正前HEAD）。

- quick: `data_loading.mjs:107` のLIMEメッセージ件数が実際93、期待92。会話ウィンドウ／衣装とは無関係。作業ブランチでも同じ失敗を再現。固定mainでは94件に更新済みで `data_loading.mjs` はPASS。このPRに無関係な修正を混ぜない。
- browser 1: `ui_themes.mjs` の1280／844は22pxの操作文字と28pxの本文の比率が上限0.65を超える既存失敗。#3108前のmainも22pxであり、今回の修正でも変更していない。
- 同jobの `phone_density.mjs` の `desktop-unchanged` は、操作ボタンの値を `44px 16px 254px` と期待するが、紙テーマの実際は `44px 22px 254px`。固定mainでも `CASE_FILTER=desktop-unchanged` で同一失敗を確認。上と同じく既存の紙テーマの文字サイズと古い期待値の不一致であり、安全領域のずれを検査するものではない。

## 証拠画像

単元フォルダに元スクリーンショット `evidence-window.jpg` と、以下の実ゲーム画面を保存。PR内では `docs/qa/window-tsumugi-1110/` に対応する画像を同梱する。

| 内容 | 単元フォルダ | PR内 |
|---|---|---|
| main・長い地の文で重なり再現 | `main-long.png` | `before-window.png` |
| 修正後・同じ長い地の文 | `final-long.png` | `after-window.png` |
| 修正後・オーナー画像と同じ冒頭行 | `final-owner-window.png` | `after-owner-scene.png` |
| main・勤務中なのに通常服 | `main-tsumugi.png` | `before-tsumugi.png` |
| 修正後・勤務中のエプロン | `final-tsumugi.png` | `after-tsumugi.png` |
| 修正後・もう一つのエプロン表情 | `final-smile.png` | 単元フォルダに保存 |
| 無関係な第1章・通常服のまま | `final-normal-unrelated.png` | `unchanged-normal.png` |

検証はローカルChromiumの実ゲームとCDPのsafe-area上書きで実施。オーナーのiPhone Safari自体を遠隔操作したものではない。
