# Noor DSR11 / PR #2382 — BACKGROUND ONLY, REVIEW CANDIDATE

## Result
Generated the requested graphic background using built-in image_gen with the three exact, inspected source images specified in `docs/spec/desert_ride.md` §4. PR #2382 was rechecked before generation: head `0419c67b62bde82f264510f08c87f92625b44cd9`, no comments/holds or newer head. No integration, adoption or merge was performed.

Delivered raw: `raw/noor-graphic-background-REVIEW.png`, **1672×941 RGB opaque PNG**, unchanged from built-in output. This background is separate from the previously shared graphic PERSON candidate. The earlier person's QA caveats remain; this background does not upgrade that person's acceptance status.

## Exact reference validation (reference bytes NOT bundled)
The user supplied `noor-cutin-bg-refs-2382.zip`, 684660 bytes, SHA256 `65bcf28a4de934f48976887e3e10af6877645130fca6ca858a14fc230ef98d58`, Library `libfile_70aa702616c4819181962e1291529b55`, file `file_0000000045ec81f5abe93586c2a54465`, version0. Materialized via the supported Library flow and persisted identity metadata. ZIP size/hash matched; path traversal, total expansion and image decodability were checked. Each actual image also matched its GitHub LFS size/OID and was viewed before generation:

| Canonical path | Bytes | SHA256 |
|---|---:|---|
| `remake/img/ui/character_intros/graphic/bg_yoru.webp` | 150002 | `d55bfd65b32860e2a28228a7662df4c2c9b7c11f5136c533058c9462c647a017` |
| `remake/img/ui/character_intros/graphic/bg_maki.webp` | 371212 | `47bce3e362f24a4cc558227db3721cfe05bcfc04cfde77a346868a60ef03d1ca` |
| `remake/img/ui/character_intros/graphic/bg_da_silva.webp` | 161942 | `9254dbfe9759441b723c647d5f2d7c86acde6a12dc7c754e14723ea25ba86dcd` |

All three are RGB 1672×941. They are style references only. Their bytes are kept private and excluded from this external deliverable.

## Visual QA (background only)
- Geometric orange dune layers, sun disc at low dune horizon, small navy 4×4 silhouette on crest and diagonal sandboard track cluster in upper right.
- Strong navy-purple/orange graphic-poster print composition, sharp curves and edges, limited palette, halftone marks. This is not the painterly VN landscape style.
- Left third remains dark/quiet for a portrait; bottom third remains dark/quiet for quote overlays. Some restrained tone-on-tone diagonal print marks remain at bottom edges, like the actual style references.
- No people, visible faces, text, letters, logos or watermarks. No religious motifs or smoking equipment.
- First output added a loose board and unrelated ribbon-like mark and was too busy in lower right. A targeted image_gen edit removed the board/ribbon and shifted the bright track upward. Only the corrected candidate is bundled; prompts of both calls are preserved.
- Some slight generated color variation remains within print planes; it is not asserted to be a mathematically exact vector/hex palette. Final compositing with live text and portrait has not been run here.

## Next integration step
Pass the candidate to the authorized Claude task for selection and preservation under asset_sources. Existing `intro_graphic_import.py noor <background> --background` normalizes the graphic background; make the classic fallback crop at1536×1024 as current spec says. This workspace is not a Git checkout; runtime files, manifest, `PORTRAITS`, `heads.json` and tests were not edited/run. Do not silently apply the still-unapproved previous person candidate.

This package contains one new background image plus prompts/QA/manifest only. No reference-image bytes or previous person-image bytes are included.
