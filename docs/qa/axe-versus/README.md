# ひよりとの10投対戦（#489 / Draft PR #569）

クラウド `/workspace/shisha-game` で検証。workerは `codex-axe489-20261015-7c92b4e1`。
[仕様承認](https://github.com/haseatsu114514-dot/shisha-game/issues/489#issuecomment-6186706909)、claim 38698232861、status 38698427627のmain/success、実ログのCLAIMED/VALIDATEDと最新bot台帳のowner/run一致を読取確認してから着手した。開始mainは507809c3。Mac・追加認証・権限変更・再claim・releaseは使用していない。

## 検証結果

- モデル23件PASS（既存16＋対戦7）。`model-results.txt`。固定seed 0〜9999で各難易度1万試合を採点し、平均34.1659／50.4406／61.3695点。初期値を維持した。各軸誤差・力・落下率・宣言成功率と採用理由は [仕様書](../../spec/axe_throw.md#ひよりと10投対戦489)。プレイヤーの成績を変えても同じseedの相手履歴が一致する。
- 対戦7ケースPASS。PC／タッチ横844×390／タッチ縦390×844／キーボード＋動き軽減で各20投を実操作し、両者の記録・合計・勝敗・共通採点・保存全文不変を検査。最初の4ケースは `initial-six-cases.json`。同ファイルの旧lock/lifecycle結果を追加件数へ数えず、下記の強化後の結果を採用する。
- `draw-final.json`：公開APIのseed=9/hardと実際のゲージ停止・集中で60対60を作り、各10投で引き分け終了、延長なし、表情・台詞を確認。得点や履歴を注入していない。再挑戦で双方の履歴と宣言回数がリセットされ、中断結果のwinnerがnullとなることも検査。
- `lock-final.json`：相手が構えている間のフォーカス・構え直し・宣言・Space連打を前景で検査。背景停止とルール閲覧中の停止、相手飛行中の取消、次ゲームの初期状態を検査。
- `lifecycle-final.json`：Abort／DOM撤去／実state LOAD＋caller Abort／pagehide／実showScreenで終了Promiseが解決し、未完の相手投擲を計上せず、保存・live stateを維持。二重呼出し、事前Abort、不正設定の拒否も検査。
- 既存ソロ20ケースPASS（`solo-regressions.json`）。3投・10投、PC/タッチ縦横/キーボード、飛行・説明・手ブレ・集中・宣言/閉鎖/取消、連打・中断、旧保存/友人/恋人/LIME不変。
- 正式ひより11ケースPASS（`formal-hiyori.json`）。実3投、前後台本読了、料金の一度きり確定、取消、New Game/LOAD、既存友人/複数恋人とLIME予約を保持。
- 保存6ケースPASS（`save-load.json`）。Barの実LOADとpagehide取消もPASS（`bar-load.json` / `bar-pagehide.json`）。LIME VM PASS。
- 構文・diff・agent-docs・台詞lint（ERROR 0 / WARN 0）・旧キャラ設定検査PASS。workflow YAMLのparse PASS。ローカルactionlintは未導入のため未実行。GitHubの最終head CIはPRのChecksで別途確認する。

合計はモデル23＋ブラウザ46＝69ケースとLIME VM。ローカルJSONの `ref:null` は実行時の値を保持し、後のheadへ書き換えない。検証した実装は8c0526ceから、対戦の呼出元画面変更ガードを追加したコード。最終提出コードのハッシュは `source-sha256.json`。このガード追加後にlifecycleケースを再実行し、他の対戦4画面はガード対象外の独立ページ、ソロはガード非適用である。GitHub CIの対象headとローカル結果は区別する。

## 表示と初回失敗

保存した7枚の最終画像を目視確認した。PC/タッチ縦横の投後と結果、キーボードの相手勝利、60対60の引き分けを含む。点・台詞・ポーズの表示用注入はしていない。

初回PC入口の対戦ボタンが画面下へはみ出したため、広い画面では対戦欄を右側へ配置した。失敗JSON/画面は `first-menu-fit-failure.*`、修正後に全4画面の入口・ゲーム・結果の収まり検査を通過。

追加の引分け検証は、初回の物理入力遅延で横が13%右に止まり5点となった（`first-draw-aim-failure.*`）。ゲームの判定や最終6点assertは変えず、実キーボード停止・見える狙いの確認・実構え直し・集中を使う手順にした。構え直し条件が厳しすぎて止まった初回も `draw-reaim-failure.json` に保持。半径0.1の中央に対し、止めた狙いが半径0.06以内であることを確認して、集中時の手ブレと力補正の余地を残す。最終実操作で全10投6点と引き分けがPASS。

直接APIをstageへ重ねて実showScreenを呼ぶと、#screenだけが置換され、兄弟の対戦画面が残る問題も検出した。対戦開始時の#screenと子ノードを保持し、変更時に取消として後片付けするよう修正。検査自体もPromise待ちを2秒で失敗させるようにし、強化した全lifecycleケースを再実行してPASS。正式caller・ソロの画面所有権処理は変更していない。

## 境界と残作業

新しい相手は独立ページのひよりのみ。#540の本編相手解禁・街選択、正式ひより台本、保存schema、報酬、LIME、関係成立・素顔発覚は変更しない。既存素材のバイト列も維持。

Draft・予約を保持。マージ・公開・Issue終了は未実施。実機Safariは未検証で、タッチはChromiumの端末エミュレーション。仕上がり確認とマージ等は別途の承認対象。
