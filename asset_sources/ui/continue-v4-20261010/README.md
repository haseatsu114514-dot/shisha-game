# CONTINUE 表示確認（最新: 2026-10-11）

## CV35〜46 参考画像の筆文字・円形HUD・鋭角ボタンを本編採用

最新の添付参考を完成形として再構築。斜めの「コンティニューする？」、右上の実時計HUD、暗いスモークステージ、中央の正規人物、迫る巨大数字、線付きの1行セリフ、金と紫の鋭角ボタン。GAME OVERは同じ筆文字と青紫の発光でシンプルに中央表示。カウントとボタン文字はライブUIで、素材へ焼き込んでいない。

- [完成・アゲハ1080p](neon-reference-20261011/neon-ageha-1080.png) / [スミさん720p](neon-reference-20261011/neon-sumi-720.png) / [スマホ横持ち](neon-reference-20261011/neon-ageha-phone.png)
- [残り5秒](neon-reference-20261011/neon-ageha-5.png) / [迫る残り1秒](neon-reference-20261011/neon-ageha-1.png) / [シンプルなGAME OVER](neon-reference-20261011/neon-game-over.png)
- [初回実画面](neon-reference-20261011/iteration-1.png)から、タイトルを右へ58px・幅824→752px、セリフ34→32px、ボタンとの間隔を修正。長い強調行でも8px以上、ボタン下21px以上を確認。終了ロゴに前行の微小な光が混じらないよう切出し境界も調整。
- [透過アトラス原画](neon-reference-20261011/neon-atlas-original.png) / [完全な生成指示](neon-reference-20261011/neon-atlas.prompt.txt) / [実参照・SHA256・変換記録](neon-reference-20261011/generation.json)
- [実画面の座標・素材読込記録](neon-reference-20261011/verification.json)。再取得は `node asset_sources/ui/continue-v4-20261010/neon-reference-20261011/capture.mjs`。

生成原画は正しい日本語見出し・GAME OVER・文字なしの2色フレームのみ。`build_continue_art.py`で行単位に機械的に切り出し、色や筆跡を変えずにPNG／WebPへ保存。暗いステージは以前の[生成原画](generated/backdrop-stage.png)を採用。煙・スポット光・粒・HUD・斜線・ボタンの選択発光はコードで動かす。1920×1080の構図を既存ステージへ縮尺して他画面を維持する。

[関連6テスト・実大会への影響・CI・画面検品の記録](neon-reference-20261011/test-results.json)。全てPASS、素材欠け・ページエラー0。

既定のプレビューは `continue-preview.html?layout=neon&background=stage`。以下の画像・紫背景・旧ロゴ・比較版は制作時点の記録として保持し、本編の既定を上書きしない。

## CV27〜34 王道配置・上部ボタン・背面カウント・暗いステージの比較版

採用中の下段ボタン版と同じ台詞・表情・カウント15で比較。
実験版は「コンティニュー？ 15 ［する］［諦める］」の横並び。下のボタンを外し、セリフを大きくして人物と台詞を目立たせる。
本編への採用は未決。添付の中央見出し＋人物＋セリフ＋下段2択を「王道」として維持する。
プレビューの「配置」で王道／王道＋迫る背面カウント／上段ボタン／上段ボタン＋背面カウントの4版を切り替えられる。
背景も「紫の煙（採用中）」／「暗いステージ（試用）」を独立して比較できる。

- PC・スミさん: [採用中](top-buttons-experiment/current-sumi.png) / [上にボタン・実験](top-buttons-experiment/top-sumi.png)
- スマホ横持ち・アゲハ: [採用中](top-buttons-experiment/current-phone-ageha.png) / [上にボタン・実験](top-buttons-experiment/top-phone-ageha.png)
- 暗いステージ: [上段ボタン](top-buttons-experiment/stage-top-sumi.png) / [背面カウント15](top-buttons-experiment/back-count-15.png) / [5](top-buttons-experiment/back-count-5.png) / [1](top-buttons-experiment/back-count-1.png)
- [紫背景＋背面カウント](top-buttons-experiment/back-count-purple.png) / [暗いステージ・スマホ横持ち](top-buttons-experiment/stage-phone-ageha.png)
- 王道・アゲハ: [数字なしの背面](top-buttons-experiment/classic-stage-ageha.png) / [かなり大きく迫る数字15](top-buttons-experiment/classic-count-15.png) / [5](top-buttons-experiment/classic-count-5.png) / [1](top-buttons-experiment/classic-count-1.png)
- [王道＋迫る数字・スマホ横持ち](top-buttons-experiment/classic-count-phone-ageha.png) / [同じ版の紫背景](top-buttons-experiment/classic-count-purple.png) / [終了時は数字を非表示](top-buttons-experiment/classic-count-game-over.png)
- [数字を消したGAME OVER](top-buttons-experiment/game-over.png) / [表示検証記録](top-buttons-experiment/verification.json)

背面の数字は濃さ12%で人物の後ろへ置き、台詞送りと独立した20秒の期限に沿って0.65倍→1.55倍へ連続して拡大する。背景タブでは止まり、動き軽減では一定サイズのままカウントする。
王道＋迫る数字版は同じ下段2択とセリフ位置を保ち、全画面の背後へ1000pxの数字を置く。0.75→1.80倍（750→1800px）に拡大し、画面を越えて迫る。数字は人物・セリフ・ボタンを覆わず、上部ボタン版の背面数字より大きい。
GAME OVER時の数字非表示は全版へ反映し、今回の煙と金の透過ロゴを中央へ出す。下の過去画像にある0と旧ロゴは変更前の制作記録。

新素材の原画・完全な指示・SHA256:

- [GAME OVER原画](generated/game-over-smoke.png) / [生成指示](generated/game-over-smoke.prompt.txt) / [生成記録](generated/game-over-smoke.json)。PNGはアルファ余白だけを切り出し、色は変更しない。
- [試用ステージ原画](generated/backdrop-stage.png) / [生成指示](generated/backdrop-stage.prompt.txt) / [生成記録](generated/backdrop-stage.json)。添付2枚を実際の画像参照として生成し、1280×720へLanczos縮小。本編の紫背景は維持する。

`continue-preview.html?layout=back-count&background=stage` で新比較版を選んだ状態から再生できる。
王道＋迫る数字は `continue-preview.html?layout=bottom-back-count&background=stage`。王道そのままは `?layout=bottom&background=stage` で比較する。

検証PASS: `continue_screen`（全18分岐、上段2版×9台本のPC／横持ち、期限・拡大・タブ停止・軽減・セーブ保持）、`continue_audio`・`continue_premium`・`burnt_gameover`（大会の焦げ→反応→再挑戦、レッスン、前日リハーサル）。ページエラー・素材欠け0、台詞lint ERROR 0／既存WARN 345、整形dry-run 0行。画像目録は既存の全項目を保持した。写真取得の再実行はサーバー起動後 `node asset_sources/ui/continue-v4-20261010/top-buttons-experiment/capture.mjs`。
[CIのパス条件と既存mainのPages権限エラー](top-buttons-experiment/ci-review.json)も確認。UIの変更は現在のPR用CIの対象外。同等の台詞lintはローカルで実行している。

## CV22〜26 ボタン・下端までの人物・見出し横カウント

「コンティニュー？ 15」の横並びを中央配置し、セリフを36px上へ移動。
選択肢は明るい「大会に戻る」と紫の「諦める」の2択ボタンに変更し、下に24pxの余白を確保。
顔高256pxを保ち、人物の表示枠を画面下端まで延長。元の人物画像・表情・紫背景はそのまま使用する。

- [スミさん・PC](buttons-inline/sumi.png) / [アゲハ・スマホ横持ち](buttons-inline/phone-ageha.png)
- [つむぎ・PC](buttons-inline/tsumugi.png) / [残り2秒](buttons-inline/urgent.png) / [GAME OVER・0秒](buttons-inline/game-over.png)
- [表示検証記録](buttons-inline/verification.json)

`continue_screen.mjs` PASS。全18分岐とスマホ横持ちの9台本で、セリフと2択の間隔・下の余白・見出し横の数字を確認。
20→0→GAME OVER→タイトル、期限直前の再挑戦、連打、離脱・タブ復帰、ミュート・動き軽減、プレビューのセーブ保持も通過。
実画面の5枚でも、下端までの人物表示と数字の背景・枠・影なしを確認。ページエラー・素材欠け0。

下のCV18〜21以前の画像は変更前の制作記録。

## CV18〜21 日本語見出し・紫の背景・数字だけのカウント

PR #265を最新mainと統合し、追加要望を反映。
見出しは同梱の極太ゴシックで「コンティニュー？」、カウントは背景・枠・影・傾きなしの数字だけ。
顔高を236px→256pxへ少し拡大し、表示枠を432px→502px、下端のフェードを84%→94%へ変更して胴体を下まで映す。

背景は保存されていた藍色の煙背景と同じ構図を保って紫へ画像編集したもの。
[採用原画](generated/backdrop-purple.png)と[実行指示・参照SHA256](generated/backdrop-purple.json)を保存。
`build_continue_art.py` は採用した紫原画をそのまま `assets/ui/continue/backdrop.png` へコピーする。
以前の英字CONTINUEロゴ・藍色の確認画像は制作記録として保持する。

- [スミさん・日本語見出し](purple-japanese/sumi.png) / [残り2秒](purple-japanese/urgent.png)
- [GAME OVER・0秒](purple-japanese/game-over.png) / [スマホ横持ち・アゲハ](purple-japanese/phone-ageha.png)
- [表示検証記録](purple-japanese/verification.json)

`continue_screen.mjs`（全18分岐・中央配置・はみ出しなし・20秒・画面離脱・タブ復帰・横持ち・セーブ保持）、
`continue_audio.mjs`・`continue_premium.mjs`・`bgm_gain.mjs`・`burnt_gameover.mjs` PASS。
後者で大会の焦げ→反応→大会冒頭、レッスン、前日リハーサルを確認。台詞lint ERROR 0、整形dry-run 0行。
マニフェストの競合はmainの制作パーツとPRのCONTINUE素材を両方保ち、再生成後も全項目の保持を確認した。

## CV12〜16 夜の藍色・1行テロップ

オーナー指摘「一枚目が好き　ボタンは無くして」「赤黒は怖い」「テロップは一行が限界」「その分キャラを大きく映す」を反映した最新の実画面。

- [スミさん](night-1line/sumi.png) / [文字が弾んで出る途中](night-1line/sumi-typing.png) / [つむぎ最終行・残り5秒](night-1line/tsumugi.png)
- [可決と反応の1行目](night-1line/meeting-retry.png) / [残り4秒](night-1line/urgent.png) / [GAME OVER](night-1line/game-over.png)
- [恋人5人とスミさんの一覧](night-1line/heroines-grid.png) / [スマホ横持ち](night-1line/phone-ageha.png)

背景とロゴは下の生成原画を `build_continue_art.py` で色替えしたもの（赤い煙→藍〜青緑、ロゴの赤い影→青）。
ボタン画像は使わない（下のA／B／C比較は経緯として保存）。

## CV01〜11 時点

本編1280×720とスマホ横持ち844×390の実画面を、Chromiumから撮影したもの。
オーナーの指定どおり、中央へロゴ→人物→テロップ→2択を縦に並べる。
顔に加えて肩・胸元まで見せ、右上のカウントは大きい明るいプレートに載せる。
正規立ち絵・表情・色を保持し、UI用のロゴ・スタンプ・ボタン・背景を画像生成した。

ボタンの比較:

- [A 文字が主役](buttons-a-text.png): 枠を抑え、大きな文字を押す。
- [B アーケード風](buttons-b-arcade.png): 朱赤とオフホワイトの生成ボタンを斜めに置く。
- [C CONTINUE表記](buttons-c-continue.png): 生成ボタンをまっすぐ置き、戻る側をCONTINUE表記にする。

- [スミさん・共同責任](sumi.png) / [世界の終わり](sumi-disaster.png) / [反対多数](sumi-meeting.png)
- [つむぎ](tsumugi.png) / [栞](minto.png) / [凛](rin.png)
- [アゲハ](ageha.png) / [ましろ](mashiro.png) / [サメちゃん](samechan.png)
- [可決スタンプと再挑戦の一言](meeting-retry.png) / [サメちゃんの再出航](samechan-retry.png)
- [スマホ横持ち・つむぎ最終キュー・動き軽減](phone-tsumugi.png)
- [時間切れのGAME OVERと00](game-over.png)

`python3 remake/tools/serve_preview.py --port 8123` でサーバーを起動し、
`http://127.0.0.1:8123/remake/continue-preview.html` へアクセスすると、9台本と2分岐を再生できる。
SE/BGM切替、動き軽減もプレビューで確認可能。セーブは変更しない。

生成素材:

| 素材 | 原画 | 実行時PNG |
|---|---|---|
| CONTINUE?／GAME OVER | [titles.png](generated/titles.png) | `assets/ui/continue/{continue_title,game_over_title}.png` |
| 可決の朱印 | [stamp.png](generated/stamp.png) | `assets/ui/continue/approval_stamp.png` |
| 朱赤／オフホワイトのボタン | [buttons.png](generated/buttons.png) | CV12で不使用（原画のみ保存） |
| 暗い煙の背景 | [backdrop.png](generated/backdrop.png) | `assets/ui/continue/backdrop.png`（藍色へ色替え） |

最初の4生成の全指示は [prompts.json](generated/prompts.json)。ボタンを背景から浮かせる修正は
[buttons-revision.json](generated/buttons-revision.json)、元の暗い版は [buttons-initial.png](generated/buttons-initial.png)。
パーツは透過PNG、背景はRGB。CV13以降、背景とロゴの赤だけを藍〜青へ色替えする（輪郭・アルファは保持）。
ボタンの文言・20→0・演出タイミングはコード側で表示する。

再ビルド:

```sh
python3 remake/tools/build_continue_art.py
python3 remake/tools/build_manifest.py
```

原画はそのまま保存し、切り出した素材は `assets/ui/continue/`、表示用のWebPは
`remake/img/ui/continue/`。顔の中心・倍率は既存 `make_face_icons.face_box` の測定から
`manifest.continuePortraits` へ自動記録し、元の人物画像をCSSで拡大・配置する。

検証の詳細と台詞の正本は [V4仕様](../../../docs/spec/continue_button_reactions_sfx_20261010.md)。
全18分岐、全45キューの字幕と正規画像、常時カウント、20秒→GAME OVER→タイトル、
期限直前の再挑戦、連打防止、画面離脱、タブ復帰、横持ち、軽減、ミュートがPASS。
実ChromiumのWebAudio出力を解析し、SEの音声サンプルがあり、離脱後は無音になることも確認した。
