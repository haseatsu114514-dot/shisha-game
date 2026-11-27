# 縦画面の試作の店番で使う、tonari のフロアの絵（2026-11-27）

オーナー「もう少し画面の上半分ぐらいがフロアとお客さんいる感じにうまいことレイアウト組み直したい」「フロアに規則的に並べるというよりはイラストに合わせて配置はしたい」
「もしうまいこと配置できなければこのゲームに合わせてTonariの背景作ってもいいかも変えてもいいのでAPIで生成して」（要望台帳 VPM25）。

いまの tonari の店内の絵（`remake/img/backgrounds/bg_tonari_inside_day.webp`。横長・会話の場面用）は、手前の机が大きく、5つの席が正面から見えないので、
店番の「上半分に店内と客」には合わなかった。そこで、**同じ店を、カウンターの中から見下ろした正方形の絵**として作った。

- 作り方: OpenAI の画像生成 API（モデル `gpt-image-2.6-sunburst`。VPL25・26 でオーナーが指定したもの）、1024×1024、品質 medium
- 参照に渡した絵: 昼＝採用済みの `bg_tonari_inside_day.webp`（場所と画風をそろえるため）／夜＝できあがった昼の絵（構図を1画素もずらさないため）
- 生成した枚数: 昼2枚（1枚を採用）・夜2枚（1枚を採用）。作り直しなし
- 試作が読む絵: `remake/previews/portrait-stage/img/floor-tonari-day.webp`・`floor-tonari-night.webp`（1024×1024・WebP 品質84）
- このフォルダ: 原画（WebP 品質96）
- **本編の画面にはまだ組み込んでいない**。本編の背景の台帳（`data/background_catalog.json`）にも入れていない（試作の合格後に、[背景の規格](../../../docs/background_standard.md) に合わせて作り直す）

| 原画 | 試作で使う絵 | 使う場所 |
|---|---|---|
| `floor-tonari-day-original.webp` | `img/floor-tonari-day.webp` | 店番の上半分（昼） |
| `floor-tonari-night-original.webp` | `img/floor-tonari-night.webp` | 店番の上半分（日暮れの後。昼の絵に重ねて、ゆっくり入れ替える） |

## 席の位置

客は、絵の中の5つの席に座る。位置は `remake/previews/portrait-stage/floor.mjs` の `SEATS`（絵の幅・高さに対する %。客の絵の裾のまん中）。
**絵を作り直したら、この表も測り直す。**

| 席 | 場所 | x | y |
|---|---|---|---|
| 1 | 奥の左（窓ぎわの2人掛け） | 20 | 50 |
| 2 | 奥のまん中（植木の棚の下の2人掛け） | 51 | 50 |
| 3 | 奥の右（棚の横の1人掛け） | 81.5 | 50.5 |
| 4 | 手前の左（斜めに置いた長いソファ） | 21 | 72 |
| 5 | 手前の右（敷物の上の2人掛け） | 75 | 72 |

## 生成後に確かめたこと

- 人物・文字・看板・ロゴは無い。シーシャの台・ホース・炭は描かせていない（空いた席にも写ってしまうため。機材の形の点検は要らない絵）
- 既存の採用済みの絵（`bg_tonari_inside_day.webp`）と原寸で並べて、同じ描き手に見える（筆の跡の残る塗り・2〜3段の影）。床や机の強い照り返し・光のにじみは無い
- 照明は、となりのトルコのモザイクランプ（形・模様・色・吊る長さがばらばら）。夜は、ランプと天井の灯りで、家具と床が読める明るさ（平均の明るさ: 昼115・夜96）
- 昼と夜の絵の位置のずれ: 0（縁の絵を重ねて測った。席の位置は昼夜で同じ）
- 観葉植物は、採用済みの tonari の内装にあるものだけ（窓ぎわの吊り鉢・壁の棚・床の鉢・棚のつる）

## 依頼文（昼）

```text
Use the attached image as the reference for the place and for the painting style. It is a cozy Japanese shisha lounge interior: warm wood, olive-green fabric sofas with chunky wooden frames, patterned cushions, low wooden coffee tables, a Persian-style rug on a dark wooden plank floor, Turkish mosaic glass pendant lamps hanging at different heights, cream plaster walls, wooden-framed windows with a daytime city view, a few potted plants, wooden shelves.

Paint a NEW view of this same room, to be used as the floor screen of a shop-management game. Keep the same hand-painted anime background style as the reference: visible brushwork, flat 2-3 step shading, no line art, no photo look, no 3D render look.

Viewpoint: seen by a staff member standing behind the bar counter, camera about 2 meters high looking slightly down, wide enough to see the whole seating floor at once. Square composition. Vertical lines stay vertical.

Layout (most important): exactly FIVE separate seating spots, each with its own low wooden table, spread naturally around the room at different depths and angles (not a neat grid, not symmetric). Every seat is turned toward the viewer (front or three-quarter front view), so that a guest sitting there would face the viewer:
1. back left, by the windows: a two-seat olive sofa with a low table in front of it.
2. back center, against the wall under a small plant shelf: a two-seat olive sofa with a low table.
3. back right corner, next to the wooden shelves: a single cozy olive armchair with a small round side table.
4. middle left, closer to the viewer: a wider olive sofa set at a slight angle, with a low table.
5. middle right, closer to the viewer, on the rug: a low olive two-seat sofa with a low table.
The seats are EMPTY and uncluttered: no people, at most one small cushion pushed to the side of each seat, because character sprites will be placed sitting on them later. Leave clear wall or backrest space above every seat. Keep the rug area in the middle and the walkways open and calm.

Top 20 percent of the picture: ceiling beams with the hanging mosaic lamps (different shapes, glass patterns, colors and chain lengths, unevenly spaced). Bottom 8 percent: the top edge of the wooden bar counter in the near foreground, plain wood.

Do not paint: people, animals, text, letters, logos, signs, picture frames with faces, hookahs, shisha pipes, hoses, charcoal, smoke, bottles of alcohol. Tables hold only a small candle glass or a tiny plant. No lens flare, no bloom glow, no light rays, no glossy wet-looking floor. Daytime; soft sunlight from the left windows is the single main light, the lamps are a weak secondary glow.
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
