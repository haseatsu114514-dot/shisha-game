# ビジュアルなしキャラ6件 ― 立ち絵候補パッケージ（2026-10-29）

Issue #1177 の素材不足 A-5（ビジュアル一式なし6件）への対応候補。**いずれも候補であり、本番スプライト・manifest へは未投入**。採用判断はオーナー／司令塔側。

探索の全文記録: `work/missing-visuals/SEARCH.md`（司令塔ワークスペース）。要点:

- **ムカイさん（mukai_master）と SHISHA-9000 はデザインが既存だった**
  - ムカイさん: 立ち絵原画 `portraits/mukai_master-remaster-v1/`（2026-10-24生成・未投入）＋短編漫画に登場（`short-comics-20261024/14-17-everyday.png`、`short-comics-unhinged-ltr-20261025/33-36-chaos-ltr.png` 第35・36話）。オーナーの「漫画にデザインがあったはず」という記憶どおり
  - SHISHA-9000: 立ち絵原画 `portraits/shisha_9000-remaster-v1/`（人型ロボット）＋検討画2方向（`review-candidates-20261024/assets/07・08`）
- **残り4人は画像が実在せず**、正本（`data/characters.json` の visual_concepts、設定書、本編台詞の衣装描写）から新規に起こした

## このパッケージの内容

| フォルダ | 内容 |
|---|---|
| `emil-original-20261029/` | エミル・ユルマズ（48歳トルコ人職人）normal 新規原画＋preview＋顔アイコン＋プロンプト |
| `da_silva-original-20261029/` | ダ・シルヴァ太陽（28歳ブラジル人）normal 新規原画＋preview＋顔アイコン＋プロンプト |
| `master_hookah-original-20261029/` | 王煙楼（58歳）normal 新規原画（前夜祭の金色の装束。本編台詞準拠）＋preview＋顔アイコン＋プロンプト |
| `sheikh-original-20261029/` | シェイク（52歳UAE王族）normal 新規原画（白カンドゥーラ＋白頭布の正装）＋preview＋顔アイコン＋プロンプト |
| `mukai_master-expressions-20261029/` | ムカイさんの表情差分4種（sad／serious／smile／surprise）。既存 normal 原画を同一性参照に生成し、normal と同一の枠変換で位置合わせ済み＋顔アイコン |
| `shisha_9000-faceicon-20261029/` | SHISHA-9000 の顔アイコン（既存原画の頭部切り出し） |
| `missing-visuals-20261029-comparison.png` | 6人ラインアップ比較シート（左から ムカイさん／エミル／ダ・シルヴァ／王煙楼／シェイク／SHISHA-9000） |

各フォルダの `generation.json` に生成条件・ハッシュ・QA・残課題を記録。

## 残課題（採用時に必要）

- 新規4人の表情差分（sad／serious／smile／surprise）は未生成（normal の方向が採用されれば同じ手順で展開可能）
- 本番投入: `assets/sprites/characters/<id>/chr_<id>_<表情>.png`（896×1200）配置、`assets/ui/face_icons/face_<id>.png` 配置、`remake/data/manifest.json` への登録
- SHISHA-9000 の形態について: 作画実績は人型ロボットで一貫。characters.json の文面（端末型寄り）との整合確認は別途
