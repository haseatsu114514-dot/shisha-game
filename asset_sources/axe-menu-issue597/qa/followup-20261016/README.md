# #597 追検証と原因訂正

前回の「mainに参照先が存在しない」は誤判定だった。main/検証HEADには両パスが追跡されており、sparse checkoutがsymlink本体を展開していなかった。`git ls-tree -r HEAD -- .agents/skills/portrait-unify/SKILL.md` は中間symlinkを辿らないため、不在の根拠にならない。

|追跡パス|mode|Git blob|
|---|---|---|
|`.agents/skills/portrait-unify`|120000|`456a639cff150138436f5a03a7ecb8b9330886ae`|
|`.claude/skills/portrait-unify/SKILL.md`|100644|`9d5e9c2f3a9fbe7f551f583eee0da0efa1239936`|

symlink内容は `../../.claude/skills/portrait-unify`。`head-paths.txt` / `main-paths.txt` / `symlink-verification.json` に実取得のmode/blob/解決先を保存した。[固定検証HEADのsymlink](https://github.com/haseatsu114514-dot/shisha-game/blob/237a57bc414bd8323be3d8c13d392ba360728fa6/.agents/skills/portrait-unify)、[参照先](https://github.com/haseatsu114514-dot/shisha-game/blob/237a57bc414bd8323be3d8c13d392ba360728fa6/.claude/skills/portrait-unify/SKILL.md)。

以下の追跡2パスのみをHEADから復元し、同じ文書検査を実行した。sparse全展開、旧コピー使用、リンク削除、検査skip、検査コード変更はない。

```sh
git restore --source=HEAD --worktree --ignore-skip-worktree-bits -- \
  .agents/skills/portrait-unify .claude/skills/portrait-unify/SKILL.md
python3 tools/check_agent_docs.py
```

結果: **exit0 PASS**。`docs-check.log` / `docs-check.exit` を参照。過去の `qa/results/docs-final.log` 等は当時の失敗として変更していない。

## 既存39一式の成功根拠: CI

親の新指示によりローカルの追加一式実行を取り消し、指定CIの完全ログをAも既存ghで取得・照合した。run **38847642882** / job **116801687392** / attempt1 / completed-success。

- source head: `237a57bc414bd8323be3d8c13d392ba360728fa6`
- base: `1ec3dddba5fd0524f544e6999e84f029a6bcde87`
- 実checkout merge ref: `04eaff886b2c8a8c422c72efb80c7a04466a8055`
- merge/source treeは双方 `4bd0baecb1374536b7a0c79d38c715dfe66c08ff`、完全一致。merge commitの親2件も上記base/headに一致。
- `ci-job-116801687392-full.log.gz` は完全原文の可逆gzip保管（展開後のbytes/SHA256一致を検証）、`ci-test-excerpt.txt` は行番号付き抜粋、`ci-validation.json` は全件数・run/job/step成功・log SHA256/bytesを記録する。ログ上もTEST_REF（source head）とcheckout merge refを区別する。

|実行|通過/全件|失敗|終了の根拠|
|---|---:|---:|---|
|モデル|28/28|0|node test出力とstep success|
|axe_throw.mjs|20/20|0|同一bash -e stepで全件PASS、後続へ到達しstep success（exit0）|
|axe_versus.mjs|7/7|0|同上（exit0）|
|axe_polish.mjs|6/6|0|同上（exit0）|
|axe_lesson.mjs|6/6|0|同上（exit0）|
|既存browser計|39/39|0|4suiteの連続実行が中断なく成功|
|axe_menu_decor.mjs|6/6|0|同上（exit0）|
|save_load.mjs|6/6|0|同上（exit0）|
|LIME|PASS|0|末尾PASSとstep success|

CIログに各suite独立のexit数値がechoされたわけではない。既存assertの全件PASS、後続commandへの到達、`bash -e` の実行stepがsuccessであることから各exit0を確認した。個別再実行の合算ではない。

## ローカル追実行は中断

公式preview8125上で開始した追加実行は、同一コードの重複検証を不要とする親指示のためwrapperが停止した。`local-interruption.json` と生logを保存。throwは20/20 exit0。wrapperからの最後確認はversus1PASSだったが、停止後の保存logには2PASSがあり、suite終了codeは無い。**versusは途中中断、polish/lesson/menuは未実行**であり、ローカル39/39成功とは扱わない。再起動しない。

この訂正ではゲーム/テスト/検査コード・assert・timeout・リンクを変更していない。元のsource fingerprint18件が全一致（`runtime-preservation-resumed.json`）、Git diffでもremake/assets/data/.github/tools/brand/docs/.agents/.claudeの変更なし。訂正commitはREADMEと追加QA証跡/manifestのみ。quota helperは別件の既知SyntaxErrorとして今回実行/修正しない。#598未起動、claim/Draft/checkout保持、merge/公開/releaseなし。

完全ログに元から含まれる末尾空白を改変せず、lossless gzipで保管する。task側の取得原文はそのまま保持し、Git diff検査を無効化しない。抜粋の行番号は展開した原文に対応する。
