# Issue #696: partial investigation, Safari recurrence pending

Worker: `codex-b-doubletap-20261019-task3`. Base: `a97160ae0956d566538150e7d3a07a3fb766e3f4`.
No merge or claim release. This is **not evidence that the reported iPhone double-tap recurrence is fixed**.
The Draft PR / Issue handoff records the exact committed validation SHA.

## Finding and change

The current main already has an unrestricted device-width viewport and
`touch-action: manipulation` on html/body and viewport descendants, with
specialized `none` / `pan-y` rules for mini-games and scrolling. There is no
general double-tap event suppression in the inspected main/VN paths.

Chrome's desktop and mobile touch emulation did not reproduce enlargement on
repeated taps. The cause of the user-reported recurrence remains unconfirmed.
Do not attribute it to a missing viewport tag or assert an iOS fix from these tests.

A separate, measurable problem is in `main.js:fitStage`: it treats visual
viewport dimensions after browser zoom as available game layout dimensions.
At 844×390, forcing browser scale 2 changes `--k` from 0.541667 to 0.270833.
Thus browser zoom also changes the game's CSS scale and counteracts enlargement.
The patch multiplies visual dimensions by `visualViewport.scale` before fitting.
At browser scale 2, `--k` stays 0.541667. The browser may still zoom deliberately.
Visible-height resize handling and the innerWidth/innerHeight fallback remain.
No viewport restrictions, touch cancellation, click synthesis or DS edits are added.

`before.json` measures base production code; `after.json` measures the patch.
The captured-drag scenario was added after the baseline run. Other scenarios
are present in both records. The only baseline assertion failures are the two
browser-zoom separation checks; passing tap checks also passed before the patch.

## Reproduce without downloads

Use an already installed Playwright module and Chrome; do not run npm install
or playwright install. For the local cache used here:

```sh
PLAYWRIGHT_MODULE=/Users/hasegawaatsuki/.npm/_npx/86170c4cd1c5da32/node_modules/playwright/index.mjs \
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node remake/test/browser/mobile_doubletap.mjs
```

The test serves local text files only, blocks external requests and all media,
uses fresh browser contexts, and never opens an existing browser profile.
It measures browser scale separately from CSS scale and stage bounds. It checks
repeated taps after navigation, real VN advancement and a fixture choice through
the real VN engine, real glossary wheel/touch scrolling, config range keyboard
input, real hole punches, mini-game drag/capture, portrait/landscape viewport
resizes, and core save/load across document reload followed by the real map.
It does not exercise the entire chapter or the save-menu resume flow.

## Environment and remaining work

- Chrome 155.0.8059.80; mobile emulation is Chromium, not iOS Safari.
- Browser zoom is set with CDP, not a real finger pinch. Viewport resizes do not
  establish hardware orientation behavior. Software keyboard behavior is untested.
- Safari is installed but SafariDriver rejected session creation because
  “Allow Remote Automation” is disabled. No setting was changed. No cached
  Playwright WebKit was found. Real iPhone and Safari/WebKit checks remain open.
- This sparse checkout has no media, existing test suite/helper, or
  `docs/master_spec.md` / `docs/owner_requests.md`. `remake/css/game-ds.css` is
  also absent (the only missing text request in the browser runs). These runs
  cannot establish production visual parity or rule out CSS in that missing file.
- Git's attempted reads of missing test helper / browser `.gitignore` blobs
  failed under network restriction. No lazy acquisition succeeded; no fetch,
  media, LFS, dependency or browser download was performed. Subsequent Git work
  uses explicit paths and tracked-only status to avoid missing ignore blobs.
- DS was not modified. Existing `initGameLayout` runs even in normal mode and
  measures DS custom properties, but the inspected normal-mode JS does not
  change `--k` or enable the DS class. Missing DS CSS prevents a complete audit.
- History investigation was limited to six base.css and four main.js commit
  metadata records, one related base.css patch and a bounded Issue search.
  That sample did not locate the original touch-action change.

Next: reproduce #696 in real iPhone Safari with the complete deployed CSS.
Record `visualViewport.scale`, its width/height, `innerWidth/innerHeight`,
`#stage`'s `--k`, computed transform and bounding rect before/after taps.
Repeat across navigation, dialogue/choices, scrolling, mini-games, rotation
and save resume. Establish whether browser scale, CSS scale, or both change
before selecting any additional gesture workaround. Keep this PR Draft meanwhile.
