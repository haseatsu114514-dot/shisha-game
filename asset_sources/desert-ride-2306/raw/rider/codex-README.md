# DESERT RIDE #2306 — Rider base-pose candidates, NOT ADOPTED
2026-11-02 06:40–06:46 UTC.
One new-outfit/master decision only: Hajime rider_ride A/B/C. Do NOT treat any candidate as the master. The other five rider poses remain ungenerated pending explicit selection.
Spec §4 at PR head e94c8d7b541381cf40e8626e4e5af01b34308948, blob4e327577544023497dd21055dda6560789ad0882.
No game changes, no manifest rebuild, no deployment, no adoption/merge.

## Reference and rule checks
Read docs/prompts/image_generation_guide.md and .claude/skills/character-portrait-remaster/SKILL.md at PR head.
Viewed all 15 adopted Minto-service/Ageha/Minto-private reference expressions, including their normal representatives at original display size.
Actually supplied in each image_gen call, in this order:
1. references/hajime-pr2306.png — CURRENT PERSON IDENTITY reference, fetched via GitHub fetch_file encoding=base64 at exact PR head, after utf8 returned UnicodeDecodeError. 402899 PNG bytes; blob c641dc297e7bf7c9c9df01ba4e117be79e92319b. SHA2566affe667e9cc665b53713c6a2319c1c91792e2e335e8408d9c941c364295e409 matches the local cached image exactly. No LFS pointer/bypass or settings change.
2. references/minto-service-v2.png — adopted fine-texture/quality reference ONLY; SHA2567d6c479d63415486687b4d3f9c5e42c247daf21bf85f7210305381cb48feccb7, matches style-references.json normal entry.
3. references/ageha-v1.png — adopted fine-texture/quality reference ONLY; SHA256ff52ea525e217ef63863db4739fc703ff8cee9ba1f46b05036937ccc463e6675, matches style-references.json normal entry.
No graphic-poster source was used. No other character's costume/hair was transferred.
Spec explicitly requests a plain white shirt and dark pants, replacing Hajime's cap/hoodie/necklace in identity reference. Prompts expressly remove those accessories.
Built-in image_gen only, transparency=true. Full per-candidate prompts in PROMPTS.json. Unmodified raw results saved; no Python painting/editing/keying/resizing.

## Visual QA
All 3 seen inline. Back view, black short hair, plain white shirt, dark slim pants, dark sneakers secured in bindings, entire bright orange board visible; head/arms/board not cropped. Face/eyes/mouth not shown. A/C show a narrow ear/neck edge, not a facial expression; owner should confirm that the slight head turn still satisfies back-only framing.
A relaxed balance stance and B compact stance; C gentle forward cruise. Neutral rather than jump or deep landing brace. Both feet attached to single board. No visible scenery/ground/cast shadow/text/logo.
Detail is clean anime cel shading with subtle texture, but smoother than the visibly pixel-dense adopted normal portraits; texture fidelity remains a style-review point, not declared perfect.
All 3 true RGBA1024x1536, exactly2x runtime512x768 aspect. Saved as RAW review art, no downsample/anchor normalization. Board-foot center differs between alternatives; adoption must measure each foot anchor rather than assume canvas center.
Inline previews expose gray/orange RGB glow in transparent regions; sample pixels outside subject confirmed alpha0 in all three, so no opaque backdrop was baked there. Very-low-alpha fringe/stray pixels still exist, as in references; full alpha bounds vs core>32 bounds recorded. Requires normal compositing/edge QA before production.
verification.json records actual dimensions, modes, byte sizes, SHA256 and alpha data for outputs and supplied references.

## Decision gates / remaining work
Choose A, B or C (or request correction) before using it to generate rider_lean_left, rider_lean_right, rider_jump, rider_brace, rider_fall. No candidate has been silently adopted.
Noor normal master candidates are next new-character decision, not yet generated here: follow the one-new-design-at-a-time rule. Noor smile/surprise require its explicitly selected normal reference; intro comes after portrait selection.
Dusk backdrops/VN dusk remain dependent on explicitly chosen daytime composition. Independent small props were already delivered in phase2.

