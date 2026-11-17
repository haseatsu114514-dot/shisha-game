# 実際に送ったプロンプト全文（#3713 B）

生成器: Grok Bot `GenerateImage`。16:9 JPEG（1280×720）で返ります。最終稿は縁が 56% になるよう切って 3600×1440 へ拡大しています。

参照:
- 現行の昼・夕の遠景（空+陸を 1800×720 に合成したもの。画風・色）
- `assets/backgrounds/bg_dubai_dunes_day.png`（見下ろす構図。車は写さない）

---

## backdrop_slope_day

v1 は現行遠景に近く、平らな砂原を「横から見る」構図になり、見下ろしになっていませんでした。v2 で谷を見下ろす構図と、16:9 高さの約 54%（切り取り後 56%）の水平な縁は取れました。ただし縁が白い線のように見え、縁より下に強い斜めの筋が残ったため、生成後に手前の斜面をほぼ均一な砂へならし、縁を砂色のわずかな段差にしています。

### v2（構図の採用元）  aspect 16:9、参照: 構図ガイド v2, backdrop_day_combined, bg_dubai_dunes_day

```
Paint a single seamless 16:9 game backdrop of a sandboarding slope outside Dubai at midday. The first image is a COMPOSITION GUIDE only (ignore its hard collage seam and ignore the strong diagonal ripple bands below the white line). The second image is the STYLE and COLOR authority: detailed 2D digital painting, fine pixel-painter texture, warm golden sand, pale-blue sky, soft haze, not photographic. The third image shows what looking DOWN onto a sea of dunes should feel like; do not copy the car or any vehicle.

CRITICAL COMPOSITION of this 16:9 frame:
- The camera stands at the top of a very tall dune and looks DOWN, not across a flat plain.
- Exactly at 54 percent of the image height, draw one clean nearly-straight horizontal lip, the edge of the slope the player is standing on, running the full width. This is a natural sunlit sand edge, not a white road, not a painted stripe, not a wall.
- ABOVE the lip (from about 36 percent to 54 percent): a valley FAR BELOW, a sea of dune crests seen from above, several receding rows, farther rows smaller paler and bluer, sunlit tops, long shadows on far sides, flat valley floors between them. Horizon line around 40 percent of the height. No dune rises much above the horizon.
- TOP (above about 36 percent): clear pale-blue midday sky, a few thin clouds. Do NOT paint a sun disc.
- BELOW the lip to the bottom: the near slope, plain evenly lit sand with only very soft ripples. No objects, no rocks, no tracks, no strong shadow bands, no diagonal stripe pattern.
- Paint it as one continuous landscape, no collage seams.
- Left and right 5 percent must stay calm, no distinctive landmark dunes or unique clouds, because the image will tile by mirroring.

HARD NG: no people, no vehicles, no tents, no animals, no buildings, no text, no logos, no UI, no watermark, no sun disc, no hard white line like a road.
```

### v1（不採用・平らに見える）  aspect 16:9、参照: backdrop_day_combined, bg_dubai_dunes_day

```
Scrolling far backdrop for a sandboarding minigame, opaque 16:9 digital painting. The player rides down the face of a very tall dune outside Dubai; the camera looks DOWN the slope. This image is the far view beyond the edge of that slope. Style must match the attached current backdrops exactly: detailed 2D digital painting with fine pixel-painter texture, warm golden sand with wind ripples, soft atmospheric haze, same color world as the midday backdrop. Not photographic. The Dubai dunes reference shows the intended LOOKING-DOWN composition (sea of dune crests below the viewer) but do NOT copy the 4x4 car, tracks, or any vehicle.

This 16:9 image will later be cropped by cutting about 14.4 percent off the top and 14.4 percent off the bottom, so keep important content in the middle vertical band.

Composition of this 16:9 frame, top to bottom:
- Upper area (to about 36 percent of height): clear pale-blue midday sky, a few thin clouds. Do NOT paint the sun, no sun disc, no obvious sun glow ball.
- Around 40 percent of height: a hazy distant horizon line. Between about 36 percent and 54 percent: we look DOWN onto a sea of dunes, several rows of dune crests receding to that horizon, each farther row smaller, paler and bluer. The nearer dunes are clearly BELOW the viewer: sunlit crests and tops seen from above, long shadows on their far sides, flat valley floors between them. No single dune rises above the horizon by more than a small amount.
- Exactly at 54 percent of this 16:9 height: one clean, nearly straight horizontal lip line across the WHOLE width. This is the lip of the slope the player is on. Above the line: the valley far below. Below the line: the near slope.
- From 54 percent to the bottom: plain, evenly lit sand of the near slope, only very soft ripples, no objects, no rocks, no tracks, no distinct shadows, no car.

The image will tile horizontally by mirroring, so keep the left and right 5 percent calm and free of distinctive dune shapes or unique cloud forms.

HARD NG: no people, no vehicles, no tents, no animals, no buildings, no text, no logos, no UI, no watermark, no border, no sun disc.
```

---

## backdrop_slope_dusk（採用: v1 を昼と同じ切り取りで仕上げ）

昼の清掃済み 16:9 を編集元にし、夕方の色だけを変えました。砂丘の形はよく一致しています。縁の行は昼と同じ切り取りを適用し、検品値は 811px（目標 808±6）。手前の斜面の筋は昼と同じ基準でならしています。

### v1  aspect 16:9、参照: backdrop_slope_day_clean_16x9, backdrop_dusk_combined

```
Recolor this exact desert slope vista to sunset, keeping the SAME place, the SAME camera, the SAME dune shapes, the SAME cloud positions, and the SAME horizontal lip line at the exact same row as the first attached midday image. The first image is the edit source: do not move, restyle, or redesign any landform. The second image is only for sunset color authority: orange-to-violet sky, dune crests rim-lit in warm light, long blue-violet shadows in the far-side valleys, fine pixel-painter 2D digital painting, not photographic.

Keep the nearly-straight horizontal lip of the near slope at the exact same height as the first image. The sand below the lip stays plain and evenly lit, with only very soft ripples and no objects, no rocks, no tracks, no strong shadow bands. Still no sun disc (the game draws the sun). No people, no vehicles, no tents, no animals, no buildings, no text, no logos, no UI, no watermark, no border. Left and right 5 percent stay calm for mirrored tiling.
```
