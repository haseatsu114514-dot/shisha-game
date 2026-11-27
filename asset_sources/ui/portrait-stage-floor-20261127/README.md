# 縦画面の試作の店番で使う、tonari のフロアの絵（2026-11-27）

オーナー「もう少し画面の上半分ぐらいがフロアとお客さんいる感じにうまいことレイアウト組み直したい」「フロアに規則的に並べるというよりはイラストに合わせて配置はしたい」
「もしうまいこと配置できなければこのゲームに合わせてTonariの背景作ってもいいかも変えてもいいのでAPIで生成して」（要望台帳 VPM25）。

いまの tonari の店内の絵（`remake/img/backgrounds/bg_tonari_inside_day.webp`。横長・会話の場面用）は、手前の机が大きく、5つの席が正面から見えないので、
店番の「上半分に店内と客」には合わなかった。そこで、**同じ店を、カウンターの中から見下ろした正方形の絵**として作った。

**2026-11-27 作り直し（VPM26）**: オーナー「ソファの配置が不自然　店としておかしくなくはして」「席席席／席　席 みたいにソファ置いてもいいし　下二つは内側向いてたりで」。
1枚めの絵は席がばらばらに置かれていたので、**奥の壁に沿って2人掛けが3つ並び、手前の左右の壁ぎわに内向きの2人掛けが1つずつ、まん中は敷物の空いた床**、という店として自然な配置で作り直した（このフォルダの原画は、作り直した版）。

- 作り方: OpenAI の画像生成 API（モデル `gpt-image-2.6-sunburst`。VPL25・26 でオーナーが指定したもの）、1024×1024、品質 medium
- 参照に渡した絵: 昼＝採用済みの `bg_tonari_inside_day.webp`（場所と画風をそろえるため）／夜＝できあがった昼の絵（構図を1画素もずらさないため）
- 生成した枚数: 1枚め＝昼2・夜2（各1枚を採用。のちに作り直し）／作り直し（VPM26）＝昼6（配置の言い方を2回変えて各3枚。1枚を採用）・夜2（1枚を採用）
- 試作が読む絵: `remake/previews/portrait-stage/img/floor-tonari-day.webp`・`floor-tonari-night.webp`（1024×1024・WebP 品質84）
- このフォルダ: 原画（WebP 品質96）
- **本編の画面にはまだ組み込んでいない**。本編の背景の台帳（`data/background_catalog.json`）にも入れていない（試作の合格後に、[背景の規格](../../../docs/background_standard.md) に合わせて作り直す）

| 原画 | 試作で使う絵 | 使う場所 |
|---|---|---|
| `floor-tonari-day-original.webp` | `img/floor-tonari-day.webp` | 店番の上半分（昼） |
| `floor-tonari-night-original.webp` | `img/floor-tonari-night.webp` | 店番の上半分（日暮れの後。昼の絵に重ねて、ゆっくり入れ替える） |

## 席の位置

席のカードは、絵の中の5つの席に合わせて置く。位置は `remake/previews/portrait-stage/floor.mjs` の `VENUE_VIEW.tonari.seats`（絵の幅・高さに対する %。カードの下の辺のまん中）。
**絵を作り直したら、この表も測り直す。**

| 席 | 場所 | x | y |
|---|---|---|---|
| 1 | 奥の左（壁ぎわの2人掛け。背もたれの上） | 21 | 37.5 |
| 2 | 奥のまん中 | 50 | 37.5 |
| 3 | 奥の右 | 79 | 37.5 |
| 4 | 手前の左（左の壁ぎわの内向きの2人掛けの上） | 20.5 | 69 |
| 5 | 手前の右（右の壁ぎわの内向きの2人掛けの上） | 79.5 | 69 |

## 生成後に確かめたこと

- 人物・文字・看板・ロゴは無い。シーシャの台・ホース・炭は描かせていない（空いた席にも写ってしまうため。機材の形の点検は要らない絵）
- 既存の採用済みの絵（`bg_tonari_inside_day.webp`）と原寸で並べて、同じ描き手に見える（筆の跡の残る塗り・2〜3段の影）。床や机の強い照り返し・光のにじみは無い
- 照明は、となりのトルコのモザイクランプ（形・模様・色・吊る長さがばらばら）。夜は、ランプと天井の灯りで、家具と床が読める明るさ（平均の明るさ: 昼115・夜96）
- 昼と夜の絵の位置のずれ: 0（縁の絵を重ねて測った。席の位置は昼夜で同じ）。作り直した版の平均の明るさ: 昼117・夜99
- 観葉植物は、採用済みの tonari の内装にあるものだけ（窓ぎわの吊り鉢・壁の棚・床の鉢・棚のつる）

## 依頼文（昼。作り直した版）

```text
Use the attached image as the reference for the place and for the painting style. It is a cozy Japanese shisha lounge interior: warm wood, olive-green fabric sofas with chunky wooden frames, patterned cushions, low wooden coffee tables, a Persian-style rug on a dark wooden plank floor, Turkish mosaic glass pendant lamps hanging at different heights, cream plaster walls, wooden-framed windows with a daytime city view, a few potted plants, wooden shelves.

Paint a NEW view of this same room, to be used as the floor screen of a shop-management game. Keep the same hand-painted anime background style as the reference: visible brushwork, flat 2-3 step shading, no line art, no photo look, no 3D render look.

Viewpoint: seen by a staff member standing at the bar counter, camera about 2 meters high looking slightly down, straight at the back wall, one-point perspective, symmetrical room. Square composition. Vertical lines stay vertical.

Furniture layout (most important). It must look like a real, sensibly arranged small lounge with exactly FIVE seating spots forming a U shape around an open center:
- BACK ROW: three identical two-seat olive sofas standing side by side in one straight line against the back wall, facing the viewer. Together they span the WHOLE width of the back wall, from the left corner to the right corner: their centers are at about 19, 50 and 81 percent of the picture width, each sofa about 24 percent of the picture width, with clear gaps between them. Each has its own small low wooden table directly in front of it. No plants, shelves or cabinets stand on the floor along the back wall.
- SIDES: one two-seat olive sofa against the LEFT side wall and one against the RIGHT side wall, clearly closer to the viewer than the back row and clearly lower in the picture, hugging the left and right edges of the picture. These two side sofas face inward, toward the center of the room (so they are seen from the side / three-quarter view), each with its own small low wooden table on its inner side. There is a visible strip of floor between the back row and the side sofas.
- CENTER: the middle of the room is open floor with the Persian-style rug, clear for walking. No furniture in the center.
All seats are empty: no people, at most one small cushion per sofa. Nothing else is on the floor.

Vertical placement in the picture: ceiling beams and the hanging mosaic lamps (different shapes, glass patterns, colors and chain lengths, unevenly spaced) only in the top 18 percent. Below the lamps, a wide band of calm cream wall above the back sofas (about 20 percent of the picture height, with only a window or two and a small plant shelf, no clutter). The backrests of the back-row sofas are at about 45 percent from the top and their tables end at about 60 percent. The side sofas sit between about 64 and 86 percent from the top. The bottom 7 percent is the plain top edge of the wooden bar counter in the near foreground.

Do not paint: people, animals, text, letters, logos, signs, hookahs, shisha pipes, hoses, charcoal, smoke, bottles of alcohol. Tables hold only a small candle glass or a tiny plant. No lens flare, no bloom glow, no light rays, no glossy wet-looking floor. Daytime; soft sunlight from the windows is the single main light, the lamps are a weak secondary glow.
```

## 依頼文（夜）

```text
Repaint the attached picture as the SAME room at NIGHT. This is a day/night pair for a game, so the two pictures will be cross-faded on top of each other: keep the camera, the composition and every object exactly where it is, pixel for pixel as far as possible. Do not move, add, remove or resize any furniture, table, cushion, plant, lamp, shelf, window, rug or the bar counter at the bottom. Keep the same hand-painted anime background style (visible brushwork, flat 2-3 step shading, no line art, no photo look).

Change only the light and the view outside:
- Outside the windows it is night: a dark blue evening sky and the same city buildings with small warm lit windows.
- The Turkish mosaic pendant lamps are switched on and glow warmly; together with the soft ceiling spotlights they light the room. The light is warm amber, with gentle cooler shadows.
- The room stays clearly readable and fairly bright: sofas, tables, rug and floor keep their colors and details, nothing sinks into black. No sunlight patches on the floor or walls.

Do not paint: people, animals, text, letters, logos, hookahs, shisha pipes, hoses, charcoal, smoke. No lens flare, no bloom haze, no light rays, no glossy wet-looking floor.
```
