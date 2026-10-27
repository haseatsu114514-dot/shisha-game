# Manual DJ prototype — Issue1064

Entry: `remake/previews/dj/index.html`, using the existing permitted HTTP preview/normal PR CI environment. Buildless; no dependency installation, external media or game SAVE required. This revision did not launch a local server/browser or change a recorded browser restriction.

1. Prepare audio (initial volume 18%). Preparation alone starts neither deck. Mute/volume are available before playback.
2. BPM SYNC: press a deck’s button to copy the other deck’s current BPM once, including decimals. It does not start playback, seek or align beat/phrase positions, change the other deck, or keep following later tempo changes. Fine pitch remains available afterwards.

Fine pitch: each deck has −0.01/+0.01 BPM buttons (also usable before playback), with two-decimal BPM/difference readouts and a 0.01-step slider. Tempo is retained after release; these controls do not seek the beat, start a deck or sync the other deck. Range is 110–140 BPM; the outward button is disabled at each limit.

Manually match PITCH/BPM: the fixed test pair starts at A128/B126. Press PLAY A, then press the separate large PLAY B at the displayed phrase head yourself. There is no continuous sync, automatic tempo blending, scheduled PLAY, automatic seek or automatic fader movement. PLAY uses the audio clock when its user request is accepted; it does not quantize to the guide.
3. Use the upper A/lower B actual-PCM waveforms and ±1/16-beat nudges to align phase. Both use the same seven-second scale/current line. Nudging seeks the playing audio; stopped-deck nudge is disabled. The B half-beat button is a labelled test control.
4. Move the horizontal crossfader over the indicated eight bars. It changes equal-power gains only. There is no EQ/CUE, tapping mini-game, scoring or pass/fail. Fader percentages show position, not linear gain.

Remaining bars, the last four beats and NEXT HEAD are provisional visual entry guidance, not an input tolerance or reservation mechanism. Missing a head never starts a stopped deck. Initial PLAY begins at beat zero; per-deck PAUSE/PLAY preserves its head. A subsequent transfer requires the player to stop/start or time the other deck; there is no CUE/reset-to-head feature. Beat-phase and 32-beat phrase offset are separately displayed; matching beats alone does not repair a whole-bar error. This remains a fixed-pair prototype rather than a finished set-management interface.

Both mono tracks are original procedural test sound (kick/hat/snare/bass), 32 beats each. Buffer rounding is included in the actual playback-rate calculation. B's existing bass is pretransposed for manually matching 128 BPM; there is no key lock and pitch follows tempo. No finished EDM, recorded songs, third-party samples, sprites or product interface images are included.

AudioContext time drives playback, waveforms and beat positions. A/B keep independent anchors and rates. The active/louder deck chooses the visual beat master with 40/60% hysteresis. The outgoing guide deck measures the eight-bar window, but never modifies audio. The VJ uses mixed-output RMS. A small passive window below the controls shows a four-beat original code dancer and, separately, a short geometric glamorous-character proposal. These are labelled placeholders, not adopted character art. Reduced motion uses static background VJ; no flashing or overlay over PLAY/waveforms.

Pause, hidden tabs and audio interruption stop/disconnect voices. Whole-transport resume restores only previously playing decks, without pitch matching. Individual pause preserves its position. Seek ramps old/new sources over 8ms and releases old nodes. Page exit disconnects/closes the graph; bfcache navigation pauses. No localStorage/sessionStorage, game-state import, economy, time or SAVE-schema changes.

Validation: `node remake/test/dj_preview.mjs` runs the actual model/audio/synth with controlled WebAudio ports. The current revision passes 24 groups; old16 results are not carried forward. This is not actual browser or physical listening acceptance. The existing `dj-preview` normal CI command `node remake/test/browser/dj_preview.mjs` now checks manual pitch/individual PLAY, stopped waveform, actual clock/offset, eight-bar guidance, PC1280×720/touch844×390/reduced-motion and large target/small-window geometry. It is saved and syntax-checked, not run locally. Physical listening, latency/clicks/loop quality, real-device touch, visibility/OS interruption UI and audio/video capture remain acceptance work. Do not bypass recorded local browser restrictions.

RED ROOM is a prototype label, not an adopted story venue. No new assets or changes to the main game are included.
