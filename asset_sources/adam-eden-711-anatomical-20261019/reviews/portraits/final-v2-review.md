# Issue #711 — independent local masked-color review

**Result: pass for the five standing portraits, derived Adam face icon, and EDEN background listed below.** The frozen v2 masks resolve the provisional neck/forehead spill and the missed red forelock tips. No further portrait/background mask correction is requested by this review.

## Scope and visual result

The authoritative direction is **Adam’s own left = green, own right = red**. For these frontal standing portraits this means **screen left red / screen right green**. The EDEN foreground apple pair uses the same screen orientation. The corrected palette reads as warm red and apple green, without blue.

All five final standing candidates were compared with their original PNGs at 3×, including eyes, ears, neck, nape strands, and clothing. Forelock boundaries were inspected at 12× after tracing the original diagonal hair/forehead outlines in coordinate grids. The narrow tips now follow their green hair half; adjacent warm forehead shading remains original. The screen-left burgundy nape strands were already target red and remain red, while the screen-right nape is green. No geometric face, pose, clothing, canvas, or alpha change was observed.

The 160 × 160 face icon was visually checked at 4×. It has matching framing and facial appearance and carries the same red-left / green-right hair. Its existing builder performs 256-color MEDIANCUT quantization of the whole cropped RGB image, then restores the separately resized alpha (`tools/make_face_icons.py::make_icon`). Consequently, recomputing the icon palette changes some face/clothing RGB values as well as hair. **Outside-hair RGB invariance applies to the five standing PNGs, not to this quantized derivative.** The icon’s dimensions and full alpha channel remain identical to the original.

The EDEN center painting was compared at 7×. Only the two foreground apple bodies change to red-left / green-right. The rear third apple stays red and the stems remain intact. The two outer paintings and all pixels outside the center pair are unchanged.

## Independent pixel checks

For each standing PNG, local Pillow/NumPy comparisons against the inspected original confirm:

- Original **896 × 1200** dimensions and the entire alpha channel are unchanged.
- **Zero changed pixels outside the frozen v2 hair masks**, evaluated using floating RGB→HSV from immutable original pixels.
- Both eyebrow guard rectangles are byte-identical.
- Independently selected face, right-ear, and neck core regions contain **zero changed pixels**. Their coordinates are recorded in `final-v2-validation.json`.

These comparisons support the visual boundary review; membership in a mask alone does not establish that a pixel is hair. The final source/candidate images were therefore also inspected directly.

EDEN remains **1280 × 720**. Its 1,468 changed pixels all lie inside the two foreground apple silhouettes, within inclusive bounds **x620–692 / y214–242**. The stem guards are byte-identical. The face icon remains **160 × 160**, with byte-identical alpha; the palette behavior described above accounts for its wider RGB differences.

## Frozen mask recipe

Use `mask-recommendations-v2.json`, **26,752 bytes**, SHA-256:

`8d18210ac3b5ba1465f3da7e51353e4bddd6077b4cde50b0de8a9be368c5cf0b`

It contains original-pixel polygons for every expression and the EDEN pair. Polygon masks are intersected with original alpha > 0 and floating HSV gates (green H42–175°, red H0–48° or H320–360°, S ≥ 0.12, V ≥ 0.06), followed by explicit eyebrow exclusions. Central-part overlap is resolved once with green priority; both masks are derived from the unmodified original. Neutral dark outlines and face/ear/neck shading are preserved.

The earlier draft and first refined recipes are inspection history. Their provisional nape box and forehead diagonal should not be used. The v2 file was frozen before the final regeneration and was not modified during this final review.

## Exact reviewed outputs

Portrait paths are `assets/sprites/characters/adam/chr_adam_<expression>.png`. EDEN is `assets/backgrounds/bg_eden_shop.png`; the face icon is `assets/ui/face_icons/face_adam.png`.

| Output | Bytes | Changed pixels vs original | SHA-256 |
|---|---:|---:|---|
| normal | 450,844 | 11,236 | `b1200dd85c3949eeb534f28ba90f4219a1fe3b1bc442f35cd24ec581023c5baf` |
| smile | 441,084 | 11,249 | `a9663ef76a2b8efdd3fa4362a6519c97302d0a3a5068098b55c7d576d1e711c9` |
| serious | 449,258 | 11,429 | `c8efbed43ecf0ad88338e14c23b9cf5db4238130e5f55a82e1147e1439329b3b` |
| surprise | 452,763 | 11,194 | `b9d11d4bc616b37fd114f304cffcf3838b7d53744780af31280e4dbce7b9ccad` |
| intense | 418,820 | 11,614 | `79bf60369bc7a6eee4b3fbc5d16464b3d9a4b2e89a60c0c534c4adc74d8a4399` |
| eden | 405,458 | 1,468 | `222d93d7a94854d4420120df53914c3d4553cd719cf0b2c119bb094dcb43f770` |
| face_icon | 42,385 | 13,951 | `593a00769659a284095be0268ee432c062b53af8a8d093b486b456261a9eb6c2` |

## Evidence and practical limit

`final-v2-validation.json` contains full original/candidate hashes, mask and semantic-region checks, dimensions, and alpha results. The corresponding `*-v2-final-inspection.png`, `*-v2-forelock-final.png`, `face-icon-v2-final-inspection.png`, and `eden-candidate-inspection.png` are local inspection boards.

The reviewer wrote only inspection reports/JSON/cropped QA under `issue711-mask-review`. All five original portrait SHA-256 values still match the earlier source audit. No production image, checkout, historical source archive, or remote resource was edited or fetched by this reviewer.

This report covers these exact local source/candidate files. It does **not** certify intro/CG changes handled elsewhere, runtime WebP/manifest validation, PC1280×720 or landscape844×390 game QA, release adoption, or completion of the overall issue. Those checks remain with the parent workflow.
