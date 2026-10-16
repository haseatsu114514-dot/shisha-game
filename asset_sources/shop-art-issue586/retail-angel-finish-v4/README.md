# HOLD — Heaven v4 candidates / Issue586 Draft PR587

Parent review2026-10-16 ~01:51UTC rejected v4 as the approved baseline: mint single-color brush became a yellow-green wave; mint leaves and grape fruit were enlarged/recomposed. User approved wing-position-only changes. C missed these invariant violations in its initial visual QA; that QA was not human approval. All v4 outputs are HELD, not selected/adopted. No further rollout or integration until corrected representatives/explicit updated steering.

## Saved work

11 actual built-in image_gen outputs: 10 Heaven flavor candidates plus one too-wide double-apple candidate. Native1254x1254 RGBA PNG bytes, original output paths, actual prompts/references and SHA256 are in manifest.json. All outputs decode, alpha0..255; low-alpha edge noise is counted without painting/cleanup. Original files remain immutable. All old21 PNG/WebPs, v2/v3 and HMD are preserved byte-for-byte. preservation-and-png-checks.json records the full check.

Heaven10 held: mint,double_apple,blueberry,strawberry,pineapple,lemon,orange,grape,watermelon,cinnamon. Each is originals/<id>.png. Four already running at HOLD (lemon,orange,watermelon,cinnamon) completed and were saved without cancellation. Dobaj6 (vanilla,coconut,mango,peach,melon,banana) and Absal2 (rose,lychee) NOT generated. Outside-shop46 HOLD. No new brands/products/data changes.

comparison-representatives.png: v3/v4 three representative comparison, prominently HOLD-labeled. comparison-heaven10-held.png: all10 held candidates. qa/thumbnails-and-front-marks.png:66/112/128px icons and rectified upper prints. build_qa.py only arranges/measures; source bytes are untouched. validation.json records approximate manually inspected front quadrilaterals, white-mask bounds and normalized shape IoU. Horizontal center .4971-.4986 and width .4343-.4371 for representatives; actual vertical position .1655-.166 DOES NOT meet .185 target. Shape IoU vs double-apple mint .99014/grape .95454; not pixel identity or acceptance. Shared template retains small contour/camera differences.

## Boundaries and next step

Runtime remains the old Draft botanical21 (including3 unapproved HMD mappings), because no new integration was performed. It is not ready to ship. Current-main3fa40d0b HMD baseline is text HMD; future authorized integration must restore that boundary by excluding candidate HMD from active mapping. Existing5 bowl/charcoal images unchanged. Game IDs/prices/effects/save formats unchanged. No gacha/#598/#437 code touched. No merge/publication/release.

Manufacturer identity evidence and precise official URLs: manufacturer-references.json. Dobaj/Absal designs are proposals only, not established game lore or real-brand aliases. Official Dozaj white carton and2019 Afzal UK colored carton pixels were inspected; equipment photo was excluded. External photos are research-only outside repo and not redistributed.

Original v3 fruit/bands/box/camera/alpha are the invariants for the next repair. Parent is checking explicit permission for code-based wing-only compositing; that exception has NOT been received or used. Built-in-only rule still applies. Await direct updated steering before image editing or more generator rollout. Same claim retained; #598 remains queued until milestone and formal transition.

## Ownership / verification

Worker codex-c-shop-art-20261016-8e7fb2cb0e; thread01a140d2-7791-7aa2-9b89-4ad03675a977; original claim38786636524. Fresh status38836193671 succeeded, wholeUUID13c5b120-1b62-4457-9354-5d86db9fd350 verified; exact log CLAIM_VALIDATED_ISSUE=586 OWNER=codex-c-shop-art-20261016-8e7fb2cb0e RUN=38786636524. Main3fa40d0b merged safely, relevant open-PR overlap check empty. Source-only PNG/alpha/hash/thumbnail/visual inspection performed. Game regressions not repeated with integration held; normal exact-head CI is separate evidence, never adoption approval. Quota helper has existing line45 SyntaxError, usage unknown; no explicit usage-limit error observed.
