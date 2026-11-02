# TRPG scenario portrait candidates — 2026-11-02

31 unchanged PNG candidates across scenarios03–13; built-in image_gen. **None adopted or installed.** Scenarios01/02 untouched. Every successful source is genuine RGBA1774×887, NOT requested2048×1024. No resize/crop/recolor/alpha cleanup. Do not call production-size compliant. Native whole-sheet lower portrait resolution remains a limitation for512px production crops.

Canon: main asset_sources/trpg-scenarios/README.md blob b6c51024d50634b9922bb18fd45e7d59871a20b2 for03–10. Refreshed main blob057937ca0f39d2b188fa8e088c585b0d890a18fb after PR2264 merge for11–13; snapshot canon-latest.md. All03+ companion roles explicitly fictional characters made for the story, not actual tabletop participants. No image references used: text canon only. Actual player standing art must NOT be substituted silently. Initial source prompts normalized for crop-safe spacing; full actual prompts saved per directory, base=A, b/c variant files.

| Scenario | PNGs | Visual candidate (not adoption) | Minimum native cell margin | Residual QA |
|---|---:|---|---|---|
| apple-thief | 3 | B | 31px | Top-right faces right, not specified left |
| doll-requiem | 3 | C | 16px | Crop margins narrower; keep pending |
| fading-familiar | 1 | None | 0(A)px | Only A generated, bad crop margins; B output-moderation rejection, C not attempted |
| fox-market | 3 | B / C | 26(B),15(C)px | B safer crop; C shows scoop |
| leaf-mail | 3 | C | 34px | Strongest crop separation; original fictional roles |
| mist-kingdom | 3 | C | 49px | Blank number tag to obey no digits |
| moonflower-encore | 3 | C | 32px | Latest merged canon confirmed |
| purikura-hero | 3 | None | 0(B),6(C)px | B crosses cells; C top-row margin6px |
| shark-island | 3 | B | 35px | Blue waist sash adapted to shoulder cloth |
| smoke-robot | 3 | None | 7(C)px | C best visually; upper row lower margin7px, B wrong cell centers |
| stage-ghost | 3 | B | 32px | Ventriloquist puppet face omitted to avoid extra faces |

## Common audit

Exactly8 human faces/order and correct4×2 visual arrangement checked for every successful output. Equal-cell pixel boundary measurements expose center-drift failures even when visual arrangement looks4×2. Margins measured from alpha>32 in each equal cell, [left,top,right,bottom], not guarantee of entirely empty low-alpha gutters. All files retained unchanged; no automatic speck cleanup. No text/frames/background scenes/shisha. Canon clothing/role cues reviewed. Individual QA.md records omissions/tradeoffs. Lower small props sometimes adapted to bust format; approval and cutout256px QA still required.

## Blocked action

fading-familiar B image_gen rejected during OUTPUT moderation, categoryother; request ID137e8c44-7c1f-469c-b246-07080a06edce. No image produced, no bypass retry. Prompt retained as prompt-b-denied.txt. C not attempted. A exists but has crop-margin problems. This scenario remains incomplete.

## Verification

SHA-256 of all31 PNGs re-read from disk and verified against each generation.json (no mismatches). All source files copied from generated_images preserving originals. No repository, scenario JSON, installation, PR or adopted manifest changed. No full clone, external upload or user-device data transfer performed. See per-scenario prompt files, generation.json and QA.md.
