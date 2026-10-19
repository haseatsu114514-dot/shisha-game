# #711 アダム・EDEN：本人基準の配色監査

**DRAFT / 画像修正待ち。** このチェックポイントでは本番のPNG・WebP・顔アイコンをすべて保持する。新しい配色の採用・本編修正完了を示す記録ではない。通常立ち絵の試作 `normal-01` は不採用。

基準mainは [`8a5bb15b8392`](https://github.com/haseatsu114514-dot/shisha-game/commit/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d)。予約は `codex-711-20261019-588761470c34`、[成功run 39273098251](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39273098251)、[bot台帳 6270296054](https://github.com/haseatsu114514-dot/shisha-game/issues/711#issuecomment-6270296054) のowner/run一致をrootセッションで確認済み。対象は [Issue #711](https://github.com/haseatsu114514-dot/shisha-game/issues/711)。

## 現在の左右ルール

最新訂正「本人から見て正しい色がいいの」を優先する。

| 基準 | 左 | 右 |
|---|---|---|
| アダム本人の髪 | 緑のリンゴ色 | 赤のリンゴ色 |
| 正面像を見た画面 | 赤 | 緑 |
| EDENの対のリンゴ・対応する意匠を見た画面 | 赤 | 緑 |

横顔・振り向きは本人の左右を保つ。画面の中央で二色に分割しない。緑を青色にしない。顔・表情・髪型・ポーズ・衣装、店名・ラベル・文字、構図・透過・余白・対以外のリンゴは保持する。画像全体を左右反転しない。CI30・CI58など過去の画面基準の指示は履歴として保存し、現在の指示へ読み替える。

## 調査結果と採用元

詳細なパス、Git blob SHA-1、分かっているファイルサイズ・SHA-256、確認方法は [inventory.json](inventory.json) に記録した。SHA-256の未取得値は `null`。Git blob SHA-1と混同しない。

### 立ち絵5表情と顔アイコン：修正待ち

原画は `assets/sprites/characters/adam/chr_adam_<表情>.png`、表示用は `remake/img/sprites/characters/adam/chr_adam_<表情>.webp`。各PNGは `asset_sources/portraits/adam-remaster-v1/<表情>-preview.png` と同一blob。採用経緯は [ch1-artの採用記録](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/adoptions/ch1-art-20261008/adoption.json) にある。

| 表情 | 原画bytes | 原画の確認結果 |
|---|---:|---|
| normal | 455,958 | 画面左＝緑・右＝赤。髪色のみ修正待ち |
| smile | 445,809 | 同上 |
| serious | 453,657 | 同上 |
| surprise | 460,197 | 同上 |
| intense | 423,200 | 同上。登場カットで使う表情 |

5枚の実PNGを目視。すべて896×1200 RGBA。顔・服・体格・ポーズを作り直す依頼ではない。

`assets/ui/face_icons/face_adam.png`（42,159 bytes、160×160 RGBA）も実PNGで画面左＝緑・右＝赤を確認。通常絵の修正が成立してから `tools/make_face_icons.py adam` で対象1人だけ再生成する。現在の設定は160px・256色、Adamの切り抜きは `f=0.188, dy=0.03`。アイコンはPNGを直接表示する。

### 登場背景・EDEN・大会CG

| 対象／本番パス | 表示・採用元 | 判定と修正の限界 |
|---|---|---|
| `assets/ui/character_intros/adam.png` | `remake/img/ui/character_intros/adam.webp`。原画は `asset_sources/character-intros/adam-hajime-v4-20261008/adam/source.png` と同一blob | 表示用WebPで対のリンゴが画面左＝緑・右＝赤。リンゴと対応する色の部分を修正待ち。蛇・書物の装飾・構図は保持。原画PNG 3,336,242 bytesは生データ未取得・未目視 |
| `assets/backgrounds/bg_eden_shop.png` | `assets/backgrounds/eden.png` は同一blobの別名。各表示用は同名の `remake/img/backgrounds/*.webp` | 実PNGを確認。**中央額の手前2個だけ**が画面左＝緑・右＝赤。左右の額は赤→緑で正しい。中央奥の3個目の赤いリンゴも色・数・位置を保持 |
| `assets/ui/store_logos/eden.png` | [採用台帳](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/store-logos/ch1-issue470/adopted.json) の **`archive/v1-decorative/sheets/eden.png`**。後のトップ階層 `sheets/eden.png` は別候補 | **正しいので保持。** [採用ロゴQA](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/store-logos/ch1-issue470/ingame-qa/adopted-logos.png) は画面左＝赤・右＝緑。原画1,455,770 bytesは生データ未取得・未デコード。判定は採用記録とQA画像の組合せ |
| `assets/cgs/cg_ch1_tournament_battle.png` | `remake/img/cgs/cg_ch1_tournament_battle.webp`。`ch1_tournament_match` の `show_cg` で本編使用 | 表示用WebPで、左から3人目のアダムの髪が画面左＝緑・右＝赤。**その髪色のみ**修正待ち。他の人物・表情・服・手・機材・文字は保持。原画PNG 2,797,659 bytesは生データ未取得・未目視 |

EDEN背景のPNGは395,780 bytes、1280×720 RGB。2つの背景PNGは同一blobで、2つのWebP同士も同一blob。`sceneBg()` は `eden.png` と `bg_adam_shop.png` を `bg_eden_shop.png` へ解決する。

EDENロゴは1960×802のシートから `[36,53,605,719]` を表示する。今回の正しい採用元を、後の未採用候補へ置き換えない。

登場カットは背景＋`intense`立ち絵＋文字の合成。過去の `cutin_adam.png` は確認用スクリーンショットで、本番の独立した差し替え先ではない。

### 章題：本人を画像で確認し、保持する

**ファイル名と人物が入れ替わっている。** [実アダムのレイヤー](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/assets/ui/chapters/ch1_layers/naru.png) は `naru.png`。画面右へ歩き、手前に見える本人左側が緑・奥の本人右側が赤で、最新の本人基準に合っている。[`adam.png`](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/assets/ui/chapters/ch1_layers/adam.png) は銀髪のなる。双方のPNG、対応する `remake/img/ui/chapters/ch1/{naru,adam}.webp`、各影は保持し、#711で命名や人物配置を直さない。

[現行の全体章題](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/remake/img/ui/chapters/ch1-title.webp) も目視済み。左から2人目が正しい横顔のアダム。採用原画は [selected-D/D-title.png](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/chapter-title/ch1-white-walk-385-20261013/selected-D/D-title.png)（採用記録SHA-256: `8ee5076b1429b376d542727a2c96ea691e2eeada913b315990da6661486cf972`）。[type-polish/adoption.json](https://github.com/haseatsu114514-dot/shisha-game/blob/8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d/asset_sources/chapter-title/ch2-5-style-studies-385-20261013/type-polish/adoption.json) と `tools/build_chapter_titles.py` がこの原画から `ch1-title.webp` を生成する。原画PNG自体の生データ確認は行っていない。

通常の第1章開始は `ch1.js → ch1-title-motion.js` で全体WebPをcanvasに表示する。共通の章題・プレビューは `core/ui.js → motions/chapter-title.js` から人物レイヤーも使うため、個別レイヤーを完全な未使用ファイルとは扱わない。

## 関連CGと除外範囲

現行目録のCG11件と非legacy台本の `show_cg` を照合した。大会3CGは表示用画像まで確認し、`cg_ch1_nagumo_smile` は南雲1人、`cg_ch1_dr_kemuri_hook` は空いた会場の博士1人で、アダムやリンゴはない。どちらも保持する。

残る8CGはスミ／はじめの練習、みんと・つむぎの場面で、該当場面データにアダム／EDENの指定はない。これは台本・目録による範囲確認であり、8枚すべての背景人物を目視済みという意味ではない。23件の `titleArts` はすべてヒロインに紐付き、Adamの項目はない。各一覧と根拠をinventoryへ残した。

- `assets/cgs/cg_ch1_tournament_tension.png` は文字だけの仮画像。人物・リンゴなし。**現行CG目録に含まれず、現行非legacy台本・コードからの参照もない。** `cgUrl()` が解決しないため本番採用CGとして数えない。
- `assets/ui/chapters/ch1_keyart.png`／`remake/img/ui/chapters/ch1_keyart.webp` は、表示用WebPでシーシャと煙だけの背景を確認。アダムやリンゴの対はない。PNGは `asset_sources/ch1-keyart/original.png` と同一blob。保持する。
- `scene-art.js` の `shisha_eden.png` は現行 `manifest.sceneProps` に存在しないため表示対象外。#711で新規に作らない。
- 原生成指示・初案・不採用案・旧立ち絵・以前のカットイン・参考シート・ハガル候補などは履歴として保持する。ファイル名だけで新たに本番へ採用しない。

## 不採用試作と原画の保持

[normal-01原画](trials/normal-01.png)、[実行した正確なプロンプト](prompts/normal-01.txt)、[比較画像](qa/normal-01-comparison.png)、[比較条件](qa/normal-01-comparison.json) を保存する。画面左＝赤・右＝緑にはなったが、顔の本人性・服の質感、キャンバス・透過／余白に変化があり、色だけの修正として成立していない。**REJECTED：本番と派生物には使わない。**

元絵896×1200に対して試作は1084×1451。比較用に試作だけを896×1200へLANCZOSで正規化した後、同じ座標を切り出している。比較画像は検品用で、採用原画ではない。

`before/` の5表情・顔・EDEN背景・登場背景・大会CGは、既存の原画blobをそのまま指す保存用スナップショットとする。対応先と期待blobはinventoryの `original_snapshots` に列挙。raw未確認の登場背景・大会CGをスナップショット化しても、目視／デコード済みの証拠にはしない。正しいロゴ・章題などは上記の固定mainリンクで参照し、複製しない。

## 続きの制作・検証（未実施）

1. 顔・服・896×1200の余白とalphaを維持できる局所修正を通常絵で成立させる。今回の不採用試作から他表情やアイコンを派生させない。
2. 5表情の髪、登場背景の対の色、EDEN中央額の手前2個、大会CG内のアダムの髪だけを明示したファイル一覧で直す。正しいロゴ・横顔・章題・左右の額・3個目の赤いリンゴは元blobを保持する。
3. 採用元PNGから対象だけを既存の変換設定でWebPへ出力する。`remake/tools/build_images.py` の実際の設定を確認し、全画像の一括変換を避ける。通常絵の検品後、顔アイコンは `python3 tools/make_face_icons.py adam` だけを実行する。
4. 必要な場合だけmanifestを更新し、無関係な項目・表情・配置値を保持する。素材が欠けた作業領域から `build_manifest.py` で全体を作り直さない。原画／派生物の寸法・alpha・期待画素と、保持対象のblobを照合する。
5. 実ゲームの**1280×720 PC**と**844×390横持ち**で、5表情・顔アイコン・初登場・EDEN訪問・大会CG・保持した章題／ロゴを確認する。非対象の人物・文字・構図、画像読み込みも確認する。

このチェックポイントでは画像修正、派生物／manifest更新、上記実ゲームQAは未完了。実施済みの別Issueや過去のQA結果を#711の合格として扱わない。
