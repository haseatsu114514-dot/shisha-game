# 街の斧投げBar・ボドゲカフェ

PR [#545](https://github.com/haseatsu114514-dot/shisha-game/pull/545) / Issue [#540](https://github.com/haseatsu114514-dot/shisha-game/issues/540)。**Draft・オーナーの仕上がり確認待ち。マージ・公開・Issue closeはしていない。**

今回の検証対象は `f323c0376d71957a1e110a739555d823064d9f82`。旧担当の保存済みhead `84d2a01d3dfbd5cc381836a4458df2affbb92dbe`を引き継ぎ、main `b69cb548718a963e88c05e1b3dec1fe6fe154964`を通常mergeして両側を維持した。**#524はマージ済みで、待機理由ではない。**

SHA・ファイルのSHA-256・環境・予約・CI取得時点は [current-source.json](current-source.json)。後続のQA記録専用commitは `assets/`・`data/`・`remake/` のGit tree一致を確認する。ローカル結果のrefを新しいheadへ書き換えず、最終PR headのCIは [Checks](https://github.com/haseatsu114514-dot/shisha-game/pull/545/checks) とrunの対象SHAで追跡する。

## 今回の遊べる範囲

| 操作 | 維持した条件と消費 |
| --- | --- |
| 第1章・地元の斧投げBar | 夜限定。既存3投練習・10投ソロ、各投の結果・自己ベスト・帰還。1日1回。完走して「終了」を押した時だけ3,000円、体力の基礎消費10、夜1行動、根性1P。既存の根性による体力補正を維持。入店・記録閲覧・取消は無料。 |
| 第2章・隣町・柚ヶ谷のボドゲカフェ | 地元から地域ボタンで移動。六角サイ、部活設立、本棚、対面勧誘済みの仲間と夜TRPG。入店・設立・購入では行動を消費しない。 |
| 昼の無料試遊 | 「七つの灯り」。ダイスで7を狙い、止める／超過を体験。部活設立前も無料で試せ、料金・体力・行動・能力・関係・結末記録を変更しない。短編2本の購入条件とは別。 |
| 『世界一普通の一台』 | ひよりの入部で入荷、500円。所持本・部員・GMの都合・夜1枠が必要。結末の読了時に結末と夜行動を同じ保存で確定。一度きり。 |
| 『サメは閉店を待たない』 | サメちゃんの入部で入荷、800円。通常の空き夜が必須イベントと重なるため、オーナー承認で**DAY8夜だけ**既存の個別シフト欄で参加可能にした。開始通算日15なら通算22日夜。週間勤務・面識・部活・対面勧誘・本所持・約束・固定夜条件を維持。同日時の既存シフトを上書きしない。 |

DAY8の承認は [Issueの記録](https://github.com/haseatsu114514-dot/shisha-game/issues/540#issuecomment-6166708845)。新規の物語イベント・料金・報酬は作っていない。自由ソロはひよりを表示・招集せず、正式イベントの面識・関係・既読を進めない。

追加要望MSP03〜08も照合：斧崎マキ／六角サイと案内、斧の夜限定、凛の夜限定・出張・同日訪問条件、昼夜無料の1階購入、こはくの昼営業、昼試遊／夜TRPG、無人ジム、昼の観音堂交流／夜の独白、シーシャ店の昼夜挨拶を保持。既存フォローアップを昼夜の挨拶より先に読む順序を復旧。ピン重なりは545側の斧座標だけで解消した。

## このSHAの検証

| 検査 | 結果と記録 |
| --- | --- |
| 店舗の本編接続 | [20/20 PASS](current-browser-results.json)。PC・ネイティブタッチで3投／10投、非ゼロの狙い投擲・各投合計・自己ベスト、実MENUでSAVE→再読込→タイトルLOAD。TRPG2本も両入力で地図→購入→プレイ→結末→帰還。2本目は本編DAY8の予定表を使い、固定夜判定を迂回しない。 |
| ひより正式イベント | [11/11 PASS](current-hiyori-results.json)。前後の会話・実3投・未読／中断・旧保存・友情／恋人・料金・LIME・既読を保持。 |
| TRPG・部活の回帰 | [13/13 PASS](current-trpg-results.json)。設立、実訪問の対面勧誘、取消、購入、二人卓／代役、GM勤務／先約、結末即時保存、読取専用本棚、通信再試行、画面撤去／別保存、独立試遊の保存非干渉。独立試遊の成功だけを本編日程の成功とは扱わない。 |
| 昼夜・店員・試遊 | [10/10 PASS](current-hours-results.json)。PC／タッチ、営業時間外と直呼びの拒否、無料試遊の停止／超過／再試遊、凛と無料購入、夜の試遊不可、別保存後の古い試遊ボタン、無人ジム・夜の観音堂。 |
| 凛の本編店舗回帰 | [10/10 PASS](current-shop-results.json)。昼の2階拒否、昼の無料購入、夜の体力不足取消、体力14と夜1行動の実保存、相談料なし、翌朝帰還。取消・消費・保存のassertを削除せず、承認済みの夜営業に合わせた。 |
| モデル・旧保存・ローダ | [実行結果](current-unit-results.json)。斧16＋TRPG11＋部活/日程14＝41/41 PASS。schema13/14自動・手動LOAD、schema15、43種類の不正な旧TRPG保存を自動／手動両方で検査。昼夜モデル20assert、章境界、JSON36件の並列上限・HTTP/JSON/通信/タイムアウトもPASS。 |

古い購入／終了ボタンの連打と確定前後の保存で二重確定を検査。残高不足、体力0、同日利用、取消、完走後の未確定取消、実reloadの未完走離脱、二重起動、別セーブへの実LOAD、pagehide、画面撤去も検査。未完走・所有セーブの切替後には確定しない。ブラウザ例外・失敗リソースは各ケース0件。

合計64/64ブラウザケースPASS。現在のcurrent-*結果・画面は、店舗回帰fixture修正後の上記SHAで全て再実行したもの。

Chromium、PC1280×720、タッチ844×390（`tap()`）。日常保存fixtureからの操作と本編SAVE/LOAD後の再開であり、NEW GAMEから全章の通し検査ではない。

## 今回の画面

| 操作 | PC | タッチ |
| --- | --- | --- |
| 斧・入店 | [マキと選択](current-pc-axe-entry.png) | [マキと選択](current-touch-league-axe-entry.png) |
| 斧・結果 | [3投](current-pc-practice-axe-result.png) | [10投](current-touch-league-axe-result.png) |
| 斧・帰還 | [地元](current-pc-practice-axe-return.png) | [地元](current-touch-league-axe-return.png) |
| カフェへの導線 | [隣町](current-pc-cafe-map.png) | [隣町](current-touch-cafe-map.png) |
| DAY8夜・入店 | [サイと本棚](current-pc-cafe-entry.png) | [スクロールできる本棚](current-touch-cafe-entry.png) |
| 2本目・結末 | [サメがGM](current-pc-cafe-result.png) | [サメがGM](current-touch-cafe-result.png) |
| カフェ・帰還 | [翌朝](current-pc-cafe-return.png) | [翌朝](current-touch-cafe-return.png) |
| 1本目・結末 | [ひよりがGM](current-pc-ordinary-result.png) | [ひよりがGM](current-touch-ordinary-result.png) |
| 昼・無料試遊 | [七つの灯り](current-trial-pc.png) | [七つの灯り](current-trial-touch.png) |

既存の店舗・的・投擲・人物・TRPG素材を再利用。今回の引継ぎで新規画像生成やロゴ制作はしていない。

## 修正・未確認・引継ぎ

[integration-failures.json](integration-failures.json)にmain統合後の失敗・対象head・CIログ・修正理由を保存。フォローアップ順序とピン重なりはコードを修正。従来3店の厳密assertにカフェ込み4ピンの完全一致を追加し、JSON件数は35→36の完全一致へ更新。凛の同日拒否を追加し、元の反復報酬assertは次の営業日に維持。既存assertの削除・弱体化はしていない。

1fb95a4aの共通CIでは、古いshop_ui fixtureが昼に凛の2階へ入ろうとして失敗した。昼の拒否を追加し、取消・消費・保存・帰還は夜に実施するよう修正。実保存の体力86と訪問日5の検査を維持し、相談料が増えないことも確認した。

同headの街歩き章通しCIは初回レモン購入未達で失敗したが、コード・assertを変更しない1回の再実行で成功。練習回数は条件を満たしていた。初回失敗と同じコードの成功runを記録し、通しドライバの乱数・操作タイミング・行動計画の再現性は別の残課題として残す。

新規離脱検査の754388beでの失敗は、取消の自動保存で`savedAt`だけが更新されるため。Dateだけ固定し、保存全文の厳密比較を維持した。ゲームの保存処理を抑止・変更していない。

- worker `codex-play540-20261014-893386c8`。正式transfer [38544778342](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38544778342)とそのrun指定のstatus [38545145863](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38545145863)の成功・実ログを確認してから編集。予約を維持。
- 旧担当の停止は540の引継ぎで確認。保存済みheadは保全。別環境の未コミット・未push差分は**未確認**。
- DS #554/#555とは [境界を共有](https://github.com/haseatsu114514-dot/shisha-game/issues/554#issuecomment-6165573309)。main.js・title・renderer・DS用CSS・共有index.htmlはmainとの差分なし。店員CSSは545の既存axe-throw.css／trpg.cssから読み込む。555との統合QAは未実施。
- #547の看板寸法、#481の街歩き、#489の新キャラ対戦、新店舗ロゴ、無関係な台詞改稿は範囲外。残要望のある540を閉じない。
- 実機Safari、実機ブラウザ、NEW GAMEから第1章／第2章全日の通しプレイは未確認。仕上がりはオーナーレビュー待ち。

今回の再現：ブラウザ依存は`remake/test/browser`で`npm ci`と`npx playwright install --with-deps chromium`。previewを8123で起動し、`TEST_REF`に検査対象SHA、`ARTIFACT_DIR`に結果の出力先、`COMPARISON_DIR`に途中画面の出力先を設定。`play_spots.mjs`・`hiyori_axe_story.mjs`・`trpg_main.mjs`・`venue_hours.mjs`を実行。モデルのコマンドは[current-unit-results.json](current-unit-results.json)。VM検査には`--experimental-vm-modules`が必要。

## 過去の実行メモ（今回の結果とは別）

以下の`source.json`・旧結果・旧スクリーンショットは当時のコミットの記録として保持し、新しいheadの検証済み結果に転用しない。旧#524待機記述は統合済みのため無効。

### 過去に確認したこと

- `play_spots.mjs`: 最終11項目PASS。PCの10投／横持ちタッチの3投、未面識キャラが出ないソロ表示、完走時だけ料金・体力・根性1P・1行動、再来店は記録閲覧のみ、手動SAVE→再読込→LOAD、無料取消、残高不足、体力0、二重起動、別セーブ・pagehide・画面撤去の取消。第2章の両街の配置、部活設立と帰還、本の購入・二人卓・結末と夜1枠の同時保存、翌朝へ進んでも二重消費なし、章制限・本棚表示中のLOADも確認した。結果: `browser-results.json`（ゲーム・保存処理の `486366a5`）。その後の章内日表示だけの修正 `ea90dab7` はPC／タッチの街・設立2項目を再確認し、`chapter-date-results.json` に保存。通算16→章内2／旧記録3→3の表示と保存日が変わらないことを追加確認した。
- `hiyori_axe_story.mjs`: 既存イベント11項目PASS。前後の会話・実3投・中断・旧保存・友情／恋人・料金・LIME・既読状態を保持。結果: `hiyori-results.json`。
- 斧のモデル16項目、TRPGの物語・部活モデル23項目PASS。TRPG旧schemaの自動／手動保存移行、章境界、日常、LIME、休養の各既存検査もPASS。
- 編集した台本のlintはERROR 0／WARN 0。6625本文の組版、agent docs、Git Safety、diff checkはPASS。TRPG静的書出し40ファイルも成功し、追加した時計モジュールを含む。整形dry-runは範囲外の既存oneesan本文1行だけを検出し、変更していない。

実行はChromium、タッチは844×390のブラウザエミュレーション。独立した日常保存fixtureからの実クリック・実投擲・実TRPGであり、新規開始から第1章全日を遊び終えた検証ではない。実機Safariは未確認。対戦モードと店ロゴ制作は #489 / #540 の別残作業。

### 過去の画面

- [PCの斧記録](axe-record-pc.png) / [タッチの斧記録](axe-record-touch.png)
- [隣町のピン・PC](cafe-map-pc.png) / [タッチ](cafe-map-touch.png)
- [カフェの部活設立・PC](cafe-club-pc.png) / [タッチ](cafe-club-touch.png)

既存の専用斧投げ背景・的・投擲、カフェ画像、TRPG背景と人物素材を再利用。新規画像生成は行っていない。

### 過去の初回失敗と修正

初回のレイアウト検査は、ピンの枠外装飾・祖先が非表示のボタンまで対象にしていた。画面で実物を確認し、表示中のボタンと実際のラベルを検査するよう修正。画面の生成前に測定していた箇所には準備待ちを追加した。

完走後のLOAD検査ではDAY5のfixtureに未読の必須つむぎ会話が残っており、本編の旧保存救済が正しく始まった。過去の必須会話を読了したfixtureに修正し、同じSAVE/LOAD操作を再実行してPASS。失敗ログ `initial-fixture-failures.json` も保存した。

既存VMの依存解決に合わせ、スポットの定義を副作用のない `axe-bar-data.js` へ分離し、ゲーム本体は来店時に読む。CIで休養VMの定義一覧への追加漏れを検出したため登録し、既存の休養・延期・料金検査をローカルで再実行してPASS。CIの最終head状況はPR Checksで追跡する。

### 過去の再現コマンド

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/play_spots.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/hiyori_axe_story.mjs
node --test remake/test/axe_throw.mjs remake/test/trpg.mjs remake/test/trpg_campaign.mjs
node --experimental-vm-modules remake/test/trpg_campaign_save.mjs
node --experimental-vm-modules remake/test/illness.mjs
```

## 再引き継ぎのレビューと操作動画

ソース `651efca68d7b8c98f337cb8bbe9d97332e8dc8cc` を正式transfer38566024845／そのrun指定status38566190607の成功後に確認。ゲーム・素材・台詞・テストのassertionは変更していない。`f323c037`とassets/data/remakeのtreeも一致。旧18画面を再利用し、不足する操作動画のみ追加した。

同headでモデル41/41、旧schema13/14のauto/manual・schema15・不正旧保存43種、昼夜モデル20assertがPASS。本編接続は[初回20ケース中19PASS/1FAIL](handoff-browser-initial.json)。失敗は本編操作前のpage.gotoの10秒上限で、[初回画面](handoff-initial-load-timeout.png)とログを保持。同じhead・同じassertion・既存CASE_FILTERで[失敗1ケースのみ再実行してPASS](handoff-browser-retry.json)。初回を20/20成功へ書き換えていない。[昼夜ブラウザ10/10](handoff-hours.json)も再実行してPASS。

| 操作動画（無音・2倍速） | PC | 横持ちタッチ |
| --- | --- | --- |
| 斧3投・結果・保存と帰還 | [3投](handoff-videos/pc-axe-3.mp4) | [3投](handoff-videos/touch-axe-3.mp4) |
| 斧10投・結果・保存と帰還 | [10投](handoff-videos/pc-axe-10.mp4) | [10投](handoff-videos/touch-axe-10.mp4) |
| 第1短編・購入・結末・保存 | [第1短編](handoff-videos/pc-trpg-ordinary.mp4) | [第1短編](handoff-videos/touch-trpg-ordinary.mp4) |
| 承認DAY8・第2短編・結末・LOAD | [第2短編](handoff-videos/pc-trpg-day8-shark.mp4) | [第2短編](handoff-videos/touch-trpg-day8-shark.mp4) |

[検証と動画原本/配布MP4のhash・対象tree](handoff-review.json)。動画は既存の本編操作テストを実行したブラウザから記録し、新しいゲーム進行は実装していない。復旧・旧保存・消費条件のassertionも維持。録画のみを加える[補助](record-video.cjs)はルートでNODE_OPTIONS=--require=./docs/qa/play-spots/record-video.cjs、CAPTURE_DIRに出力先を指定して既存play_spots.mjsを実行する。

最初の録画実行はPlaywrightのFFmpeg未導入によりゲーム検査前に停止。固定依存のFFmpegを導入してから上記を実行した。一般のゲームコードやテスト期待値を変えた対処ではない。

元workerの別環境の現在の未保存・未追跡・未push差分はアクセスできず未確認。停止は所有者申告を根拠とする。同一チャットの複数タスク保持は所有者の今回限りの明示例外であり、タスク別ID・別ブランチ・別PRのまま順番に検証する。実機Safari・全章手動通し・DSとの統合QAは未実施。Draft・予約を維持し、マージ・公開・Issue終了は行わない。
