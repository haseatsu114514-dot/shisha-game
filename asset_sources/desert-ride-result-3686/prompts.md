# 実際に送ったプロンプト全文（#3713 A）

生成器: Grok Bot `GenerateImage`（`cursor` 名前空間）。指定できる縦横比は 1:1 / 16:9 などに限られ、透過 PNG は返らない（JPEG、多くは 1024×1024 または 1280×720）。

共通の参照（特記なき場合）:
- `remake/img/ui/desert_ride_controls/jump.webp`
- `remake/img/ui/desert_ride_controls/boost.webp`
- 部品によって `panel.webp` / `speedo-dial.webp` も添付。形は写さない、と毎回指示。

採用した出力と、不採用の再生成を時系列で残します。

---

## medal_s（採用: v2）

v1 は rim の内側が速度計のような目盛りになり、Hard NG「no UI gauges」に触れました。参照から `speedo-dial` を外して v2 を取りました。

### v2（採用）  aspect 1:1、参照: jump.png, boost.png

```
Game UI rank medal, front view, no tilt, no rotation, centered with about 4 percent empty margin on every side. Hand-painted 2D game UI matching the attached gold-and-orange painted texture: fine pixel-painter brushwork, warm yellow gold, soft top-left light, crisp silhouette. Not photographic, not smooth 3D, not flat vector, not a speedometer.

A thick polished gold coin. Raised rounded rim. Just inside the rim, a decorative engraved ring of tiny radiating sun-ray lines and wavy dune-ripple engravings only — ornamental metalwork, NOT tick marks, NOT a gauge, NOT a clock, NOT a dial, no numbers, no hashes like a meter. The centre is a smooth slightly domed EMPTY gold disc covering about 62 percent of the diameter: a blank unstamped coin face with only soft metal shading, completely empty, no emblem, no letter, no star, no sun icon. A short pair of deep-red cloth ribbon tails hangs behind the lower edge of the coin. Brightest precious warm yellow gold with a few small highlight glints.

HARD NG: no letters, no numbers, no S, no logos, no UI gauges, no tick-mark dial, no watermark, no canvas frame, no drop shadow on the background.

CRITICAL BACKGROUND: perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255) everywhere behind the medal. No texture, no gradient, no shadows on the magenta.
```

### v1（不採用・目盛り）  aspect 1:1、参照: speedo-dial.png, jump.png, boost.png

```
Game UI rank medal, front view, no perspective tilt, no rotation. A single thick polished gold coin seen straight on, centered on the canvas with about 4 percent empty margin on every side. Material and paint style must match the attached reference images: hand-painted 2D game UI with fine pixel-painter texture, warm yellow gold, soft top-left light, crisp readable silhouette. Not photographic, not smooth 3D, not flat vector. Do not copy the shapes of the attached images.

Geometry: a raised polished gold rim, an engraved ring of small sun rays and dune-ripple lines just inside the rim, and a smooth slightly domed EMPTY centre disc covering about 62 percent of the diameter. The centre is a blank unstamped gold dome with only soft metal shading — completely empty. A short pair of deep-red ribbon tails hangs behind the lower edge of the coin, not in front of the centre.

This is the brightest, most precious gold medal of a set of four, with a few small highlight glints.

HARD NG: no letters, no numbers, no logos, no icons that read as text, no rank letter, no S, no A, no monogram, no emblem, no star in the centre, no UI gauges, no watermark, no border frame around the canvas, no drop shadow on the background. The game will print a letter on the empty centre later.

CRITICAL BACKGROUND: fill the entire canvas behind the medal with a perfectly flat uniform unshaded solid color #FF00FF (pure magenta, RGB 255,0,255). No gradients, no texture, no checkerboard, no white, no black. No shadows falling onto the magenta. The magenta is only a chroma-key backdrop.
```

---

## medal_a（採用: v1）  aspect 1:1、参照: 採用した medal_s

```
Recolor this exact rank medal to the A-rank metal. Keep the SAME circular coin, the SAME size, the SAME rim position, the SAME empty centre disc, the SAME engraved sun-ray ring and the small dune-ripple mark at the bottom of the ring, and the SAME ribbon-tail silhouette and placement as the attached medal. Do not change the geometry or move anything. Do not add or remove ornaments.

Change only the metal color: sunset orange-copper metal with a red-brown rim, slightly less ornate or slightly softer engraving is ok but keep the same marks in the same places. Ribbon tails in dark orange instead of deep red. The centre disc stays smooth, slightly domed, and completely EMPTY: no letter, no A, no emblem.

HARD NG: no letters, no numbers, no logos, no rank letter, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255) everywhere behind the medal.
```

---

## medal_b（採用: v1）  aspect 1:1、参照: 採用した medal_s

```
Recolor this exact rank medal to the B-rank metal. Keep the SAME circular coin, the SAME size, the SAME rim position, the SAME empty centre disc, the SAME engraved ring layout, and the SAME ribbon-tail silhouette and placement as the attached medal. Do not change the geometry or move anything.

Change only the materials: cool blue enamel on steel, with a navy rim. Simpler or slightly softer engraving is ok but keep the same marks in the same places. Ribbon tails in navy blue. The centre disc stays smooth, slightly domed, and completely EMPTY: no letter, no B, no emblem.

HARD NG: no letters, no numbers, no logos, no rank letter, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255) everywhere behind the medal.
```

---

## medal_c（採用: v2）

v1 はリボンが無いぶんコインが下がって小さくなり、縁の幅も違いました。v2 で位置と大きさを揃えています（後処理で 0.5px 以内に合わせ済み）。

### v2（採用）  aspect 1:1、参照: 採用した medal_s

```
C-rank version of the attached gold medal, front view. Keep the coin in the EXACT same place and the EXACT same size as the attached medal: the outer rim must sit on the same circle, do not move the coin down, do not shrink it. Leave the space under the coin empty: no ribbon tails at all.

Keep the same rim thickness and the same empty centre disc covering about 62 percent of the diameter. Almost no engraving: the sun-ray marks and dune mark may be very faint or nearly worn away, but the rim band itself stays the same width. Material: plain sand-coloured unpolished stone or dull bronze, brown rim, matte, not shiny gold. The centre is a smooth slightly domed EMPTY disc: no letter, no C, no emblem.

HARD NG: no letters, no numbers, no logos, no ribbons, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255) everywhere behind the medal. Do not recenter the coin.
```

---

## ribbon_win / ribbon_lose

生成器は 16:9 キャンバス上で、指定の 5.2:1 より細い帯（約 8.8:1）ばかり返しました（v1〜v3）。採用した `raw/ribbon_*.png` は、v3（win）と v1（lose）の布の質感を使い、燕尾の両端を高さ 184px に合わせて組み立て、中央の平坦部を伸ばして 1040×200（中身の比 5.201、上下左右約 4% 余白）にしたものです。lose の最終稿は、組み立てた win を色相ごとオリーブへ移したもので、外形は win と一致します。

### ribbon_win v3（質感の元）  aspect 16:9、参照: 形状ガイド + ribbon_win v1

```
Paint a game UI cloth banner ribbon using the FIRST attached image as a strict geometry guide: the ribbon must fill that same stout swallow-tail silhouette, the same size, the same 5.2-to-1 wide-but-tall banner proportions, and the same centered placement on the 16:9 magenta canvas. Do not draw a thin strip. The ribbon is a comfortable text banner, about 222 pixels tall in a 720-tall frame, with deep V-notches on both ends.

Use the SECOND attached image only for materials and style: hand-painted 2D game UI cloth, golden yellow shading to sunset orange, thin darker stitched edge along the top and bottom, soft fabric folds only near the two ends, the middle 70 percent flat, plain, and evenly lit. Blank, no text, no icons, no emblems.

HARD NG: no letters, no numbers, no logos, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: everything that is not the ribbon is perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255).
```

### ribbon_win v1（細い帯、質感の参考）  aspect 16:9、参照: jump.png, panel.png

```
Game UI horizontal cloth banner ribbon for a win result, front view, no perspective tilt, no rotation. Style must match the attached references: hand-painted 2D game UI with fine pixel-painter texture, warm desert palette, soft top-left light, crisp silhouette. Not photographic, not smooth 3D, not flat vector. Do not copy the shapes of the attached images.

Place ONE wide thin horizontal cloth ribbon in the exact center of the 16:9 canvas. The ribbon itself is much wider than it is tall (about 5.2 to 1 aspect), stretching almost the full width, with a small margin. Swallow-tail V-notched ends on BOTH left and right sides. Color: golden yellow shading to sunset orange. Thin darker stitched edge along the top and bottom. Soft fabric folds only near the two ends. The middle 70 percent of the ribbon is flat, plain, and evenly lit so text can be drawn on it later. Blank surface, no motifs in the middle.

HARD NG: no letters, no numbers, no logos, no icons, no text of any kind, no watermark, no border frame around the canvas, no drop shadow on the background.

CRITICAL BACKGROUND: everything that is not the ribbon must be a perfectly flat uniform unshaded solid color #FF00FF (pure magenta, RGB 255,0,255). No gradients, no texture, no checkerboard, no white, no black, no shadows on the magenta.
```

### ribbon_lose v1（細い帯、色の参考）  aspect 16:9、参照: ribbon_win v1

```
Recolor this exact ribbon to a lose-state version. Keep the SAME outline, size, placement, swallow-tail V-notched ends on both sides, stitched edges, and fold shapes as the attached ribbon. Do not change the silhouette or move it. Change only the cloth color: muted olive green with a darker olive stitched edge. The middle 70 percent stays flat and plain. Blank, no text, no icons.

HARD NG: no letters, no numbers, no logos, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: keep a perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255) everywhere that is not the ribbon.
```

---

## board（採用: v3）

v1 は内側に二枚目の枠があり、縦横比も 16:9 に近すぎました。v2 で形と 7:3 比は合いましたが塗りがベタ塗りに近かったため、同じ形のまま革の質感を足した v3 を採用しています。

### v3（採用）  aspect 16:9、参照: board v2, boost.png, panel.png

```
Repaint this exact record board with richer hand-painted materials, keeping the SAME geometry. The first attached image is the exact shape, size, placement, thin gold edge, small gold corner fittings, and uniform dark interior to keep. Do not change the silhouette, do not add an inner inset rectangle, do not add rows or icons.

Paint it in the same hand-painted 2D game UI style as the other attached references: fine pixel-painter texture, soft top-left light, slightly worn gold, not flat vector, not photographic. The panel is dark smoke-brown leather or wood close to #2a1616, with a subtle even leather-or-wood grain across the whole interior (the grain must stay uniform and tileable, no unique stains or marks in the middle, so the board can stretch as a 9-slice). Thin painted gold line and modest gold corner fittings only, all decoration within a very thin border.

HARD NG: no letters, no numbers, no logos, no icons, no watermark, no drop shadow on the background, no inner frame.

CRITICAL BACKGROUND: everything that is not the board is perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255).
```

---

## button_primary（採用: v1）  aspect 16:9、参照: jump.png

```
Game UI wide rounded-rectangle push button, front view, no perspective tilt, no rotation. Same family and materials as the attached orange jump button, but a WIDER landscape rectangle, not a square, and with a completely plain empty face. Hand-painted 2D game UI with fine pixel-painter texture, warm desert palette, soft top-left light, crisp silhouette. Not photographic, not smooth 3D, not flat vector. Do not copy the square shape, the arrow, the dune icon, or the word JUMP from the reference.

Place ONE wide rounded-rectangle button in the exact center of the 16:9 canvas. The button itself is about 2.6 to 1 aspect (wide and not very tall), with a small magenta margin around it. Glossy sunset orange face, ornate gold rim in the same painted-gold style as the reference, a darker lower lip so it looks pressable. The face is plain and empty: no arrow, no icon, no symbol, no text. It must stretch horizontally as a 3-slice: keep any rim decoration within the left and right ends (about 15 percent of the width); the middle of the face and rim is simple and uniform.

HARD NG: no letters, no numbers, no logos, no icons, no arrow, no JUMP text, no watermark, no border frame around the canvas, no drop shadow on the background.

CRITICAL BACKGROUND: everything that is not the button must be a perfectly flat uniform unshaded solid color #FF00FF (pure magenta, RGB 255,0,255). No gradients, no texture, no checkerboard, no white, no black, no shadows on the magenta.
```

---

## button_secondary（採用: v1）  aspect 16:9、参照: button_primary v1, boost.png

```
Recolor this exact wide rounded-rectangle game button to a secondary dark version. The first attached image is the exact shape to keep: same outline, same size, same placement, same gold rim, same side diamond ornaments, same pressable darker lower lip. Do not change the silhouette. Replace only the orange face with a dark leather-brown face in the same material family as the second attached boost button (dark leather / brushed metal brown-black), still a plain EMPTY face: no lightning bolt, no icon, no text. Gold rim stays gold. Hand-painted 2D game UI, fine pixel-painter texture, soft top-left light.

HARD NG: no letters, no numbers, no logos, no icons, no lightning bolt, no BOOST text, no watermark, no drop shadow on the background.

CRITICAL BACKGROUND: everything that is not the button is perfectly flat uniform unshaded solid #FF00FF magenta (RGB 255,0,255).
```
