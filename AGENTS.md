# AGENTS.md — 共通AI開発ルール（唯一の入口）

Claude Code と Codex の共通指示。Claude Code は `CLAUDE.md` の `@AGENTS.md` 経由で参照する。**このファイルだけを起点にし、作業に関係する詳細資料だけ読む。**

## 対象・正本

- ゲームの実装・プレイテスト・公開先は `remake/` のみ。台詞・共有データは `data/`、共有素材は `assets/` を使う。物語と人物設定: `brand/story_and_structure.md`、`brand/character_profiles.md`、`data/characters.json`。
- 旧 `web/` と Godot 版は廃止済み。 `project.godot` が存在するチェックアウトは古い。旧パスを実装先にしない。
- `web/` は存在不要。旧 `web/` を実装・テスト・復元の対象にせず、不在を理由に停止・確認要求しない。過去の `AGENTS.md` やメモにある `web/` 必須指定は無効とし、現行 GitHub `main` の指示と `remake/` に従う。
- 仕様・要望: `docs/master_spec.md`、`docs/owner_requests.md`。最新の明示的なユーザー依頼が仕様変更を求めている場合は、その依頼を優先する。意図が不明な矛盾は現行コードと照合する。
- 詳細な正本一覧・引き継ぎ: `docs/current_documentation_guide.md`。

## 作業の原則

- 開始時にブランチ・作業対象・安全確認を行う。別チャットの未マージPRや未コミット変更を上書きしない。
- ユーザーの依頼には、達成に必要な調査・実装・関連調整・テスト・commit/push・PR作成を含む。依頼範囲の実装判断や、すでに得た同じ承認を聞き直さない。マージは既存の明示許可・方針と安全条件に従う。
- 最新の明示指示と取得済みの承認を、過去の仕様・担当メモ・スキル内の履歴より優先する。依頼外の重大な仕様変更、結果を大きく変える曖昧さ、破壊的操作は確認する。軽微な判断は自律的に進め、完了時に説明する。
- 確認待ちや重複候補は該当範囲だけ保留し、予約済みIssue内の独立した作業や読み取り調査を進める。他workerの予約は奪わず、別Issueの実装には別途予約が必要。
- ゲームの挙動・UI・世界観の変更は依頼範囲に収める。小さな変更で、関連テストを実行し、未実施は明記する。
- キャラ設定・台詞・報酬・改行は正本とスキーマに従う。必要時のみ `docs/gameplay_agent_reference.md` と `docs/review_scope.md` を読む。
- シーシャ画像・キャラCG・外部素材・立ち絵作業は `docs/asset_ai_guidance.md` の該当項目を読む。画像の実物構造・ライセンス・QAを省略しない。
- 起動・テスト: `remake/README.md`。ゲームデータを編集したら関連リンタ・テストを確認する。
- 過去の `docs/*handoff*.md` は日時付き履歴。必要時だけ読み、現在のPR・ブランチ・実装で再確認する。
- 終了時はPRに変更点・テスト・未完・引き継ぎを記す。確定した永続ルールだけ正本を更新し、日付付きMDをむやみに増やさない。

## リポジトリ取得と通信量（必須）

- このリポジトリはフルクローンしない。他のAIへのフルクローン依頼も禁止する。
- 既存checkout/cacheを再利用し、必要なファイル・ref・差分だけを取得する。
- 広範囲のfetch/pull、全履歴・全ブランチ・素材・LFSの一括取得を自動実行しない。
- 大容量通信が見込まれる取得・更新・テスト・アップロードは、実行前に目的・推定通信量（不明なら不明）・節約案を提示し、承認を得る。
- shallow/filtered fetchでも少量通信は保証されない。想定外に転送量が増えたら中断し、取得量（計測できなければ不明）と状況を報告する。

## Git Safety

If this machine uses a canonical checkout path, store it in local Git
config with:
`git config --local shisha.canonicalRoot "$(pwd -P)"`

Do not work from `sheesha_battle`, `シーシャバトル-(4.2)`,
`.codex_tmp/...`, or any other duplicate checkout. Those paths must be
treated as stale until the user explicitly replaces the canonical path
and updates the local config.

At task start, after changing checkout/worktree, and before commit/push
(the hooks also check commit/push):

- verify the repo root with `git rev-parse --show-toplevel`
- confirm that the same directory contains `data/`, `assets/` and `remake/`.
  Retired `web/` is not required. Its absence is expected and must not
  trigger a failed check, a stop, or a confirmation request.
  `project.godot` must NOT exist: the Godot version was deleted on
  2026-06-15, so a folder that still has it is a stale copy. Ignore any
  older rule (in any AGENTS.md or notes) that requires `project.godot`
- run `./tools/check_git_safety.sh`
  WARN is allowed; stop on ERROR.
- if `git config --get core.hooksPath` is not `.githooks`, run
  `./tools/enable_git_hooks.sh`
- if `git config --local --get shisha.canonicalRoot` is set, confirm
  that it matches the repo root or the canonical checkout owning this worktree

WARN alone does not require user confirmation. After verifying origin, enabling
the documented hooks and fetching only necessary missing refs may be done
autonomously, subject to the repository acquisition and transfer rules above.
If ERROR remains, stop edits in that checkout and report the specific cause.
Do not overwrite unrelated changes or try to merge unrelated histories.

A worktree made from the canonical checkout (`git worktree add`) is
allowed; `check_git_safety.sh` accepts it.

### Hard rules

- branch new work from `origin/main`; resume a saved PR on its existing branch after verifying ownership and current remote state
- use pull requests instead of direct pushes to `main`
- do not use `git push --force`
- do not use `--allow-unrelated-histories`
- do not change the default branch to a feature branch as a workaround

If `git merge-base HEAD origin/main` fails, the branch is not safe for a
normal PR. Stop and fix the Git layout first.

### GitHub が唯一の正本（PCに作業を残さない・2026-10-03）

2026-09-30〜10-02 に、Codex がPC上のフォルダで作業を進め、push できないまま差分ファイル・画像が
PCにだけ溜まる事故が起きた（PR #173 で回収）。再発防止として以下を守る。

- 正本は GitHub の `origin`（main と作業ブランチ）だけ。PCのフォルダ・`outputs/`・stash・
  チャットの添付・画像生成サービスのライブラリは正本ではない。「ローカル正本」として扱わない。
- 作業を始めるときは、GitHub API等で最新のmain refと必要な差分を必ず確認する。既存checkout/cacheを再利用し、ローカルrefの不足時だけ、上の取得・通信量ルールに従い対象refを限定取得する。新規作業は**最新の `origin/main` から新しいブランチ**を切る。
  保存済みPRの再開は、現在のIssue予約とリモートのPR/headを確認し、必要な移管後に既存ブランチで継続する。古いローカルコピーだけを根拠に再開せず、別workerの未コミット変更を上書きしない。
- 作業の区切りごと・セッションの終わりに、必ず commit して作業ブランチへ push する。
  push が権限などで止まったら、回避したり差分ファイルを作って終えたりせず、止まってオーナーに報告する。
- 生成した画像・音声もその場で `assets/`（使う素材）か `asset_sources/`（元データ）に置いて commit する。
  デスクトップや外部のライブラリに置いたままにしない。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新の `origin/main` を取り込んでから次の空き番号を使う（別チャットと同時に作業して番号が重なった例がある・2026-10-04）。
- 終える前に `git status`（未コミットが無い）と `git log @{u}..HEAD`（未pushが無い）を確認する。

---

## Codex / Claude Code 利用枠と作業終了時の引き継ぎ

- Codex と Claude Code の両方に適用する。利用制限が近い、作業時間が残り少ない、またはセッション終了の兆候がある場合は、新規の大きな作業を開始せず、進捗の保全と引き継ぎを優先する。
- 利用枠の残量・リセット時刻は、各ツールが公式に提供する画面・コマンド・API等で**実際に取得できる場合のみ**参照する。取得不能なら推測しない。認証情報の抽出、非公式な制限回避、頻繁なポーリングはしない。利用枠が見えなくてもタスクの区切りごとに保全する。
- 完了した変更は関連テストと必須チェックを確認し、既存の Git Safety・ブランチ保護・レビュー要件に従って PR を作成する。マージ権限があり、ユーザーの既存のマージ方針で許可され、競合・未完了・失敗チェックがなければマージする。制限を理由に安全条件を省略しない。
- 未完了の作業は、既存 Issue があれば更新し、なければ GitHub Issue を作成する。完了範囲、残タスク、関連 PR/ブランチ/コミット、テスト結果、ブロッカー、次の具体的手順を記す。未完成の変更を完成扱いでマージしない。
- 作業中の有効な変更は安全な作業ブランチへ commit/push してから終了する。push 不可・Git 安全チェック失敗時は無理に回避せず、失われる恐れのある差分と復旧手順を報告する。秘密情報は Issue に書かない。
- 制限到達後に追加操作できることを前提にしない。余裕があるうちに小さな単位で保存し、次のセッションは Issue と PR を確認して再開する。
- 利用上限で別のAIへ交代する運用は維持する。交代前の区切りでcommit/push・未完Draft PR・DONE/TODO/TEST/NEXTを保存し、現担当が `handoff` で編集停止と引き継ぎ待ちを記録する。次AIのIDを事前に決めたり、同じ作業の再承認をユーザーへ求めたりしない。後任は新worker IDの `pickup` 成功と現在bot owner/run一致を確認して保存済みブランチを継続する。手順は `docs/issue_claim_protocol.md`。有効な保存/停止記録がない場合は従来の回復手順を使い、無反応や残量の推測で予約を奪わない。

### Mac 利用枠チェック補助

Mac 上で作業する Codex / Claude Code は、開始時・タスクの区切り・終了前に `python3 tools/agent_quota_guard.py check codex` または `check claude` を実行し、表示された対応方針に従う。取得値が古い・不明なら推測せず、通常の小刻みな commit/push と Issue 引き継ぎを行う。手動設定・公式画面の確認・制約は `docs/agent_quota_guard.md` を参照。これは自動取得・自動マージ機能ではない。


### 低残量時の柔軟な運用・マージ負債を溜めない

- 残量は停止の強制条件ではない。**20%以下でもユーザーが望む小タスクは継続してよい**。残量の推測や都度の確認質問は不要。完成した小タスクはその都度commit/push・PR化し、安全条件を満たす場合はマージする。
- 30%以下は大きな新規作業を控え、完成PRを優先して整理。20%以下は短いタスク単位で保存とPR整理を挟む。10%以下は引き継ぎを優先するが、ユーザーが明示的に望む小タスクは続けてよい。
- ユーザーが「止めてマージ」「今すぐ終了整理」と指示したら、残量にかかわらず**新規実装・仕様検討・大規模な競合解消を即停止**。安全確認→現在の有効な差分をcommit/push→既存の完成PRから安全にマージ→未完成/競合/失敗/承認待ちはIssue更新または作成→短い引き継ぎ報告、の順で実行。マージのために別の長い開発を始めない。
- マージ不可のPRを延々と修正しない。保護ルール・レビュー・必須チェック・Git Safetyは省略せず、危険なら保留してIssue化する。
- 終了報告は短く **MERGED: #番号 / PENDING: #番号(理由) / ISSUES: #番号 / BRANCH: 名前 / NEXT: 次の1手** の形にする。リンクまたは番号を残し、次のChatGPT/Codex/Claude Codeが会話履歴なしでも再開できるようにする。
- Mac専用スクリプトやフックはスマホ・クラウドで動かない場合がある。GitHub上のPR/Issue/作業ブランチを引き継ぎの正本とする。

## 複数CodexチャットのIssue予約（必須）

- 複数のクラウド/ローカルCodex・Claude Codeセッションは同じアカウントでも独立した作業者。実装前に `docs/issue_claim_protocol.md` に従い、GitHub Actions `issue-claim.yml` または `/issue-claim` コメントで同じ排他的予約を取得する。読み取りだけの相談・調査・レビューには予約不要。
- ワークフロー実行の**成功と現在のbot台帳のowner/run一致を確認するまで**実装しない。成功直後の別 `status` 実行は必須ではなく、GitHub APIで台帳と成功runを照合してよい。予約済みIssueは別セッションで作業しない。
- 作業の継続単位はIssue/PR。現在の担当・ブランチ・採用/保留・次の手順は対象Issue/PRに記録する。スキルや過去メモの「Codex担当」「Claude担当」を現在の排他的担当とみなさない。
- workerごとに実装中は1件。全変更をpushした保存PRを `park` すると、Issueの排他的予約を保持したレビュー待ちとなり、独立した別Issueを予約できる。待ち中のIssueは `resume` 成功と新owner/run・保存headの確認後に編集を再開する。同じworkerが複数の待ちPRを持ってよい。
- AI交代には保存済みPRを `handoff` で引き継ぎ待ちにし、後任が `pickup` で同じIssue/PRを取得する。これは予約を解放せずに行う。`park` はレビュー待ちであり、後任への移管許可ではない。未取得のhandoffを元担当が取り消す場合は `resume`、取得後は旧担当で再開しない。
- 利用枠切れ時はpushと引き継ぎを優先し、予約を勝手に解除しない。PRの安全確認・マージは従来のGit Safetyを維持する。

### 予約からPRまでのセッション運用（クラウド/複数チャット共通）

- 新規実装ではセッション固有の worker ID を決め、`docs/issue_claim_protocol.md` に従って `next` または `claim` を実行する。同じworkerの再開は現在のowner/runと保存済みPRを確認して継続し、再予約は不要。別workerへの保存済みOpen PRの移管は `transfer` を使う。成功runとIssue番号を確認できなければ実装を開始しない。手動で選んだIssueも同様。
- **他のチャットの worker ID を使い回さない**。Codexの複数チャットも各々別worker。Issue/PR/作業ブランチの紐付けを記録し、予約中のIssueを別workerが勝手に再開しない。
- 作業中は小さな単位でcommit/pushし、PRを早めに作成する。利用枠切れ・中断時はIssueに `WORKER / ISSUE / BRANCH / PR / DONE / TODO / TEST / BLOCKERS / NEXT` を残す。未完成ならDraft PRにし、予約は保持する。
- 中断・採用保留だけでは予約を解除しない。Issueがcompletedで閉じ、同一repoからmainへマージされた参照PRがあり、参照Open PRがなく、成功runと現在の台帳を再確認できた完了予約は自動整理する。明示放棄などは従来どおり同じworkerで `release` する。
- 別セッションへの引き継ぎは旧worker停止・成果物pushを確認し、有効な `handoff` 保存記録があれば後任の `pickup` を使う。記録がなければ従来どおり、Open PRがなければ旧release→新claim、保存済みOpen PRがあれば `docs/issue_claim_protocol.md` の `transfer` を使う。通常の移管はwrite権限と旧担当側の記録で行い、追加の管理者承認は不要。移管run成功と現在の新owner/run一致を確認してから編集する。
- 古いIssue本文・コメントの共通手順は、冒頭の自動同期欄と現行の予約手順を優先する。個別の採用保留・検証条件・範囲指定・停止指示は維持する。
- PRをマージする前に対象ブランチと最新mainの差分、競合、必須CI、レビュー要件、テスト、未完了項目を確認する。未確認・失敗・競合時は**自動マージ禁止**。安全なPRのみ順次マージし、Issueの予約を解放する。
