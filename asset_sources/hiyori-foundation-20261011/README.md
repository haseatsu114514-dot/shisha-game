# 泡沢ひより・本心表示とルート基盤の検証（2026-10-11）

実装コミット `887cb99`。本番のVN・データローダー・恋愛／友人・セーブ処理をChromiumで確認した記録。
第1章の正式な登場イベントは未接続。立ち絵・顔アイコンは素材待ちで、他人の絵や架空の画像参照は使っていない。
作業中にmainへ入った遠距離・同行方針の文書変更も取り込み、[引き継ぎ仕様](../../docs/spec/hiyori_implementation.md)へ反映した。

## 表示確認

| 画面 | 本心が括弧内に出る場面 | 同じ気持ちが表の台詞になる場面 |
|---|---|---|
| PC 1280×720 | [desktop-inner.png](desktop-inner.png) | [desktop-spoken.png](desktop-spoken.png) |
| スマホ横持ち 844×390 | [mobile-inner.png](mobile-inner.png) | [mobile-spoken.png](mobile-spoken.png) |

淡いピンクの本心は表の台詞より小さく、別の段に表示。表の台詞を先に送り、本心には発話の文字送り音を付けない。
「帰りたくない」を初めて口に出す行では本心の段を消し、通常の会話枠へ戻る。PC・スマホの4画面を目視確認。
斧投げサンプルは背景も素材待ちのため暗い画面で試写する。

## 実行結果

| 検査 | 結果 |
|---|---|
| `remake/test/hiyori.mjs` | 9項目PASS。ページエラー0、HTTPエラー／素材欠け0。[生の結果](test-results.json) |
| `remake/test/browser/save_load.mjs` | 6項目PASS。[生の結果](save-load-results.json) |
| `remake/test/data_loading.mjs` | 35ファイル、同時読込上限4、通信失敗・タイムアウトがPASS |
| `remake/test/text_wrap.mjs` | 5,424台詞PASS。本心の長文改ページは専用ブラウザ検証で確認 |
| `remake/test/daily_consistency.mjs` | PASS |
| `tools/lint_dialogue.py` | ERROR 0／WARN 345。変更前もWARN 345で、追加したひより台本のWARNは0 |
| `tools/tidy_dialogue_text.py --dry-run` | 0行 |
| `tools/check_legacy_terms.py` | ERROR 0。既存の台帳履歴に警告1件 |
| JS/MJS構文・変更JSON・`git diff --check` | 正常 |
| `remake/test/lime_consistency.mjs` | **FAIL（既存のテスト不備）**。`phone.js` がimportする `yen` をテスト側の `util.js` モックがexportせず、リンク時に停止 |

LIME検査のエラーは `SyntaxError: The requested module '../core/util.js' does not provide an export named 'yen'`。
`lime_consistency.mjs`・`daily/phone.js`・`core/util.js` はmainと同一で、ひよりの変更に含めていない。
このテストを成功扱いにせず、今回の関係性と保存の検証は実ブラウザの本番モジュールで実施した。

専用9項目では、表→本心の順序、発話音なし、クリック、他キャラの通常表示、ログの区別、HTMLエスケープ、長い本心、知識／報酬キューへの非接続、PC／スマホ、AUTO中のログ停止、SKIPと選択肢、読了と再読／同時実行、質問→締めくくり→告白／友人、デート／友人会話の本心、章条件、旧schema7からの保存、既存恋人との併存を確認。
正式台本と贈り物の代用品はテスト内でのみ注入し、配信データには登録していない。
第1〜5章の状態を切り替えた条件確認であり、第2章以降の通しプレイではない。

## 手元での確認

```bash
python3 remake/tools/serve_preview.py --port 8123
# 別ターミナル
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/hiyori.mjs
```

表示の試写は `http://127.0.0.1:8123/remake/hiyori-preview.html`。
「儚い台詞と本心」「斧投げで演技が崩れる」「総務の仕事と気分転換」「本心が初めて声になる」「恋人になっても儚い女ごっこ」の5本。
試写はメモリ上だけの仮状態を使用し、本編のセーブ・設定・localStorage・sessionStorageを変えないことも実測済み。
通常ブラウザの表の台詞と返事だけを追っても、はじめが読めない本心を知っている会話にはしない。

ESモジュールとJSONを直接配信するためバンドルのビルドは不要。画像目録へ新規アセットを追加していない。
必要な参照原本・5衣装・13表情・斧投げ背景・正式台本などは[残タスク一覧](../../docs/spec/hiyori_implementation.md#残タスク)を参照。
