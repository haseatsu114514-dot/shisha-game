# f51ddcf8 contexts失敗の調査（未解決）

WORKER: `codex-tsumugi452-20261015-3d1c4d7902` / PR #691 / Issue #452

公式CIの[新job117730107673](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39146089117/job/117730107673)は `day4-visit` の `nextMorning`（action_context.mjs:49、呼び出し:132）で60秒タイムアウト。他13ケースは成功。[旧job117726956603](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39145006776/job/117726956603)は全14ケース成功。両jobの実ログを読み、旧SKIP失敗と混同していない。新jobの標準出力には停止時のブラウザ例外・状態は出ていない。

両head間では本番ソース、action_context.mjs、support.mjsに差分がない。以下はGit blob IDの一致を確認したもの。

| ファイル | main7d63 / 87c1 / f51d のblob |
| --- | --- |
| remake/js/daily/reel.js | `cf046bbce7431179e7b6eecd92a739cc8bfbcd7f`（3つとも同一） |
| remake/test/browser/action_context.mjs | `70368e7b41e8df6a14b46fdaf6c2fa0f6e2fabaa`（旧・新同一） |
| remake/test/browser/support.mjs | `a34daf7e13b3c6e0380237ca97e6383c3c745ed3`（旧・新同一） |

## ローカルで確認した別途の停止原因

同じDAY4訪問ケースの無改変実行でも60秒待ちを再現。画面は夜のボーナス後、帰宅前。ブラウザは `Cannot read properties of undefined (reading 'lines')`。続く診断実行で `reel.js:416 settingHint → :790 finish` のスタックを取得した。

`settingHint` は `.find` の候補ごとに `pickWeighted(Math.random, kinds)` を引き直す。候補に一致する抽選が一度もなければ `kind` がundefinedとなる。ボーナス後の `finish` は設定示唆の後に完了callbackを呼ぶため、例外時に演出のPromiseが解決せず、翌朝へ進まない。これは不定期な実行失敗ではなく、特定の乱数列で起きる本番の例外である。

固定入力でmain7d63とPR f51ddcf8を比較した。実際の自由行動・保存/LOAD・リール抽選を通し、リールseed15（最初がBIG）、設定示唆の抽選入力 `[0.99, 0.99, 0.99, 0, …]` を与えた。ゲームソースは読み替えず、診断用の乱数入力だけを固定した。修正実験のみHTTP routeで下記2行に置換し、リポジトリの本番ファイルは編集していない。

```js
const picked = pickWeighted(Math.random, kinds);
const kind = SETTING_HINTS.find((h) => h.id === picked);
```

[制御入力による比較結果](contexts-reproduction.json) / [再現スクリプト](contexts-reproduction.mjs)。無改変は両バージョンともDAY4 slot2・BIG報酬適用済みで例外停止。抽選を一度だけ行う実験では、両バージョンともDAY5 slot0に到達し、元ケースの遭遇・帰宅・支出assertを保持して通過する。

これは**公式CIの直接原因と同一だと確定したものではない**。同CIのartifact内 `action-context.json` の `errors` / `failedResources` を照合する必要がある。約13MBのZIPは画像を含むため取得せず、必要なJSON項目の共有を依頼した。CLIの既存認証は無効と表示されたため、その取得経路は使用せず、新規認証は行っていない。既存Git remoteの読み取りとGitHub connectorは利用できる。

対象外2アイコンのキャッシュ不足による404は全試行で残っている。従って制御した進行assertと根因実験は成功したが、ブラウザスイート全体の合格ではない。assert削除・乱数固定による不具合隠蔽・再実行だけでの解決扱い・タイムアウト延長は行わない。本番reel.jsは本PRの担当範囲外なので変更していない。

## 引き継ぎ

- DONE: 公式前後job比較、ローカル同ケースの無改変タイムアウト再現、設定示唆例外の固定入力再現と修正実験。
- TODO: 公式artifactのJSONとの照合、reelの実装担当範囲を決めて本修正・関連検証。PR #691はDraftのまま、全成功とは扱わない。
- 最新main `a97160ae0956d566538150e7d3a07a3fb766e3f4` は #692のJSON Pointer差分ガード3ファイルのみが追加され、当該本番/テスト/AGENTSは変更されていない。追加Git fetchはしていない。
- 予約を保持。新規claim・解除・他担当の変更・マージ・公開・Issue終了なし。
