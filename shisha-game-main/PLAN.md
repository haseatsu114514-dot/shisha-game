# Game Plan: Shisha Battle — 大会UIリデザイン＆バグ修正

## Game Description

既存のシーシャゲーム（~/shisha-game-main）の大会パート（シーシャ作りミニゲーム）UIを
ダンガンロンパ/ペルソナ/ディバインゲート風にリデザイン。煙モチーフ、紫×黒基調。
ノベルパートはシンプルのまま維持。バグ修正も含む。

---

## 1. バグ修正: 孤立ファイル削除 & SPEAKER_NAMES 補完

- **Status:** done
- **Depends on:** (none)
- **Targets:**
  - scripts/autoload/dialogue_box.gd
  - scripts/tournament/ch1_tournament.gd
- **Goal:**
  - `scripts/autoload/dialogue_box.gd`（使われていない旧コピー）を削除
  - 大会の `SPEAKER_NAMES` に不足キャラ（tsumugi, mashiro, salaryman, kirishima 等）を追加
- **Requirements:**
  - autoload版は project.godot にもシーンにも参照されていないことを確認してから削除
  - SPEAKER_NAMES は `scripts/ui/dialogue_box.gd` 側のマッピングと整合させる
- **Verify:** `godot --headless --quit` でパースエラーなし。削除したファイルへの参照が残っていないこと。

## 2. 大会UI用アセット生成（パネル・背景）

- **Status:** done
- **Depends on:** (none)
- **Targets:**
  - assets/ui/ui_tournament_main_panel.png
  - assets/ui/ui_tournament_side_panel.png
  - assets/ui/ui_tournament_header.png
  - assets/ui/ui_tournament_fullscreen_bg.png
  - assets/ui/ui_tournament_step_card.png
  - assets/ui/ui_mini_dialogue_bg.png
- **Goal:** 大会パート専用のUIパネルアセットをダンガンロンパ/ペルソナ風に生成。煙モチーフ、紫×黒基調、おしゃれなデザイン
- **Assets needed:**
  - ui_tournament_main_panel: メインパネル背景、黒ベースに紫のグロウ縁取り、煙テクスチャ、半透明、900x666px
  - ui_tournament_side_panel: サイドパネル背景、同系統スタイル、380x666px
  - ui_tournament_header: ステップ名ヘッダーバー、グラデーション紫→黒、煙の装飾、1280x60px
  - ui_tournament_fullscreen_bg: 没入モード全画面背景、暗い紫の煙が渦巻く、1280x720px
  - ui_tournament_step_card: ステップカード枠、コンパクトなカード風、紫の枠線とグロウ、300x110px
  - ui_mini_dialogue_bg: ミニ会話パネル背景、小さめの煙テクスチャ付きパネル、600x140px
- **Verify:** 全アセットが単色ではなく、煙モチーフ・紫黒基調のスタイリッシュなデザインになっていること

## 3. 大会UI用アセット生成（ゲージ・ボタン・エフェクト）

- **Status:** done
- **Depends on:** (none)
- **Targets:**
  - assets/ui/ui_tournament_button_normal.png
  - assets/ui/ui_tournament_button_hover.png
  - assets/ui/ui_tournament_button_pressed.png
  - assets/ui/ui_tournament_gauge_frame.png
  - assets/ui/ui_tournament_gauge_fill.png
  - assets/ui/ui_tournament_choice_box.png
  - assets/ui/ui_smoke_particle.png
- **Goal:** 大会専用のボタン・ゲージ・選択肢ボックスをペルソナ/ダンガンロンパ風に生成
- **Assets needed:**
  - ui_tournament_button_normal: 紫グラデーションの角丸ボタン、煙装飾、400x64px
  - ui_tournament_button_hover: 同ボタンのホバー（グロウ強化、紫が明るく）、400x64px
  - ui_tournament_button_pressed: 同ボタンの押下（凹み、暗め）、400x64px
  - ui_tournament_gauge_frame: ゲージ外枠（温度・吸い出し用）、横長、紫のメタリック枠、600x48px
  - ui_tournament_gauge_fill: ゲージ中身（グラデーション紫→ピンク→赤）、590x40px
  - ui_tournament_choice_box: 選択肢パネル、ペルソナ風の斜めカット付き枠、700x60px
  - ui_smoke_particle: 煙パーティクル用テクスチャ、白〜紫のソフトな煙、128x128px
- **Verify:** ボタン3種の差異が明確。ゲージが横長で視認性が高いこと。

## 4. 大会シーン（tscn）レイアウトリデザイン

- **Status:** done
- **Depends on:** 2, 3
- **Targets:**
  - scenes/tournament/ch1_tournament.tscn
- **Goal:** 生成したアセットを使って大会シーンのレイアウトを刷新。パネルにテクスチャ背景を適用、フルスクリーンモードを煙エフェクト付きに
- **Requirements:**
  - MainPanel / SidePanel にテクスチャ背景を設定（NinePatchRect or StyleBoxTexture）
  - FullscreenStage に全画面煙背景を適用
  - StepCard にカード枠テクスチャ
  - ChoiceContainer のボタンスタイルを大会専用に
  - MiniDialoguePanel に専用背景
  - ヘッダー部分を装飾付きに
  - フォントカラーを白/紫系に統一
- **Verify:** godot --headless --quit でパースエラーなし。シーンツリーが壊れていないこと。

## 5. 大会スクリプト: UIスタイル適用＆動的生成部分の更新

- **Status:** done
- **Depends on:** 4
- **Targets:**
  - scripts/tournament/ch1_tournament.gd
- **Goal:** コード内で動的に生成しているUI要素（ボタン、ゲージ、弾幕など）に新しいスタイルを適用
- **Requirements:**
  - _add_choice_button() 等のボタン生成で新アセットのテクスチャを使用
  - _TempGaugeVisual の描画色を紫×黒テーマに変更
  - _PullGaugeVisual の描画色も統一
  - 弾幕（MindBarrage）のビジュアルを煙テーマに
  - ステップ遷移時の演出色を紫系に統一
  - SPEAKER_NAMES の修正もこのタスクで反映
- **Verify:** godot --headless --quit でパースエラーなし。ボタンや演出が新テーマカラーになっていること。

## 6. 煙パーティクルエフェクト追加

- **Status:** done
- **Depends on:** 3, 4
- **Targets:**
  - scenes/tournament/ch1_tournament.tscn
  - scripts/tournament/ch1_tournament.gd
- **Goal:** 大会シーンに常時表示される煙パーティクル演出を追加。ペルソナ/ダンガンロンパのような雰囲気を出す
- **Requirements:**
  - GPUParticles2D または CPUParticles2D で紫の煙を背景にゆっくり漂わせる
  - フルスクリーンモード時は密度を上げる
  - ステップ遷移時に煙が一瞬濃くなるトランジション
  - パフォーマンスに影響しない程度（particle数は控えめ）
- **Verify:** パースエラーなし。煙が自然に漂い、UIの視認性を邪魔しないこと。
