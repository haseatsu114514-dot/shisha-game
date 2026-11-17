# クラウド：顎に人差し指を添える採用案

2026-11-18（日本時間）のオーナー選定。「やはりこれの右　顎に指の」のスクリーンショット右側を単体化し、「終わったらマージ」の指示で組み込み。

- キャラID: `rei`（†黒羅雨℃†／クラウド）。
- `rei-source.png`: 生成サービスの原画。1049×1500 RGBA、無加工で保存。SHA256 `df8b1f5dd0d56c04b427e786cc63cc419af27d462fb245c0d7691afedd13a035`。
- 髪をかき上げる案ではなく、顎に人差し指を添え、反対の腕を組む最終選定。分け目・赤いメッシュ・薔薇刺繍を維持し、目元は髪で隠す。通常立ち絵は対象外。
- 生成指示の全文: `prompt.txt`。参照は同じ会話に添付されたオーナーの選定スクリーンショット（右の人物）。画面UI・左の人物を除くよう指定した。
- 実装画像: `remake/img/ui/character_intros/graphic/rei.webp`。原画の縦1500pxを1024pxに等比縮小し、左右へ透明余白を足した1024×1024 RGBA WebP（quality92）。切り抜き・描き足し・顔や髪への加工なし。
- `heads.json`: 原画上の頭頂y45／顎y390／顔中心x618を等比換算し、透明余白を加えた `[31,266,576]` を登録。頭頂は上に流れた髪先を除く。
- 配置は既存 `tools/intro_graphic_frames.py` の `frame_for("rei", *heads["rei"])` で算出。高い髪先を保護するSAFE_TOP_IDSと、顎の指先が右の文字へ入りすぎない左位置の下限（SAFE_HAND_LEFT: -310）にreiを追加。生成値は width1220／left-310／top2／right77.9。
- 部分取得環境では既存frame_forの結果でreiの行のみ更新し、他キャラの配置は保持。全素材のあるcheckoutでは `python3 tools/intro_graphic_frames.py` で同じ値を再生成できる。

## 確認

- 実Chromium。現行の `illustratedIntro`・`layoutIntro`・`mountIntro`、本番CSS・本番フォント・本番背景・本番の人物データを使う局所fixtureで描画。
- PC1280×720と横持ちタッチ846×393で、名前・二つ名・一言の画面内配置、画像decode、JavaScriptエラー0、取得失敗0を確認。保存・進行の本編通し検査とは区別する。
- `qa-pc.png`／`qa-phone.png` を目視。頭髪の分け目・顎に添える指・耳飾りが見え、名前・一言との重なりなし。顔の眼・眉は髪で隠れている。灰色の鼻の短いアクセントは選定ポーズの輪郭表現として残る。
- `python3 tools/intro_graphic_frames.py --check` 成功。原画・QA・ゲーム画像のLFS実体をアップロードしてからポインタを保存する。
- 鉄仮面さんの候補は `../../candidates/2026-11-18-salaryman/`。未採用のためゲーム画像を差し替えない。

