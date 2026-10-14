# 第2章の店舗ロゴ

オーナー「2章の店のロゴとか作ってたっけ なければ生成」に対応。既存の `assets/ui/store_logos/` は第1章の7店だけだったため、3店分を `image_gen.imagegen` で新規生成した。Issue #514 / PR #524。

| 店 | 意匠 | 原画 | 配布 |
| --- | --- | --- | --- |
| MELTY PUFF | 白・ピンクのクマ、豹柄リボン、ラインストーン、キャンディ風の文字。平成ギャルの店に合わせる | [PNG](ageha/source.png) | [WebP](../../assets/ui/store_logos/melty-puff.webp) |
| 神崎煙草店 | 金と墨の筆文字、煙とKを組み合わせた創作の紋、朱色の印。組長の肩書きは入れない | [PNG](kumicho/source.png) | [WebP](../../assets/ui/store_logos/kanzaki.webp) |
| 零-ZERO- | 銀の零とZERO、CDの反射、赤い薔薇、棘とピック。V系の店に合わせる | [PNG](rei/source.png) | [WebP](../../assets/ui/store_logos/zero.webp) |

各ディレクトリの `prompt.txt` は実際の全文指示。原画は1536×1024 RGBA、配布は全構図を768×512へ縮小した透過lossless WebP。生成後の描画修正・背景の手作業除去・切り抜きはしていない。透過率・寸法・SHA256は [metadata.json](metadata.json)。描画された店名を目視し、透過チャンネルを実ファイルで確認した。人物、実在団体の紋、実バンドのロゴやCDジャケット、シーシャ機材は描かない指示。

本編DAY2以降の隣町の地図ピンと、本編DAY1／独立試遊の店内見学前カードへ接続。小さいピンでは別途テキストの店名も残す。第1章7店の元PNGと表示範囲は維持する。ヴォルクは第3章で登場するため、この第2章用のロゴには含めない。
