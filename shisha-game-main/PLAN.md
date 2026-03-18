# Game Plan: Shisha Battle — Chapter 1 Asset Update

## Game Description

既存のシーシャゲーム（~/shisha-game-main）の1章をアップデート。UIと背景アセットを改善・新規生成。
16-bitピクセルアートスタイル、日本の都市・シーシャラウンジ雰囲気、ダーク背景にネオン・暖色ライトアクセント。
プレースホルダー（単色ベタ塗り）のPNGを全て実際のアートワークに差し替える。

## 1. 背景アセット生成（店舗・室内）

- **Status:** done
- **Depends on:** (none)
- **Goal:** tonari外観・主人公の部屋・各キャラの店舗背景を16-bitピクセルアートで生成し、プレースホルダーを差し替える
- **Targets:**
  - assets/backgrounds/bg_tonari_outside.png
  - assets/backgrounds/bg_home.png
  - assets/backgrounds/bg_shop.png
  - assets/backgrounds/bg_naru_shop.png
  - assets/backgrounds/bg_adam_shop.png
  - assets/backgrounds/bg_ryuji_shop.png
- **Assets needed:**
  - bg_tonari_outside: 日本の路地裏、外からシーシャバーを見た夜景、外照明がネオンで光る、16-bit pixel art, 1280x720
  - bg_home: 若者の和室ワンルーム、夜、畳と布団、窓から街の灯り、16-bit pixel art, 1280x720
  - bg_shop: C.STATIONシーシャ店、現代的でオシャレな内装、昼、ガラス張りカウンター、16-bit pixel art, 1280x720
  - bg_naru_shop: ライバル・なるの店、少しギラギラした若者向けシーシャ店、16-bit pixel art, 1280x720
  - bg_adam_shop: アダムの店、上品なダブルアップル専門シーシャ店、ミドルイースト風インテリア、16-bit pixel art, 1280x720
  - bg_ryuji_shop: りゅうじの店（C.STATION系）、16-bit pixel art, 1280x720
- **Verify:** 全6枚が単色ではなく実際のピクセルアート背景になっていること。各場所の雰囲気が伝わること。

## 2. 背景アセット生成（屋外・タイトル・大会）

- **Status:** done
- **Depends on:** (none)
- **Goal:** タイトル画面・大会ステージ・日中夜間の街並みを生成し、プレースホルダーを差し替える
- **Targets:**
  - assets/backgrounds/bg_title.png
  - assets/backgrounds/bg_tournament_stage.png
  - assets/backgrounds/bg_street_day.png
  - assets/backgrounds/bg_street_night.png
- **Assets needed:**
  - bg_title: 夜のシーシャラウンジ全景、タイトル画面用ムードカット、紫・青のネオンで幻想的、16-bit pixel art, 1280x720
  - bg_tournament_stage: SMOKE CROWN CUPの大会ステージ、コンテスト会場、スポットライト、4席のテーブル、ビッグバナー、16-bit pixel art, 1280x720
  - bg_street_day: 日本の地方都市の路地・商店街、昼間、活気ある街並み、シーシャ関連看板、16-bit pixel art, 1280x720
  - bg_street_night: 同じ通りの夜景版、ネオンサイン、街灯、深夜ムード、16-bit pixel art, 1280x720
- **Verify:** 4枚全てが単色ではないこと。タイトル用はムードがあること。大会ステージはSMOKE CROWN CUPらしいこと。

## 3. UIアセット生成

- **Status:** done
- **Depends on:** (none)
- **Goal:** ダイアログボックス・名前タグ・タイトルロゴ・ボタン類を16-bitピクセルアートで生成し差し替える
- **Targets:**
  - assets/ui/ui_dialogue_box.png
  - assets/ui/ui_dialogue_namebox.png
  - assets/ui/ui_title_logo.png
  - assets/ui/ui_button_normal.png
  - assets/ui/ui_button_hover.png
  - assets/ui/ui_button_pressed.png
- **Assets needed:**
  - ui_dialogue_box: 横長の半透明ダークパネル、ピクセルアートの縁取り、紫/青のグラデーション、テキスト表示エリア、1100x200px
  - ui_dialogue_namebox: 小さめの名前表示タグ、左上に配置想定、同一スタイル、300x60px
  - ui_title_logo: ゲームタイトル「シーシャバトル」または「SHISHA BATTLE」の装飾ロゴ、煙エフェクト付き
  - ui_button_normal: ピクセルアートのメニューボタン、暗い紫系、通常状態
  - ui_button_hover: 同ボタンのホバー状態（明るくなる）
  - ui_button_pressed: 同ボタンの押下状態（凹む）
- **Verify:** 各UIパーツが単色ではなくデザインされていること。dialogue_boxはテキストが読みやすい背景色・透明度を持つこと。

