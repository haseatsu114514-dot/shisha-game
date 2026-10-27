# Pinned actual-module QA (read only)

Sources: parent-provided df3 snapshot, PR748 4195bc7 CSS overlay, PR759 c709f2a CSS overlay. Current-main integration is not tested: state/audio changed since the shared base. Production sources, claims, branches, settings and CI were not changed. No chapter flow, resumeGame, or main boot was executed. Real loadAll, VN engine, craft session/steps, text helpers, fonts and art were used. Isolated Chrome contexts and temporary profiles only; profile contents are not evidence/upload material.

Network: renderer Fetch interception only allows parent localhost. Final VN and craft recheck launches also disable proxy/domain reliability and map external DNS names to NOTFOUND. Browser-wide transferred bytes were not instrumented. No external retrieval was performed by this worker. Parent broker supplied all source/art. Initial failed logs are preserved in artifacts-vn/ and artifacts-vn-final/; artifacts-craft/ preserves three localhost bootstrap failures. The parent increased local server backlog5 to128; artifacts-craft-recheck/ reruns those three and necessary candidate phone geometry cases on port58562.

## VN PR748

Final fresh evidence: artifacts-vn-fresh/results.json, four cases base/748 × 1920x1080 desktop/844x390 coarse touch. Zero resource404, network loading failure, runtime error or blocked renderer external requests. All five bundled font faces loaded. DOM images decoded; explicit background1920x1080 and lounge button texture960x175 Image.decode succeeded. Normal advance, AUTO, exclusive SKIP, choice callback, real saveToSlot/loadFromSlot and same isolated scene reopen passed in all four. Save/load is not per-line VN resume or chapter LOAD coverage.

Strict Ctrl-held→AUTO assertion remains FAIL in both desktop cases and PASS in both touch cases. Desktop capture shows keydown Ctrl then pointerdown/mousedown/contextmenu/pointerup/mouseup on AUTO; no click reaches its production handler. vnDone=false and dialogue/choices remain. This is native macOS Ctrl+mouse contextmenu, not an end-of-scene reset and not introduced by748. It does not establish the cause of the separately reported Linux/732 failure. Assertions were not weakened.

Initial box/control geometry moves +3physical px on1920x1080 (stage k1.5), +1.08333physical px on844x390 (k0.5416667), matching the2design-px translate. Dimensions and x positions unchanged; choice layer position unchanged. Actual screenshot748-vn-landscape.webp was directly inspected and shows real character/background/dialogue/window/buttons. Full game/device playthrough and true line resume untested.

## Craft PR759

artifacts-craft/:20 cases,17 PASS and3 bootstrap local connection failures. All three failed cases rechecked PASS in artifacts-craft-recheck/. All four actual step functions complete with native inputs: setup options, mix +9/+3 and confirm, pack all three choices and confirm, placement triangle. Tutorial and non-tutorial rehearsal preview variants are distinguished. No synthetic chapter or full craft sequence was run.

Candidate phone geometry recheck: setup/pack/place audience face/heading/note within parent, modified body14physical px, worker footer region above audience, pack three choices+confirm initially within viewport pass. Production intentionally hides ordinary worker caption/name text; footer rectangle containment is not proof of visible name text. Actual pack after screenshot was directly inspected: real face, name, explanation, three choices and confirm visible. Caption touch gesture reaches scroll36. Mix list/side native synthetic touch gestures move; not a physical phone test. Existing untouched mix audience/guide small text remains outside this PR boundary.

PC actual screenshots mix tutorial/rehearsal and pack decoded pixel comparisons are identical before/after. Phone mix outer bench-right, temperature preview/legend/ideal/optimal common geometry fields match base, both hidden and visible preview states.

NEW FAILURE: candidate phone mix tutorial AND rehearsal each have four +/- controls height29.25physical px (width44.095), failing target>=44. Footer44.095 passes. Production DOM has caption p + two flavor rows. Existing craft.css213-216 nth-child(3)/not nth-child(4) special rule therefore applies and outranks new phone overrides for row grid/fr-name grid-area and button height54design px. This also yields narrow wrapping in actual screenshot. The static fixture lacked this exact caption/row interaction. No production fix made during read-only QA; parent notified for scoped repair. Do not describe759 as fully passing.

Not covered: physical device, DS, portrait, full chapter/game flow, latest-main state/audio integration, remaining craft steps, current-main release/deployment. Existing static41 PASS is separate and does not supersede these actual-DOM failures.
