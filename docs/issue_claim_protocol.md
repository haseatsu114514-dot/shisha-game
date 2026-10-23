# Issue予約（v2）

操作は **claim / release / handoff** の3つ。2026-10-23のオーナー指示により旧v1予約はすべて無効。
旧コメントは履歴として残す。既存PRの続きもv2でclaimしてから編集する。読み取り調査・レビューは予約不要。

| 操作 | 動作 |
| --- | --- |
| `claim` | 空いたIssueを予約。同じworkerの複数予約・Open PRがあるIssueの予約も可。 |
| `release` | 現担当が完了・放棄で解除。closed Issueにも実行可。 |
| `handoff` | 現担当が保存先と残作業を残して予約を空ける。後任は新worker IDでclaim。 |

## 申請

write権限とセッション固有のworker IDが必要。IDは3〜80文字の英数字・`.`・`_`・`-`、先頭は英数字。
CLIではmain上のワークフローを実行する。request_idは任意（指定時はworker IDと同じ形式で固有にする）。

```sh
gh workflow run issue-claim.yml -R haseatsu114514-dot/shisha-game --ref main \
  -f operation=claim -f issue=888 -f owner=codex-example-01 -f request_id=unique-request-01
```

解除は `operation=release`。交代は `operation=handoff` と `-f summary='保存PR/branch; DONE/TODO/TEST/NEXT'`。
handoff前に変更をcommit/pushして編集を止める。summaryは1〜1200文字でHTMLコメント不可。
連携からは**対象Issue自身**へ1コメント1要求で送る（PR・別Issueからの申請不可）。末尾の既知のClaude Code署名1つは可。

```text
/issue-claim {"operation":"claim","owner":"codex-example-01"}
/issue-claim {"operation":"release","owner":"codex-example-01"}
/issue-claim {"operation":"handoff","owner":"codex-example-01","summary":"保存PR/branch; DONE/TODO/TEST/NEXT"}
```

## 結果確認

成功run・`CLAIMED_ISSUE=<番号>`・最新bot `issue-claim:v2` 記録のowner/run一致を確認して編集する。
release/handoffは現worker IDと元の申請ユーザーが一致する場合だけ可。失敗・cancel・pendingは成功ではない。
書込後の失敗は現担当がreleaseする。同じrequest ID・記録済みrunは重複書込しない。再申請は新ID/コメントを使う。
待ち行列はIssue番号ごと。他Issueは並行、同じIssueだけ直列。pending置換で取消された申請は確認して再申請する。
自動解除・全Issue走査・PR照合・担当数制限・旧予約回復は行わない。過去の共通予約手順より本書を優先する。
Git Safety・共有ファイルの衝突確認・必須CI・レビュー・マージ条件は別途守る。
