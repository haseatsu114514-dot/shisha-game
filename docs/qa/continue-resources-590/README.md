# #590 retry resources, pause and countdown sound

Refs #590. This is a partial implementation of the design Issue; do not close it.

Worker: `codex-a590-closeup-20261016-4bbd263e`  
Thread: `01a14361-8340-7852-8452-e9ac62a06df0`  
Claim: successful run `38861468538`, active ledger `6209557867`.  
Execution: official A, `gpt-6-astra` / `high`; no other inference launched.  
Base: `7ce32bd83481d76ab1591709e71843907692558e`.  
Latest main inspected: `df3d9897b94a9f4d8e5a628ebb85b890ba7255a9`.
Its 17 intervening commits do not change these implementation files, the
approved 14 runtime assets, AGENTS.md or the claim protocol.

## Behavior

- Chapter 1 captures inventory and stamina once, after the rescue grant and
  before the first craft. Retry restores absolute values, never adds healing.
  PR699 loss tracking and retry assistance remain intact.
- Schema 18 adds a one-time `source: "legacy-load"` snapshot for old Chapter 1
  tournament saves with only `stockSnap`. Its stamina is the current saved value;
  missing historical stamina/max stamina is never guessed. Subsequent SAVE/LOAD
  retains that baseline.
- Illness, money, affinity, dates, rewards and other progression are not restored.
  Schema16/#577 behavior and Chapter 2's existing resource machinery are preserved.
- Actual visible rotation hint, hidden document, MENU and disconnected screen
  are combined. The clock, captions and CONTINUE audio resume only after all
  reasons clear. Initial portrait pause also observes subsequent CSS visibility,
  even without a DOM attribute change.
- One decision clock emits 20..6 (15 ticks), 5..1 (5 existing tones), and 0 once.
  Caption fast-forward cannot move the deadline; missed boundaries do not burst
  on resume. Sounds use the existing shared context, volume settings and owned
  source cleanup.
- LOAD disposes the old owner; Chapter 1 also checks ownership after warm-up and
  before a delayed retry transition. Decision callback remains once.
- PR610 C framing and PR595 logo CSS/view files are unchanged.

## Local verification

Node 24.13 and isolated installed Google Chrome, using existing Playwright cache.
No dependency/browser installation or full clone/fetch. External browser HTTP
was blocked; approved runtime files were loaded from local cache/checkout.

Passed commands:

```sh
node remake/test/tournament_resources.mjs
node --experimental-vm-modules remake/test/continue_audio.mjs
node remake/test/continue_premium.mjs
node remake/test/ch2_tournament.mjs
node remake/test/axe_bar_discovery.mjs
node --experimental-vm-modules remake/test/illness.mjs
node --experimental-vm-modules remake/test/stamina_condition.mjs
node remake/test/browser/continue_lifecycle.mjs
node remake/test/browser/continue_output.mjs
```

Browser scripts accept `BASE_URL`, `CHROME_EXECUTABLE_PATH`, `NODE_PATH` and
`ARTIFACT_DIR`. Both use the real `continue-preview.html` modules and CSS with
an isolated browser context, not a natural tournament playthrough.

- Resources: 52→48→52, inventory 12→2→12; repeated retries; no aliasing or additive
  recovery; rescue-before-capture ordering; schema15/16/17 migration; repeated
  slot/auto SAVE/LOAD; illness/progression preservation; LOAD during warm-up/wipe.
  The Chapter 1 entry-order test executes its actual function prefix with story,
  UI and asset dependencies stubbed. It is not a full craft/playthrough.
- Lifecycle: PC1280×720 and touch844×390, portrait390×844 held 30 seconds,
  MENU+hidden+rotation overlap, all-clear resume, normal/fast captions, exact
  15+5+1 boundaries, retry at 1s/19.95s, opposite-button spam, paused reactions,
  LOAD with old DOM still attached, detach cleanup, reduced motion and SE off.
- Geometry: real controller timeouts at 1280×720, 1920×1080, 844×390, 667×375.
  Face size524.8, center640/273; timeout logo center640/360; face/captions/count/
  choices hidden and callback once. Runtime image/font failures and pageerrors:0.
  Screenshots were inspected locally. Preview controls are present in captures.
- Native output: MediaRecorder captures of the real SE bus and master output,
  decoded PCM spectrum confirms all 21 tones with BGM off and on. A visible
  one-second MENU pause produces silence in both recordings and shifts the same
  decision clock once. No clipping; boundary error limit150ms. This is real
  rendered output analysis, not a function-call assertion or human listening.
  BGM-on uses the existing synth fallback, not the unavailable external BGMer file.
- #577:20/20. Existing Chapter 2 resource/judge/retry test passed.

Tests exposed and corrected an initial-portrait start-wait bug. Earlier test
instrumentation also confused BGM sources with SE and omitted silent recording
frames; the final tests distinguish the actual audio graph and keep recording
silence via a zero source connected only to recording taps. No assertion removal
or timeout extension was used to turn failures into passes.

Approved acquisition: 14 existing blobs, exactly5,506,296 body bytes, each
SHA-verified against latest main. HTTP overhead was not measured. No other
asset download. Detailed local receipts, JSON, screenshots and WebM captures
remain in this task's evidence directory; binaries are not included in this PR.

## Remaining gates and Issue classification

| Classification | Requirements/status |
| --- | --- |
| Adopted, already merged | PR595 logo and PR610 C2.05; preserved, not recreated |
| Adopted, this change | Entry resources/legacy migration, actual-display overlapping pauses, timer/audio/cleanup/owner boundaries, mandatory15+5+1 sound |
| Proposal, not implemented here | Defeat-specific context/advice, seven cues and loss-streak shortening, 18 rewritten reactions, focus/arrow/repeat behavior and button/label changes, additional effects, Chapter 2 shared presentation adapter/extra preview |
| Other-owner confirmation | #564 names/lover scripts; no changes to those designs or dialogue |

Pending: exact-head required CI, independent review and merge/conflict checks.
No independent AI was launched. A coordinator-provided independent review is
required before merging; this worker's own inspection is not that review.
CI/PR creation may start existing broad runner checkouts, browser installation
and artifact uploads (total transfer unknown); communication approval is needed
before triggering those existing workflows. No workflow/queue settings changed.

Not performed: human listening, physical phone/Safari, natural full tournament
SAVE/LOAD/retry playthrough, external recorded BGM, all seven speakers/44 faces
re-run, full existing readiness/screen/neon/typing/classic/title-center suites
against the main entry page. The latter remain required CI/reviewer follow-up
where their additional assets are available. Prior PR610 QA is not counted as
a fresh run for this commit.

Keep the claim and checkout while pending. Do not mark Issue590 complete,
release its claim, or move this unmerged checkout to Trash.
