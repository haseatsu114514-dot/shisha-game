# タイトル限定・DS風2画面試作（#554 / Draft PR #555）

通常版を残した試作です。オーナー確認までマージ・公開しません。新規の原画生成・置換はありません。

## 試す・戻す

`codex/554-title-dual-screen`をcheckoutし、リポジトリのルートから実行します。

```sh
python3 remake/tools/serve_preview.py --port 8123
```

`http://127.0.0.1:8123/remake/`を開き、上端の「DS風」を選択します。初期状態は通常版です。
「通常版」で即時復帰できます。通常版のスマホ縦持ち案内は従来どおり残し、メニューは横持ちで操作します。
縦持ち案内の手前にもDS切替・復旧入口を表示します。DS版はスマホ縦で同寸の上下、PCで左右です。
小さい画面ではタイトル／操作パネル内をスクロールでき、ボタンを縮めません。

表示が壊れた場合は `http://127.0.0.1:8123/remake/?titleLayout=normal` を開き直してください。
このURLは保存済みDS設定より通常版を優先し、ゲーム中LOADの自動再開予約があってもタイトルを開きます。
ゲームのセーブは読み替えません。明示的に「DS風」を選ぶと復旧パラメータを外します。

表示設定は `suien_title_layout` のみで、ゲームのオート／手動セーブ・configとは別です。
不正値、読み書き不能、専用CSSの読込失敗では通常版。復旧入口の最低限の配置は専用CSSに依存しません。
タイトルを離れるとDS寸法・パネル・入口が解除され、会話・マップ・制作は現行UIです。

## 比較（同じ正式採用済み原画）

| 画面 | 通常版 | DS風 |
| --- | --- | --- |
| PC 1280×720 | [通常版](pc-normal.png) | [左右2画面](pc-ds.png) |
| スマホ縦 390×844 | [従来の縦持ち案内＋切替入口](phone-normal.png) | [上下2画面](phone-ds.png) |
| スマホ横 844×390 | [通常版のメニュー](phone-normal-landscape.png) | — |

原画は`comparison-art.json`に記録。縦横比を保ち、顔にロゴを重ねません。背景も既存採用素材です。
見本の濃紫・金色の細い縁を参考にし、太い本体枠・ヒンジ・画像内文字のボタン化は行っていません。

## 検証

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/title_layout.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/save_load.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/hiyori_title_five.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node docs/qa/title-layout/capture.mjs
```

別ポートでは`BASE_URL=http://127.0.0.1:8124/remake/`を指定します。
ブラウザは使い捨てcontextで、プレイヤーの保存には触れません。テスト結果JSONとソースハッシュを同梱します。

- タイトル18ケース：PC／スマホ、両モードの全5メニュー、Enterの既存ボタン操作、再読込、通常復帰、同じ原画を保持。比較撮影でもTab→Enterによる設定ボタン操作を検証。
- 復旧URL＋再開予約＋セーブ保持、不正設定、保存済みDS設定の読込／書込失敗、両モードの画像失敗、専用CSS欠落。
- 320×568の同寸パネルと先頭／末尾の実ボタン、NEW GAMEから現行会話、実マップ・実制作台への遷移と寸法復帰。
- 既存保存／ロード6ケース、ひより正式タイトル5ケース。初回CIの縦持ち案内の回帰は本体側で修正し、既存assertは変更していません。
- 初回の自作テストは重複セレクタ、タイトルLOADにない確認ボタン待ち、会話開始を画面IDだけで待つfixture誤りを修正。初期実行を中断して修正後に全件再実行しました。

実機Safariは未検証。ローカルの操作・画像比較が対象で、本試作は公開していません。
予約はDraft承認待ちとして保持します。確認後は最新main、CI、競合、レビュー条件を再確認してから採用判断します。
