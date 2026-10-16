# Issue #596: polyhedral spare gear and tabletop depth

Baseline: `1ec3dddba5fd0524f544e6999e84f029a6bcde87` (merged #600). `baseline-1280.png` was captured from the current source before editing. Runtime/test source: `af63e0d9bcb59486f088bb13707d5ed2603f6dba`. Later documentation-only commits do not change that source.

The actual check still uses exactly two square DOM d6, nine pip positions per die, accessible values 1–6 and model-consistent results. Resin bevels, blank edges and contact shadows use CSS. Static spare polyhedral dice and a pouch sit at the outer right edge; they have no numbers, live outcomes, animation, input or accessibility content. They hide at ≤1200px width or ≤600px height. The existing level text/actions, viewport compensation, 9-slice frame, scrollable body, ancestor clipping fixes and deterministic resize readiness remain.

`measurements.json` records 60 states: both stories, four viewports (1280×720, 800×600, 390×844, 844×390), details, canonical helper toggles/used/unavailable states, roll/result/reroll, three grades, reduced motion and missing decoration fallback. The test checks full frame/title/actions against every clipping ancestor, all original five hit points, scrollable body controls and ≥43.9px touch height. New checks compare real pips/aria/model dice and reroll index, require exactly two active dice, blank edge content, empty noninteractive aria-hidden spare gear, viewport bounds and no overlap with live controls. Four decorative images must decode, and a separate case aborts all four while continuing the story.

The added reduced-motion case initially exposed incidental hover oscillation when a previous click remained on a newly moved result button edge. Moving the pointer to the viewport corner before measurements removes this test interaction; no hit, clipping, size or readiness assertion was weakened. `trpg_layout.mjs` and `trpg_resize.mjs` are unchanged. Resize regression retains delayed-handler negative/positive and persistent-obstruction controls for both stories/details states.

Visual review: the attached actual Chromium screenshots show the peripheral gear distinct from active d6, coherent teal/brass/wood material, level readable controls, unobscured helper/details, and complete frame. Props hide on the three constrained sizes. Native source/prompt/hash/alpha/conversion details: `asset_sources/trpg-polyhedral-issue596/`. No scene/portrait/exploration art or model/save/data/RNG code changed.

Validation commands (BASE_URL points to the dedicated current-source server; ARTIFACT_DIR points to QA output):

- `node --test remake/test/trpg.mjs remake/test/trpg_feedback.mjs remake/test/trpg_campaign.mjs` — 30 passed.
- `node --experimental-vm-modules remake/test/trpg_campaign_save.mjs` — migration and 43 malformed save fixtures passed.
- `python3 tools/lint_dialogue.py trpg_` — 3 files, no errors/warnings.
- `node remake/test/browser/trpg.mjs` and `node remake/test/browser/trpg_experience.mjs` — passed.
- `node remake/test/browser/trpg_resize.mjs` — passed.
- `node remake/test/browser/trpg_tabletop.mjs` — 60 states passed.
- `node remake/test/browser/trpg_main.mjs` — 12 cases passed; initial `club-recruit-touch` failed before game startup because the simple HTTP server reset a module request. The focused retry passed using the repository preview server; no game code or test conditions changed.

Physical Safari, physical phone and actual VoiceOver speech are untested. Touch, keyboard/focus/status and reduced motion were exercised in Chromium. This is a Draft PR; no merge or Issue closure.

Static export: `python3 tools/export_trpg_preview.py --commit af63e0d9bcb59486f088bb13707d5ed2603f6dba --output <export-dir>` produced 52 files. Served only that directory on a separate port; the complete 60-state tabletop suite passed, including decode of the new spare-kit WebP. Every SOURCE.json hash matches the exported file and immutable Git blob. Four representative exported PNGs were inspected. Exporter unchanged. `validation.json` records tested/export source and limitations; the PR links current CI.
