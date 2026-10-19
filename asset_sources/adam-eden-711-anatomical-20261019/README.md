# #711 アダム・EDEN：本人基準の配色修正

**素材の局所補正と配信用更新を保存したPR候補。本編のPC・横持ちタッチの最新head CIと、取得した画面の目視確認は実行待ち。** 通常絵の生成試作 `normal-01` は引き続き不採用。採用候補は既存原画の色だけをマスクで補正した版である。

[Issue #711](https://github.com/haseatsu114514-dot/shisha-game/issues/711) / [PR #742](https://github.com/haseatsu114514-dot/shisha-game/pull/742)。基準mainは [`8a5bb15b8392`](https://github.com/haseatsu114514-dot/shisha-game/commit/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d)。正式claimは owner `codex-711-20261019-588761470c34`、[成功run 39273098251](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39273098251)、[bot台帳 6270296054](https://github.com/haseatsu114514-dot/shisha-game/issues/711#issuecomment-6270296054) の一致を編集前・継続時に確認した。

## 現在の指定と承認

最新訂正「本人から見て正しい色がいいの」を優先する。

| 基準 | 左 | 右 |
|---|---|---|
| アダム本人の髪 | 緑リンゴの緑 | 赤リンゴの赤 |
| 正面像を見た画面 | 赤 | 緑 |
| EDENの対のリンゴを見た画面 | 赤 | 緑 |

横顔・振り向きは本人の左右を保つ。緑を青へ置換しない。旧CI30・CI58などの画面基準の指示は履歴として残し、現行指示を適用する。

2026-10-19、原画のマスク内だけをローカル処理する方法と、追加通信30 MB以内の限定取得・保存について承認を受けた。「アダムは全て差し替えるなら多少顔がかわっってもいい」という許容も受領した。今回の採用候補では、立ち絵5表情の顔・表情・服・体格・ポーズ・キャンバス・alphaを維持して髪色を揃えた。顔アイコンは既存の160px/256色パイプラインから作るため、顔周辺にもパレット再量子化によるRGB差があるが、形・表情・切り抜き・alphaは維持する。

## 実画像の一覧と処置

採用元、全パス、beforeのGit blob、SHA-256、範囲外の確認限界は [inventory.json](inventory.json)。今回の出力と採用履歴は [adoption.json](adoption.json)。原画の再取得では3 PNGだけ、計7,589,671 bytesを取得し、全て基準mainのGit blobと照合して実画像を確認した。

| 対象 | 原画での判定 | 今回の処置 |
|---|---|---|
| Adam normal / smile / serious / surprise / intense | 正面で画面左緑・右赤 | 5枚とも本人左緑・本人右赤へ髪だけ補正。896×1200 RGBA維持 |
| Adam顔アイコン | 画面左緑・右赤 | 補正したnormalから既存設定で再生成。160×160 RGBA維持 |
| Adam登場絵 | リンゴが画面左緑・右赤 | 対のリンゴと直後の色付き内側模様だけ補正。蛇・金色／クリーム色の装飾・書物・文字用余白・左の大きな斜めの緑面は保持 |
| EDEN背景2別名 | 中央額の手前が左緑・右赤 | 中央額の手前2個だけ補正。奥の3個目、茎、左右の額、店内構造・機材を保持 |
| EDEN採用ロゴ | 画面左赤・右緑で正しい | 元blob維持。採用元は `archive/v1-decorative/sheets/eden.png` |
| 第1章大会CG | 左から3人目のAdamが画面左緑・右赤 | Adamの髪だけ補正。他の3人、顔・手・服・機材・ラベル・舞台の青紫照明を保持 |
| 第1章の実Adamレイヤー `naru.png` | 右向き横顔で本人左が緑、奥の右が赤 | 正しいため元blob維持。対応WebP・影も維持 |
| 第1章レイヤー `adam.png` | 実画像は銀髪のなる | 対象外として維持。命名整理は行わない |
| 採用済み第1章全体タイトル | 左から2人目のAdamが正しい横顔 | 元blob維持 |
| 旧ch1 keyart、大会の南雲・博士CG | 確認した表示用画像にAdam／リンゴ対なし | 維持 |
| tournament_tension仮PNG | 文字だけで現行CG目録・非legacy参照なし | 未採用のまま維持 |

立ち絵の旧採用元は `asset_sources/portraits/adam-remaster-v1/<expression>-preview.png` で、元の本番PNGと同一blob。[ch1-art採用記録](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/adoptions/ch1-art-20261008/adoption.json) は改変しない。登場原画は `asset_sources/character-intros/adam-hajime-v4-20261008/adam/source.png` と同一blobだった。

EDEN背景は `assets/backgrounds/{bg_eden_shop,eden}.png` の同一画像別名。両PNGと両WebPはそれぞれ同一bytesを保つ。ロゴは1960×802の採用シートから `[36,53,605,719]` を表示する。[採用台帳](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/store-logos/ch1-issue470/adopted.json) と原画を照合し、後の別候補で上書きしていない。

章題の実Adamは `assets/ui/chapters/ch1_layers/naru.png`。通常の本編第1章開始は `ch1.js → ch1-title-motion.js` が `remake/img/ui/chapters/ch1-title.webp` をcanvasへ描く。共通章題・プレビューは個別レイヤーも使うため、レイヤーを未使用扱いにしない。全体の採用原画は [selected-D/D-title.png](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/chapter-title/ch1-white-walk-385-20261013/selected-D/D-title.png)、採用記録SHA-256 `8ee5076b1429b376d542727a2c96ea691e2eeada913b315990da6661486cf972`。この原画PNG自体は未取得で、確認は実レイヤーPNGと採用全体WebPによる。

現行CG11件と台本のshow_cgを照合した。大会3CGは表示用実画像まで確認した。他の8CGはスミ／はじめの練習、みんと・つむぎの場面として目録・台本から除外した範囲で、全8枚の背景人物を目視したとは報告しない。titleArts 23件はヒロインに紐づく目録上の範囲確認。`shisha_eden.png` は現行manifest.scenePropsに存在せず表示対象外。未採用候補・旧生成指示は履歴として保持する。

## 編集方法と保存物

[recolor.py](recolor.py) と [recipe.json](recipe.json) は、原画の色相条件と画像別の多角形を組み合わせた再現可能な色補正。HSLの色相・彩度を調整し、明度、キャンバス、原画alpha、未選択画素を保持する。目・眉・耳・額・首を保護し、本人右側に既に赤く描かれた画面左の襟足はそのまま残す。全体／CSSの左右反転は使用しない。

- `before/`: 5表情、顔、登場絵、EDEN背景、大会CGの原画9枚。既存Git blobを再利用した不変スナップショット。
- `after/`: 今回採用候補のPNG9枚。配信用の採用元と同じGit blobを参照する不変スナップショット。
- `masks/`: 実際の変更対象を白で示す8枚の二値マスク。
- [配色比較](qa/portraits-before-after.jpg)、[場面比較](qa/scenes-before-after.jpg)、[拡大比較](qa/details-before-after.png)、[保持素材の確認](qa/preserved-art.jpg)。比較画像は検品用で、ゲーム素材ではない。
- [色補正記録](qa/color-validation.json)、[配信用検証](qa/asset-validation.json)、[立ち絵・背景・アイコンの独立レビュー](reviews/portraits/final-v2-review.md)、[登場絵・大会CGの独立レビュー](reviews/scenes/final-scene-review.md)と各詳細測定・凍結マスク案を保存。[監査資料の独立照合](reviews/metadata-review.md)でbefore/after、採用元・出力のハッシュとローカル参照を確認した。
- [不採用normal-01](trials/normal-01.png)、[実行した生成指示](prompts/normal-01.txt)、[不採用比較](qa/normal-01-comparison.png) は保持。別の顔・服・キャンバス・alphaになった生成試作から採用画像を派生していない。

再現はこのフォルダの原画スナップショットを使う。既存のcheckoutで、作業用出力先を指定する例:

```sh
python3 asset_sources/adam-eden-711-anatomical-20261019/recolor.py \
  --recipe asset_sources/adam-eden-711-anatomical-20261019/recipe.json \
  --source-root . --snapshot-inputs \
  --output-root /tmp/adam-711-reproduction \
  --records /tmp/adam-711-reproduction/color-validation.json
```

原画の期待Git blobが違えば停止する。以前の別担当の原画や候補を編集先にしない。

## 配信用とmanifest

現行mainの `build_images.py`、`build_manifest.py`、`make_face_icons.py` をそのまま利用した。

1. `python3 tools/make_face_icons.py adam`
2. `python3 remake/tools/build_manifest.py --portraits-only adam`
3. `python3 remake/tools/build_manifest.py --backgrounds-only bg_eden_shop.png eden.png`
4. 登場絵と大会CGは `build_images.encode(source, relative_path)` を対象2点にだけ実行。

5表情のWebPは可逆で、デコードしたRGBAが採用PNGと全画素一致。全表情の原画alphaと896×1200キャンバスは不変。顔アイコンalphaも元の160px版と一致する。両背景の別名はPNG同士・WebP同士が一致する。

manifestは限定再生成で `generated` だけが更新された。全メンバー、Adamの5表情、`h=.8717, b=.0258, ax=.5053, aspect=.7467`、登場カットframes、他担当に関係する項目は保持した。素材が揃わない作業領域での全体再生成は行っていない。

大会CGの配信用WebPは現行エンコーダを適用して385,392 bytes（旧配信205,492 bytes）。同じ現行エンコーダを編集前原画へ適用した場合は385,462 bytesで、今回の色補正後との差は70 bytes。旧配信の圧縮条件との差を含む更新であり、原画の非対象人物や構図の描き直しではない。登場絵・背景も現行の対象別設定で変換する。

## 検証結果と残る確認

[asset-validation.json](qa/asset-validation.json) の寸法・alpha・マスク外画素・保護する元色・WebP一致・別名一致・manifest保持は合格。色配置と髪／肌の境界、蛇・金色・茎・店内を原画との比較および独立レビューで確認した。人物データ・人物設定の整合チェック、JSON/Python/Node/YAMLの構文確認も実施した。

本編確認は `remake/test/browser/adam_eden_711.mjs` を既存 `remake-browser.yml` のChromiumジョブで実行する。PC1280×720と横持ち844×390（hasTouch/isMobile）で5表情、登場、マップ顔／ロゴ、入店カード、EDEN訪問、大会CG、保持した章タイトルを確認し、JPEGと結果JSONを専用 `adam-eden-711-results` artifactへ保存する。既存ジョブと依存・素材を再利用し、ジョブ・権限・新しい依存を増やさない。[テストとCI追加の独立レビュー](reviews/code-review.md)で実表示背景レイヤーの参照漏れを修正した。`PR_HEAD_SHA` はPRのhead、`TEST_REF` は既存checkoutの実行commit（PRイベントではmerge commit）として両方を記録し、検証結果と結び付ける。

**この保存時点では、新しいheadのCI、専用artifactの目視、マージ前の最終競合・レビュー確認は待ち。** ローカルにはブラウザバイナリがなく、接続ブラウザも利用できず、クラウドブラウザは作業ホストのlocalhostへ接続できなかった。ブラウザの大容量取得や新規認証は行っていない。対象場面を本物のゲームモジュールで確認するテストであり、全章通しプレイの完了は主張しない。最新結果はPRの正確なheadに結び付けて追記し、安全条件が揃ってからマージ・Issueクローズ・予約解除へ進む。
