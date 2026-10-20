# PR757 isolated production-module QA

Exact head: `aeff796097f10d92df932d1bccd3f440910303ed`.
Production `holes.js` served from the parent-prepared exact-head overlay; its Git blob `f0168cef799879ebf79aaeda1b7e2cbc1d647537` matches the final local source. Remaining production dependencies/data/CSS/art use the parent-prepared pinned df3 snapshot. No product source changes were made.

## Execution and evidence

`index.html` + `app.mjs` import real production data/state/UI/session/holes modules without the chapter/main entrypoint. The harness starts a fresh drill session and opens only the holes bench. Production autoSkill is null. The template is selected by actual CDP pointer input in the real UI: 外周12穴＋中周12穴, outer12/middle12/inner0. No target, timer, completion, score, or hole state is assigned by the harness. `nearNext` observes rendered cursor/marker geometry and schedules actual input near alignment; this is automated input QA, not a human skill assessment.

- `run.mjs` / `results.json`: PC1920×1080 and emulated coarse phone844×390. Actual 35-second wall-clock wait after starting; no virtual time. The zero-time instruction stays actionable on an unfinished ring. 24 real CDP Space presses complete 12 outer + 12 middle holes, and the recorded score has timeRatio0 in both cases.
- `pointer.mjs` / `pointer-input/results.json`: the same two viewports, no zero-time wait. PC mouse pointerdown and emulated phone touchStart/touchEnd actually punch all24 targets; each ends with24perfect/no missed targets. This additionally checks the pointer/touch input route. This is synthetic Chrome touch, not a physical phone.
- Both runs: ring completion disables punching and enables next ring; two rapid next clicks cannot skip the unfinished second ring. All24 completion disables punch/next and enables “穴あけを終えて結果へ”; extra Space presses add no holes. Two finish clicks show one result card and leave the run promise unresolved. “確認して次の工程へ” resolves once. Supplemental run sends three rapid result-button clicks and records exactly one resolution.
- Tab reaches both completion and result buttons with computed2px focus outline. Screenshots show both labels wrapping inside their buttons in PC and844 layouts. The existing scaled844 layout remains small; this check does not establish a general14px/44px mobile usability standard or change that layout.
- Actual foil, worker, shop art and ZenKakuGothicNew Medium/Bold/Black fonts return200. Suien Gothic faces are loaded. Craft Mincho is declared but unused/unloaded in these states. Empty-src dormant image elements are not treated as missing rendered assets. Saved PC/844 time0, ring-next, all-complete and result screenshots were visually inspected.

## Network and limits

Initial localhost50304 run completed before the parent server migration. Supplemental run used localhost58562, `--no-proxy-server`, background networking disabled and DNS deny. Both page sessions intercept requests and allow only their localhost origin or internal data/blob URLs. No external renderer requests were observed; browser-wide wire traffic was not measured. Only non200 responses were `/favicon.ico`404; no missing gameplay asset/JSON/font request. No fetch/install/CI/chapter playthrough/public-site QA was performed by this worker.

These are real production holes-module, DOM/font/art and CDP input checks in an isolated bench, not a chapter/full-game playthrough, physical-device test, save-resume test, or deployed-main verification. Existing VM fixtures remain separate evidence. First harness attempt omitted the real template Start click, failed before gameplay assertion, and was corrected; it was not a product failure.

Final evidence: `summary.json`, both full results JSON, reproducible harnesses, and16PNG screenshots under this folder and `pointer-input/`. No new merge blocker observed within this scope. Draft/CI/release policy remains the parent's responsibility.
