# 第1章の読み込み待ち — Issue #609

Base: `4834e9eccb54d7aff466cac03bf784b5227e5735`。この記録は独立レビュー用 Draft の作業中記録。公開版の変更・マージは行わない。

## 確定した原因

1. `setBg` の戻り値は画像取得・デコードだけでなく、場面転換の幕が開き終わるまで待つ。VN の500ms、作業台の220msの読み込み判定もこの全体を待つため、キャッシュ済みでも意図的な演出を読み込みと誤判定する。
2. VN の `firstPortraits` は表示開始行に関係なく台本を走査し、2種類の表情を開始条件にしていた。`remake_tutorial_result` の最初の地の文は立ち絵なしだが、次のスミの笑顔を1.8秒遅延すると開始までPC 1833.7ms、touch 1820.7ms。修正後PC 2.1ms（touchと最終集計は後述予定）。実際にその表情を使う行は引き続き取得・デコードを待つ。

`setBg().assetsReady` で画像と演出の完了条件を分ける。従来の戻り値をawaitする呼び出し元の契約、演出時間、入力ロック、15秒上限、失敗時再取得、先読み上限を維持する。作業台は資産待ちと操作禁止を別カウンターで管理する。

## 修正前の実測

公開版の取得済み背景2種を交互に切り替える実エンジンの再現は、PC・横向きtouch各4回で毎回約0.73秒のVN表示。対象切替のResource Timingは各回0件。これは公開版での局所再現であり、公開版の章通し・物理スマホの確認ではない。

ローカルPC相当の既存 `playthrough.mjs` は第1章Day 1–14・敗北→再挑戦→優勝までPASS。VN表示64回/50.866秒、作業台15回/15.242秒。PCとtouchの前後比較を直列実行中。

## 検証

実行済み: 新規局所テストの最初の10ケース、既存 `tutorial_transition` 3 / `vn_visual_readiness` 4 / `navigation_transitions` 7 / `craft_readiness` 3 / `save_load` 6 / `continue_readiness` 3 = 26ケースPASS。追加AUTO・作業台再入場ケース、制限回線、章通し修正後の集計は実行待ち。

既存テストのタイムアウト・アサーションは変更していない。章通しランナーはVN turboとcraft自動操作を使う既存の固定経路で、通常の読書時間や全分岐の体験時間ではない。

## 再現コマンド

`remake/test/browser` の既存の固定Playwright依存をインストールし、`NODE_PATH` をその `node_modules` に設定する。必要なら `CHROME_EXECUTABLE_PATH` をChrome実行ファイルへ設定する。

```sh
python3 remake/tools/serve_load_audit.py --port 8609
# 別ターミナル、同じ専用checkout。変更した3モジュールだけを指定baseから読み取る。
python3 remake/tools/serve_loading_baseline.py --ref 4834e9eccb54d7aff466cac03bf784b5227e5735 --port 8610
BASE_URL=http://127.0.0.1:8609/remake/ node remake/test/browser/ch1_loading.mjs
BASE_URL=http://127.0.0.1:8609/remake/ AUDIT_DIR=.codex/artifacts/loading-after node remake/tools/measure_ch1_loading.mjs
BASE_URL=http://127.0.0.1:8610/remake/ MOBILE=1 AUDIT_DIR=.codex/artifacts/loading-before-touch node remake/tools/measure_ch1_loading.mjs
BASE_URL=http://127.0.0.1:8609/remake/ AUDIT_DIR=.codex/artifacts/loading-matrix-after node remake/tools/measure_loading_matrix.mjs
```

配信はgzip/Range/600秒キャッシュのlocalhostモデル。制限回線は起動後の場面に128KiB/s・150msを適用し、タイトル起動時間には適用しない。計測ツールはゲームのセーブを使わず隔離contextで動く。

## 過去対策との関係・範囲外

- #308 / PR #362: 同じ背景で初めて出る立ち絵を待つ間の無反応への案内と、使い切った画像待ち上限の繰り返しを解消。今回の演出時間との混同、後続表情の開始前待ちは残った。
- PR #302: タイトル画像の絞り込み、SKIP時の実画像/CG/演出待ち、CONTINUE準備。今回はその待ち保証を維持する。
- #503 / PR #541: 作業台全素材の待機を現在工程に絞った。既存テストの再入場は同じ背景で、背景が変わった後の演出待ちを含まなかった。
- `docs/player_load_capacity_20261010.md` は転送量の計測。全章の大きなBGM転送と、VN読み込み表示の待ち条件は別であり、本変更で音声転送量を解決したとはしない。

#590顔アップ、#594checkpoint、#586素材公開確認、章題プレビュー、PR #580/#481の地図・在店のコードは変更・取り込みしない。物理端末/Safariと修正版の公開配信は未検証。
