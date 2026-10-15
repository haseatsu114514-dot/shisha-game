# ショップパッケージと欠落HMD画像のQA (#586)

Draft PR #587。マージ/公開確認は親担当の判断待ち。公開版にはまだ今回の画像を反映していない。
全商品対応表・原画・プロンプト・選定/不採用・変換検証は [制作記録](../../../asset_sources/shop-art-issue586/README.md)。

検証はこのタスクのfresh独立cloneで `python3 remake/tools/serve_preview.py --port 8123` を起動し、
Google ChromeをPlaywrightから使って行った。PC 1280×720、横持ちtouch 844×390のエミュレーション。
実機端末の検証とは区別する。既存利用者のブラウザ保存には触れず、各ケースを使い捨てcontextで実行。

```sh
python3 tools/build_shop_art.py
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  ARTIFACT_DIR=.codex/artifacts/shop-art node remake/test/browser/shop_ui.mjs
NODE_PATH=remake/test/browser/node_modules node --experimental-vm-modules remake/test/daily_consistency.mjs
python3 tools/check_agent_docs.py
git diff --check
```

全21点の元PNG/512角RGBA WebPを全デコード・alpha/bbox/SHA256照合。元PNG無加工。修正前7PNGも全デコード済み。
全26商品はPC/touchで実表示から画像URLを解決してdecodeし、18種が別URLであること、HMD3種に文字代用が無いこと、
全18フレーバーとHMD3種の詳細画像/表示窓が画面内へ収まることを確認。

schema5の代表旧セーブを実際のloadで読む。商品閲覧と詳細開閉でstate/保存元文字列が不変、
購入後はミント50→100g、所持金12,800→11,250円、レモン50gと任意フラグを保持することをPCと実tap入力で検証。
既存10ケースで一括購入・経費/大会準備・売却・贈り物・くじ・残金不足・数量・画面破棄・別セーブ境界・
入店/ショールームの行動消費がPASS。日常整合性、check_agent_docs、diff-checkもPASS。

追加ケースは最初、ゲーム全体のviewport縮尺を112px固定で比較して失敗した。CSS上の112pxと実画面の収まりを別に検証して修正。
原画変換の完了前に開始した初回smokeはmapping未生成で起動できず、変換後に再実行した。最終結果を `results.json` に記録する。
撮影はmodalのpop-inアニメーション完了を待つ。製品の仕様/価格/保存処理はこの修正で変更していない。

`data/`、既存`assets/`、`remake/js/core/state.js`、制作描画、#437の正本には差分なし。
CI/reviewの最新状況と最終headはIssue #586とPR #587の引き継ぎコメントを参照。
利用枠補助は現行mainの `tools/agent_quota_guard.py` 45行のSyntaxErrorで取得不能。残量不明として設定は変更していない。
