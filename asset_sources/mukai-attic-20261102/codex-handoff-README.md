# mukai attic candidates — 2026-11-02

Authority: https://github.com/haseatsu114514-dot/shisha-game/issues/2222#issuecomment-6568398616

Three new candidates generated with the built-in image_gen tool, one call per candidate, all referencing the actual current bg_mukai_shop.png. This package is candidates ONLY; no production asset, ATTIC_BG constant or manifest has been changed. No PR or repository commit created.

## Reference proof

reference/bg_mukai_shop.png is 1280×720 RGB PNG, 1,265,123 bytes. SHA256 998401f6510d9ef9937b9710b1df1d49507e95e91f7331cbcfb6c1af1afeb4fc matches the current main LFS pointer fetched through the connected GitHub app (blob 9127a2b2dbb17878b21c5051ed86e012e70df483). Actual pixels retrieved via single bounded public media URL in the cloud environment and inspected before generation. Observed features: muted blue-gray plaster, black metal fixtures, aged dark wood, amber lighting, small Tokyo neighborhood/overhead wires. No full clone or desktop transfer.

## Prompt provenance

Complete unabridged prompts are in prompts/A.txt, prompts/B.txt and prompts/C.txt. Input image was the above reference for all calls. transparent_background=false. No CLI, API keys, quota switching or external AI service used.

## Visual QA

All three outputs viewed at generation: no people, no cats, no shisha/hookah devices, no text, logos or watermarks visible. All show sloped exposed wood roof, one window, Tokyo roofs and overhead railway wires, tatami, futon with folded blanket, mug on crate, blank cartons, floor stair opening. Daytime golden afternoon light. Same muted blue-gray walls and aged dark timber visibly relate to reference.

- A: warm wide composition, good reference continuity. EXTRA PROPS: small potted plant, shelving and a case at right were not requested. Lower fidelity than B/C.
- B: compact sleeping place, blank cartons, single crate mug, folded blanket, descending stair opening. Strong sparse interpretation. Stair opening reads as steep stairs rather than literal ladder; user description says ladder-like, not mandatory ladder.
- C: clearest low roof and compact corner, especially spare and faithful required objects; recommended visual candidate. Rail stair opening leads down at right, small window exposes rooftops/wires. No extra decoration noticed.

## Exact-size blocker

All calls explicitly requested 1280×720, but the built-in generator emitted 1672×941 RGB PNGs. They are named *-raw.png to avoid claiming required production dimensions. No Python/image utility resizing performed because current tool policy requires image_gen for image editing unless explicitly requested otherwise. Before production acceptance, exact 1280×720 normalization is still required through an authorized image-editing route. Do not claim these are ready-to-drop-in assets.

## Handoff

User choice should determine candidate. Final production destination requested by authority: assets/backgrounds/bg_mukai_attic.png, 1280×720. Separate repository owner may set ATTIC_BG in remake/js/chapters/ch5-tokyo.js to bg_mukai_attic and run python3 remake/tools/build_manifest.py after approved candidate/size handling. Day/night should share art with existing nighttime darkening, not separate art. No current production integration performed here.
