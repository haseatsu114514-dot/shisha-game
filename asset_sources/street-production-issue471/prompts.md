# Built-in image_gen prompts

## はじめの歩行絵

Use case: identity-preserve. Image 1 (formal Hajime portrait) is the ONLY identity reference. Image 2 is the 5-column/two-row walking layout. Image 3 is only existing pixel sprite detail/proportions. Preserve the 22-year-old male protagonist, black hair and black curved-brim cap with tiny steam mark, open black zip hoodie, black shirt, cargo pants, black high-top shoes, small silver pendant. Exactly 10 isolated full-body sprites on flat #FF00FF, columns down/down-right/right/up-right/up, rows opposite-leg step A/B. Uniform scale/foot baseline, no cell borders, floor, text or shadow. Crisp detailed field sprite suitable for 72dot downscale, about 3.5 heads tall. Back views have no face/front zipper/chest pendant. Opposite arm/leg movement. No female-character substitution or redesign.

Inputs: formal `chr_hajime_normal.png`, `pose_reference_sheet.png`, existing `tsumugi_walk_72.png` (layout/style only). Transparent background false; established converter makes the production alpha sheet.

## 大須風の昼

Use case: precise-object-edit. Edit `arcade-day-original.png` to the everyday mix of Osu shopping district, especially red steel beams/pale translucent roof of Niomon street and dense mixed storefronts of Shintenchi street. Preserve centered vanishing point, clean floor, landscape ratio and detailed pixel-painter 2D game style. Practical lower roof, boxy red beams and functional ceiling lights; vary facade height, color, material and age. Mixed clothing/electronics/hobby/food/local-cafe storefronts, blank colorful vertical signboards/pennants, no real brand logos or readable shop names. Near-left ochre timber/glass cafe; mint/pink renovated brick cafe on the right; far dark-timber shop with round window and lantern outside the arcade at the district edge. Measurable doors. Keep central pedestrian aisle empty, no cars, people, sprites, furniture/bikes/plants in walking lane, no shisha equipment, UI or watermark. Afternoon roof light and readable foreground doors.

## 同一構図の夜

Use case: lighting-weather. Change ONLY day to night in `osu-arcade-day-original.png`. Keep every roof beam, facade, door, floor, signboard, cafe and distant district-edge shop in the same dimensions/positions. Deep blue outside sky, pale warm functional arcade lights and warm indoor shop lamps. Red beams, storefronts and floor tiles remain readable. Muted blue ambient roof light, no crushed-black walking lane. No new people, text, brands, UI, watermark or moved entrances.

## 比較のみ・最初の昼

Use case: stylized-concept. A central-perspective covered regional Japanese shopping arcade for actual 2.5D RPG gameplay. Slightly elevated eye level, warm pixel-painter architecture, individual old/new storefronts, blank signage, clean broad central aisle, no characters, cars, UI, shisha equipment or watermark. Generated before the owner's specific Osu reference; the decorative glass roof version is not used in the game.
