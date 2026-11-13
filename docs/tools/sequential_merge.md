> **注意（2026-10-30）**: 本ツールは任意の試作で、必須手順ではない（`AGENTS.md`）。本文の claim／worker／予約・引き継ぎに関する記述は、2026-10-23に撤廃したIssue予約の時代の設計で、現在の運用には使わない。

# 順次マージ連携の読み取り専用preflight（Issue #423）

この段階ではGitHubの証拠を収集し、純粋関数で判定する。実マージAPI、auto-merge、branch更新、レビュー投稿、CI再実行、claim操作、保護・権限・secret変更は実装しない。Issue #423の実マージ連携・専用一時PRでの実地検証は未完了のまま残す。

## 初期状態と結果

`tools/sequential_merge/policy.json` は `approved: false`、CIルール・reviewer許可リスト・記録権限者リストは空。CI範囲とサーバー保護方針も未承認であり、実データの結果は `BLOCKED` になる。設定が空のときに、現在見えている緑色チェックやレビュー投稿者を自動採用しない。

`evaluate(snapshot, policy, now)` は入力を変更せず、次を返す。

| フィールド | 意味 |
| --- | --- |
| `status` | `BLOCKED` または仮想的に全証拠が揃った `READY_FOR_RECHECK` |
| `executionEnabled` | 常に `false` |
| `expectedHead` / `validatedBase` | 判定した対象HEADとmain SHA |
| `applicableJobs` | 変更パスに適用されたworkflow pathとjob名 |
| `reasons` | 拒否理由のコード一覧。取得失敗・未設定・不明も含む |

`READY_FOR_RECHECK` は証拠の整合性を表す。マージの許可や現在のGitHub状態の証明にはならない。fixture中の設定・人物ID・証拠はすべて架空で、実リポジトリへの承認ではない。

## 証拠の収集

`collect.mjs` の `githubReader` はRESTのGETと固定の読み取り専用GraphQL queryだけを公開する。収集対象はPR、main、変更パス（rename元も判定）、mainからHEADへの比較、checks、statuses、reviews、全review threads、Issue comments、workflow runs/jobs、設定済みworkflowのmain/HEAD blob、全Open PRと変更パス、保護設定・rulesets。main/PRは最後に再取得し、他PRの変更パスも取得後のHEAD/件数と照合する。

ページ取得はRESTの全ページとGraphQL cursorをたどる。ページ失敗、総数不一致、cursor反復、取得上限、権限不足は `errors` と `complete` に記録し、空集合として成功扱いしない。最大10ページ/collection、30 runs、30 Open PR、160 requests、受信JSON約4 MiBを上限とする。容量は応答受信後に確認するため最後の1応答分は超過しうる。上限超過時に追加ページや素材を取得して補わず拒否する。収集結果の鮮度上限は最大300秒。

保留・依存・担当・実行主体に対するサーバー側強制・権限について、承認済みの記録形式とデコーダーはまだない。収集器は `attestations: {}` を返し、コメントや `protected: true` を勝手にこれらの証拠へ変換しない。生のprotection/rulesets取得に成功しても自動マージ安全とは判定しない。

## CIの適用範囲と出所

CIは承認済みmanifest `ciRules` から判定する。各ruleには `workflowId`、main上の `workflowPath`、必要なjobの正確な表示名配列 `jobs`、変更パスの `include` / `exclude` が必要。未設定のまま自動生成しない。manifest自体を読むコード・設定のmain SHA (`policyBase`) と収集したmain SHAが違えば拒否する。

globは `*`（同一階層）、`**`（階層をまたぐ）、`?` のみ。先頭否定、文字クラス、brace、YAML triggerの自動解釈は未対応として拒否する。少なくとも1個のjobが適用され、変更パスの全件（rename元も）がruleに覆われなければ拒否する。GitHubのpath filterやjob名・matrix名との対応は承認時に明示する。

適用ruleごとに、main/HEADのworkflow blobが同一、workflowがactive、workflow ID/pathが一致、runのrepo/event/PR番号/HEAD/baseが一致し、全jobが同じrun attemptで成功していることを確認する。必要jobは `check_run_url` のIDから同じHEAD・job名・許可App IDのcheckへ結び付ける。同じ名前だけの別Appのチェック、別repo/run、HEADで書き換えたworkflowは代用できない。現在は `pull_request` eventのみ対応し、未知のevent、外部CI、fork、可変job名は拒否する。

取得したcheckは全件 `completed/success`、statusは全件 `success` が必要。必須チェック0件、missing、pending、cancelled、neutral、skipped、unknownも拒否する。過去の失敗attemptが同じHEADの取得結果に残る場合も保守的に拒否する。集約バッジや最後の成功だけへ縮約しない。

HEADが最新mainを祖先として含むことに加え、runが報告するPR baseも一致させる。APIのrun metadataだけでは、任意のworkflowが実際にどのtreeをテストしたかを証明できない。workflow内容・checkout先・job範囲の信頼を確立する承認が別途必要であり、HEAD/baseの結合が確立できないCIを安全と推測しない。

## レビュー・保留・依存・担当

独立レビューは、許可されたGitHub数値ID/typeの `User` による対象HEADの `APPROVED` が少なくとも1件必要。同一GitHubアカウントを別チャットが使ったことを独立性の根拠にしない。PR作者、実行主体、担当記録中の参加者は除外する。最新の判定レビューをID順に扱い、`COMMENTED` で `CHANGES_REQUESTED` を消さない。未dismissの変更要求、古いHEADの承認、pending、未知のレビュー状態、未解決threadは拒否する。

純粋判定関数が受け取る `attestations` は将来の承認済みデコーダー用の境界で、現在はfixtureのみが供給する。各記録は `head/base/observedAt/recordId/authorId` を持ち、許可された権限者と鮮度に一致する必要がある。

- `blockers`: `hold: false`、`unresolvedFindings: 0`、`dependenciesComplete: true`。
- `ownership`: 空でないowner、全参加GitHub ID、空のconflicts。Open PRの変更パス重複も別途拒否する。未pushの別workerの作業はAPIだけでは分からず、正式記録が必要。
- `enforcement`: `enforced/strictBase/scopeComplete: true`、`bypassPossible: false`。
- `permission`: 当該actor ID、`mergeAllowed: true`、`bypass: false`。

JSON内の `authorId` やbool自体には認証能力がない。生のコメント、PR入力、任意のJSONをそのままこの証拠として信頼してはいけない。実データから正規記録の作成者・scope・最新状態を検証するデコーダー、許可主体、記録形式の承認が完了するまでは欠落として停止する。

## 読み取り専用workflowとテスト

専用 `.github/workflows/sequential-merge.yml` は関連PR/pushでfixtureテストを実行する。main上の `workflow_dispatch` のみdry-runを行う。checkoutはdispatch時のmain SHAで固定し、候補PRのコードは実行しない。ユーザー入力はPR番号のみで、shellへ展開しない。権限は `contents: read` のみ。追加のread権限も自動付与せず、現tokenで取得できない証拠は失敗として残す。

dry-runのsummaryにはSHA・理由コードを出し、`BLOCKED` ではjobも失敗にする。テストjobの成功は架空fixtureの契約確認であり、実PRのマージ可能性を意味しない。Dispatchはworkflowがmainへ入った後、通常の運用判断で行う。この実装作業では実データdispatch・マージ試験を実施しない。

```sh
node --test tools/sequential_merge/test.mjs
actionlint .github/workflows/sequential-merge.yml
```

テストは実際の判定関数・収集器・dry-run entry point・オフライン逐次処理を呼ぶ。0件/missing/stale/cancelled/偽装App/別workflow/HEAD-base race/ページ失敗/依存/保留/担当衝突/レビュー主体/保護不足を拒否する反例を含む。ネットワークやGitHub設定を変更せず、パッケージ追加も不要。

`simulateSequence` は渡されたfixture snapshotと架空のmerge結果だけを消費する。API adapterやcallbackを受け取らず、ネットワーク経路を持たない。各PRの二重取得を判定し、架空のexpectedHead付き要求を記録、main更新後は次PRを新baseで再検証する。失敗や古いbaseで直ちに停止する。

## 有効化前に決める5項目

1. 必須CIの正確なworkflow/job/App、変更パスへの適用範囲、実際にテストするHEAD/baseとcheckout先。
2. 独立reviewerの許可主体・記録・除外条件。
3. 正式な保留・依存・未解決指摘・担当競合の記録形式と権限者、最新記録を認証するデコーダー。
4. 実行主体にも適用されるstrict checks/reviews/queue・bypass不可の強制条件と検証手段。main保護なし/不明は停止。
5. 専用一時PR・実行権限・実マージ試験・有効化の明示承認。live adapterは別レビューが必要。

expected headをmerge APIへ渡してもmainの比較更新にはならない。クライアント側の直前再取得とmergeの間には競合窓が残る。現リポジトリで強制される保護/queueがない不足を、シミュレーション成功やpreflight成功で解消したことにしない。現段階の実装でIssue #423を完了扱いにしない。
