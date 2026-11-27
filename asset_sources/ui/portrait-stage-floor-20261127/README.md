# 縦画面の試作の店番で使う、tonari のフロアの絵（2026-11-27）

オーナー「もう少し画面の上半分ぐらいがフロアとお客さんいる感じにうまいことレイアウト組み直したい」「フロアに規則的に並べるというよりはイラストに合わせて配置はしたい」
「もしうまいこと配置できなければこのゲームに合わせてTonariの背景作ってもいいかも変えてもいいのでAPIで生成して」（要望台帳 VPM25）。

いまの tonari の店内の絵（`remake/img/backgrounds/bg_tonari_inside_day.webp`。横長・会話の場面用）は、手前の机が大きく、5つの席が正面から見えないので、
店番の「上半分に店内と客」には合わなかった。そこで、**同じ店を、カウンターの中から見下ろした正方形の絵**として作った。

**2026-11-27 作り直し（VPM26）**: オーナー「ソファの配置が不自然　店としておかしくなくはして」「席席席／席　席 みたいにソファ置いてもいいし　下二つは内側向いてたりで」。
1枚めの絵は席がばらばらに置かれていたので、**奥の壁に沿って2人掛けが3つ並び、手前の左右の壁ぎわに内向きの2人掛けが1つずつ、まん中は敷物の空いた床**、という店として自然な配置で作り直した（このフォルダの原画は、作り直した版）。

**2026-11-27 2回めの作り直し（VPM30）**: オーナー「今椅子がやや下の方にあり上の方の人が変な位置にあるのでこの画面に合わせて背景せいせいして」。
カメラを高くして床を広く写し、奥の3席を絵の上の方へ（背もたれの上端が上から約29%）、手前の左右の席を中ほど（約50〜84%）へ寄せた。席のカードは、その席のソファの上に重ねる（このフォルダの原画は、この版）。

- 作り方: OpenAI の画像生成 API（モデル `gpt-image-2.6-sunburst`。VPL25・26 でオーナーが指定したもの）、1024×1024、品質 medium
- 参照に渡した絵: 昼＝採用済みの `bg_tonari_inside_day.webp`（場所と画風をそろえるため）／夜＝できあがった昼の絵（構図を1画素もずらさないため）
- 生成した枚数: 1枚め＝昼2・夜2（各1枚を採用。のちに作り直し）／作り直し（VPM26）＝昼6・夜2／2回めの作り直し（VPM30）＝昼3（1枚を採用）・夜1（採用）
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
| 1 | 奥の左（壁ぎわの2人掛け。カードはソファに重ねる） | 25 | 41.5 |
| 2 | 奥のまん中 | 50 | 41.5 |
| 3 | 奥の右 | 75 | 41.5 |
| 4 | 手前の左（左の壁ぎわの内向きの2人掛け） | 18 | 74 |
| 5 | 手前の右（右の壁ぎわの内向きの2人掛け） | 82 | 74 |

## 生成後に確かめたこと

- 人物・文字・看板・ロゴは無い。シーシャの台・ホース・炭は描かせていない（空いた席にも写ってしまうため。機材の形の点検は要らない絵）
- 既存の採用済みの絵（`bg_tonari_inside_day.webp`）と原寸で並べて、同じ描き手に見える（筆の跡の残る塗り・2〜3段の影）。床や机の強い照り返し・光のにじみは無い
- 照明は、となりのトルコのモザイクランプ（形・模様・色・吊る長さがばらばら）。夜は、ランプと天井の灯りで、家具と床が読める明るさ（平均の明るさ: 昼115・夜96）
- 昼と夜の絵の位置のずれ: 0（縁の絵を重ねて測った。席の位置は昼夜で同じ）。2回めの作り直しの平均の明るさ: 昼115・夜97
- 観葉植物は、採用済みの tonari の内装にあるものだけ（窓ぎわの吊り鉢・壁の棚・床の鉢・棚のつる）

## 依頼文（昼。2回めの作り直し・VPM30）

```text
Use the attached image as the reference for the place and for the painting style. It is a cozy Japanese shisha lounge interior: warm wood, olive-green fabric sofas with chunky wooden frames, patterned cushions, low wooden coffee tables, a Persian-style rug on a dark wooden plank floor, Turkish mosaic glass pendant lamps hanging at different heights, cream plaster walls, wooden-framed windows with a daytime city view, a few potted plants.

Paint a NEW view of this same room, to be used as the floor screen of a shop-management game on a phone. Keep the same hand-painted anime background style as the reference: visible brushwork, flat 2-3 step shading, no line art, no photo look, no 3D render look.

Viewpoint: seen from above the bar counter, camera fairly high (about 2.6 meters) and tilted down, so that the floor takes most of the picture and the back wall is short. One-point perspective, straight at the back wall, symmetrical room. Square composition. Vertical lines stay vertical.

Furniture layout (most important, a sensibly arranged small lounge with exactly FIVE seating spots in a U shape around an open center):
- BACK ROW: three identical two-seat olive sofas side by side in one straight line against the back wall, facing the viewer. Their centers are at about 21, 50 and 79 percent of the picture width, each sofa about 22 percent of the picture width wide, with clear gaps between them. Each has its own small low wooden table directly in front of it.
- SIDES: one two-seat olive sofa against the LEFT side wall and one against the RIGHT side wall, both much closer to the viewer than the back row. They face inward, toward the center of the room (seen from the side / three-quarter view). The left one occupies roughly 3 to 30 percent of the picture width, the right one roughly 70 to 97 percent. Each has a small low wooden table on its inner side.
- CENTER: open floor with the Persian-style rug, clear for walking. No furniture in the center.
All seats are empty: no people, at most one small cushion per sofa.

Vertical placement in the picture (measured from the top edge; please follow closely):
- 0 to 12 percent: ceiling with the hanging mosaic lamps (different shapes, glass patterns, colors and chain lengths, unevenly spaced). Short chains, the lamps stay high.
- 10 to 24 percent: a short strip of back wall with one or two small windows; calm, little decoration.
- Back-row sofas: backrest top at about 23 percent, seat cushions at about 31 to 35 percent, their small tables at about 36 to 43 percent.
- 43 to 92 percent: open floor and rug.
- Side sofas: from about 54 percent (top of the backrest) to about 82 percent (front of the seat), with the seat cushions around 66 to 72 percent.
- 92 to 100 percent: the plain top edge of the wooden bar counter in the near foreground.

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
