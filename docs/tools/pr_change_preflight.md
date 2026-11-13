> **注意（2026-10-30）**: 本ツールは任意の試作で、必須手順ではない（`AGENTS.md`）。本文の claim／worker／予約・引き継ぎに関する記述は、2026-10-23に撤廃したIssue予約の時代の設計で、現在の運用には使わない。

# 読み取り専用の変更予定・PR事前チェック（#422 第二段階）

`tools/pr_change_preflight.py` は、明示した計画とOpen/Draft PRの**実変更ファイル**を比較する独立した補助ツールです。
PR編集・マージ・権限変更は行いません。任意の補助で、着手やマージの必須手順ではありません（Issue予約は2026-10-23に撤廃済み）。
#422全体の完了ではなく、実地の一時Issue/PR検証やワークフロー連携は後続です。

## 計画と実行

ローカルの計画JSON、またはIssueの人間コメントを入力にできます。PR本文の書式は変更しません。

```json
{
  "version": 1,
  "issue": 422,
  "worker": "your-session-specific-worker",
  "files": [
    "tools/pr_change_preflight.py",
    "tools/test_pr_change_preflight.py",
    "docs/tools/pr_change_preflight.md"
  ],
  "dependencies": {
    "issues": [],
    "prs": [420]
  }
}
```

```sh
python3 tools/pr_change_preflight.py --plan /tmp/plan.json
python3 tools/pr_change_preflight.py --plan /tmp/plan.json --format json
python3 -m unittest discover -s tools -p test_pr_change_preflight.py
```

Python標準ライブラリと、既存認証済みのGitHub CLI `gh`を使います。認証設定の変更やトークンの入力は行いません。
全通信は `gh api --method GET`。`--repo owner/name` で対象を指定でき、既定はこのリポジトリです。
API一覧・ファイルはページングし、PRの変更数と取得数を照合します。取得の前後でhead・state・変更数を照合し、変化したら再実行が必要です。
GitHubのPRファイルAPIは最大3000件のため、それを超えるPRや部分取得を完全な検査として扱いません。
各API呼出しの上限は90秒です。失敗時はendpointと失敗種別を表示し、認証・proxyの詳細は出力しません。

`files` は大文字小文字も含めた、リポジトリ相対の**ファイル単位の完全一致**です。
ワイルドカード、絶対パス、`..`、ディレクトリを示す末尾 `/` は受け付けません。
`tools` のような名前は完全一致のファイル名として扱われ、配下を再帰的に含みません。ディレクトリの変更予定は個々のファイルへ展開してください。
追加予定でまだ存在しないファイルも指定できます。renameは新旧両方のパスを比較します。

`files: []` や依存の `[]` は「なしと明示済み」。キー未記載、不正な値、JSON内の同名キー重複は「情報不足」です。
依存は同じリポジトリのIssue/PR番号です。自己Issue依存・重複指定・PRをIssue配列に入れた記載も安全扱いにしません。
PR依存は `merged=true` かつclosedでのみ完了扱いです。closedだけの未マージPRは未完です。
Issue依存はclosedかつ `state_reason=completed` で解決扱いですが、実装の実地検証済みとは意味しません。
`not_planned` や理由不明のclosed Issueは依存未完に残します。

## Issue／handoffコメントの明示形式

IssueのConversationコメントに、次の3行を**同じコメント内**で明示します。
通常の進捗／handoff記録の `WORKER / ISSUE / BRANCH / PR / DONE / TODO / TEST / NEXT` と併記できます。

```text
WORKER: your-session-specific-worker
PLANNED_FILES: ["tools/pr_change_preflight.py", "tools/test_pr_change_preflight.py", "docs/tools/pr_change_preflight.md"]
DEPENDS: {"issues": [], "prs": [557]}
```

`WORKER` は空でないworker ID、残る2行の値はそれぞれ1行のJSON配列／オブジェクトです。
`PLANNED_FILES: []` と `DEPENDS: {"issues": [], "prs": []}` は「なしと明示済み」です。
未記載、空欄、自然文の `none`、同じ行名の複数記載、JSONの重複キーや配列の重複値は計画不足とします。
従来のカンマ区切り自然文や `DEPENDENCIES:` はこの形式への自動変換・推測を行いません。
パスと依存番号の検証・依存の完了条件は計画JSONと共通です。

```sh
python3 tools/pr_change_preflight.py --issue 422
python3 tools/pr_change_preflight.py --issue 422 --format json
```

`--issue` は正のIssue番号で、`--plan` と同時指定できません。
Issue情報とコメント全ページをGETし、コメント数の不一致・重複ID・不正メタ情報・取得失敗は
`fetch_failures` に記録して `incomplete` とします。PR番号はIssue入力として受け付けません。
人間コメントはGitHubの `user.type=User` に限定し、Botコメントを除外します。
これは人間アカウントを使用するAIのコメントを含み、書いた人の権限の認証には使いません。

行頭（インデントなし）の `PLANNED_FILES:` または `DEPENDS:` を含む人間コメントのうち、
**作成順で最新（最大comment ID）**を選びます。ブロック引用、バッククォート／チルダのコードフェンス内の例は読みません。
上のコード例を実際に投稿するときはコードフェンスを外してください。
Issue本文、PR本文、自然文、別コメントの項目は補完元にしません。
通常の進捗コメントやBotコメントは計画を置き換えません。
古いコメントを編集しても新しいコメントより優先されないため、計画更新は3行をそろえた新規コメントで行ってください。
最新宣言が部分的・不正でも、古い有効な計画へ戻りません。宣言がない場合も `missing_information` として終了コード2です。

Issueモードだけ、選択したコメントの `issue / comment_id / author` をJSONの `plan_source` に追加し、
textでは `PLAN_SOURCE` 行で示します。既存の `--plan` の出力・終了コードは変わりません。
コメントは現在のスナップショットであり、同数の編集・削除と追加や取得後の更新まで排他・保証するものではありません。

## 判定・出力例

| 終了コード | status | 意味 |
| --- | --- | --- |
| 0 | `no_detected_overlap` | 明示計画と取得できた全Open/Draft PRに一致なし、明示依存は解決済み |
| 1 | `requires_review` | ファイル重複候補または依存未完。担当間の確認が必要 |
| 2 | `incomplete` | 計画未記載・不正、取得失敗、取得途中のhead変化など。安全判定はできない |

4カテゴリは `file_overlaps` / `unmerged_dependencies` / `missing_information` / `fetch_failures` に分離します。
複数カテゴリを同時に残し、取得失敗があれば既知の重複候補を保持したまま `incomplete` を優先します。
自身の既存PRも除外しないため、再実行で自分のPRとの重複が出る場合も確認対象です。

以下はfixture相当の出力抜粋です。実行時は観測時刻、取得済みPR数と限界も表示します。

```text
# 非衝突（実装の安全保証ではない）
STATUS: no_detected_overlap
CHECKED_OPEN_PRS: 1

# Open/Draft PRで同じファイル
STATUS: requires_review
FILE_OVERLAP: PR #7 draft=True: tools/example.py

# closedでも未マージの依存
STATUS: requires_review
DEPENDENCY_PENDING: prs #9 state=closed merged=False

# files未記載
STATUS: incomplete
PLAN_MISSING_OR_INVALID: files must be explicitly listed (empty [] is allowed)

# ファイル取得失敗（取得できた別PRの重複は残す）
STATUS: incomplete
FILE_OVERLAP: PR #7 draft=True: tools/example.py
FETCH_FAILED: files unavailable
```

**未push作業、未記載の計画、ローカル変更は見えません。** 重複はバグやmerge conflictの確定ではなく確認候補です。
GitHubレスポンスは時点の情報であり、取得後の新PR・pushを排他しません。着手・マージ前には再確認してください。
このツールのexit 0はレビュー完了、依存機能の実プレイ検証、マージ許可を意味しません。

## 検証範囲

fixtureでは非衝突、Open/Draft重複、rename旧パス、未完Issue、closed未マージPR、merged PR、
closed-as-not-planned、計画未記載と明示空、型・パス不正、取得失敗、部分取得・3000件超、head変化、
不正メタ情報、CLIの3終了コード、GET-only・ページング・タイムアウトを検証します。通信やGitHub書込みはありません。
Issueモードは最新の人間宣言、未記載・明示空・不正な最新宣言、重複記載、依存未マージ、
引用／コード例／Botの除外、コメント取得失敗・部分取得、JSONモードとの判定互換もfixtureで検証します。
実リポジトリへのツール確認はGET-onlyの読み取り実行です。一時Issue/PRを作る実地検証は未実施です。
UI・ゲーム・台本・画像・PR本文・権限は変更しません。
