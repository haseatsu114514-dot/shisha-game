# 龍龍水煙所・正式採用ロゴ（R4 煙・雲枠）

2026-11-06 にオーナーが R4 を正式採用。原画 `source.png` は採用候補 `work/codex-a-longlong-remake-1106/candidates/r4-smoke-frame.png` の無改変コピー（1536×1024 RGBA、SHA256 `aec7fb9307e86538eca77018a7315943b35ce066a5978f63d5e46a6ae07d9365`）。候補の検品記録は同単元の `RESULT.md` と `qa-remake.jpg`。

配信用 `assets/ui/store_logos/ch4-longlong.webp` は原画の全面を 768×512 に縮小した透過 lossless WebP。Pillow 10.2.0 の `Image.Resampling.LANCZOS` と `lossless=True` を使用。図案、色、構成は変更していない。SHA256 `64fb8033fcdf8eea57d1a26155f83f1eeee80ddb411c4f34b860594da7a83943`。

`remake/js/core/store-logos.js` の `ch4_dubai_longlong` に登録。第4章ドバイの日常地図で `82×46` のピンとして表示し、来店時は同じ登録から到着札に表示する。地図の昼・夕景での原寸合成 QA は [map-frame.jpg](qa/map-frame.jpg)。地図背景は `bg_dubai_map.webp`（SHA256 `e171ff3e06bf0d5504cb4de4ef47d4a17f2bc9fdfa652835d9e6710ce86d0e06`）と `bg_dubai_map_dusk.webp`（SHA256 `2698f26356fb24fa8309f384c2da9c46c5846740bf0da5aeeee14665bbcddfdb`）。地点座標は地図幅の58%、高さの50%。ピンは実際の白い看板色、到着札も実際の白地色を使い、`82×46` と `180×104` で合成した。両背景・両サイズで意匠を判読できる。
