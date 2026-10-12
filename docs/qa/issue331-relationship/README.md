# Issue 331: 表示修正と新規プレイ実測の引き継ぎ

2026-10-12、ユーザーの「今できてるとこまでにして、別のCodexがやる」により停止。PR 414はDraft。Issue全体は未完・open。worker `codex-priority-20261012-01a12f11`、claim run `38222243024` SUCCESS。

## 保存した変更

- `remake/js/daily/status.js`: `affinityLevel()`を使い、恋人の通常ハートを♥5固定。「恋人　絆」を「恋人」に変更。内部Lvを画面とaria-labelに出さない。
- `remake/js/core/ui.js`: BOND通知の内部Lvを削除し、内部ポイントの進捗をハート充填で見せず5個満タンへ。非恋人の好感度・能力通知は維持。
- `remake/test/browser/lover_hidden_growth.mjs`: PC/タッチの表示・旧セーブ・私的成長・MAX後・節目報酬・複数恋人/修羅場。CIへ追加。
- `remake/test/relationship_pace.mjs`: 新規ゲームの通常UIから到達日とイベントを計測するスクリプト。

`stats.js`、`bonds.js`、`romance.js`、LIME/calendar/map、台詞・設定・報酬・スキーマは変更しない。♥3ゲートと15点救済は再制作しない。新しい日数・倍率・回数・関係ゲートは採用していない。

先行PR 413と、他workerのタイトル選別PR 387を含むmainをmerge済み。競合はCIへのテスト追加1箇所だけで、両方のテストを残した。PR 414のmainとの差分にタイトル選別の制作を混ぜない。

## 検証済み

表示/保存/成長/節目/修羅場の新規6ケースPASS。[結果](hidden-growth-results.json)。既存`affinity_gates.mjs`の10ケースPASS。[結果](affinity-gates-results.json)。通常の好感度通知の回帰もPASS。[ログ](affinity-notifications.txt)。[PC STATUS](screenshots/pc-status.png)、[タッチ STATUS](screenshots/touch-status.png)、[PC BOND UP](screenshots/pc-bond-up.png)、[タッチ BOND UP](screenshots/touch-bond-up.png)を目視確認済み。

PCは1280×720、スマホ横持ちはChromiumの844×390タッチエミュレーション。実機スマホは未検証。表示/旧セーブ等のケースは準備した状態からのAPI・UI回帰で、新規プレイとは区別する。

### 新規プレイ8ルートの観測

| 操作ルート | 初対面 | ♥3 | ♥4 | ♥5 | フィナーレ | 交際 |
| --- | --- | --- | --- | --- | --- | --- |
| つむぎ・毎日訪問/即返信 PC | 1 | 4 | 5 | 7 | 8 | 8 |
| みんと・毎日訪問/即返信 タッチ | 2 | 4 | 10 | 12 | 13 | 13 |
| 凛・毎日訪問/即返信 PC | 3 | 7 | 12 | 未到達 | 未到達 | 未到達 |
| つむぎ・友情 タッチ | 1 | 4 | 5 | 7 | 8（友情） | なし |
| つむぎ・告白保留 PC | 1 | 4 | 5 | 7 | 8 | 10 |
| 凛・通常UIで占いを購入 PC | 3 | 6 | 10 | 13 | 未到達 | 未到達 |
| つむぎ・隔日訪問/即返信 PC | 1 | 6 | 8 | 12 | 未到達 | 未到達 |
| 凛・通常UIでジム育成 PC | 3 | 7 | 12 | 未到達 | 未到達 | 未到達 |

値はゲーム内DAY。未到達はDAY14大会開始まで。つむぎはDAY5に♥3質問、DAY5に既存外出、DAY6/7に後半の固有会話、DAY8に締めくくりと同日夜の告白。みんとはDAY5買い出し、DAY10本名と♥3質問、DAY11私的交流、DAY13フィナーレと同日夜の告白。友情では恋人0・贈り物を維持。保留ではDAY8のwaitからDAY10にgoへ進んだ。

日付・好感度・既読・恋人・seedを注入せず、NEW GAMEからマップ/店舗/LIMEを操作。会話はテスト用turbo（実台本と選択処理を通す）、ミニゲームは`craftTest.auto="good"`で加速する。従って人間が実際に読む所要時間や手動ミニゲームの技能の評価ではない。通常ペースの代表として隔日訪問を使い、平均的なプレイヤー全員のペースとは断定しない。

スロットの乱数・魅力・天候は新規ゲームのまま記録。みんとの試行では魅力が48まで育った。凛の通常試行は魅力10、ジム試行は34。乱数も異なるので差を魅力だけの因果効果と断定しない。**これらは試した操作計画の観測値で、全選択・全乱数を探索した数学的な最短日数ではない。** [各ルートの行動・イベント・選択・保存状態](measurements/)を参照。

再現: プレビューサーバーを起動し、Playwrightを`remake/test/browser`へ`npm ci`。`CHROME_EXECUTABLE_PATH`と必要なら`BASE_URL`を指定。

```sh
node remake/test/browser/lover_hidden_growth.mjs
node remake/test/browser/affinity_gates.mjs
node remake/test/affinity_notifications.mjs
PACE_TARGET=tsumugi PACE_MODE=fast node remake/test/relationship_pace.mjs
PACE_TARGET=minto PACE_MODE=fast PACE_TOUCH=1 node remake/test/relationship_pace.mjs
PACE_TARGET=rin PACE_MODE=fortune node remake/test/relationship_pace.mjs
```

PACE_MODEは`fast/usual/friend/hold/boost/fortune`。計測スクリプトは長いためCIに追加していない。結果は`.codex/artifacts/relationship-pace/`。凛の出張日に卸の買い物ピンを「凛に会える」と誤認しないよう、既存`RIN_AWAY_DAY`を参照する（ゲーム側の変更なし）。

## 未完・失敗を隠さない

- 古い`bonds.mjs`は99行で`3 !== 5`。無回答のまま♥5まで上げる期待値で、現行♥3ゲートと不一致。修正前の公開mainでも同じ失敗を再現。[ローカル](legacy-bonds-local.txt) / [公開main](legacy-bonds-public.txt)。本件の表示修正による新規不具合とは確認されていない。テストは未修正。
- `minto_progression.mjs`は31行のevaluate内で招待がundefinedとなり`accept_event`読取が失敗。[ログ](legacy-minto-local.txt)。原因・公開mainでの同症状の切り分けは**未実施**。新規UIの実測ではみんとの交際DAY13が通っているが、この旧テスト失敗をPASSと書かない。
- 初期headのMotion endingsはチェキのmarker判定で失敗。main merge後のhead `8d90810f`は同チェックPASS。最終headの全CIは次の担当が再確認する。
- 表示修正の公開版検証、最終レビュー、Ready化、安全なsquash merge、Pages確認は未完。PR 414をDraftのまま渡す。表示だけでIssue 331全体を閉じない。

## 速度調整の候補（未採用）

全員に同じ日数・倍率を足すと、既に遅い凛や隔日訪問の進行を止める。つむぎは既存の6固有会話・♥3質問・外出を読んでもDAY8交際となる。まず「この密度でDAY8が早すぎるか」をオーナーの意図に照らして判断する。

候補は、つむぎの既存応募場面`ch1_tsumugi_sketch`/`_tsumugi_contest_submitted`の実読了を関係の意味ある節目に使う案、またはフィナーレ後に既存の私的交流を一度選べる導線を再利用する案。後者は外出済みのセーブに再招待がなく進行不能になり得るため、単純にフラグ必須化しない。DAY13のみんとの同夜告白を一律に遅らせると大会を越え、現行の受入テストとも衝突する。**どの場面をゲートに採用するかは未確定で、コードへ反映していない。**

旧セーブの恋人・絆・既読・専用ハガルを減らさず、未読を推測で完了扱いにしない。第2章以降が未接続なので章跨ぎ実プレイは未確認。ひより等の別worker/別Issueは触らない。
