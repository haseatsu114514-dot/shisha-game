# Playtest Checklist

Use the items relevant to the changed screen. Follow the parent skill's save isolation, test scope, and evidence rules; this list does not require a full-game run for every change.

## Universal checks

- Does the game boot into a useful first state?
- Are the main verbs obvious and responsive?
- Does the HUD remain readable over gameplay?
- Does the first playable screen prioritize play over dashboard chrome?
- Do the character, dialogue, crafting tool, and active control remain readable within the approved layout?
- Do pause, failure, and recovery states work?
- Does the game survive viewport changes?

## 2D checks

- sprite baseline consistency
- hit, hurt, and attack timing
- command menu focus and input state
- tile or platform readability
- particle or camera effects obscuring gameplay

## Browser checks

- desktop and mobile viewports
- input modality differences
- reduced-motion behavior
- pause behavior when focus changes
- background input is blocked when a modal requires it
- transient onboarding hints do not hide the action after their purpose is served

## Reporting

- Capture and inspect screenshots for visual findings, using the same scene and viewport for comparisons.
- Check the real scaled text, frame alignment, portrait baseline, touch areas, safe areas, and foreground/background contrast.
- Inspect timing and sound with the actual interaction or a short recording when motion changes.
- Label mockups, browser emulation, physical-device checks, and untested states accurately.
- Put findings in severity order.
- Include reproduction steps.
- Call out whether the likely owner is simulation, renderer, frontend, or asset pipeline.

## Upstream source

Adapted from [OpenAI Game Studio 0.1.2](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/references/playtest-checklist.md) at commit `981b02c0c44058b595f3b4180002c3ae3c806d40`.
The [upstream plugin manifest](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/.codex-plugin/plugin.json) declares the MIT license and OpenAI authorship. The checklist is scoped to this project's 2D browser game and includes comparable visual evidence.
These repository adaptations are maintained here; do not overwrite them with generic upstream defaults during an update.
