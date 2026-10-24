# Chapter 3 — Steve's Smoke & Glory Tokyo interior

## Files

- `assets/backgrounds/bg_steve_shop.png`: adoption candidate, 1280×720 RGB/sRGB PNG.
- `source.png`: original image generation output, 1672×941 RGB/sRGB PNG.
- `prompt.txt`: complete generation prompt.

## Visual QA

- Checked the `ch3_steve_low_heat` dialogue and Steve's character profile. A mechanical kitchen timer is visible at the guest seating area, and pizza plus sliced BBQ meat wait at the back service pass. Guest tables remain empty, matching the pizza's later arrival in the scene.
- Red booths, cream tile, brick pizza oven and dark checker floor give the American chain's Tokyo branch a warm social character. This is visually separate from `bg_mukai_shop.png` (blue-gray café with coffee counter), `bg_yohaku_shop.png` (quiet cream/wood interior), and the staged Volk shop (charcoal concrete and instruments).
- The center and lower foreground stay clear enough for dialogue portraits. The timer, pizza and meat remain visible at 1280×720.
- Inspected the output at game resolution: no people, readable text, numbers, menus, logos, recognizable real-world brands, shisha apparatus, hoses, mouthpieces, charcoal, smoke, or malformed hardware.
- The depicted food is on a service ledge, so the narration can still show it being brought to the table later. Shisha handling remains in the dialogue without a background depiction of the apparatus.
- Mechanical resize from source to 1280×720; source aspect ratio is within one tenth of one percent of 16:9.

## SHA-256

- `source.png`: `057d1cd51e58ca0064e5a106f01cc4e07eced8325570a9e1f45a0ca220c05510`
- `bg_steve_shop.png`: `628b5e7ae953a3fcb8553f10161d6956507ee24c21c110cabb75fcc8ca7e52a7`

## Integration note

The game-sized background is stored at `assets/backgrounds/bg_steve_shop.png`, registered in `remake/data/manifest.json`, and used for Steve's Chapter 3 visit. The runtime image and Steve's portrait were checked together in the VN scene.
