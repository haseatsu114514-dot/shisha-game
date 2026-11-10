# Phone landscape map and craft layout — 2026-11-10

## Scope and evidence

Reproduced on `origin/main` at `819c3d2ee`; updated onto `origin/main` at `e5fbb838a`, branch `codex/phone-layout-1110`. Chromium/Playwright emulated landscape touch viewports at CSS 852×393 and 932×430, plus 852×340 and 932×377 for Safari chrome reducing visible height. Phone map and craft cases also emulated 59px left/right and 21px bottom safe insets. Desktop was checked at 1280×720. The 1280×720 stage and blurred side backdrop remain unchanged.

Owner photographs: [map](evidence-1-map.jpg), [steam](evidence-2-steaming.jpg), [heat](evidence-3-charcoal.jpg), [packing](evidence-4-packing.jpg). Reproduction was run on current main before changes; the screenshot links below show the fixed version at the tightest 852×340 case. These are browser renderings, not a physical iPhone Safari capture.

| Screen | Reproduced issue and cause | Fixed evidence |
| --- | --- | --- |
| Map | Quest card covered the GUIDE line; guided `!` was partly under the HUD. Both were independently positioned inside the scaled stage. Reserve a separate row above GUIDE and place the badge below the HUD edge. | [map, 852×340](phone-layout-1110-iphone-852-bar-map.png), [map, 932×377](phone-layout-1110-iphone-932-bar-map.png) |
| Setup | Additional finding: the long equipment preview pushed the choices below the panel at reduced height. Bound preview height and make its text scroll, leaving the actions visible. | [setup](phone-layout-1110-iphone-852-bar-setup.png) |
| Packing | Audience name broke mid-word and its text clipped; vertical choice list overflowed, the confirm button covered a choice and the bowl. Phone density increased text and target sizes inside fixed columns and a sticky footer. Widen the shared audience column, keep the name whole, scroll the note, and use a three-column choice grid with a separate footer cell. | [packing, 852×340](phone-layout-1110-iphone-852-bar-pack.png), [packing, 932×377](phone-layout-1110-iphone-932-bar-pack.png) |
| Mixing | Additional finding: the absolute `?` covered the first `+` button. Put the help control in the gap beside the vessel preview. | [mixing](phone-layout-1110-iphone-852-bar-mix.png) |
| Charcoal | `?` sat over the carrier's upper edge. Move the carrier below the shared help control. | [charcoal](phone-layout-1110-iphone-852-bar-heat.png) |
| Steam timer | `?` and thermometer covered the portrait, while forecast and instruction were cramped. Put help and thermometer within the right panel; retain the timer and forecast within panel bounds. Enlarge the transparent timer button hit regions to at least 38 CSS px. | [steam](phone-layout-1110-iphone-852-bar-steam.png) |
| Placement, water, holes, draw | Checked for other overlap or clipping. Placement actions fit; water and hole preview screens showed no additional collisions at 852×340, nor did the draw step in the existing touch layout test. | [placement](phone-layout-1110-iphone-852-bar-place.png), [water](extra-852-bar-water.png), [holes](extra-852-bar-holes.png), [draw](pull-touch.png) |
| Desktop | Phone-specific selectors do not apply at 1280×720. | [map](phone-layout-1110-desktop-map.png), [packing](phone-layout-1110-desktop-pack.png) |

The code changes are in one phone layout stylesheet loaded after the existing density and craft styles. The stage fit math, dialogue, scenario, balance, and image assets were not changed. One PR covers map and craft because the common trigger is phone density within the fixed stage.

## Verification

- `phone_layout_1110.mjs`: all 12 map/craft/options cases passed, including 852×340, 932×377, safe area, and desktop. Geometry assertions check card/guide separation, panel containment, text fit, help/control separation, and 38px tap targets.
- Existing `craft_layout_703.mjs` `layout-touch`, `craft_materials.mjs` `touch-packing` and `touch-foil`: passed.
- Existing `phone_density.mjs`: 18/18 passed on the updated main, including `desktop-unchanged` after #3107 merged.
- Existing `conversation_ui.mjs`: `money-choice-reason` and `choice-modal-log-keyboard` passed. `paper-safe-area-and-work-costume` timed out waiting for `.portrait.active`; `desktop` and `landscape` timed out at line 321. The same three failures occurred with this new CSS emptied, confirming they are outside this change. `keyboard-controls` passed in the CSS-disabled run but failed once in the full CSS-enabled run at line 251; it passed on an isolated retry with the CSS enabled. No conversation CSS or logic was edited.
- `git diff --check` and browser test syntax/CI suite JSON checked.

No production deployment or physical-device test was performed. The linked captures and automated geometry checks cover the specified Safari-like visible areas; owner verification on the published build remains the final device check.
