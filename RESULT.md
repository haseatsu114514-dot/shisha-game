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


# PWA 仕上げの検証（2026-11-10）

## 公開経路

- `remake/index.html` が入口。manifest の `start_url` は `./index.html`、`scope` は `./`、`display` は `fullscreen`、`orientation` は `landscape`。
- アイコンは実体のある PNG（192×192、512×512）で、512 は `maskable` にも指定済み。
- main への push で `.github/workflows/deploy-pages.yml` が `remake/`、`data/`、`assets/` を Pages に配置する。`remake/tools/stamp_deploy.py` が公開版の build ID を付け、既存の `build.json` 確認処理が更新を通知する。

## ローカル確認

- `python3 remake/tools/serve_preview.py --port 8135 --directory /tmp/pwa-1110-site` で、現行 `index.html`、manifest、アイコン、`sw.js` と最小のゲームモジュールを配信。Playwright Chromium で `navigator.serviceWorker.ready` と `controller` を確認。登録 scope は `http://127.0.0.1:8135/remake/`、状態は `activated`。
- ブラウザから manifest を取得し、`fullscreen`、`landscape`、192/512 アイコンと maskable 指定を確認。PNG 実体の寸法も `file` で確認。Android のインストールに必要な構成は揃う。実機の追加メニュー表示は未確認。
- `Cache-Control: public, max-age=3600` を返す別のローカルサーバー（8136）でも、制御中ページから取得した HTML、JS、`../data/` の JSON を配信中に `one` から `two` に差し替えると、次の fetch で `two` を取得。`caches.keys()` は空。ネットワーク専用・`no-store` のため古い Cache Storage の版は残らない。
- 配信中の `sw.js` を変更して `registration.update()` を実行すると `controllerchange` が発火し、新しい worker に切り替わった。`skipWaiting()` と `clients.claim()` の動作を確認。
- `node --check remake/sw.js`、`git diff --check`、`./tools/check_git_safety.sh` は成功。

## quick

`node tools/ci/run.mjs --kind quick` を最後まで実行し、74 スイート中 65 成功・9 失敗（終了コード 1）。失敗はこの sparse checkout に入れていない素材・資料への参照で、PWA の変更箇所に起因する失敗はない。例: `remake/img/ui/poems/poem_ch1.webp`、`remake/img/loading/sumi-cold-tea-1.webp`、`asset_sources/desert-ride-2306/adoption.json`、`asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json`、`assets/audio/dj/km__dance-monster.mp3`、`experiments/proto/street/`、`CLAUDE.md`。失敗スイートは `chapter-poems`、`desert-ride-rules`、`loading-comics-spec`、`slim-deploy`、`docs`、`game-logic`、`audio-and-text`、`tools`、`new-flavors-dubai-shop`。完全な CI checkout で再判定する。

# D1110-1: SW 導入後のブラウザ回帰（2026-11-10）

## 修正と分類

固定 base は `a150c7f813a02c60b37b582ad0a5977459b365d2`、修正前 head は `8f4b9c26b7af3db118d4b82066effad2164202b1`。開始時 PR baseRef は `f5dd257ce3b1d7c1fa7dc819e0f61acd4620c1d8`。base と修正前 head のゲーム差分は index の登録と sw.js だけ。PR #3127 の本文・全コメント・review comments・関連 open PR #3078/#3073/#3074 の files を再確認してから既存 `codex/pwa-1110` で継続した。

| 固定版 / context.serviceWorkers | 登録・controller | 画像/JSON page.route | 実 ch2_daily の画像失敗・再試行 |
| --- | --- | --- | --- |
| base / allow | 無し | 到達 | PASS |
| base / block | 無し | 到達 | PASS |
| 修正前 head / allow | remake/、activated、有り | 不達、SW が再 fetch | FAIL: 32800 !== 35800 |
| 修正前 head / block | 無し | 到達 | PASS |
| 修正版 / allow | remake/、activated、有り | 画像と明示的 no-cache JSON に到達 | PASS |

修正前は画像失敗の注入が届かず、正常な画像・会話を読んで3000円を消費した。実プレイで画像失敗時に課金される不具合とは区別する。サーバーが実際に不正な画像本文を返す独立検査では、**修正前・修正版とも**実 `visitPreparationSpot` が `{ used:false, exerted:false }` を返し、所持金・slot・既読を含む状態全体と保存は不変だった。

SW は有効のまま、鮮度制御を HTML/JS/CSS/JSON に限定した。既に `no-cache`（実台詞ローダ）、`no-store`、`reload` を指定した通信は再発行せず、その鮮度指定を尊重する。画像・音声は導入前の通常 HTTP 経路と HTTP キャッシュ寿命を保つ。SW の永続キャッシュ・オフライン・先読みは追加しない。上の初版記録にある「同一オリジン GET 全件 no-store」は、この修正後はコード・データの既定要求に限る。

`index.html`、共通 support、既存 route/assert、suites.json、ゲームの章機能、音声・画像・台詞には変更を加えていない。

## 検証

- **PASS** `node remake/test/browser/pwa_network_regression.mjs`。実 index の登録処理と実 SW を独立 HTTP サーバーで使用。allow/block の各 context に登録・controller・worker の request・fromServiceWorker・page.route を記録。route を入れる前に `max-age=3600` の HTML/JS/JSON を変更し、allow は新本文、block は旧本文という対照を確認。実 `readDialogues` の no-cache も両 context で最新版を取得した。
- **PASS** 同テストで scope は `remake/`、scope 外は controller 無し。配信中の worker を変更すると controllerchange 後に activated、Cache Storage は空。サーバー側画像破損時の実来店の不消費と、同じ URL での画像再取得を確認。
- **負の対照** 同じ検査に修正前 SW を配信すると、実破損の不消費は PASS、画像 route 注入が迂回される assertion は FAIL。画像成功を失敗として扱ったり assertion を緩めたりしていない。
- **PASS** 既存 `ch2_daily.mjs` の `boardgame-preview-normal` / `boardgame-preview-failed` / `room-image-failure-preserves-cost-and-action` / `preparation-json-failure-keeps-day1-and-retries`。`CASE_FILTER=<ケース名> node remake/test/browser/ch2_daily.mjs` で実行。
- **quick 初回 72/74**: `node tools/ci/run.mjs --kind quick` を編集せず完走。失敗は未展開のロード漫画 LFS と未取得 `.agents/skills/portrait-unify/SKILL.md`。必要な quick 素材を既存ローカル LFS cache から展開し（素材ダウンロード無し）、sparse の資料を補った後、失敗した `node remake/test/loading_comics_spec.mjs` と `python3 tools/check_agent_docs.py` は両方 PASS。実体を用いた `node remake/test/chapter_poems.mjs` も PASS。CI と同じ Node 22 での全件結果は現 head の CI で確認する（ローカル Node 24.22.1 / Playwright 1.62.1）。
- **FAIL / timeout** `node tools/ci/run.mjs --kind browser --suites craft-scenes` は既定の10分×2回を実行し、ともに worker_scenes の途中で上限到達。craft_readiness / foil_skip はこのスイート実行では未実施。`slow-image-before-heat`、`visible-element-decode-gate`、`slow-punch-frame-gates-real-holes`、元 CI の失敗だった `broken-punch-frame-complete-fallback` の PASS を確認したが、スイート全体の成功とはしない。
- ローカルの追加失敗: real-puff の表示不一致・timeout・Page crashed、punch-flipbook の `ERR_INSUFFICIENT_RESOURCES`。base の同じ real-puff-pc でも `pull-stop` 待ち timeout（:101）を2回再現し、修正版再試行と一致。最初の `pull !== inhale`（:106）などの別署名は解決扱いにしない。CPU pressure 約92%の実測も保存。元 CI の画像/JSON注入不達とは別の環境/タイミング問題の候補として現 head CI で再判定する。
- `node --check remake/sw.js`、新規テストの構文確認、`git diff --check`、git safety を実行。

詳細ログ・比較サーバー・context 計測用 preload・単元 RESULT は `work/codex-a-3127-sw-regression-1110/` に保存。比較時は同じコード/素材を使い、index/sw だけを固定 ref から配信。必要な素材の不足・LFS pointer は実ゲームの失敗と混同しない。

## TODO / NEXT（PR 全体の完了とは区別）

元 CI は https://github.com/haseatsu114514-dot/shisha-game/actions/runs/42767560522 （quick SUCCESS、browser 1/2/3・result FAILURE）。失敗21ケースはいずれも画像/JSONの注入・観測を含む。局所再実行以外を成功扱いせず、push 後の同一 head の quick・browser・result を同じ PR に追記する。未解決の表示署名が CI にも出たら、その実ログで次の切り分けを行う。

新規テストの suites.json 登録は #3073/#3074/#3078 の変更と重なるため**登録待ち**。現時点の入口は `node remake/test/browser/pwa_network_regression.mjs` の単独コマンドで、CI 登録済みとは扱わない。sweeper は現 head の必須 `CI / result` と残る検証を確認する。この単元ではマージ・新規 Issue/PR 作成はしない。


## main 取り込みと追加検証（D1110-1）

最初の修正 head `4ad2f58b9accd78bdba400a000e8ce86dbe3271d` は push 済みだったが、その時点の main `4e368556edb5dda69b9934b8325a6bd769ab7e3e` と RESULT.md が add/add 競合し、PR の CI が起動しなかった。この競合解消のためだけに main を取り込み、main 側の「はじめから」調査と PWA 側の記録を両方保持した。ゲームコードの手動競合解消は無い。#3078 の index 差分は title-ds/game-ds の CSS link 削除であることを再確認し、その領域には触れていない。

取り込み前の追加単独実行: `craft_readiness.mjs` 全3ケース PASS（元CIの next-step-prefetch-does-not-block を含む）。`worker_scenes.mjs` の broken-scene-real-mix-fallback / timeout-then-late-image-stays-fallback / broken-focus-uses-approved-face も CASE_FILTER で個別に PASS。先の関連スイート全体の timeout 記録は取り消さない。固定 base/head 比較ログは main 取り込み前の不変スナップショットとして保持する。取り込み後の必須 CI と局所再検証は同じPRの結果コメント・単元RESULTに追記する。
