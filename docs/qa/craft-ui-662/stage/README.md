# 制作UI 実装比較・第3単位（#662）

選択工程は2カラムを残し、穴あけ・炭焼き・蒸らし・吸い出し・調整は盤面を広げました。844×390では案内・顔・操作の配置と文字サイズを個別に変更。温度計を盤面の近くへ寄せ、実況は左、結果の評価・講評・次へは中央にまとめています。

- before: main `d069102e6dac96368665972bf417744f3b60239f`
- after実装: `0b603af65e3870f9036d8cc6410f980e32dc52a0`（第1・2単位を含む）
- 第1単位と同じseed662、新規セッション、工程、固定時計、機材・葉・温度条件で実DOMを撮影。ユーザーセーブそのものではありません。
- PC 1280×720／Chromiumタッチエミュレーション844×390。実機スマートフォンは未検証です。公開反映前の実装です。

## 変更と検証

|変更|確認|
|---|---|
|操作盤面を広げ、顔・実況を左の小窓へ|9工程×2サイズ18件PASS。ヘルプ・本文・実況の収まりを検査。最後の配合カード調整後も該当ケースPASS|
|横持ちタッチで押せる寸法|ヘルプ、配合±、詰め方、タイマー、穴配置の主要操作は実画面44px以上。基本2種の配合ボタンはスクロールせず表示|
|蒸らしの盤面と操作を分離|論理盤面784×414、当たり判定・速度・成功窓は変更なし。PC移動293→117→293px/s、タッチ280→116→280px/s。精密切替・同時2点タッチ・回復PASS|
|操作から結果へ|操作中の流れるコメントを盤面外へ退避し、結果時に表示。評価◎○△・講評・次へを中央へ。既存craft_focusの実況・結果・PC／横持ち／縦持ち試験PASS|
|工程を通した互換性|通常練習／チュートリアル×PC／横持ち4件で全工程→調整2回→保存済み状態へLOADを確認。通しは既存テスト自動操作、実入力は穴あけ・吸い出し・蒸らしの別試験で確認|

採点・乱数・葉消費・価格・保存形式を変更していません。蒸らしのキー案内はPCだけに小さく表示し、既存タッチ操作は維持。結果を待つ間も操作領域を覆いません。

```sh
BASE_URL=http://127.0.0.1:8127/remake/ node remake/test/browser/craft_guidance.mjs
BASE_URL=http://127.0.0.1:8127/remake/ node remake/test/browser/craft_materials.mjs
BASE_URL=http://127.0.0.1:8127/remake/ node remake/test/browser/craft_routes.mjs
BASE_URL=http://127.0.0.1:8127/remake/ node remake/test/craft_focus.mjs
BASE_URL=http://127.0.0.1:8127/remake/ CHROME_EXECUTABLE_PATH=<既存Chromium> node remake/test/steam_forecast.mjs
```

## 同条件before／after

### PC 1280×720

|工程|before|after|
|---|---|---|
|配合|![before](../before/pc-mix.png)|![after](after/pc-mix.png)|
|詰め方|![before](../before/pc-pack.png)|![after](after/pc-pack.png)|
|穴あけ|![before](../before/pc-holes.png)|![after](after/pc-holes.png)|
|炭配置|![before](../before/pc-place.png)|![after](after/pc-place.png)|
|炭焼き|![before](../before/pc-heat.png)|![after](after/pc-heat.png)|
|時間設定|![before](../before/pc-timer.png)|![after](after/pc-timer.png)|
|蒸らし|![before](../before/pc-steam.png)|![after](after/pc-steam.png)|
|吸い出し|![before](../before/pc-pull.png)|![after](after/pc-pull.png)|
|調整|![before](../before/pc-care.png)|![after](after/pc-care.png)|

### 横持ち 844×390

|工程|before|after|
|---|---|---|
|配合|![before](../before/touch-mix.png)|![after](after/touch-mix.png)|
|詰め方|![before](../before/touch-pack.png)|![after](after/touch-pack.png)|
|穴あけ|![before](../before/touch-holes.png)|![after](after/touch-holes.png)|
|炭配置|![before](../before/touch-place.png)|![after](after/touch-place.png)|
|炭焼き|![before](../before/touch-heat.png)|![after](after/touch-heat.png)|
|時間設定|![before](../before/touch-timer.png)|![after](after/touch-timer.png)|
|蒸らし|![before](../before/touch-steam.png)|![after](after/touch-steam.png)|
|吸い出し|![before](../before/touch-pull.png)|![after](after/touch-pull.png)|
|調整|![before](../before/touch-care.png)|![after](after/touch-care.png)|

## 残る確認・別判断

ヘルプを開いた間の時間・入力停止は次の単位で検証・実装します。通常物語と大会の全経路、各中断点からの復帰はまだ全て確認済みとはしていません。全操作を実機で手動プレイした結果ではありません。

炭配置1択の自動スキップ・炭配置と炭焼き統合は、戻る順序、チュートリアル案内、大会の指定炭、練習モードの履歴を変えるため分離して未実装。タイマー前回値保存・初期値変更もSAVE/LOADと再挑戦の開始条件が変わるため未実装です。これらは表示改善のPRには含めません。
