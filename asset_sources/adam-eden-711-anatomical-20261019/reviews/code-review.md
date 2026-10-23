# Issue 711 — independent browser QA / CI code review

**Disposition: no unresolved blocking findings in the reviewed revision; ready for execution in CI.** One definite runtime mismatch was identified, reported, fixed by the author/root, and independently rechecked. This is a read-only static review, not a browser execution result.

## Reviewed scope

- Test: `/workspace/scratch/588761470c34/issue711-work/remake/test/browser/adam_eden_711.mjs`
- Workflow: `/workspace/scratch/588761470c34/issue711-work/.github/workflows/remake-browser.yml`
- Runtime reference: `/workspace/scratch/b8e2d0757151/shisha-game`, with current-main changes read from `/workspace/scratch/588761470c34/issue711-preview/overlay` (15 files).
- Reviewer did not author or modify the QA test, workflow, production code, or adopted assets. No network access, browser installation, or local browser execution was used.

## Resolved finding

**P1 — background checks read the container instead of the displayed layer.** The original `background(page, '#bg')` helper inspected the CSS background on `#bg`. Runtime `remake/js/core/ui.js`, `setBg()` (lines 125–165), puts the image on a newly appended `.bg-img` child. Consequently both `map-and-entry` and `eden-visit` would fail before collecting their background evidence.

The applied helper at test lines 71–104 now selects the last `.bg-img.show`, fails if `#bg` has no displayed child, and decodes its actual source. Its direct CSS branch also remains valid for `.vn-cg.show` (`remake/js/vn/engine.js`, `showCg()`, lines 486–504). Its SVG branch follows the first base image plus all nested prop images and creates HTML Images for decoding, consistent with `remake/js/core/scene-art.js`, `renderSceneArt()` (lines 75–120). Missing hrefs, failed decodes, and zero dimensions fail explicitly.

The current reviewed manifests contain only the two home scene props, so EDEN currently uses the CSS branch. SVG support is conditional compatibility; the initial suggestion that EDEN necessarily uses SVG was corrected during this review.

## Other checks

- Bootstrap waits for the real title and boot teardown, then resets state through the real state API. Day 4 / slot 0 permits the Adam map visit. Intro-seen flags avoid an unrelated automatic intro during dialogue; directly invoking `playIntro('adam')` still exercises the intro.
- Expression calls, center position, 896×1200 dimensions, alpha measurements, and five fixed-frame screenshots agree with the portrait runtime/manifest. `textSpeed = 4` renders immediately, so Enter/tap advances the intended line.
- Intro selectors and the 1350 ms checkpoint agree with the illustrated-intro structure/animation. Map pin, arrival card, adopted logo crop, and `visitChar('adam')` APIs agree with current runtime. The canonical tournament CG cue is immediately followed by actual narration, making the sliced cue/text test meaningful.
- The chapter title renderer reaches its direct original-image frame at 3100 ms; the test's 3150 ms pixel comparison is consistent. Both preserved-asset SHA-256 constants independently match audit originals: EDEN logo `68b3102129af4c1f8c3bc218c9a03ffa7216483285c62bbd227f62aa062ca2a6`; chapter title `39dd98c35a3394985f847adecf2884108acd2ae559507aa0879914e7ce341c44`.
- PC 1280×720 and touch 844×390 run in separate fresh contexts, using actual Enter/click or tap inputs. Successful complete execution produces 12 cases and 24 JPEG screenshots. Resource/page failures and assertion failures are recorded; any failed case fails the final process assertion.
- Workflow diff is exactly two added steps in the existing Chromium job: execution (3-minute step limit) and an `always()` artifact upload. No dependency, permission, job, checkout, or existing-suite edits were introduced.
- Independent `node --check` on the applied test completed with exit code 0.

## Evidence limits to retain in handoff

The color direction, face identity, texture, and fine cropping still require review of the CI screenshots. The test explicitly sets `visualReviewRequired: true`; it does not compare red/green pixels automatically. Synthetic expression dialogue and the isolated canonical CG cue are focused rendering checks; this is not a chapter playthrough.

The 3 MB ZIP size is a logged target, not an enforced assertion; `screenshotBytes` measures JPEG bytes. CI runtime and final artifact size remain unmeasured locally.

`PR_HEAD_SHA` is report metadata, not a checkout selector. The unchanged checkout and `TEST_REF` determine the tested revision; retain both `ref` and `prHeadSHA` and associate CI evidence with the actual checked-out commit when claiming exact-head verification.

## Reviewed file SHA-256

- `remake/test/browser/adam_eden_711.mjs`: `4aa7e19333b041d1f9fe691d15df4d1000e830e81d3014bb81c49e6d2ae427cc`
- `.github/workflows/remake-browser.yml`: `4817fbd405b7146b233f42b7ae3de040c35f8e4dab486f133a991313189673ed`
