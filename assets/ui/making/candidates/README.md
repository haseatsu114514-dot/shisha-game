# Remaining making-asset candidates

Generated with the built-in image generation workflow on 2026-07-05.
These files are selection candidates and are intentionally not wired into the game yet.

| Runtime asset | Variant 1 | Variant 2 |
|---|---|---|
| `hookah_tray.png` | `hookah_tray_v1.png` — polished, rounded rim | `hookah_tray_v2.png` — aged, stepped rim |
| `hookah_stem.png` | `hookah_stem_v1.png` — minimal polished stem | `hookah_stem_v2.png` — patinated geometric collars |
| `hookah_base.png` | `hookah_base_v1.png` — tall pear silhouette | `hookah_base_v2.png` — low faceted bell silhouette |
| `hose_line.png` | `hose_line_v1.png` — ribbed U curve | `hose_line_v2.png` — braided asymmetric curve |

## Prompt set

Common prompt: isolated 2D pixel-painted game UI component matching the dark anime visual-novel workbench assets; visible fine pixel texture; black/deep-purple shadows with warm amber-gold highlights; clean readable silhouette; no text, logo, UI, numbers, watermark, shadow, reflection, or extra objects; flat `#00ff00` chroma-key background.

Variant-specific subjects:

- Tray 1: slim polished brass circular tray, nearly side-on, shallow horizontal ellipse and thin raised rim.
- Tray 2: aged brass circular tray, nearly side-on, restrained hammered texture and stepped narrow rim.
- Stem 1: very slender straight polished brass tube with simple connector collars.
- Stem 2: very slender aged-brass tube with restrained geometric collar joints and dark patina.
- Base 1: empty translucent pear-shaped violet-gray glass base with a narrow neck and amber rim highlights.
- Base 2: empty translucent low bell-shaped faceted violet glass base with a short neck and amber rim highlights.
- Hose 1: deep-violet ribbed hose in a broad relaxed U curve with simple connector cuffs.
- Hose 2: charcoal-purple braided hose in an asymmetric sweep with restrained amber thread highlights.

The generated sources were chroma-keyed locally, resized to the contract dimensions in `docs/asset_gen_prompts.md`, and the glass variants received a partial-alpha pass so the code-rendered water and bubbles can remain visible underneath.
