# #500 関係の選択とSTATUSの案内

既存の♥3実回答ゲート・♥5のフィナーレ／告白条件を変更せず、選択肢の方向と次の行動を表示する。

## 検証

ローカルの `remake/tools/serve_preview.py --port 8123`、Chromium、1280×720 PC／844×390横持ちタッチのエミュレーションで確認。

- `remake/test/browser/relationship_ui.mjs`: 6ケースPASS。♥3のつむぎ・みんと・凛の正式な質問を再生し、PCクリック／タップで恋愛・友情を選択して実回答・上限解除・STATUSを確認。旧♥5未回答、隠し恋愛値だけの旧データ、旧友人フラグ、未回答フィナーレ、告白保留、複数恋人、後発キャラ・未会キャラ、未制作ひより告白の非案内も確認。
- `remake/test/browser/affinity_gates.mjs`: 10ケースPASS。既存の♥3停止・両回答・一度だけの救済・♥5フィナーレ・友情／告白予約・贈り物・旧セーブ・男性の締めくくり。文字サイズ調整後にPC／タッチの友人表示2ケースも再確認。
- `remake/test/browser/save_load.mjs`: 6ケースPASS。
- `remake/test/choice_oneline.mjs`: 通常選択肢188件・LIME返信186件が1行に収まる。
- `remake/test/data_loading.mjs`、`remake/test/daily_consistency.mjs`: PASS。構文・差分空白・Git Safetyも確認。

テストは使い捨てブラウザコンテキストで面識・好感度・読了を用意した状態から行う。選択と会話は本番エンジンを使用するが、NEW GAMEから自然に全日程を歩く速度計測や、第2章以降の新規ゲーム進行の完成確認ではない。表示を開閉しても状態と保存済みJSONが一切変わらないことを比較している。ひよりの後半台本・専用ハガルは #496／#497、みんとの順序・LIMEは既存の別PRで扱う。

## 画面

- [PCの関係選択](pc-route-choices.png)／[タッチの関係選択](touch-route-choices.png): 正式なつむぎ質問のchoice行を表示するUI確認用の場面。画面の進行条件は上の実回答ケースで別に確認する。
- [PCの♥3待機案内](pc-branch-waiting.png)／[タッチの♥3待機案内](touch-branch-waiting.png): 凛の未回答・節目読了済みデータから、次の訪問先を案内。

詳細は [関係UI結果](relationship-ui-results.json)、[保存・読込結果](save-load-results.json)、[既存ゲート結果](affinity-gates-results.txt)、[1行表示結果](choice-oneline-results.txt)。PRのCI・マージ・公開状態はGitHubで別に確認する。

## マージ前のmain統合

PR #429のmain `cd745597e7227b9e27b14c77bd9fef27b84b2e34` を取り込み、CI設定の競合を両方のテスト呼出しを残して解消。みんとの♥3正体判明→私的な約束の順序修正を維持した統合後のコードで、[関係UI6ケース](merge-main-relationship-ui.txt)、[既存♥3／♥5ゲート10ケース](merge-main-affinity-gates.txt)、[みんとの個別進行4ケース](merge-main-minto.txt)がPASS。YAML構文と両テストステップの存在、JS構文、差分空白を確認した。再開予約はstatus run `38351713253` の成功と同じworker／claim runのログで検証した。
