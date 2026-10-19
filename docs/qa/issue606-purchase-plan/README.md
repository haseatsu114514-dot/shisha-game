# #606: 大会前の必須購入の到達

基準main: `4834e9eccb54d7aff466cac03bf784b5227e5735`。

## 実際の失敗と成功の比較

- #604 merge `a6cc6c99` の[direct job](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38858816039/job/116836207007) は、2026-10-16 06:11:31 UTCに章クリア後の `Missing practice/shopping` / exit 1。準備blueberryと練習3件は成立し、所持lemonなし。lemonの計画・購入ログはともに0件。
- workflow全体のconcurrency取消は06:11:39 UTC。この実assert失敗は取消前で、取消だけとは扱えない。同runのstreetは実購入と最終PASSを記録。
- #603 merge `4834e9ec` の[direct job](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38859817680/job/116839346245) と[street job](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38859817680/job/116839346161) は両方PASS。driverは失敗版と同一blob `26c6d77cf0cfdf0ef0e5f50094ddf732e55bec82`。成功だけで原因解決とは扱わない。
- [失敗direct抜粋](a6-direct.excerpt.log) / [同runのstreet抜粋](a6-street.excerpt.log) / [後続main direct抜粋](4834-direct.excerpt.log) / [後続main street抜粋](4834-street.excerpt.log)。

## 原因と再現範囲

必須の `shop:lemon` が、時間を使う通常PLANのindex19に依存していた。DAY12の最初の自由マップでindex16なら、健康時は「休養→なる→ジム→時間を使わない購入」がDAY13までに収まる。初回発病でDAY12の昼を失うと「休養→なる→ジム」で残り3枠を使い、大会が先に始まる。購入ハンドラへ入らないので、#604の購入後の成否確認だけでは救えない。

発病は `core/illness.js` の `Math.random` を使い、driverのweather/state/reelの固定seedとは別。実calendar/stats/illnessモジュールを使った隔離診断で、DAY11夜の仕事＋自主練に相当する消耗後の24/100から、健康ならDAY12 slot0・体力38、初回発病ならslot1・体力60となることを確認した。仕事とUIはmock、乱数はこの隔離診断だけで境界値を与えた。[診断結果](illness-slot-reproduction.json)。通常の通し検証の乱数・ゲーム状態は変更していない。

再現コマンド: `node --experimental-vm-modules --no-warnings docs/qa/issue606-purchase-plan/illness-slot-reproduction.mjs`。[診断コード](illness-slot-reproduction.mjs)は実calendarを読み、発病時に昼枠がなく夜枠が残ることもassertする。

旧CIの発病フラグは記録されていないため、そのrunの抽選値・発病自体の直接観測とは区別する。DAY12朝まで同じ体力推移から、失敗側はDAY13に体力100・支出なし、成功側は体力91・3,000円支出となる観測に一致する再現経路である。確定した欠陥は、実際に起こり得る半日遅延だけで必須購入が到達不能になる計画構造。

[旧PLANの枠再現](legacy-plan-reproduction.json)と[修正前の回帰テスト失敗](legacy-scheduler-red.log)では、健康ケースは成功し、半日遅延ケースだけlemon未購入・planIdx19でDAY14に到達した。

## 修正

- 時間を使う行動は同じ順番の[PLAN](../../../remake/test/playthrough-plan.mjs)に保持し、lemon購入を独立させる。
- 実際の中間準備完了後の最初の自由マップで、通常行動・追加休養より先に購入する。中間準備が選ぶ葉や既存の仕入れ導線へ先回りしない。
- 所有済みというだけで購入完了にしない。[既存の購入確認](../../../remake/test/playthrough-shopping.mjs)が50g増分・正規価格支払・所有・空cartを確認した時だけdriver内の完了記録を更新し、通常PLANの位置は進めない。失敗時は従来通り停止する。
- 既存の最終assertは保持し、実購入の完了記録も追加検査。日・slot・planIdx・次行動・中間準備・休養/発病状態をログへ追加する。
- runtime・共有データ・乱数・料金・報酬には変更なし。既存の初期seed・ターボ/ミニゲームauto以外に、通し検証で資金・在庫・進行を注入しない。

## 検証

- 旧計画の健康ケースPASS／半日遅延ケースFAILを確認後に修正。
- Node回帰: 新6件＋既存購入失敗/状態確認9件、計15件PASS。
- driver・計画module構文、diff check PASS。
- 文書チェックPASS。sparse checkoutで除外されていた公開参照18件（既存symlinkを含む）をHEADから内容不変で補った。変更差分には含まない。
- 新規workflowのYAML構文・read-only権限をRuby標準YAMLで確認。actionlintは未導入で、GitHubでの実実行結果とは分ける。
- 通常direct/streetを新規ゲームから並行実行し、両方exit0・最終PASS。2026-10-16 06:43:36〜06:53:24 UTC（15:43〜15:53 JST）、Mac Node24.13.0 / Playwright1.62.1 / Chromium151.0.7922.34。controllerは自分のpreview・Node・browserプロセスだけを終了した。
- 両方DAY8夜・通常PLAN index9のまま、lemon在庫0→50g、所持69,950→68,400円（1,550円）、所有・空cart・購入完了を観測。中間準備の葉はblueberryのまま。DAY14で既存の敗北→再挑戦→優勝、セーブ/ロード、練習・準備・在庫・演出・成長の最終assertも通過。
- driver・計画module・既存購入確認helperの検証前後SHA256は不変。[通し結果とreceipt](browser-results.json) / [direct全進行ログ](direct.log) / [street全進行ログ](street.log)。
- [ソース不変条件](source-invariants.json): 元の最終assert部分は追加の実購入assertを除いてbyte単位で同一。時間を使うPLANの全項目と順序、既存購入確認helperも保持。runtime・data・assetsの変更なし。

WORKER: `codex-purchase-plan-20261016-01a13c6a`。
CLAIM: [38860889733](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38860889733) SUCCESS、最新bot owner/run一致を確認して着手。
元#582の完了成果・#594のBセッション・他Open PRのブランチは変更していない。
