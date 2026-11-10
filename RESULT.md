# 第2章バイト接客イベントの条件修正結果（2026-11-10）

基準: `origin/main` `a150c7f813a02c60b37b582ad0a5977459b365d2`。作業ブランチ: `codex/baito-fixes-1110`。`data/baito_events.json` の条件のみを変更し、台詞・選択肢・結果文は変更していない。

| 状態 | 修正前 | 修正後 |
| --- | --- | --- |
| 第2章、「残る匂い」既読、食事回未読 | 次のシフトで優先選出 | 同じく優先選出 |
| 食事回を読了し、`usedBaito` に記録されたセーブ | 未読の通常回があればそれを選出。食事回自体は適格候補に残る | 食事回は適格候補から除外 |
| 食事回と通常回がともに既読で、未読候補が枯渇 | 食事回が再選出され得る | 通常回だけが再選出可能 |
| 食事回だけが候補で、食事回は既読 | 食事回が再選出され得る | 定型接客にフォールバック |
| 第2章 DAY1、試煙会前の苺回 | 抽選対象 | 抽選対象外 |
| DAY9 試煙会読了、試供品受領前の苺回 | 抽選対象 | 抽選対象外 |
| 試供品受領場面 `ch2_strawberry_sample` 読了後の苺回 | 抽選対象 | 抽選対象（一度のみ） |

食事回は `once: true` を追加し、既存の `usedBaito` による除外を適用した。苺回は `trigger_flag: _ch2_read_ch2_strawberry_sample` を追加した。このフラグは DAY9 の試供品受領場面の再生完了後に立ち、同じ処理で試供品も付与される。追加した `daily_consistency.mjs` の回帰テストは、実際の `tonari.js` のシフト選出経路で上記の境界を検証する。

## 検証

- `node --experimental-vm-modules remake/test/daily_consistency.mjs`: PASS
- `node --experimental-vm-modules remake/test/ch2_strawberry_trial.mjs`: PASS
- `node remake/test/ch2_ageha_story.mjs`: PASS
- `node tools/ci/run.mjs --kind quick --suites data-smoke`: PASS（1.8分、1/1 suite、retry なし）。`audit_dialogue_art.py` の参照 WARN は助言で、スイートは成功。
- `git diff --check`: PASS

保護 PR #742 #736 #1103 #1098 の変更は行っていない。PR は Ready for review とし、マージしない。

---

# 「はじめから」の読み込み待ち調査（2026-11-10）

## 原因

タイトル表示後に始める会話用フォントの先読み `loadVnFonts()` は、`document.fonts.load()` 2件を `Promise.all()` で待ち、時間上限がなかった。最初の会話 `play()` もその Promise を `assetsReady` に含めるため、フォント応答が遅いと `vn-loading` の「場面を準備しています…」が残り、最初の台詞へ進めない。画像は15秒、音声は8秒、JSONは15秒の待ち上限がある。台詞や画像の404が原因ではなかった。

`origin/main` の会話用フォントローダーは 2026-11-06 の会話UI更新で入った。直近の 11-10 の会話UI調整は主にレイアウトで、この無制限待ちを導入した変更ではない。

## 再現と所要時間

ローカルの sparse checkout に `remake/`、`data/`、`assets/` を含め、専用のプレビューサーバー（8124）と Chromium で確認した。タイトルの初期表示後、同じフォント応答をブラウザの通信ルートで保留し、タイトルの「はじめから」を押してから最初の台詞まで計測した。修正前は同じサーバー上で HEAD の元コードを返した。

| 条件 | 修正前 | 修正後 |
| --- | ---: | ---: |
| `ZenOldMincho-Blue-Regular.woff2` の応答を保留 | 14.7秒時点で台詞なし、読み込み表示あり | 7.5秒で最初の台詞、読み込み表示なし（フォントは未着） |
| 通常の「はじめから」 | ― | 7.4秒 |
| 「つづきから」（冒頭オートセーブ） | ― | 3.7秒 |
| `?debug=1` の「はじめから」 | ― | 4.1秒 |

元コードで保留を20秒続けた別の再現でも読み込み表示が残り、応答解放後約2秒で台詞が出た。保留時のコンソールエラー・404・失敗リクエストは0件。通常・続き・デバッグ開始でもエラーと404は0件（タイトル曲の場面切替による `ERR_ABORTED` は除外）。

## 修正

フォント先読みを最大4秒で打ち切り、未着の場合は既存の代替書体で会話を開始する。フォントの通信は続き、到着すればブラウザが適用する。即時失敗時の再試行は維持。台詞・シナリオは変更なし。

## 検証

- `node --experimental-vm-modules remake/test/warmup_defer.mjs`: PASS（保留したフォントが時間内に代替へ進む回帰ケースを追加）。
- `BASE_URL=http://127.0.0.1:8124/remake/ node remake/test/browser/newgame_font_wait.mjs`: PASS。実タイトルから開始し、フォント未着のまま3.8秒で最初の台詞を確認。CI の独立した短いブラウザ群に登録した。
- 既存の `ch1_loading.mjs` 全件は参考として実行。先読み対象の LFS 実体不足を補った後、新規開始に近い PC・タッチの会話読み込みケースは通過した。既存の作業台キャッシュケース2件はタイトルの並行画像先読みを拾って失敗し、連続走行中に Chromium のタブが2件クラッシュした。単独の `touch-warm-scene` は PASS。今回の回帰は独立群で判定する。
- `node tools/ci/run.mjs --kind quick`: 初回は sparse checkout で検査用資料・JSON・LFS画像・試遊コードを省いたため、`desert-ride-rules`、`loading-comics-spec`、`slim-deploy`、`docs`、`game-logic`、`tools` が失敗。欠けたファイルだけ追加後、各失敗コマンドを個別再実行しすべて PASS。quick 全体の初回終了コードは 1 のままと記録する。PR の CI では同じ quick 全体を確認する。
