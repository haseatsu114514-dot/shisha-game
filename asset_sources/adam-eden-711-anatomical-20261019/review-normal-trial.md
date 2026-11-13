# Adam normal trial 01: independent visual review (#711)

Review date: 2026-10-19 UTC

**Status: REJECTED / NOT ADOPTED.** The trial demonstrates the correct hair-color order, but changes visible features outside the hair and does not satisfy the requested preservation. Keep the adopted production portrait in place.

## Inputs and intended correction

- Adopted source: `assets/sprites/characters/adam/chr_adam_normal.png`, 896 × 1200, RGBA.
- Generated candidate: [trials/normal-01.png](trials/normal-01.png), 1084 × 1451, RGBA. Original generated filename: `exec-e08a04c6-7bb7-4c68-b2ef-54572d46550e.png`.
- Saved instruction: [prompts/normal-01.txt](prompts/normal-01.txt).
- Saved comparison: [qa/normal-01-comparison.png](qa/normal-01-comparison.png), with normalization/crop metadata in [qa/normal-01-comparison.json](qa/normal-01-comparison.json). Resizing was for comparison only.

The latest owner instruction fixes the colors to Adam's anatomical sides:

| Reference | Left | Right |
|---|---|---|
| Adam's own hair | Green apple green | Red apple red |
| Front-facing Adam on screen | Red | Green |
| Paired EDEN/intro apple motifs on screen | Red apple | Green apple |

The trial has the correct front-view color order. That success alone does not make it suitable for adoption. The requested operation must retain the original face, expression, hair silhouette, body, outfit, pose, texture, framing, and transparency. No whole-image flip is permitted. Profiles must be judged by anatomical side, not by dividing the screen into two halves.

## Visual findings

1. **Fabric texture changes substantially.** The source's fine diagonal/crosshatch texture across the shirt and apron is largely replaced by smoother shading. This is especially clear in the apron panel and pockets in the saved comparison. The black clothing remains recognizable, but its original rendering is not retained.
2. **Facial details are redrawn.** The mouth/lip contour, eye and brow lines, and nose/cheek shading differ subtly. The candidate remains recognizably Adam with a broadly neutral/serious expression, but does not preserve the exact original face and expression.
3. **Contours and small details change.** Hair tufts, outer clothing edges, folds, and shoe details differ. These changes extend beyond replacing the two hair colors.
4. **Canvas and framing change.** The generated file has a different resolution. Resizing or fitting it back to 896 × 1200 cannot recover the source's unchanged nonhair pixels or alpha plane.

## Transparency measurements

Bounding boxes below use inclusive left/top and exclusive right/bottom coordinates, measured directly from each original file's alpha channel.

| Measurement | Adopted source | Generated trial |
|---|---|---|
| Canvas | 896 × 1200 | 1084 × 1451 |
| Alpha ≥ 1 bounding box | `[237, 122, 641, 1178]` | `[72, 45, 1046, 1417]` |
| Alpha ≥ 24 bounding box | `[240, 126, 631, 1169]` | `[290, 150, 769, 1414]` |
| Alpha ≥ 128 bounding box | `[241, 127, 631, 1168]` | `[290, 151, 768, 1414]` |
| Alpha = 255 bounding box | `[242, 130, 629, 1166]` | `[292, 154, 767, 1413]` |

Both files contain real RGBA transparency. In the trial, faint nonzero-alpha pixels extend far outside the figure's normal area. At alpha ≥ 24, accounting for the different canvas sizes, the trial's right boundary extends approximately 4.63 source-canvas pixels farther right, and its top begins approximately 1.95 pixels higher. Its alpha is therefore not an unchanged copy of the adopted source's alpha.

## Decision and proposed next method

Do not install this trial into `assets/sprites/characters/adam/` or generate a production face icon/WebP from it. Retain it as a rejected trial and an orientation reference.

The appropriate proposed method is a precise masked local recolor of the adopted source: preserve its canvas and alpha exactly; select only the red/green hair regions; change color while preserving strands, luminance, shadows, and highlights; and require byte-identical pixels outside the mask. The same principle applies to narrowly selected apple/motif regions in other affected assets.

**This method remains pending explicit user permission.** The built-in image-editing instruction requires use of the image-generation tool for image edits unless the user explicitly requests another method. The attempted imagegen edit did not meet the preservation requirement. This review records the reason for requesting that method exception; it does not treat the exception as already granted or perform any local recoloring.

## Independent review of the four instruction diffs

Compared the candidate text files with the existing read-only cached checkout. The earlier main comparison established that these four baseline files were unchanged between cached commit `5b2b7818ff2596239ca5dd6dbf1e2a2a82af92fb` and main `8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d`.

| File | Scope and interpretation |
|---|---|
| `data/characters.json` | Only Adam's two `visual_concepts` strings change. The apple/anise props and grand bowl-preparation scenario remain, followed by explicit anatomical left green/right red and front-view screen left red/right green. The second concept states the paired EDEN/intro motif order and preservation constraints. No character identity, voice, statistics, scale, intro face, or other character changes. |
| `brand/character_profiles.md` | Two Adam-specific additions distinguish anatomical sides from screen sides, cover profiles/turns, specify the EDEN pair, and preserve already-correct images and unrelated features. Consistent with the latest correction. |
| `docs/prompts/asset_gen_prompts.md` | Adds a current instruction section with the same three-way mapping, a correction-only scope, no whole-image flip, and explicit precedence over old screen-left-green instructions. Historical production notes are retained. |
| `tools/make_reference_sheet.py` | Changes only Adam's first descriptive point to name anatomical versus screen sides. No rendering or generation logic changes. |

**Text review: PASS for the anatomical correction and intended scope.** The existing first visual-concept scene has been retained. For future new compositions, interpret the appended pose/composition preservation clauses as constraints on correcting adopted art, not as instructions to replace the retained bowl-preparation scene with a neutral standing portrait.

Read-only checks performed during this review:

- Parsed both character JSON files: 40 characters before and after; only `adam.visual_concepts` differs.
- Parsed both Python files into ASTs. After accounting for the one changed description string, the ASTs are identical.
- Inspected all four text diffs and the saved visual comparison.

## Smallest relevant local lint checks

Existing repository checks relevant to this text/data change are:

- `python3 tools/check_active_json.py` — active JSON syntax, including `data/characters.json`.
- `python3 tools/check_char_consistency.py` — character data/profile consistency. It checks existing name/age relationships, not hair-side semantics.
- `python3 tools/check_legacy_terms.py` — existing names/settings scan across data, brand, docs, and tools, if running in a complete current repository view. Do not use `--fix` for this review.

The changed reference-sheet script requires only a read-only `ast.parse` syntax check for this one-string edit; that check has already passed. The manual mapping review supplies the spatial/color verification that the existing lints do not implement.

In the sparse API overlay, these existing validators derive paths from their own `__file__`; changing the shell working directory alone would still validate the old checkout. Use the current overlay as the validators' root, or explicitly point a loaded `check_char_consistency` module's `CHARS_FILE` and `PROFILES_FILE` to the candidate files. A direct JSON parse of the candidate is the meaningful minimal syntax check without fetching additional data.

The existing `lint-dialogue.yml` gate also runs `tools/lint_dialogue.py`, `tools/check_story_canon.py`, `tools/check_dialogue_links.py`, and `tools/test_story_canon.py` when character data/profile files change. Those are normal PR-head integration gates; no dialogue, route, or browser behavior was edited here. No full game, browser suite, image regeneration, download, remote write, or general lint execution was performed in this review.
