# アダム・はじめの採用登場背景の修正

2026-10-08、CI58〜61への対応。PR227で接続済みの登場背景だけを生成編集し、本編用PNGへ同じバイトで反映した。人物の立ち絵・紹介の一言・登場タイミング・既読は変更していない。

- アダム：リンゴの葉・枝・花を外し、左の青りんご／右の赤りんごを保持。蛇と古い書物を思わせる彫刻装飾で、エデン／禁断の果実を表現する。実際に読める聖書の文字や人物は描かない。
- はじめ：シーシャ本体・ホース・マウスピースと小さな反復柄を除き、キャップと抽象的な曲線へ整理。
- はじめの肩書き：文言の正本は `data/characters.json` の `hajime.intro_cutin.title`。本編は直接読み込み、紹介専用フォントも正本から再生成する。

各人物フォルダの `source.png` が生成原画で、`assets/ui/character_intros/<id>.png` とバイト一致。`previous-background.png` と `previous-cutin.png` に修正前の背景と実画面を保存した。過去のPR226比較原稿はそのまま保持している。

[アダムの生成指示](adam/prompt.txt)／[はじめの生成指示](hajime/prompt.txt)。入力・出力SHAと実参照は [generation.json](generation.json)。表示用WebPは通常の画像ビルドで生成する。本編に重ねた最新の画面は `review/`、確認結果は `validation.json` に保存する。

## タイトルロゴの追加修正（UX17）

同じ作業中の指示により、タイトルロゴの登場キーフレームから文字をぼかすフィルターを除いた。透明度・移動とロゴ原画は保持。`review/title_early_mobile.png` は登場300msの実画面。開始から1599msまでの確認と、2人のスマートフォン画面は `review/smoke-validation.json`／`review/*_mobile.png` に保存している。
