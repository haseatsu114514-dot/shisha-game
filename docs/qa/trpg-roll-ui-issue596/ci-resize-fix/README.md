# CI resize synchronization repair — Issue 596 / Draft PR 600

Original source: `0b6921be9c28162903b2600ce58c75689b763ec7`. Runtime/static-export source remains `2b73b090b4cf145d455e3f0ff293d18f897a98eb`; this repair changes tests and CI only. Model/save/data/RNG/assets/preview/CSS are byte unchanged. Prior runtime/export evidence remains in `../review-fix/`.

[Linux CI failure](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38838876705/job/116774329875): Chromium 151.0.7922.34 / Playwright 1.62.1 build 1234. Parent transferred all 87 artifact files (44 top-level items), artifact 12021015473; metadata and exact failure excerpt retained here. Historical CI did not record hit owners, so its exact target cannot retrospectively be observed.

Observed deterministic reproduction: defer only preview's actual resize callbacks until after `setViewportSize` resolves. Run 1280×720 → 800×600 → 390×844 → 844×390, both scenarios, details closed/open. At the last viewport CSS immediately leaves the portrait-only rule in `trpg-stage.css:443` that hides the rotate hint during judgement. Before `preview.fit` runs, `--k` is still 0.3046875 and `#trpg-rotate.hidden=false`. All five points hit `DIV#trpg-rotate` (no class/role, pointer-events auto, inert false, visible, opacity 1, z-index 1000, transform none). Its ancestry is BODY.trpg-preview → HTML. Visual and layout viewports are already 844×390. No running animation or transition exists in the failing snapshot. First action rectangle is exactly CI's left 249.84918212890625, top 238.1846923828125, right 419.56011962890625, bottom 282.1834716796875. This exact geometry and all-five overlay reproduction establish the resize lifecycle race, rather than a modal animation hypothesis. After releasing the real callbacks, scale becomes 0.5416666666666666, hint hidden/display none and all five hits pass. Full snapshots include stage transform, ancestry, roles, CSS and animations.

Natural scheduling with CDP CPU throttling rate 6 did not fail in 96 snapshots (12 repetitions × 4 sizes × 2 scenarios); see `natural-summary.json`. This is not represented as a natural reproduction of the historical Linux event ordering. The callback gate is a deterministic scheduling regression and is confined to test code.

`settledPreview` waits on RAF for concrete outputs of preview.fit: visual/layout viewport agreement, mathematically expected --k and transformed stage width, correct rotate.hidden, and no displayed rotate hint while judgement is open. It never polls hit success or retries fit assertions. Persistent unrelated overlays still fail every hit. A broken rotate state times out and produces diagnostic files. No arbitrary sleep was added. The 150ms timeout in the negative control asserts that readiness stays pending while callbacks are deliberately held; callback release is explicit, never time driven.

All original full rectangle / every clipping ancestor checks, four 6px corner insets plus center, touch size checks and model invariance assertions remain. Failing probes now save point owners and ancestry in the same browser evaluation, JSON and screenshot before throwing; a catch additionally records complete layout state on timeout or any later failure.

Local commands (macOS arm64, Node v24.13.0, installed Playwright 1.62.1 / Chromium build 1234):

- `python3 -m http.server 8596 --bind 127.0.0.1` at canonical repo root.
- `BASE_URL=http://127.0.0.1:8596/remake/ node remake/test/browser/trpg_resize.mjs` — PASS; repeated twice using ARTIFACT_DIR in parent evidence, all PASS. Four scenario/details combinations each run; old behavior negative, settled positive and persistent overlay negative controls.
- `BASE_URL=http://127.0.0.1:8596/remake/ ARTIFACT_DIR=docs/qa/trpg-roll-ui-issue596/ci-resize-fix/tabletop node remake/test/browser/trpg_tabletop.mjs` — PASS 58 states, all five hits and full bounds preserved. Minimum control height 43.993469px (existing 0.1px float tolerance).
- `node --check` on all three changed/new test modules; `git diff --check` and GitSafety — PASS.
- Existing model/save/browser baseline suites were not redundantly repeated locally; runtime unchanged. New-head GitHub workflow runs its full existing suite plus the new resize regression. No old CI rerun was requested.

Before/after shark landscape screenshots visually inspected: old state is entirely covered by the rotate hint; settled state has complete frame/title/actions. No shader/WebGL runtime is involved in this DOM UI. Physical Safari/phone remains untested; Chromium touch emulation only. actionlint is unavailable locally; workflow edit adds only paths and a node command.

Worker `codex-b590-logo-20261015-7e3a92`, same reservation 38835056628. [Fresh status 38840191329](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38840191329) success, request `b596-ci-resize-20261016-a`, validated Issue596/owner/source claim. Draft retained; no merge, close, release or new claim.
