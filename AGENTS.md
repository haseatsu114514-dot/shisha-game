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
- ゲームの挙動・UI・世界観の変更は依頼範囲に収める。検証は以下の方針に従い、未実施は明記する。
- キャラ設定・台詞・報酬・改行は正本とスキーマに従う。必要時のみ `docs/gameplay_agent_reference.md` と `docs/review_scope.md` を読む。
- シーシャ画像・キャラCG・外部素材・立ち絵作業は `docs/asset_ai_guidance.md` の該当項目を読む。画像の実物構造・ライセンス・QAを省略しない。
- 起動・テスト: `remake/README.md`。ゲームデータを編集したら関連リンタ・テストを確認する。
- 過去の `docs/*handoff*.md` は日時付き履歴。必要時だけ読み、現在のPR・ブランチ・実装で再確認する。
- 終了時はPRに変更点・テスト・未完・引き継ぎを記す。確定した永続ルールだけ正本を更新し、日付付きMDをむやみに増やさない。

### 検証方針

- 変更箇所と危険度に見合う検証を選び、局所再現・関連回帰を先行する。過去のスキル・運用例より最新の明示的なユーザー方針を優先する。
- 小さな表示・文言修正で、全章通しやランダム要素の全種類総当たりを毎回要求しない。保存・進行・共通基盤の変更では、影響に応じた必要な境界回帰を残す。
- 同じHEADの有効な成功結果を再利用する。追加実行時は変更箇所・対象base・環境・依存等による失効理由を示し、無関係な全結果を自動的に失効扱いしない。
- CI待ちだけのA（Codex A）の推論や定期メッセージを繰り返さず、結果確定時に必要な判断を行う。
- 現行必須checksの無断省略、失敗の隠蔽、assertion・判定の緩和は禁止する。
- 見込み時間・通信量が大きければ実行前に節約案を示す。大容量通信の事前承認は下記の既存ルールを維持する。
- 目安時間をハードな成功期限にせず、固定時間上限による中断を成功扱いしない。timeout・cancel・未実施を区別して記録する。
- 検証方針は必須CI・独立レビュー・mergeの安全条件や通信制限を維持する。予約は本書の3操作に従う。
- Draft PRでは重いブラウザ系CI（Playwright/Chromium）は動かない。結果が必要になったらPRを Ready for review にする（その時点のheadで全件動く）。mainへのpushと手動実行は従来どおり全件動く。

### 流れを止めない進め方（2026-10-23 オーナー方針）

- mainのCIが赤いときは、その修正を最優先にする。赤いmainの上に別のPRを重ねてマージしない（オーナーが個別に許可した場合を除く）。
- 1つのPRは1つのIssueの小さな変更にする。大きなIssueは、半日程度で終わる単位の子Issueに分けてから進める。
- 同じ場所（例: `remake/js/craft/`）を触る作業は同時に進めない。開いているPRが同じファイルを変えていたら、その完了を待つか、別の場所の作業を選ぶ。
- pushは区切りごとにまとめる。小さな修正を何度もpushしない（pushのたびにCIが最初からやり直しになる）。
- オーナーが結論を指示した作業では、設計の選択肢を聞き返さずに実装する。迷う細部は、ゲームの挙動を変えない方を選んでPRに書く。
- CIが緑で競合のないPRは、待たせずにマージする。
- 予約・引き継ぎ・CIなどの仕組みは、オーナーの依頼があるときだけ増やす。ゲームの作業中に自分で仕組みを足さない。

## リポジトリ取得と通信量（必須）

- このリポジトリはフルクローンしない。他のAIへのフルクローン依頼も禁止する。
- 既存checkout/cacheを再利用し、必要なファイル・ref・差分だけを取得する。
- タスクごとに shisha-game を丸ごと `git clone` することは禁止（リポジトリは約4.8GB・画像はLFSなし。2026-10-20〜21にタスクごとのクローンで約90GBの通信を消費したと推定）。
- 新しい作業ディレクトリは既存の共有クローンから `git worktree add` で作るか、既存の作業ディレクトリを再利用する。やむを得ず新規取得が必要な場合は司令塔に確認し、`--filter=blob:none` 等で最小化する。
- CI成果物の大量ダウンロード（`gh run download` の繰り返し）も必要最小限にする。
- 広範囲のfetch/pull、全履歴・全ブランチ・素材・LFSの一括取得を自動実行しない。
- 大容量通信が見込まれる取得・更新・テスト・アップロードは、実行前に目的・推定通信量（不明なら不明）・節約案を提示し、承認を得る。
- shallow/filtered fetchでも少量通信は保証されない。想定外に転送量が増えたら中断し、取得量（計測できなければ不明）と状況を報告する。

### 画像と Git LFS

- `assets/`・`remake/img/`・`asset_sources/` の png/jpg/jpeg/webp/gif は、`.gitattributes` により**新規追加分だけ** Git LFS で保存する。既存画像は同ファイル末尾の生成ブロックで通常のGitファイルに固定する（`tools/gen_lfs_legacy_attributes.sh` で生成。手で消さない）。既存履歴の移行（`git lfs migrate` 等）や一括変換はしない。
- 作業前に一度 `git lfs install --skip-repo` を実行する（`.git/hooks` は使わない。LFSのアップロードは `.githooks/pre-push` が行う）。git-lfs が無い環境では画像が通常のGitファイルとして入るため、追加前に導入する。
- 既定ではLFS実体を一括取得しない。`GIT_LFS_SKIP_SMUDGE=1` で worktree を作り、必要な画像だけ `git lfs pull --include="<パス>"` で取得する。LFSの転送量は所有者の無料枠（帯域・容量）を消費するため、上の通信量ルールに従う。
- `git add` 後に `git lfs ls-files` で新しい画像がLFS管理になったことを確認する。

## 実行経路: CLI / GitHub連携

- ローカルCLIと、認証済みGitHub連携/APIのどちらでも作業できる。`gh`・shell・ローカルcheckoutの有無を実装許可の条件にせず、利用可能な経路で同じ予約・差分・保存・検証条件を満たす。CLIの未導入とGitHub権限不足は区別する。
- CLI経路では下のGit Safetyを実行する。checkoutを持たないGitHub連携では、対象repo、最新main SHA、作業branchのbase/head、既存PRの変更ファイル、現在の予約owner/runをAPIで確認する。ローカル専用のroot・hooks・スクリプト検査は「対象外」と記録し、実行済みとは報告しない。実際にcheckoutで編集する場合はCLI側の検査も必要。
- 連携経路での保存は、最新mainを親に別branchを作り、対象ファイルの現在blob SHAまたは親treeを確認してcommitを作成する。ref更新は期待headを指定し、forceを使わない。無関係なtreeを置き換えず、予期しないhead変更は再読・再比較する。既存PRの続きを編集するときはそのbranchを使い、現在の予約を確認する。
- 予約は両経路とも `issue-claim.yml` の claim / release / handoff を使う。連携からは対象Issueへの `/issue-claim` コメントでも申請できる。形式・結果確認は [予約手順書](docs/issue_claim_protocol.md) に従う。
- GitHub連携でcommit作成とbranch更新を確認することはCLIのcommit/pushに相当する。PRを作り、変更を含む正確なheadのCIを確認する。ローカルテスト不能なら未実施と記録し、対応CIで検証する。テスト・run情報も読めなければ確認済みとせず、必要な変更だけを保留する。
- 既存認証の範囲で可能な経路を使い、CLI不在だけを理由に再承認・新規ログインを求めない。新しい認証情報、権限拡大、公開範囲変更が必要な場合だけ、その変更の前に相談する。権限拒否を別アカウントや別経路で迂回しない。
- 共通コードの分離先は非公開の `haseatsu114514-dot/dot-ai-bridge-test`。外部コードの本番導入を承認・実施するまでは、このrepoのmainと予約手順を使う。

## Git Safety

この節のローカルコマンドはcheckoutで作業する場合に適用する。checkoutを持たないGitHub連携では、上のAPIによる同等の確認・保存・検証に従う。

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
  保存済みPRの再開は、現在のIssue予約とリモートのPR/headを確認し、予約を取得して既存ブランチで継続する。古いローカルコピーだけを根拠に再開せず、別workerの未コミット変更を上書きしない。
- 作業の区切りごと・セッションの終わりに、必ず commit して作業ブランチへ push する。
  push が権限などで止まったら、回避したり差分ファイルを作って終えたりせず、止まってオーナーに報告する。
- 生成した画像・音声もその場で `assets/`（使う素材）か `asset_sources/`（元データ）に置いて commit する。
  デスクトップや外部のライブラリに置いたままにしない。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新の `origin/main` を取り込んでから次の空き番号を使う（別チャットと同時に作業して番号が重なった例がある・2026-10-04）。
- 終える前に `git status`（未コミットが無い）と `git log @{u}..HEAD`（未pushが無い）を確認する。

---

## 利用枠と作業終了時の引き継ぎ

- 利用枠が残り少ない・セッション終了が近いときは、新しい大きな作業を始めず、commit/push・PR保存・引き継ぎを優先する。残量が少なくても、オーナーが望む小さな作業は続けてよい。
- 残量は各ツールが公式に見せる場合だけ参照し、推測しない。Mac では任意で `python3 tools/agent_quota_guard.py check codex|claude` を使える（`docs/agent_quota_guard.md`）。GitHub連携だけの環境では不要。
- 未完の作業はDraft PRにし、PRかIssueに DONE / TODO / TEST / NEXT を書く。未完成の変更を完成扱いでマージしない。push できないときは回避せず、失われる差分と復旧手順を報告する。
- AI交代は、全変更をpushしてから `handoff` で予約を空ける。後任は新しいworker IDで `claim` し、保存済みブランチを続ける（下の予約節）。
- オーナーが「止めてマージ」「終了整理」と言ったら新しい実装を止め、push → 緑のPRをマージ → 未完をIssue化 → 短く報告する。
- 終了報告は **MERGED: #番号 / PENDING: #番号(理由) / ISSUES: #番号 / BRANCH: 名前 / NEXT: 次の1手** の形で短く書く。

## 複数CodexチャットのIssue予約（必須）

- 操作は **claim / release / handoff** の3つだけ。CLI・GitHub連携共通の形式は [予約手順書](docs/issue_claim_protocol.md)。読み取り調査・レビューは予約不要。
- 2026-10-23のオーナー指示により旧v1予約はすべて無効。既存PRの続きを含め、v2でclaimしてから編集する。過去のIssue本文・コメントの共通予約手順より本節を優先する。
- セッション固有のworker IDで空いているIssueを `claim` し、成功run・`CLAIMED_ISSUE`・現在のbot owner/runを確認する。同じworkerは複数Issueを持てる。待ち行列はIssue番号ごとで、他Issueの予約を走査しない。
- 完了・放棄は現担当が `release` する。AI交代は変更をcommit/pushし、保存先とDONE/TODO/TEST/NEXTを添えた `handoff` で予約を空ける。後任は新worker IDで `claim` する。
- 旧形式の予約履歴や保存済み成果は削除しない。新形式で他workerが予約中のIssueを横取りせず、共有ファイルの衝突はIssue/PRで調整する。自動解除・旧予約の回復手続きは設けない。
- 作業の区切りと終了時にcommit/pushし、PRに変更・検証・残作業・次の一手を残す。未完はDraftとする。予約はマージ許可ではなく、Git Safety・最新main・競合・必須CI・レビュー・未完了項目を別途確認する。
