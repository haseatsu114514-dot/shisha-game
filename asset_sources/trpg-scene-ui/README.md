# TRPG の選択用イラスト

画像生成で制作した、透過背景の 3 × 3 タイル集。原寸 PNG は `assets/ui/trpg/`、ブラウザ配信用の lossless WebP は `remake/img/ui/trpg/` に保存する。生成指示は `prompts.json`、寸法・SHA-256 は `generation.json` を参照。

| 素材 | 上段（左から） | 中段（左から） | 下段（左から） |
| --- | --- | --- | --- |
| choices-harbor | 紅茶、果物、スパイス | 窓際、カウンター、本棚 | 休息、旅の予定、会話 |
| choices-shark | 柑橘の囮、防水ケース、灯り | 桟橋、屋根、整備水路 | 香りの囮、足音の囮、灯りの囮 |

各画像を実物で確認し、絵柄の統一、透過、タイル間の余白を確認した。人物・シーシャ本体を描かない道具と情景の素材で、既存キャラクター設定の変更はない。CSS の `background-position` で各タイルを表示する。絵の切り貼り・描き直しはせず、配信用ファイルは RGBA の画素一致を確認した lossless 変換のみ。

生成元: OpenAI image generation。生成日: 2026-10-15。使用先: `remake/js/trpg/view.js`、`remake/css/trpg-stage.css`。
