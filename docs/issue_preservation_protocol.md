# PRがない成果の保全と正式移管

## この段階の実装範囲

この実装は、非ownerによる保全操作の契約、APIをmockした検証、読み取り専用の
`check` を用意する段階である。本番の停止・再書込み防止を検証する実行基盤は
未接続のため、本番の保全操作は稼働していない。対応する証拠を検証できない
場合は `UNSUPPORTED_FENCING` で失敗し、branch、commit、PR、予約を書き換えない。
成功した読取りやテストも、保存・移管・実装再開の許可にはならない。

この最小実装で表現できる成果は、合計1 MiB以下・10ファイル以下のUTF-8テキストの
新規追加だけであり、各ファイルは1 byte以上を必要とする。空ファイルは未対応である。
既存trackedファイルの修正・削除、バイナリ、`.github/`、
`.git/`、私的パス等は対象外とし、拒否する。対象外の成果が存在する場合に、
対応できる部分だけを保存して「全成果保全済み」としてはならない。

対象は、旧担当が停止し、成果は残っているが参照Open PRがないため、既存の
`transfer` に進めない場合である。新しい「PRなしtransfer」は追加しない。
正式導入する保全操作で専用recovery branchとDraft PRを作り、その保存内容を
検証してから、[既存の引継ぎ・transfer](issue_claim_protocol.md#recorded-handoff-of-saved-open-prs)
へ接続する。保全段階では旧ownerの予約を維持し、統合修正や実装の続行を行わない。

この文書は、現行規約ですでに非ownerの保存が認められていたという解釈ではない。
実際の運用を有効にする前に、保全実行者・既存権限・実行基盤・承認・監査を
正式に導入する必要がある。#594への適用は、証拠提示後のユーザーの最終確認まで
禁止する。#594の保存済み3ファイル・旧owner・予約にはこの実装で触れない。

## 成果と証拠の境界

- Macのパッチやローカル3ファイルは `local_only` の成果である。保存先と完全性を
  記録しても、それだけで `pushed:true` や全成果保存済みと認定しない。
- 未commit・未pushの変更、生成物、子実行の成果を含め、全成果を棚卸しする。
  不明・欠落・manifest不一致があれば保全・移管を許可しない。
- 元実行と関連子実行の停止、残存writerの停止、利用制限解除後も再開・書込みを
  拒否する実効的な制御が必要である。無応答、期限切れ、利用制限表示、古い
  `completed` 表示を、その証拠にしない。
- worker名、実行世代、`stopped:true` 等の自己申告だけでは、共有資格情報を使う
  旧実行の直接pushを防げない。実行基盤の信頼できる証拠と制御を検証する。
  基盤が未対応なら、保全済み成果を保持して移管を拒否する。
- テスト結果は実行コマンド、結果、検証対象の完全commit SHAと一緒に記録する。
  過去の41件PASSを、最新main上での統合・再テストの成功と扱わない。

## 読み取り専用check

CLIは既存のread権限だけを使い、指定Issue上の承認コメントと現在の予約を読む。
承認本文は完全なUTF-8バイト列のSHA-256で固定する。保全実行者は認証済みの
実行コンテキストから渡し、承認JSONの自己指定を実行者の証明にしない。

保全実行者は承認コメントの作者本人に限定する（`actor == approval.user.login`）。
双方の既存write以上の権限を検証し、他のwriterへ暗黙に委任しない。承認作者が
元claim runの実行者と異なる場合は、既存復旧条件に従うadminとしての独立確認と
証拠を必要とする。権限だけで停止・全成果保全・再書込み防止を認定しない。

```sh
PRESERVATION_ACTOR='<authenticated-login>' \
  node tools/issue_preservation.cjs check \
    --issue '<issue-number>' \
    --approval-comment '<approval-comment-id>' \
    --approval-sha256 '<64-character-lowercase-sha256>'
```

`GH_TOKEN` には、現在の正規の実行環境が提供する既存tokenを使う。資格情報を
Issueへ書いたり、別tokenを探したり、権限設定を変更したりしない。本番CLIには
保存を開始する `publish` 操作を公開しない。libraryの保存経路へのadapter注入は
テストと将来の信頼境界のためのもので、任意のadapterによる本番証拠の代用を
許可するものではない。

承認コメントは次の1行markerにmanifest JSONを含める。コメント全体のSHA-256を
CLIで指定するため、marker以外の説明文の編集も検出対象になる。

```text
<!-- issue-preservation:v1 {manifest JSON} -->
```

| manifestのフィールド | 内容 |
| --- | --- |
| `schema` | `issue-preservation/v1` |
| `request_id` | 個別救済を識別するUUID |
| `issue` | 対象Issueの整数番号 |
| `from` / `to` | 旧worker / 明示した移管先worker |
| `claim_run` | 成功した現予約runのID文字列 |
| `claim_comment` | 現予約のbot台帳コメントID |
| `base` | 保存branchの親にする40桁の完全commit SHA。各検証境界で最新mainとの一致が必須 |
| `files` | `{path, bytes, sha256}` の全成果manifest |
| `evidence` | `stopped` / `inventory` / `fenced` の証拠URL |

証拠URLの存在は、停止・全成果の棚卸し・再書込み防止の証明にはならない。
信頼するruntime adapterがmanifestとdigestに対して証拠・有効性を検証する必要が
ある。本番checkにはそのadapterが接続されていないため、URLを入力しただけで
チェックに成功したり、保全操作が有効になったりしない。

`base` は過去の任意commitを指定する欄ではない。checkと将来の保存操作は、
各検証境界で最新mainと `base` が一致することを要求する。mainが移動した場合は
`MAIN_CHANGED` で停止し、保存済み成果と現予約を保持する。新しいbaseでの衝突・
依存・テスト対象を再評価し、manifestと、そのmanifestに対する明示的な保全承認を
更新してから再開する。baseや承認digestを自動で差し替えない。これは保全要求の
対象を更新する手続きであり、既に承認された実装内容の再承認を求めるものではない。

libraryの契約では `envelope = {approval_comment, approval_sha256, manifest}` と、
`payload = [{path, content}]` を別に渡す。`content` は正規のBase64であり、復号後の
長さとSHA-256をmanifestに照合する。専用branch名は
`codex/recovery/issue-<issue>/<request_id>` に固定する。これはテスト可能な保存契約で
あり、この段階で人が独自adapterを注入して本番保存するための手順ではない。

手動workflow **Issue preservation preflight (read only)** の入力は次の3項目である。

| 入力 | 内容 |
| --- | --- |
| `issue` | 対象Issue番号 |
| `approval_comment` | 同じIssue上の明示的な保全承認コメントID |
| `approval_sha256` | コメント本文全体のUTF-8バイト列のSHA-256 |

workflowは `contents/issues/actions/pull-requests: read` のみを要求する。保存用の
write権限を追加せず、既存coordinatorの実装・権限・ガードを変更しない。読取りの
checkは独立したconcurrency groupを使い、本番予約のpending runを置換しない。
将来の書込み経路は正式な排他・直前再検証へ接続するまで有効にしない。

着手前に、現在の環境がworkflowを起動できるか、公式に提供された機能・権限を
確認する。CLIの存在やGET成功だけをdispatch可能の証明にしない。起動できない
場合は、実際に拒否された操作、HTTP状態・公開可能な理由、上記の正確な入力を
報告する。未確認の権限不足理由を推測せず、403等を別資格情報や未承認経路で
回避しない。checkを依頼しても予約・保存が完了したとは扱わない。

## 将来の保全操作を有効にする条件

1. 明示承認を、対象Issue、期待する旧owner/run/台帳コメント、新worker、保全実行者、
   base、専用保存先、全成果manifestと証拠に結び付ける。変更・撤回した承認は拒否する。
2. 元実行の停止と実効的な再書込み防止を、信頼する実行基盤で検証する。
   全成果の棚卸しとmanifestの検証を行う。
3. 許可するmutationは、新規専用recovery branch、承認manifestと完全一致する
   バイト列のcommit、対象Issueを参照するDraft PRの作成に限定する。main、既存ref、
   他Issue、権限設定を書き換えず、既存branchを上書きしない。
4. 各書込み境界で台帳・承認・head・証拠を再検証する。commitは期待するbranch headを
   指定する。mainと承認baseが異なれば停止し、再評価・保全承認更新なしに続行しない。
   結果不明時は既存保存先を読取り照合し、重複commit/PRを発行しない。
5. 完全commit SHA、親、変更パス、Git blob、全成果manifestとremoteの読戻しを照合する。
   保存base、過去のテスト対象SHAとの差異、テスト範囲、未検証事項をDraft PRへ記す。
6. 全成果のリモート保全を確認後に、既存条件に従う正式handoffとtransferを行う。
   元claim実行者の記録、または現行の管理者復旧条件を必要とする。管理者権限だけで
   停止・成果保全・再書込み防止の証拠を代用しない。
7. そのtransfer runの成功と、最新bot台帳のIssue・新owner・新runを一度照合する。
   状態変化・後日の再開では再確認する。移管後に最新mainへ統合し、必要なテストを行う。

すでに承認された実装内容を再承認する依頼ではない。必要なのは保全例外の正式導入、
具体的な救済操作の明示承認、既存transferの承認記録である。workflowのwrite権限や
新しい資格情報を必要とする設計変更は、既存権限で済む変更として黙って導入しない。

## 監査・失敗・他作業との境界

監査には救済要求ID、承認参照、旧新worker、元runと新run、期待台帳、証拠参照、
manifest、保存先と完全SHA、未保存変更、テスト対象SHA、残作業と保留条件を残す。
公開出力へ私的チャットID、Macパス、資格情報、非公開の会話を含めない。非公開の
停止証拠等はアクセスを限定した保管先へ分ける。

拒否・不明・途中中断では、既存予約と保存済み成果を維持し、releaseや削除を
自動実行しない。transferの台帳更新後にrunが失敗した場合も、現台帳を保全して
開始を拒否する。古いマージPR、無言、期限切れだけで予約解除しない。

PR #605のコメント予約・park/resume・完了整理は別作業であり、この実装から
未マージの機能を現行手順として使わない。#613にも着手しない。

回帰確認は新しい保全契約と既存予約ガードの両方を実行する。APIはmockし、本番の
#594を破壊的な試験や保存操作の試行に使わない。

```sh
node --test tools/test_issue_preservation.mjs tools/test_issue_claim.mjs
```
