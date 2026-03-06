# subscription_reminder_gas

サブスクの期限を Google スプレッドシートで管理し、期限前に LINE 公式アカウントから自動リマインドする GAS です。

## 対応機能
- 期限前の 3 回リマインド（既定: `7,3,1` 日前。行ごと上書き可）
- 決済方法の管理（例: まとめて支払い、クレジットカード、デビットなど）
- 通知停止方法
  - スプレッドシートのチェックボックスで停止
  - LINE メッセージ操作で停止/再開
- 通知重複防止（送信履歴キーを記録）

## ファイル
- `Code.gs`: GAS 本体
- `appsscript.json`: Apps Script マニフェスト

## スプレッドシート列
シート名は既定で `Subscriptions`（`SHEET_NAME` で変更可）。

`A:ID`  
`B:サービス名`  
`C:期限日`  
`D:金額`  
`E:決済方法`  
`F:停止(シート)` ← チェックで停止  
`G:通知日(カンマ区切り)` ← 例 `7,3,1`  
`H:LINEユーザーID`  
`I:停止(LINE)` ← LINE 操作で自動更新  
`J:通知履歴キー`  
`K:メモ`

## Script Properties
- `SPREADSHEET_ID` (必須): 管理対象スプレッドシートID
- `LINE_CHANNEL_ACCESS_TOKEN` (必須): LINE Messaging API のチャネルアクセストークン
- `SHEET_NAME` (任意): 既定 `Subscriptions`
- `REMINDER_DAYS_DEFAULT` (任意): 既定 `7,3,1`
- `PAYMENT_METHOD_OPTIONS` (任意): 決済方法プルダウン候補（カンマ区切り）
- `TARGET_USER_ID` (任意): 行に `LINEユーザーID` 未設定時の送信先
- `DAILY_TRIGGER_HOUR` (任意): 定期実行時刻（0-23, 既定 9）

## 初期セットアップ
1. GAS プロジェクトに `Code.gs` と `appsscript.json` を配置
2. Script Properties を設定
3. `setupAll()` を 1 回実行（シート初期化 + トリガー作成）
4. GAS をウェブアプリとしてデプロイ（`doPost`）
5. LINE Developers の Webhook URL にデプロイ URL を設定
6. Bot に1回メッセージを送って連携確認（`TARGET_USER_ID` が自動保存される）
7. 必要なら `sendTestNotification()` を実行して疎通確認

## LINE コマンド
- `一覧`: サブスク一覧（決済方法を含む）
- `支払い一覧`: 決済方法ごとの内訳
- `停止 <ID>`: 指定IDの LINE 通知停止
- `再開 <ID>`: 指定IDの LINE 通知再開
- `停止 全部`: 一括停止
- `再開 全部`: 一括再開

例:
- `停止 SUB-AB12CD34`
- `支払い一覧`

## 通知停止の優先順位
1. `停止(シート)` が ON の行は通知しない
2. `停止(LINE)` が ON の行は通知しない
3. 両方 OFF かつ期限条件一致時のみ通知

## 補足
- `ID` は空欄なら自動採番されます。
- `決済方法` 列はプルダウン候補を設定済み（自由入力も可）。
- リマインド本文に `決済方法` を含めて送信します。
- `通知日(カンマ区切り)` が空欄の場合は `REMINDER_DAYS_DEFAULT` を使います。
