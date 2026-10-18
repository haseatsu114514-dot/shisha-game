# #350 隔離Macケース（実試験停止中）

このbranchは未実行の試験パケット。**旧observeの実行手順は無効**。
現版は非推論preflightと読取verifyのみで、実CLIの`exec`、fixture dispatch、編集、
release、Issue closeを実行する経路を持たない。mock成功を実地PASSとしない。
本branchのfixture workflowはmainへマージしない。

## 保持する対象

|対象|値|
|---|---|
|親Issue/worker|#350 / `codex-577-limited-20261018-3a8c921e`|
|親claim|`39093250740` completed/success、bot `6245141404` owner/run一致（開始時再確認）|
|隔離branch|`codex/350-mac-start-gate-20261018`|
|準備base|`d069102e6dac96368665972bf417744f3b60239f`|
|保持するfixture|#665（close・claim・releaseしない）|
|将来の実CLI専用worker|`codex-350-mac-probe-20261018-e82b7c1f`|
|将来のclaim request|`350-mac-case-20261018-e82b7c1f`|
|将来のrelease request|`350-mac-release-20261018-e82b7c1f`|
|fixture concurrency|`issue350-mac-e82b7c1f`|

旧成果・旧予約・B/Cプロセスは保持し、停止済み・差分なしと推測しない。
#605実装、#660/#661/#662、#556/#355は対象外。#350全体は未完のまま。

## Bの正規起動と起動前停止条件

`subprocess`はshell alias/functionを解決しない。bare `codex`や、
`command -v`の結果だけをBの証拠にしない。

使用可能な形は、**既存Bの正規Macタスクが既にB環境を継承している状態**から、
既存の正規CLI実体の絶対パスを明示する方法だけ。新wrapperを作らず、shell設定を
sourceせず、HOME/CODEX_HOMEを再代入しない。B選択がalias/function内の代入にしか
存在しない、実体が未確認、継承環境がunset/A/defaultなら、Codex呼出し前に停止する。
既存Bタスクの実際の起動方法はクラウドから未検証であり、推測で補わない。

preflightはOSユーザーのホームから期待する`.codex-plus-b`を求め、継承された
CODEX_HOMEと一致し、Bディレクトリがsymlinkでないことを確認する。
次に同じ絶対パスの公式非推論`--version`、`login status`、`doctor --json`だけを使う。
0.162.1、ChatGPT login、公式診断のBのCODEX_HOME・provider/MCP・認証方式の
非機密メタデータが確認できなければ停止。認証/設定ファイルの内容は読まない。
診断形式が未対応でも失敗として止まり、別コマンドや別認証へfallbackしない。
生の診断出力は公開しない。

**これらが一致しても実推論を許可しない。** 現在のパケットには、実効hooks・
プロジェクト/全体設定の起動時処理・MCP/providerの副作用と追加課金なしを証明する、
検証済みの公式非機密情報契約がない。login成功、MCP数0、利用者のyes/no、
任意JSONだけでは代用しない。有効化フラグもない。
新login・認証情報読取/移送・設定/権限変更・課金・常駐化では解消しない。
実試験の再開には既存正規環境についての公式情報を確認し、起動安全条件を別途レビューする。
Sol・mediumも実CLIでの正式モデル対応未確認のまま。別モデルで疎通しない。

## dot正規Macタスクの最小手順（まだ実行しない）

1. 既存checkout/cacheとBタスクの状態・差分・プロセスを確認する。
   最新mainのAGENTS/予約規約、#350最新台帳、#665/他担当境界を読取再照合する。
   親350予約を引き継ぎ先で流用して編集しない。full clone/大容量取得なし。
2. 同branchの報告済み**完全40桁HEAD**だけを既存cacheから隔離worktreeへ準備する。
   dirtyなB/Cツリーの切替、reset/clean/force pushはしない。
   `./tools/check_git_safety.sh`、Macの既存quota helperを確認。不明値を推測しない。
3. 正規B環境の継承とCLI実体の絶対パスを、既存起動情報から確認できなければ停止。
   確認できた場合も、下記は**非推論preflightだけ**（ユーザーが実行を再開した時に限る）。

```text
python3 -B tools/issue350_mac_gate.py preflight --codex-bin /確認済みの既存CLI実体/codex --expected-head 完全40桁HEAD
```

上の日本語部分は既存情報で置換する引数の説明であり、環境変数代入ではない。
helperはclean worktree・固定HEAD・作業ファイルとGit blob一致も確認する。
期待結果はexit2の`BLOCKED_UNKNOWN_NO_RETRY`。B確認不能ならCodex呼出し前、
メタ情報取得不能ならその場、一致しても実効副作用/追加課金の未証明で停止する。
PASS_OBSERVEDは出さない。未知結果は同じcaseで保全し、再実行/別モデル試行しない。
現在の依頼ではこのpreflight自体もMacでまだ実行しない。

MacのGitHub副作用は**0件**：fixture claim/release/status dispatch、Issue作成/close、
予約変更、Actions取消は行わない。親350予約とfixture665を保持する。
準備側の副作用は同branchへのcommit/pushと#350への訂正記録のみ。

## verifyの規約と厳密な関連づけ

読取専用verifyにはrun・固定HEAD・32桁nonceが必須。対象はfixture665のみ。
成功runのbranch/SHA/event/path/attempt/request・CLAIMED notice・最新bot owner/runを
検査する。最新mainのcoordinator本体JSを固定SHA256と照合し、変われば再レビューで停止。
最終gate直前に台帳とIssueを再読取し、open/非PRに加え最新規約の
`blocked`/`status:blocked`拒否を適用する。初回と最終の台帳変更も拒否する。
API読取と編集の間の原子的ロックを保証するものではなく、実observerへの接続は無効。

旧observerのfilename/verify部分文字列・クライアントstdout受理を削除した。
将来用`VerifierAuthority`は完全argvとstarted/completed IDの対応を要求し、
クライアントの出力JSONを一切権威として使わない。controllerが固定Git blobを独立Python
プロセスで実行し、私有pipeの結果をfresh nonce・SHA/digest・run/owner/request・厳密な型と
照合する。私有receiptは1回限り。偽出力・別コマンド・再利用では開かない。
この検査核のmock成功は実クライアント観測の完了ではない。

## 時間制限・ローカル回帰

旧600秒timerと実CLI起動を削除。将来の起動経路は現版にはない。
現存するgh/Git/公式メタデータおよび私有verifyは各20秒上限。
helperが起動した新しいsession/process groupだけを対象にTERM→1秒待機→KILL→
1秒以内の回収/残存確認を行う。無関係なB/Cプロセスを名前でkillしない。
終了未確認・timeout・予期しない残存子プロセスは結果不明で再実行禁止。
OSが終了を確認できない場合も成功扱いせず、pid/pgidとUNKNOWNを返す。

```bash
python3 -B tools/test_issue350_mac_gate.py
```

標準ライブラリのローカル模擬試験。実Codex、gh、ネットワーク、認証、dispatchなし。
blocked途中追加時の編集0、policy/owner/run変更、偽PASS/別SHA/nonce/再利用、
B誤環境の起動0、メタ情報一致でも実推論0、TERM無視・pipe保持子プロセスの上限、
無関係プロセスの存続を検査する。これは実地PASSの代替ではない。
