# 第2章・県大会エリアの新都市マップ

Issue #514 / worker `codex-ch2-20261013-7bc91a42` / 2026-10-13。第2章制作の最初の成果として作った街マップと、素材棚卸しを保管する。これは章全体の完成やDAY14県大会までの接続を示すものではない。

## 舞台・制作方針

同じ地方・同じ県内の隣町。第1章の大須・栄風の商店街より格が高い、名古屋駅の交通拠点と渋谷の若者街を組み合わせた都市として制作した。東京への移動は第3章の設定であり、このマップで東京へ移転しない。街の確定名は柚ヶ谷（ゆずがや）。

駅ビルと青いガラス双塔、大きな駅前広場、接続した歩行者デッキ、中央のスクランブル交差点、若者向け商業街、大型イベント会場、音楽街、工房と裏通りを作った。第1章のマップと同じ、高精細な俯瞰アイソメ／ピクセルペインター調。寺・テレビ塔・招き猫・十字アーケードが主役の第1章とは街の規模と構造で差をつける。

地元のtonari・KEMURIKUSA・EDEN・PEPPERMINT・Dr.fookah・自宅を隣町へ移設した扱いにはしない。地元との往復方法と行動消費は、章本体の接続で別途設計する。

## ファイルと生成来歴

| ファイル | 用途 |
|---|---|
| [day/source.png](day/source.png) | 生成された昼のPNG原画。1672×941、RGB、無変更コピー |
| [night/source.png](night/source.png) | 昼原画を画像編集参照して生成した夜のPNG原画。1672×941、RGB、無変更コピー |
| [station/source.png](station/source.png) / [station/prompt.txt](station/prompt.txt) | 地上視点の駅前到着背景と実際の生成指示。駅の曲面屋根・双塔・デッキ・商業棟を街マップと合わせた新規生成 |
| [day/prompt.txt](day/prompt.txt) / [night/prompt.txt](night/prompt.txt) | 実際に送った全文プロンプト |
| [metadata.json](metadata.json) | ツール、入力参照、サイズ、SHA256、配布変換の記録 |
| [pin-layout.json](pin-layout.json) | 画像を見た後の建物入口に合わせたピン先端の推奨位置 |
| [quality-inventory.csv](quality-inventory.csv) | 既存第2章素材・不足・設定矛盾の棚卸し |
| [validate.py](validate.py) / [validation.json](validation.json) | 画像寸法・形式・8地点の昼夜位置照合の再現手順と結果 |
| [配布昼WebP](../../assets/backgrounds/bg_widehanga_map_day.webp) / [配布夜WebP](../../assets/backgrounds/bg_widehanga_map_night.webp) | 1280×720。原画全体を縮小し、lossless WebPで保存 |
| [配布駅前WebP](../../assets/backgrounds/bg_widehanga_station_day.webp) | 到着の会話に使用。会話完了後に俯瞰の街マップへ移る |

生成ツールは `image_gen.imagegen`。昼は新規生成のため画像添付は行わず、目視した採用済み `remake/img/backgrounds/bg_osu_map_day.webp` と夜版の画風・視点を文章で指定した。夜は昼原画だけを `referenced_image_paths` へ渡し、建物・道路・交差点・画角を固定して光源だけを変える編集を指示した。参考として特定の実在建築・商品・ロゴを模写していない。シーシャ器具と人物の接写は生成対象から除外した。

配布版はImageMagickで全画面を1280×720へ縮小、WebP losslessで保存した。切り抜き、描き足し、合成、色変更、再生成は形式変換時には行っていない。原画の縦横比と16:9の差は約0.05%で、画面全体を保持して定型サイズへ合わせた。生成原画・プロンプト・配布版はリポジトリに保管し、生成サービスのライブラリや作業端末だけを正本にしない。

```sh
magick asset_sources/ch2-city/day/source.png -resize 1280x720\! -define webp:lossless=true assets/backgrounds/bg_widehanga_map_day.webp
magick asset_sources/ch2-city/night/source.png -resize 1280x720\! -define webp:lossless=true assets/backgrounds/bg_widehanga_map_night.webp
magick asset_sources/ch2-city/station/source.png -resize 1280x720\! -define webp:lossless=true assets/backgrounds/bg_widehanga_station_day.webp
python3 asset_sources/ch2-city/validate.py
```

## 目視QA・位置照合

昼夜の原画と配布版を目視確認。駅屋根・双塔・デッキの階段・スクランブル・会場キャノピー・ピンクの立面・木造店・黒赤の音楽店・工房と四隅の街区が同じ位置にある。夜も道路と建物の輪郭が読める。夕暮れ補正の代用ではなく、駅・窓・街灯からの照明を持つ編集差分になっている。

配布版は昼夜とも1280×720 RGB WebP、外周まで街区があり透明な欠けや枠がない。読める文字、実ロゴ、ピン、UI、シーシャ器具は目視上ない。非常に小さい店頭の色面・細線は装飾として残るが、店舗名や台詞を画像へ焼き込んでいない。正確な名称はゲーム側で重ねる。

自動照合は、8地点の明暗に依存しにくい輪郭強度を使い、昼の切り出し位置に対して夜の画像を上下左右8pxずつ探索した。すべての地点で最適位置は `(0, 0)`。この照合は局所的な一致を調べるもので、生成画像が全画素で同一構造だと保証する検査ではない。建物・道路・外周の目視確認も併用した。UIのピン・文字・情報パネルとの干渉は、章プレビューの実画面で別途確認する。

駅前背景は別の視点で新規生成。駅の曲面ガラス屋根、矩形・円筒の双塔、歩行者デッキ、右側の丸い商業棟を地図と目視照合した。下部は舗道と道路にし、会話枠と人物を重ねる余白を確保。小さなモブ・車・歩道と車道・信号の縮尺を確認し、読める文字・実ロゴ・シーシャを含めない。地図の立体寸法を完全に復元した背景とは扱わない。駅前画像が読めなくても到着会話は街マップ上で続けられる。

PCと横持ちタッチでの画像表示・ピン位置・名前の開示・保存不変の記録は [試遊QA](../../docs/qa/ch2-preview/README.md)。

## 棚卸しと今回の追加制作

1. MELTY PUFFの既存 `bg_ageha_shop` は画素密度が粗く、大きな文字や顔写真が焼き込まれている。ピンク・レオパード・入口のプリクラ機という固有内装を保ち、準備中の入口背景を再制作した（[内装制作](../ch2-interiors/README.md)）。アゲハの正規立ち絵を本人性の基準にし、顔と年齢感を再デザインしない。
2. 神崎の表示店名は現行 `data/characters.json` の「神崎煙草店（表向き）」を使う。旧「仁義と煙」と、雑貨／茶店風 `bg_ryuji_shop` には設定差がある。オーナーの追加参考に合わせ、畳座敷の初案を、木壁・黒革ソファ・執務机・大理石床・神棚・肖像写真・金屏風を持つ明らかなヤクザ事務所風へ作り直す。旧本編背景を一括置換しない。第2章の客席ではタッパーを見せず、閉じた収納・奥へ隠す。
3. REIとヴォルクの店会話の旧背景は `bg_tournament_stage`。大会ステージを店舗として使わず、黒赤・薔薇・小舞台のV系店と、金属・計器・運搬ケースの一時展示室という別々の準備中背景を制作した。無関係な店の背景へ差し替えて不足を隠さない。
4. `kumicho` / `rei` / `volk` の正規立ち絵は現行manifestとリポジトリ全treeにないことを親エージェントが確認した。プロフィールに記載されている表情名だけでは画像の存在を示さない。別キャラの立ち絵を代用せず、各人物の外見・服装・身長・年齢感を正本と照合し、[初回通常立ち絵](../ch2-characters/README.md)を制作した。必要表情と専用紹介背景は後続。
5. REIは [brand/story_and_structure.md](../../brand/story_and_structure.md) の第3章記述では東京がホームグラウンド、ヴォルクは [brand/character_profiles.md](../../brand/character_profiles.md) 冒頭で東京所属候補として記載される。一方、第2章台本では県大会エリアの店舗へ来訪し、story本体には当地の工業地区の鉄の煙がある。この所在地・常設店／出張／展示の扱いは未整理。このマップのプレビュー位置だけで正史の所在地を確定しない。店舗本体の接続前に整理する。
6. シーシャ器具を描く店舗背景・CGの新規制作では [docs/asset_ai_guidance.md](../../docs/asset_ai_guidance.md) に従い、実物写真・店固有の素材と照明・容器保管・HMD/炭/ホースの構造を確認する。今回の街地図は器具を描かない指定を優先した。

## 本編初日への接続

同じ原画を本編DAY1でも使用する。行き先の会場は最新の正本に合わせて「県大会ホール」（C.STATIONと同じビルの貸イベントホール）。店舗自体を巨大な展示会場と呼ばない。地図の建物を借りたホールのあるビルとして扱い、文字はUIで表示する。本編は第1章の所持品と関係を引き継いで、場面の区切りで保存。独立試遊はメモリだけで進む別入口として残す。[本編初日QA](../../docs/qa/ch2-main/README.md)。
