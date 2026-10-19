# 読み取り専用の変更予定・PR事前チェック（#422 第一段階）

`tools/pr_change_preflight.py` は、明示した計画とOpen/Draft PRの**実変更ファイル**を比較する独立した補助ツールです。
予約ワークフローとの連携、予約・移管・PR編集・マージ・権限変更は行いません。
既存のclaim→そのrun指定statusやOpen PR参照拒否を置き換えず、#548などの予約制限を回避する用途には使いません。
#422全体の完了ではなく、実地の一時Issue/PR検証やワークフロー連携は後続です。

## 計画と実行

Issue/worker引き継ぎに添付できるJSONを用意します。PR本文や既存の予約記録の書式は変更しません。

```json
{
  "version": 1,
  "issue": 422,
  "worker": "your-session-specific-worker",
  "files": [
    "tools/pr_change_preflight.py",
    "tools/test_pr_change_preflight.py",
    "docs/pr_change_preflight.md"
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
# 非衝突（実装・予約の安全保証ではない）
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
このツールのexit 0は予約取得、レビュー完了、依存機能の実プレイ検証、マージ許可を意味しません。

## 検証範囲

fixtureでは非衝突、Open/Draft重複、rename旧パス、未完Issue、closed未マージPR、merged PR、
closed-as-not-planned、計画未記載と明示空、型・パス不正、取得失敗、部分取得・3000件超、head変化、
不正メタ情報、CLIの3終了コード、GET-only・ページング・タイムアウトを検証します。通信やGitHub書込みはありません。
既存予約ワークフロー・UI・ゲーム・台本・画像・PR本文・権限は変更しません。
