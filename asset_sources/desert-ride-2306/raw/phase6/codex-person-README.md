# Noor DSR11 — graphic portrait REVIEW candidate; background blocked

## Latest authority
PR #2382, head `0419c67b62bde82f264510f08c87f92625b44cd9`, explicitly records owner's graphic-style selection. `docs/spec/desert_ride.md` §4 now requests two raw images: square magenta-background character and opaque 1672×941 background. No hold on this request was found. Related open PR search showed #2382 (request/portrait-face adoption) and unrelated comic refill #2383, not another cut-in producer. Parent knew no duplicate producer.

## Delivered
`raw/noor-graphic-portrait-REVIEW.png` is one built-in image_gen raw output, NOT ADOPTED and NOT INTEGRATED. Six attempts/corrections are recorded in `PROMPTS.json`; original outputs remain at their recorded generated_images paths. This external handoff includes only the latest candidate, prompts, and QA/description. Reference-image bytes and superseded images are intentionally excluded. References named below are provenance metadata, NOT bundled files. No repeated smile/surprise generation was done; #2382 had already received those.

## Reference provenance (image bytes NOT bundled)
- `samechan.png`, `ageha_v1.png`, `rin.png`: requested approved graphic style references, inspected at actual pixels.
- `noor_normal_A.png`: exact owner-selected original, SHA256 `2e72bc62ee718aced3dbb59de3cb1bcd968eeaa85fd3e9c6f8f2211b3aad3b53` matches adopted source. This is the source of runtime normal, NOT a claim that its bytes equal the runtime PNG. GitHub returns runtime's LFS pointer (expected runtime SHA256 `1374af232413652aaa6285982730e308ba47edf31305d89c3f3632b279b07266`, 626887 bytes), not readable image bytes. Parent authorized the source-equivalent reference for independent character work.

## Visual QA and reservations
- Raw is RGB **1254×1254**, although prompt requested 1024×1024. The normal importer crops/resizes to 1024×1024; no manual resize or keying was performed here.
- Opaque magenta background. Hair/sunglasses, board rounded ends, hands and fingers are contained; only lower torso/belt naturally intersects bottom crop. Skin is rendered as white planes with navy geometric shadows.
- Black tied-back hair, visible part/forehead opening and side wisps, head sunglasses, olive rolled-sleeve shirt, black inner/belt and beige scarf retained. No earrings or other invented accessories in delivered candidate.
- Plain orange sandboard rests behind shoulders, one hand grips it and the other thumb points backward. Friendly smiling mouth. Eyes, brows and eyelashes are hidden in a large connected face-plane shadow instead of a discrete eye-mask stripe.
- Earlier failed versions had added earrings, clipped board, overlong face-covering bangs or an eye-mask-looking stripe. These were not silently accepted; latest was corrected.
- Candidate still needs owner's/implementer's visual selection: the very large angular facial shadow and simplified front fringe should be compared with the original normal and style trio. Head/chin placement is not an exact match to the requested 3%/35% guide; measure `heads.json` and normalize via `intro_graphic_frames.py` after import. Some slight generated color variation remains in orange/ivory planes; do not claim exact uniform vector fills.
- Runtime cut-in, chromakey edges, size normalization, `heads.json`, scaled frame, both classic/graphic modes and intro tests were NOT run. No claim of ready-to-merge assets.

## Background: exact blocker
Required actual style references are `remake/img/ui/character_intros/graphic/bg_yoru.webp`, `bg_maki.webp`, `bg_da_silva.webp`. None was found in the current workspace or any existing ZIP. GitHub's normal `fetch_file` gives LFS pointer text; its general `fetch` explicitly does not support binary responses. No access denial was bypassed. No background was generated from imagined references. Please provide those three actual files (or an authorized existing checkout/Library transfer) to continue the second image.

## Integration handoff
This scratch directory is not a Git checkout. No push, GitHub source commit, manifest edit, `PORTRAITS` registration or main change was performed. If approved, preserve the raw under the authorized asset_sources path and use the existing `intro_graphic_import.py` character route, then measure head/frame. Background and classic fallback remain pending. Authoritative integration instructions are the latest PR #2382 specification, not this work-in-progress folder.
