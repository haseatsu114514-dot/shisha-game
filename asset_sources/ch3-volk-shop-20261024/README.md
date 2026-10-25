# Chapter 3 — Volk's Tokyo shop background

## Files

- `assets/backgrounds/bg_volk_shop.png`: final game background, 1280×720, RGB/sRGB PNG.
- `source.png`: final image generation source, 1672×941, RGB/sRGB PNG.
- `prompt.txt`: original image generation prompt.
- `edit_prompt.txt`: edit prompt used to vary the gauge needles and make the instruments read as thermometers and humidity gauges.
- `source_v1.png`: initial source retained for provenance; do not use as the game background.

## Visual QA

- Matches the dialogue's wall of room condition instruments, with visible analog gauges, enclosed thermometers, a dark display and a conditions board. Dial ticks and board cells carry no readable numbers or words.
- Plausible Tokyo street visible through the side window. Steel, charcoal and concrete interior is visibly distinct from the warm lounge in `bg_tonari_inside.png` and the cream/wood interior in `bg_yohaku_shop.png`.
- Center and lower part of the frame remain open for dialogue portraits. The important instrument wall stays visible above them.
- Inspected at game resolution: no characters, readable text, logos, shisha hardware, hoses, charcoal, smoke, weapons or military insignia.
- Final is mechanically resized from the generated source to 1280×720. Source aspect ratio differs by less than one tenth of one percent from 16:9.

## File checksums (SHA-256)

- `source.png`: `b3fe8cee7ced39406ca19df4aa46f1c7e7aff14e4a6a6d4690deca605432ce5b`
- `bg_volk_shop.png`: `13ddab064210cf842bbf20333a0917bf1e46ddf7b07a646fd8862829dec73f4d`

## Integration note

The background is registered in `remake/data/manifest.json` and used for Volk's Chapter 3 shop visit. The runtime image and Volk's portrait were checked together in the VN scene.
