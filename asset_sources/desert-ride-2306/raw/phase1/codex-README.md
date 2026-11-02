# DESERT RIDE #2306 — phase 1 candidates, NOT ADOPTED
Checked 2026-11-02 06:17–06:25 UTC.
Repository haseatsu114514-dot/shisha-game; PR #2306 head e94c8d7b541381cf40e8626e4e5af01b34308948.
Canonical specification blob 4e327577544023497dd21055dda6560789ad0882, captured as SPEC.md.
Default branch spec returned 404; read successfully at exact PR head. No restriction bypass was attempted.
PR search DESERT returned #2306 only; PR comments were empty; parent confirmed this worker alone owns #2306 (camel-race #2304 is separate).
Tool: built-in image_gen only. Generation prompts in PROMPTS*.json. Style reference in references/; SHA-256 in SHA256SUMS.
No repository edits, uploads to repository, deployment, manifest rebuild, asset replacement, adoption, or merge performed.
All PNGs are unmodified generator originals; no enlargement, cropping, keying or cleanup performed.

## Delivered
- backdrop_day A/B/C: daytime game distant-panorama concepts, 3 alternatives.
- bg_dubai_dunes_day A/B/C: daytime VN background concepts, 3 alternatives.
- sand_puff A/B/C: transparent pale sand-puff concepts, 3 alternatives.

## Visual QA
Every generated image was inspected inline at generation.
Backdrops: bright golden flat sand at lower third, quiet distant layered dunes, blue sky, no people/vehicles/buildings/text/logos/sun disc. Fine pixel-painter texture rather than photoreal/3D. A is quieter; B has larger middle-distance dune shoulders; C emphasizes distant haze. NONE meets exact 2560x720 dimensions: A 2048x768; B/C 1983x793. All are concept candidates, not production-ready panoramas. No unilateral upscale or distorted resize.
VN: fine warm pixel-painter dunes/wind ripples; generic sand-colored 4WD at left; open center foreground; no people/logos/lettering. C has the smallest vehicle and most open center; A/B crop the vehicle at left edge more strongly. Actual 1672x941, above runtime 1280x720 in both axes but below requested 2048x1152 generation guide; exact aspect differs slightly from 16:9. Can be fit/downsampled only after selection under the asset workflow. Not claimed as exact runtime assets.
Sand puffs: true RGBA, one cream-white connected mass each, no shadow/floor/text, A compact; B more upright wisps; C wider flatter. Actual 1254x1254, not requested 256x256. Transparent pixels and soft partial alpha verified in verification.json. Very-low-alpha stray pixels touch left/bottom bounds; core >8/255 alpha stays well inside canvas. Potential pale/yellow edge fringe in inline transparent preview: edges require compositing QA and cleanup before production adoption. No false claim of fully clean alpha or ready-to-use particles.

## Priority and dependencies
P1: Choose a daytime distant backdrop; resolve exact-size panorama before generating dusk as an edit. Choose VN day composition; then generate same-composition dusk edits from that explicitly selected day. No daylight candidate silently designated canonical; neither dusk set generated.
P2 independent untouched: large/small rock, flag pole and blank goal banner (3 candidates per concrete asset). Their original spec remains in SPEC.md.
P2 new-character/new-outfit master decisions: rider_ride base 3 alternatives using actual Hajime identity + adopted Mint/Ageha style references; Noor normal master 3 alternatives using prescribed new character design + adopted style references. These base masters are NOT generated in phase 1 and do not yet have an adoption decision. Do not describe them as finished or blocked by an already-existing selection.
P3 after explicit base selection: rider left/right/jump/brace/fall with the chosen rider reference; Noor smile/surprise with the chosen normal reference; Noor intro only after standing portrait selection. One character/expression per generation.

## Verification
verification.json records actual dimensions, mode, byte size, SHA-256, alpha extrema/bounds/counts for all 9 outputs.
The game was not modified or tested because this is art-only candidate generation.

