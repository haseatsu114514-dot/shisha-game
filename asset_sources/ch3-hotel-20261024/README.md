# Chapter 3 — national victory night hotel room

## Files

- `bg_ch3_hotel_night.png`: adoption candidate, 1280×720 RGB/sRGB PNG.
- `source.png`: original generated image, 1672×941 RGB/sRGB PNG.
- `prompt.txt`: complete generation prompt.
- `qa_portrait_preview.png`: review-only approximate composite with Hajime's existing normal portrait. Do not install this preview as a game asset.

## Visual QA

- Read `ch3_abyss_hotel` and the story structure's victory-night guidance. The room has a clear writing desk area where Hajime can set the trophy, and an electric kettle for the later line about boiling water. The trophy itself is absent before the narration places it.
- Modest Tokyo hotel single room: one made bed, temporary travel bag, hotel-style wall paneling, quiet night city view. The amber room lamps and blue outside light support a calm celebration rather than a crisis scene.
- Compared with the game's existing painted night backgrounds, particularly `bg_home_night.png`; the level of painted detail and mixed warm/cool lighting are compatible. The hotel lacks the home's bookshelf, plants and kitchen, so the two rooms remain distinct.
- Inspected the final at 1280×720. In the approximate portrait preview, Hajime occupies the center while the bed, kettle and open trophy space remain visible at the sides. Actual runtime placement and dialogue box may vary.
- No hotel logo, readable text or numbers, people, reflections, shisha apparatus, hoses, charcoal, smoke or unrelated props are visible.
- Mechanically resized the generated source to 1280×720; source aspect ratio differs from 16:9 by less than one tenth of one percent.

## SHA-256

- `source.png`: `a42441d96440f9ca7c658a7e8856396c3ecc0cf896156490ef7877ac78ddc14a`
- `bg_ch3_hotel_night.png`: `b354d341f530dbfb502fc45dbabaf1ab18cf771c9ba1733405a199d9419e1bc2`

## Integration note

The final PNG is installed at `assets/backgrounds/bg_ch3_hotel_night.png`, with a generated WebP in `remake/img/backgrounds/`. `ch3_abyss_hotel` uses the background in the third chapter aftermath runner. The portrait composite is retained here for QA only.
