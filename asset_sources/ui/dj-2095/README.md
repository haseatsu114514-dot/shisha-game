# DJ 紫テーマの素材（Issue #2095）

新規生成はしていない。既存の生成素材（#2071・#2073、OpenAI画像API gpt-image-2.5-sunburst）と背景 `assets/backgrounds/bg_dj_red_room.png` を、Pillowで色相を−75°回して紫基調にした（明度・彩度・透過はそのまま）。赤→紫、琥珀→ピンク寄りになる。

| 出力 (`remake/img/ui/dj/`) | 元 |
|---|---|
| bg-purple.webp | assets/backgrounds/bg_dj_red_room.png |
| controller-body-purple.webp | asset_sources/ui/dj-2073/controller-body.png（1280幅） |
| jog-wheel-purple.webp | asset_sources/ui/dj-2073/jog-wheel.png（384px） |
| fader-cap-purple.webp / fader-cap-h-purple.webp | asset_sources/ui/dj-2071/fader-cap.png（縦横） |

eq-knob.webp は真鍮色のまま使用。赤い旧WebPは使わなくなったので削除（元PNGは各 asset_sources に残る）。
