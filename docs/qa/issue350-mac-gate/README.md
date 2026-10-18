# #350: dot正規Macタスク用、実Codex開始gateの1ケース

これは**未実行の試験パケット**。構文チェック、mock、login成功を実地PASSにしない。
クラウドのCONNECT403を迂回せず、既存Mac Bの正規CLIだけで実施する。
本branchは分離したlive fixtureであり、**mainへマージしない**。

## 固定した対象・担当

|項目|値|
|---|---|
|親Issue|#350（未完を維持）|
|親worker|`codex-577-limited-20261018-3a8c921e`|
|親claim|`39093250740` completed/success、bot `6245141404` owner/run一致|
|準備base|`d069102e6dac96368665972bf417744f3b60239f`|
|試験branch|`codex/350-mac-start-gate-20261018`|
|使い捨てfixture Issue|#665、無分類、next対象にしない|
|実CLI専用worker|`codex-350-mac-probe-20261018-e82b7c1f`|
|claim request|`350-mac-case-20261018-e82b7c1f`|
|release request|`350-mac-release-20261018-e82b7c1f`|
|concurrency group|`issue350-mac-e82b7c1f`（本番groupと分離）|
|設定|Sol (`gpt-6.1-sol`)・medium、既存ChatGPT認証|

旧PR420の`codex/issue-350-worker-coordinator`は統合済みの証拠として保持し、
上書き・作り直しをしない。#605のpark/resume案は未統合のまま採用しない。
#660ストーリー、#661日常/地図、#662制作UI、#556/#355はこのcaseの対象外。

## 使うファイルと変更範囲

- 現行正本: `AGENTS.md`、`docs/issue_claim_protocol.md`、
  `.github/workflows/issue-claim.yml`、`docs/agent_quota_guard.md`。
- Mac既存補助: `tools/agent_quota_guard.py check codex`。
- 試験補助: `tools/issue350_mac_gate.py`（既存Python3.9+の標準ライブラリ、既存gh/codexのみ）。
- workflowはこのbranchだけでfixture番号・worker・claim/status/releaseを制限し、
  groupを分離、claimのbot書込み後・run完了前に20秒holdする。
  coordinatorの本体JSとpermissionsはbaseから変更しない。
  本体JSのSHA256は`base-script.sha256`。holdや制限を本番へ持ち込まない。
- 実CLIが編集するのは、観測補助が作る隔離ディレクトリ内の
  `fixture/gate-probe.txt`だけ。初期値`BEFORE_GATE\n`を`AFTER_GATE\n`にする。
  初期fixture作成は試験controllerの準備であり、実CLIの編集と区別する。
- Macのdotはbranchを読み取り、準備済み補助を実行する。予約中のrepoソースを
  別セッションで編集しない。ソース修正が必要なら親に返し、先に正式担当手続きを行う。

## dotが最初に確認すること

ユーザー確認済みなのはMacのcodex **0.162.1**、Bの既存`~/.codex-plus-b`、
公式`login status`の`Logged in using ChatGPT`/exit0まで。
**Mac実推論とActions必要権限は未検証**。以下で実際に切り分ける。

1. B/Cの停止中タスク・作業ツリー・未コミット/未push差分・進行中プロセスを確認する。
   他タスクを停止済み・差分なしと推測せず、reset/clean/force push/旧予約解除をしない。
2. 既存Mac canonical checkout/cacheを使う。GitHub上の準備branch SHAを読み、
   必要なref/blobだけ限定取得して別worktreeで同じSHAを使用する。
   sparse checkoutはtools、workflow、規約とGit Safetyに必要な既存領域だけでよい。
   full clone、一括全履歴/素材取得はしない。今日の通信量了承は認証・権限拡大の許可ではない。
3. 最新mainのAGENTS/予約規約、#350最新bot台帳、fixture #665の状態、他担当境界を再照合。
   branchとmainの規約/JSが変わった、別ownerが付いた、参照PRが新設された場合は停止して親へ返す。
   #350の親IDをMacの新セッションへ流用しない。親350をrelease/再claimしない。
4. worktreeで`./tools/check_git_safety.sh`を実行。ERRORなら停止。
   古いローカルrefを根拠に新branchを作らず、dirtyな既存B/Cツリーを切り替えない。
5. **Bの既存ランチャー/既存ターミナル文脈をそのまま使用**し、実際に既存
   `~/.codex-plus-b`を使うことをメタ情報で確認する。
   認証ファイル内容を読まない・コピーしない。HOME/CODEX_HOMEやtokenを再代入しない。
   `command -v codex`、`codex --version`、`codex login status`を再確認する。
   `codex exec --help`で使用する既存オプションを確認。未対応なら更新/別modelへ逃げず停止。
6. `python3 tools/agent_quota_guard.py check codex`を実行。
   不明/古い値は不明のまま。手動の推測値設定、非公式quota API、追加課金をしない。
   公式利用制限/接続拒否なら同じcase/セッションを保全して停止する。
7. 新login、API keyへのfallback、endpoint/proxyの付替え、sandbox/network許可拡大、
   hook trustの迂回、常駐server/自動起動設定は行わない。
   本補助は既存設定を継承し、`-a never`で追加承認を要求せず停止する。

## 実行は1回だけ

`probe_out`はdotの既存タスク用`work/`の下、**repo外**で、まだ存在しない絶対パスを
dotが選ぶ。ホーム直下/認証ディレクトリは使用しない。repo内に出力しない。
以下は準備branchのworktree rootから実行する（Bの既存文脈を維持）。

```bash
python3 tools/issue350_mac_gate.py observe --out "$probe_out"
```

補助はMac以外を拒否する。既存CLI0.162.1/ChatGPT login、clean worktree、
local/remote branch一致、親owner/run、fixture未予約、同requestの既存runなしを確認してから、
実CLIを**1プロセス**起動する。これが実推論の試行であり、別の疎通用モデル試行は起動しない。
CLIが起動できない/モデル未対応/正規権限不足ならBLOCKED。別profile/モデル/認証で再試行しない。

実CLIへの指示は補助に固定してある。claim dispatchは専用ref/Issue/worker/requestで1回。
同runを特定して、編集前に次の**read-only**コマンドを別tool commandで実行する。

```bash
python3 /準備worktree/tools/issue350_mac_gate.py verify CLAIM_RUN_ID
```

`verify`は本物のrun、最新のbot台帳、branch/head/request、run_attempt=1、
CLAIMED_ISSUE noticeを読むだけでファイル編集を行わない。
exit3/`gate:false`は未許可。再dispatchせずread-onlyで待つ。
`matched_pending:true`（owner/runは一致するがrunは未完了）の20秒windowを少なくとも1回観測する。
completed/success・最新owner/run一致・notice確認を満たすexit0/`gate:true`の後に、
**別のtool command**で初めてtargetを書き換える。

補助はMacの非特権kqueueでtargetとfixtureディレクトリを観測し、
実クライアントのJSONイベントへ受信時刻を付ける。ファイルは初めから書込み可能で、
permission hookで編集を強制的に防ぐ試験ではない。対象inode/ディレクトリの変更を記録し、
成功gate受領前にpendingな書込みイベントがあれば失敗とする。
実クライアントの申告や最終ハッシュだけをPASS根拠にしない。

## 期待結果・証拠

- `result.json`: `PASS_OBSERVED_ONE_CASE`。
- `state.closed_window=true`、`state.gate=true`、`early_write=false`、
  `directory_change=false`。targetの書込みイベントがgate確認後にある。
- `client-events.jsonl`: 実CLIのdispatch、実API確認、verify成功、**その後の別commandの編集**、
  正式release/確認が読める。dotはコマンド順と対象も確認する。
- target最終値`AFTER_GATE\n`、AGENTS不変、他fixtureファイルなし。
- repoは実行前後ともclean。CLI内部の通常session記録を、対象の実装編集と混同しない。
- 元実CLI workerのrelease runもcompleted/success、最新botのreleased/owner/run一致、
  fixture #665 closed。親350のowner/runは変更なし。
- `NOT_VERIFIED`/`BLOCKED`、window未捕捉、JSON形式未認識、権限拒否、時計/観測不明、
  10分上限はPASSにしない。補助の10分上限は自分が起動したcaseのprocess groupだけを停止し、
  Actions取消/予約解除はしない。その他B/Cのプロセスには触れない。

開始/終了時にquota helperを確認し、branch SHA・CLI version・認証方式（値は貼らない）・
claim/release run/ledger・変更順・結果を#350へ返す。
生ログが不足/秘匿値を含む場合はそのまま公開せず、必要な検証箇所を安全な形で保全する。
実session IDも残し、利用制限時は同じcaseを保全する。無条件の再送や別workerへの付替えは禁止。

## GitHubの副作用（これ以外は行わない）

準備側: 親350の通常claim 1回（成功済み）、専用Issue #665作成、試験branch push。
Mac側: API読取り、専用branch上のclaim 1run、同workerのrelease 1run、fixture665 close。
別status dispatchは不要。#350へ実測結果の記録を返すが、親Issueはcloseしない。
本番groupのpending置換試験、`next`、`transfer`、#605 park/resume、他Issue予約、
本番workflow編集、mainへのpush/merge、追加のclient/常駐化は含めない。

## 完了の範囲

PASSでも「この実Mac Codexプロセスが、この1ケースで成功run/最新owner-run確認前に
編集しなかった」という観測だけ。旧clientへの強制機構、Claude、複数AI、cancel/pending置換、
隔離next、安全merge queueを検証したことにはしない。#350全体は未完を維持する。
今はMac未実行。親予約は保持し、コード変更が必要なら親へ返す。
