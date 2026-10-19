# Issue 711 — final independent scene review

**Result: accept these two source-PNG candidates for the requested color-orientation correction. No further mask changes are recommended.**

Reviewed on 2026-10-19 against the untouched audit originals. Formal claim remains `codex-711-20261019-588761470c34`, run `39273098251`, PR 742. This reviewer performed read-only inspection and wrote analysis/report files only; no candidate, original, production, or work asset was edited by this reviewer.

## Visual result

- **Adam intro:** the left apple and its inner patterned backing are red; the right apple and backing are green. Snake anatomy, gold/cream detailing, stems, arches, book geometry, and composition remain visually intact. The large diagonal green field and exterior page/frame treatment remain appropriate and unchanged in the tested protected regions.
- **Tournament CG:** Adam’s screen-left frontal hair is red and screen-right crest/fringe is green, matching his anatomical right-red / left-green rule. The previously omitted thin green forelocks and ear-adjacent strips are corrected, and the right fringe tips are green. The original red nape behind his screen-left ear remains red. Warm crown rim light is retained. Face, expression, pose, the other three characters, and stage composition are visually unchanged.
- Viewed both complete native candidates, an enlarged native-pixel crop of Adam’s head, and the intro motif crop. Neither asset was flipped, reframed, regenerated, or rescaled.

## Protected-pixel findings

- Intro: **125,255 tested gold/cream pixels** with exact source hue `30 <= H < 70`, saturation at least 0.15, and value at least 0.20 in the motif review region are **pixel-identical**. The earlier clipped-cream regression is resolved: all 2,603 pixels in the separately tested bright H58–66 class are unchanged.
- Intro: **zero changes outside the two bounded lobe regions**. Tested diagonal-field, lower-page, and outer-right-frame regions also have zero changes.
- Tournament: **zero changes outside the two bounded hair regions**. All eligible source-green hair pixels within the final green mask have been recolored; no omitted green strips remain under that test.
- Tournament: **zero changes to protected source-green eyebrow pixels**, the guarded non-green face pixels, the nape core, or tested blue/purple stage pixels. The left-eyebrow and tiny-brow exclusion regions are entirely unchanged. The broader right-eyebrow exclusion polygon overlaps 11 recolored red-fringe pixels; those are hair pixels outside the face guard, while its source-green eyebrow pixels remain unchanged.

## Candidate identities

| Asset | Dimensions | PNG bytes | Changed pixels |
| --- | --- | ---: | ---: |
| `assets/ui/character_intros/adam.png` | 1672 × 941 RGB | 3,077,020 | 117,050 |
| `assets/cgs/cg_ch1_tournament_battle.png` | 1920 × 1080 RGB | 2,798,440 | 15,323 |

Candidate SHA-256:

- Intro: `e373cd560a82a6cf7416a47cd48eb1fe6de6bce18e2c94ffdd484522ec23a8c6`
- Tournament: `cf59f7021f45f51c005d4ff84a8f05b35fbdf4d6e65eca1a21bedefb7f785d53`

Audit-original SHA-256:

- Intro: `f80e8e102f034765f428a4e45626fafe61120e20db6ac32ac378bebe827bd08b`
- Tournament: `694eb554d9f8e302b4047f0fbd5812ca38bfcc9814d6d92c3050234ec8691974`

Frozen recipe: `mask-suggestions-v2.json`, SHA-256 `fbff2adace66465f1c2ca033925034172ee9fa7324374e612f700e4216ed2491`. No v3 recommendation was required.

## Limits and evidence

This review covers the two source PNGs and the orientation/protection findings above. Color-class checks are qualified by their masks and hue ranges; they do not constitute semantic segmentation of every antialiased ink edge. Runtime loading, generated formats, release bundles, and issue-wide consistency are outside this scene review and remain with the root task.

Detailed measurements are in `final-scene-review-data.json`. Final read-only crops are `cg-final-native-head.png` and `intro-final-motif.png`. The original and candidate paths and their hashes are recorded in the measurement file.
