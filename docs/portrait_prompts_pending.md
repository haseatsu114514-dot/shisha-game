# 立ち絵プロンプト待機リスト（未生成キャラ）

現在、メモに記載されていた未生成キャラはありません（2026-07-16確認）。

生成済み・組み込み済み:

- 神崎竜二（`kumicho`）
- 田中健太（`rei`）
- ヴォルク・イヴァノフ（`volk`）
- ナンディ・カルダモン（`nandi`）
- スティーブ・デイビス（`steve`）
- 王煙楼（`master_hookah`）
- シェイク・アル=ガリヤーン（`sheikh`）
- エンリケ・ダ・シルヴァ・太陽（`da_silva`）
- エミル（`emil`）
- ムカイさん（`mukai_master`）
- かこ（`kako`）
- りら（`rira`）
- 路上占い師（`uranaishi`）
- サラリーマン（`salaryman`）
- 常連のおっちゃん（`mob_occhan`）
- 初心者の若い女性客（`mob_firsttimer`）
- インスタ女子（`mob_insta`）
- フレーバーポリスの眼鏡おじさん（`mob_megane`）
- 外国人観光客（`mob_tourist`）

今後キャラを追加するときは、容姿の正本を `data/characters.json` に置き、生成手順は
`docs/image_generation_guide.md` に従う。生成元は
`asset_sources/images/character_masters/` と
`asset_sources/images/character_sheets/`、ゲーム用PNGは
`assets/sprites/characters/{id}/` に保存する。

## 立ち絵不要（意図的に対象外）

- 主人公（`hajime`）は一人称視点のため、通常会話では立ち絵を表示しない。
- 複数人を一枚で描く必要があるバイト客（カップル、大学生4人組、誕生日グループ）は、個別立ち絵ではなく必要になった時点でイベントCGとして検討する。
