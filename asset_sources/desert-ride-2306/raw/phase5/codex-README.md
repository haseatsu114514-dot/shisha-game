# Noor DSR10 / PR #2366 — REVIEW CANDIDATES, NOT ADOPTED

## Result
- Generated one `smile` and one `surprise` with built-in image_gen, one expression per call. No runtime assets, manifest, character data or PR branch were changed.
- Source: PR #2366 head `f42ed45497bcd4eb72966d97f793fd53e7947b3c`, `docs/spec/desert_ride.md` §4, owner_requests DSR09/10. The PR explicitly records owner selection of normal **A**, not B/C. Its only comment at inspection was CI evidence (13:43 UTC). Related PR search found no expression-production PR; parent also knew no duplicate artist.
- Exact selected A was already cached locally: SHA-256 `2e72bc62ee718aced3dbb59de3cb1bcd968eeaa85fd3e9c6f8f2211b3aad3b53`, matching PR adoption.json. No image download or clone was needed.

## Inputs and prompts
- `references/noor_normal_A.png`: exact identity/outfit/pose/boots reference.
- `references/minto-service-v2.png`, `ageha-v1.png`: rendering quality references only; inspected as actual pixels before generating. Noor A's existing detailed anime rendering was kept, not redesigned to another character or to chunky pixels.
- `PROMPTS.json`: complete prompts, built-in tool mode and returned original output paths. Raw outputs are copied unchanged, original generated files retained.

## Visual QA
- Both are RGBA PNG 1024×1536. Visible figure exceeds 1300px (alpha>128 bounds: smile y15..1522; surprise y12..1523).
- Same tied black hair, head sunglasses, beige neck scarf, rolled khaki shirt and black inner top, belt, cargo trousers, dark lace-up hiking boots. Same hand-on-hip/relaxed lowered hand and same stable stance. No new jewelry, watch or backpack. Full hair, hands, shoes inside frame.
- Smile: both eyes naturally closed, open happy laughing mouth. Surprise: open brown eyes, raised brows, small rounded open mouth. Expressions are clearly distinguishable from adopted normal.
- This is generative face-only editing, not pixel-identical preservation of the rest: tiny cloth/boot contour details drift by a few pixels. It preserves design and stance, but implementer should compare all three at the common scale before adoption.
- Alpha 0..254. At threshold>8, bounds are smile (271,14)-(884,1524), surprise (271,11)-(888,1524); A is (271,12)-(881,1524). All have extremely faint low-alpha surrounding pixels. These are unchanged raw generation outputs, not manually keyed or filtered. Light-background compositing was not performed in this pass. No claim of a perfectly zeroed alpha exterior.
- A's previously documented 7.96-head proportion warning remains applicable; this task did not redesign the owner-selected normal to force the generic range.

## Cut-in not generated: exact format unresolved
DSR10 says '登場カットインの一枚絵', but does not specify whether it is the classic no-person poster background under `assets/ui/character_intros/noor.png` or a newly designed square graphic portrait. Current `intro-graphic.js` has a separate portrait/background pipeline and Noor is not registered. `tools/intro_graphic_import.py` expects a square character and 16:9 background, while DSR10's original request only names the classic PNG. No exact Noor-specific cut-in composition/style reference is supplied. Do not invent a finished UI or substitute a character render for a background; obtain this format decision before generating the cut-in.

## Save / handoff
The current scratch directory is not a Git checkout (`git rev-parse` fails); `.git` is empty read-only. GitHub is the repository source of truth. These are candidate raw files, not an integration or merge. Preserve through an authorized LFS-capable repository task under `asset_sources/desert-ride-2306/raw/phase5/` (or owner-approved equivalent) and reference them on PR #2366. Build runtime derivatives from originals with the existing portrait process only after adoption is authorized.
