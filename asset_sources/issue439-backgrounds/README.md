# Issue #439: カフェ店内・施設の夜景

[Issue #439](https://github.com/haseatsu114514-dot/shisha-game/issues/439) に合わせ、カフェは昼夜とも店内から窓越しに外が見える構図へ変更。観音堂は入口・灯籠の灯りで夜景を描き、ジムは照明を保って窓の外だけ夜にする。

内蔵の画像生成機能で6枚を制作した。[全プロンプト](prompts.json)、[生成元とSHA256](inventory.json)、[生成原画](generated/)、[差し替え前のカフェ原画・WebP](previous/) を保存。原画は生成出力と同一バイトで `assets/backgrounds/` に採用し、既存の背景限定ビルドで配信WebPを作成した。

| 画像 | 使い方 |
|---|---|
| `bg_cafe_day.png` | 晴れの店内、既存テラスの内側 |
| `bg_cafe_night.png` | 同じ構図の夜、店内照明と窓の外の夜景 |
| `bg_cafe_overcast_day.png` | くもり・雨の日中、直射日光なし |
| `bg_kannon_night.png` | 昼画のフィルターを使わず、灯籠・入口・夜空を描画 |
| `bg_kannon_overcast_day.png` | くもり・雨の日中、青空・日差しなし |
| `bg_choizap_night.png` | 店内の照明は点灯したまま、窓の外を夜景へ |

生成後に、建物・家具・画角の連続性、昼夜の光源、窓と室内の区別、文字枠の背後の読みやすさを目視確認。シーシャ・人物・実在ロゴは描かない。雨粒は画像に焼き込まず、本編の天候レイヤーで外／窓ガラスだけに表示する。

`node remake/test/browser/issue439.mjs` でPC・横持ちタッチの夜背景選択、夜フィルターなし、カフェ雨の窓限定、翌日の雨停止を確認した。[本番描画12画面の表示証跡](review/) と [天候・背景・窓の検証値](review/validation.json) を保存。生成原画は6枚とも1672×941 RGB。目録の変更は6背景の登録・WebPと生成時刻だけで、他の人物・機材・タイトル目録は保持する。
