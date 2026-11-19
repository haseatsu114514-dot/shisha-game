---
name: game-playtest
description: Playtest shisha-game screens and review visual quality, readability, input feedback, and responsive layouts. Use for browser QA, screenshot comparisons, UI or motion review, and reproducible gameplay issues using the repository's existing previews and Playwright tests.
---

# Game Playtest

## Overview

Use this skill to test browser games the way players experience them: through boot, input, scene transitions, HUD readability, and visual state changes. Prefer browser automation and screenshot review when the project supports it.

## Repository integration

- Follow [AGENTS.md](../../../AGENTS.md), the [current documentation guide](../../../docs/current_documentation_guide.md), and the [existing test entrypoints](../../../remake/README.md). Use [web-build-test](../web-build-test/SKILL.md) for the established commands and CI scope.
- Test the affected `remake/` screen with the existing preview pages, browser support, and deterministic state hooks. A new engine, test framework, CI workflow, or whole-game playthrough is not a prerequisite for a local UI change.
- Use an isolated browser context or the existing save-isolated preview. Do not overwrite a player's save to reach the test state.
- For visual evaluation, use the current approved design and [game-ui-frontend](../game-ui-frontend/SKILL.md). Identify the commit, scene, theme, and viewport so stale screenshots cannot stand in for the changed build.
- Distinguish observations, source-based hypotheses, subjective art preferences, and untested behavior. Do not report a screenshot as reviewed until its image has actually been inspected.

## Preferred Workflow

1. Boot the game and confirm the first actionable screen.
2. Exercise the main verbs.
3. Capture and inspect screenshots from representative states; compare before and after at the same state and viewport.
4. Check the UI layer independently from game state and assets. For motion changes, exercise the real interaction or inspect a short recording.
5. Report findings in severity order with reproduction steps.

## Tooling Guidance

- Prefer Playwright or equivalent browser automation already available in the repo.
- When the game is canvas or WebGL heavy, screenshots are mandatory because DOM assertions alone miss visual regressions.
- Use screenshots to judge playfield obstruction and HUD weight, not just correctness of text or layout.
- When deterministic automation is not practical, do a structured manual pass and capture evidence.

## Common Checks

### 2D checks

- sprite alignment and baseline consistency
- hit or hurt animation readability
- HUD overlap with the playfield
- command menu state changes
- tile or platform readability
- input-state feedback and turn-state clarity

## Responsive and Browser Checks

- desktop and mobile viewport sanity
- safe-area and notch issues where relevant
- reduced-motion behavior for UI transitions
- keyboard, pointer, and pause-state handling
- actual scaled text and touch-target size, rather than only logical stage coordinates
- a representative desktop viewport (1280×720) and landscape phone viewport (844×390); add 740×320 for a dense target or an existing test requirement
- portrait rotation guidance when affected; do not reintroduce the retired two-screen layout
- actual iPhone/Safari checks only when that device/browser was used; label Chromium emulation accurately

## Reporting Standard

Lead with findings. Keep each finding concrete:

- what the user sees
- how to reproduce it
- why it matters
- what likely subsystem owns it

- Include the screenshot or recording location and the tested commit/state/viewport.
- Say whether each check passed, failed, was blocked, or was not run. A source review alone does not establish visual quality, and a passing layout test is not an aesthetic score.
- Keep follow-up work scoped to concrete findings and reuse the existing Issue/PR workflow; avoid a duplicate checklist or issue for the same finding. Use [playtest-feedback](../playtest-feedback/SKILL.md) only when first-time-player impressions are requested.

## References

- [Focused playtest checklist](references/playtest-checklist.md)
- [Game UI design and visual review](../game-ui-frontend/SKILL.md)

## Upstream source

Adapted from [OpenAI Game Studio 0.1.2](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/skills/game-playtest/SKILL.md) at commit `981b02c0c44058b595f3b4180002c3ae3c806d40`.
The [upstream plugin manifest](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/.codex-plugin/plugin.json) declares the MIT license and OpenAI authorship. The adaptation adds the existing test/save workflow and evidence requirements, retains browser-game playtesting, and omits unrelated 3D tooling.
These repository adaptations are maintained here; do not overwrite them with generic upstream defaults during an update.
