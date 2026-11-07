# Rio portrait generation record

All 14 originals were generated with Codex image generation, transparent background. The seven `new` originals and `nanami/normal` were produced before the VM restart. Their exact prompts were not present in the checkpoint, so they are not represented here as verbatim records. They used the current Rio sprites as identity and expression references and approved portraits as style references. The six remaining nanami expressions were generated after restart with one image call per expression.

## References for each resumed nanami expression

1. `assets/sprites/characters/rio/chr_rio_<expression>.png`: Rio's identity, clothing, body and expression truth.
2. `assets/sprites/characters/rio/chr_rio_normal.png`: Rio's 6.53-head proportion target only; do not copy its expression.
3. `asset_sources/portraits/rio-2702/originals/nanami/chr_rio_normal.png`: completed same-person nanami style and head-scale target.
4. `assets/sprites/character_variants/nanami/minto/chr_minto_normal.png`: adopted nanami style target only; do not copy Minto's face, hair, body or clothing.

## Resumed prompt (common text, with the corresponding expression inserted)

> Use case: style-transfer. Asset type: full-body transparent visual-novel portrait original, `<expression>` expression. Create only Rio, one person, full body including shoes, genuinely transparent background, at least 1300 px character height. Rio has long charcoal-black hair with bangs, blue-gray eyes, adult face, white rolled-sleeve blouse, black tailored trousers, belt, black heels, silver pendant and hoop earring, black clipboard in hand. Expression: `<expression instruction>`. Keep Rio's exact identity, outfit, body type, clipboard and 6.53-head proportion; head size and position consistent with completed nanami normal. STYLE FIX: match adopted nanami portraits' fine ink contour, subtle paper-like colored texture and restrained shading; do not copy reference character identity. Outline no thicker than adopted new Tsumugi. No plants, scenery, props beyond clipboard, text or watermark.
>
> STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
>
> HEAD-TO-BODY STANDARD: Rio's head from hair top to chin should be 1/6.53 of total hair-top-to-shoe height; use her original portrait as proportion target.

Expression instructions: `sad`: visibly downcast eyes and mouth, restrained sorrow, not crying theatrically; `serious`: focused, firm gaze and set mouth, composed resolve; `shock`: stunned, alarmed gaze and tense mouth, strong but controlled shock; `smile`: warm genuine smile with softened eyes, adult and restrained; `smug`: confident teasing smirk with half-lidded eyes; `surprise`: eyes widened and mouth parted in sudden surprise.

The sad call used the same reference roles and style instructions, with its expression sentence written directly. `generation.json` records reference and output hashes.
