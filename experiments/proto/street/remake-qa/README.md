# 第1章ハリボテ接続の操作確認

オーナーの2026-10-13依頼、Issue #456 / PR #458（旧URL修正）/ PR #460（接続）。新しい街・制作課題・練習頻度・画像は追加せず、既存 stage=set を使用する。単体の休止記録は上位READMEに保持。

## 実行した検証

| 検証 | 結果・証跡 |
|---|---|
| PR #458 の修正版 `smoke.mjs` で現行試作を検証 | 標準/HD/set × 画像あり/404、230項目 PASS。接続後の同じ単体回帰も PASS。`proto-smoke.txt` |
| `node remake/test/browser/street_selection.mjs` | 33項目 PASS。PC 1280×720、Chromiumの横持ちタッチ844×390。`selection.txt` |
| `node remake/test/playthrough.mjs` | DAY1〜14、敗北→再挑戦→優勝・章クリア、案内3回/配達2回、LIME、実手動セーブ/ロード、スロット pending=0 PASS。`direct-playthrough.txt` |
| `STREET_MODE=1 node remake/test/playthrough.mjs` | 歩行経由でも章クリアまで到達。最初のrunは不固定の抽選回数下限で失敗、次runはテスト専用importがframeに注入された404で失敗。テストをseed=1と本編だけの計測へ修正し、計測フックのframe注入と旧fixtureの材料制限を修正後、Actions 38283303619 のdirect/street両経路がDAY14の敗北→再挑戦→優勝までPASS。`street-playthrough-ci.txt` / `direct-playthrough-ci.txt`。最終headはPRで確認する |
| `node --experimental-vm-modules remake/test/illness.mjs` | 発病、休養、全日休養・夜予定など PASS。`illness.txt` |
| `node remake/test/temporary_closures.mjs` | 3店の臨時休業、実通知/マップ/保存、翌日/章の解除 PASS。`temporary-closures.txt` |
| `node remake/test/browser/save_load.mjs` | 全枠・旧schema5・欠落JSON・PC/タッチ/画面回転の6件 PASS。`save-load.txt` |
| `python3 tools/check_agent_docs.py` / JS構文 / diff / Git Safety | PASS |

BASE_URL は新規の独立checkoutを配信した `http://127.0.0.1:8146/remake/`。単体試作のBASE_URLは `/`。
PC/タッチの各条件で追加ボタンと全ての既存ピンの矩形が重ならないことも検査。ボタンはピンとスロットの間の下部に置く。

33項目は、実キー/タッチ移動・実タップ入店・小物を調べる・戻るの無消費、6種の入口制限、3ID、無料配達、実LIMEの受諾/中断、MENU/手動枠/実boot-load、旧schema11、昼夜、スロット表示の二重報酬なし、欠落画像の代替を含む。ファストトラベルは試作保存を無視し、本編実訪問だけで解放する。

## 画面証跡

- [PC・昼・本物のHUD/手動セーブ](pc-day.png)
- [横持ちタッチ・昼](touch-day.png)
- [夜・既存スロット表示](pc-slot.png)（旧セーブの読込/未提示結果の専用fixture。HUD確認は昼の実日常fixtureで実施）

画像は既存ゲームのブラウザ画面。仮歩行絵の表示、入口の料金/イベント印、通り上のキャラに操作ボタンが重ならないことを目視した。

## 未確認・統合時の注意

- スマホ物理端末・Safariは未確認。タッチはChromiumエミュレーションである。
- mainへのマージ・公開版の接続は未実施。最新headのCIとレビュー結果はPRを参照し、pending/失敗を成功として扱わない。
- 初回接続CIのMotion endingsはチェキのペン着地チェックで失敗。同じ未変更のテストをmain #440後（5fec373e）のActions 38280842584で実行すると成功。街歩きとの因果は未確定で、チェキのJS/テストはこのPRで変更していない。
- 未マージ #448 は chooseSpot の背景待ち/プレビュー、#379 は go の onBeforeGo を変更予定。統合時は両方を残す。#379が先に入る場合、歩行入口にも同じ確認フックを通し、誘い確認/中断を再検証する。これらのworkerのIssueやブランチは変更しない。
- 保存に街歩きの新規項目はない。到着では訪問済みにせず、入店/読了は従来の訪問・イベント処理だけが記録する。歩行位置・ダッシュ設定は一時状態で、ロード/再入場は安全な入口に戻る。
