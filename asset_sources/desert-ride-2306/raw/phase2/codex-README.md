# DESERT RIDE #2306 — phase 2 independent props, NOT ADOPTED
2026-11-02 06:26–06:38 UTC.
Spec: docs/spec/desert_ride.md §4 at PR #2306 head e94c8d7b541381cf40e8626e4e5af01b34308948, blob 4e327577544023497dd21055dda6560789ad0882.
Phase 1 Library package: libfile_e9acf71597048191ab2b8bb9fd2ea48b (9 candidates).
Parent confirmed exclusive #2306 assignment (camel race #2304 belongs to another worker) and authorized continuation with independent props. No day or character master selected here.
Built-in image_gen only; all delivered art is raw generator output, no Python painting/keying/resizing/cropping/upscaling.
No repository/runtime/manifest changes, no adoption or merge.

## Delivered: 12 candidates
- rock_large A/B/C: broad reddish-brown partly buried rock silhouettes, self-shading, no cast shadow or ground.
- rock_small A/B/C: simpler lower rounded stones, isolated, no cast shadow or ground.
- flag_pole A/B/C: slender neutral metal pole with one small plain orange triangular pennant.
- goal_banner A/B/C: plain white-to-ivory long rectangular cloth, no text, logo, checker print, ribbon tails, poles or ground.
- attempts/goal_banner-A2-cleanup-attempt.png is a retained extra attempt, not a fourth proposed selection.

## Visual and technical QA
All images inspected inline on generation. Rocks have crisp warm fine pixel-painter texture, no scene/person/markings. Large A high on left, B diagonal seam, C low stratified shoulders; small A rounded, B sloped faceted shoulder, C simpler low oval.
Flags have entire pole and blank orange triangular cloth visible, no shadows. Their metal shading is slightly smoother than rocks; approve style and narrow-runtime legibility before adoption. Pole foot is offset from raw canvas center because pennant extends right; adoption requires measured foot anchoring, not blindly using image center.
Goals show blank physical cloth with restrained fold variation, A nearly taut, B stronger wrinkles, C more sag. Smooth fabric shading is less pixel-textured than rocks; remains a style-review point.
Goal A/B inline previews show gray/cream haze because preview exposes RGB under transparent pixels. Pixel inspection confirms sampled surrounding haze pixels have alpha=0 (example A x1024,y100/200/250/300/550/650 all alpha0; fabric y400 alpha253). Therefore it is NOT an opaque baked backdrop. A2 was a targeted imagegen cleanup attempt before this was confirmed; retained for provenance, not presented as an improvement. Very-low-alpha stray pixels remain in all groups and some raw alpha bboxes reach canvas boundaries; core alpha>32 bounds remain inside canvas. Do not claim all edges are production-clean.
All 12 candidates are true RGBA. verification.json records dimensions, mode, size, SHA-256, full alpha/core bounds and transparency counts.
Rocks are 1448x1086 versus runtime 512x384. Flags A/B 887x1774, C789x1993 versus runtime128x512. Goals A/B2048x768,C2172x724 versus runtime1024x192. These are review originals, NOT exact production exports. No distort-to-fit conversion or enlargement was applied. Flags/goals need approved layout and size normalization before runtime use; especially flag narrow aspect/pole anchor and goal shallow banner aspect.

## Provenance and prompts
PROMPTS-rock-large.json and PROMPTS-rock-small.json: matching A/B/C generation prompts.
PROMPTS-flag.json: flag A/B/C generation prompts, no reference image.
PROMPTS-goal.json: initial prompt plan; only A used this original set.
PROMPTS-goal-final.json: exact final prompts; B/C used these strengthened transparent-edge prompts. GOAL_A2 in that file was an unused new-generation prompt; the actual A2 edit used PROMPT-cleanup-attempt.txt with goal_banner-A-raw.png as edit target.
Rock style reference: references/bg_eden_shop.png, SHA256 2e5eb0e1146609a09a35d090c03c4a676835701db32ddf281c2b749c2c466204. It controlled texture only, never scene contents.
SHA256SUMS covers candidate originals, attempts, prompts, reference, this record and verification.

## Still pending
Day backdrop and VN day selections remain explicit-owner decisions; same-composition dusk generation must use the selected day reference.
Rider_ride new-outfit master candidates and Noor normal master candidates are not yet made; additional rider poses and Noor smile/surprise depend on explicit base selection. Noor intro is after portrait selection. Do not silently designate any design as canonical.

