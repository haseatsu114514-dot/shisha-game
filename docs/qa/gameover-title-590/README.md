# GAME OVER title centering (#590, B only)

Production change: only `left: 0` and `right: auto` in the neon timed-out
`.go-title` rule. Normal CONTINUE and portrait framing remain unchanged.
The adopted C close-up and all other #590 work are outside this PR.

Worker: `codex-b590-logo-20261015-7e3a92` (official Codex CLI 0.162.1;
`CODEX_HOME=/Users/hasegawaatsuki/.codex-plus-b`). Fresh recovery checkout,
base main `9ae125e4285a376f20200ab8276e3f1893dfaf81`.
Claim [38817417065](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38817417065)
and fresh status [38822545759](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38822545759)
completed successfully. Status request `71d62415-85dc-494b-af3b-4c19eb6fd081`
validated issue 590, this owner and claim run 38817417065.

## Reproduce

Use the existing pinned Playwright dependency (`npm ci` in
`remake/test/browser`) and the preview server on port 8123.

```sh
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
ARTIFACT_DIR=docs/qa/gameover-title-590/fixed \
node remake/test/browser/gameover_title_center.mjs
```

The test mounts actual `buildGameOver`, advances its real 20-second deadline
using Playwright's clock, and verifies phase=gameover. It finishes the logo's
CSS entry animations only for stable box measurement; no timeout DOM or game
callback is fabricated. Each case then verifies the existing title callback
fires once, with the save sentinel unchanged. External BGMer is blocked and
sound muted, so this is visual/layout QA, not an audible listening test.

## Results

| Viewport | Baseline center X (normal) | Fixed center X/Y (all 3 modes) |
| --- | --- | --- |
| 1280×720 | 698.002594 | 640 / 360 |
| 1920×1080 | 698.000692 | 640 / 360 |
| 844×390 | 698.000795 | 640 / 360 |
| 667×375 | 698.002660 | 640 / 360 |

Coordinates are in the 1280×720 stage. See the full precision in
`baseline/metrics.json` and `fixed/metrics.json`. All 12 fixed cases
(normal, 40 caption clicks, OS reduced motion × 4 sizes) passed the 1px
center tolerance, 760×220 box, hidden faces/captions/count/choices,
single title exit and save invariance. Browser errors and failed local art
requests: 0. Maximum fixed X error is below 0.001 stage px.

Before the CSS edit, the regression failed as expected:
`normal 1280: centerX=698.0025939941406, expected 640 ±1 stage px`.
All 12 baseline timeouts had the same approximately +58px offset.
Baseline images/metrics were collected before measurement was refined to
finish entry animations (hence tiny nonzero baseline Y/size animation offsets).
During test development, assertions were corrected for CSS animation timing,
the imported stylesheet and Chrome's identity-matrix serialization; production
CSS remained the same two-line fix.

Normal title left=58/top=8/752×178, portrait top=112/height=608,
and image inline framing and dimensions matched all 12 baseline snapshots.
Only the ongoing portrait animation transform was excluded from exact snapshot
comparison (observed sampling difference <0.004px). See `comparison.json`.

Screenshots were visually reviewed for baseline 1280 GAME OVER, baseline
844 CONTINUE, fixed GAME OVER at all four sizes (667 in reduced mode).
They show the standalone logo centered with no residual face, caption or number.

Related local checks passed: `continue_neon.mjs`, `continue_readiness.mjs`
(pc/mobile/warm-premium), `continue_typing.mjs` (pc/touch),
`node --experimental-vm-modules remake/test/continue_audio.mjs`,
`node --check` for the new test, Git Safety, and `git diff --check`.
This CSS-only scope does not require the full gameplay suite.

No merge, issue closure or reservation release. Parent #590 still covers
rotation/background timing, retry stamina snapshots, audio/context, caption
revision and C portrait close-up, among other design work.
The quota helper was not run because it reads a user config file and this
task explicitly forbids reading account/config files; no quota was inferred.
