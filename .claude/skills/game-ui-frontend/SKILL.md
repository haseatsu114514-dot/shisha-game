---
name: game-ui-frontend
description: Design and improve the shisha-game browser UI, including dialogue windows, crafting screens, HUDs, menus, overlays, mobile layouts, and visual direction. Use for game-screen design, visual polish, or comparing UI proposals while preserving the project's approved art and existing implementation.
---

# Game UI Frontend

## Overview

Use this skill whenever the game needs a visible interface layer. The job is not to produce generic dashboard UI. The job is to produce a readable, thematic browser-game interface that supports the play experience.

## Repository integration

- Follow [AGENTS.md](../../../AGENTS.md) and the [current documentation guide](../../../docs/current_documentation_guide.md). Use the latest explicit owner decisions and current code; dated design reports are not authority for reverting a newer choice.
- Work in the existing `remake/` ES Modules game. Reuse its DOM UI, CSS variables, image frames, font definitions, previews, and animation helpers. Installing this skill does not request an engine/framework migration or a new UI library.
- Read only the specification and implementation for the affected screen. Confirm the current font in `remake/css/base.css`; do not pin an old font, palette, or layout from this skill.
- Preserve approved character identity, art, dialogue, mechanics, and save behavior within the requested scope. Follow [asset guidance](../../../docs/asset_ai_guidance.md) when an asset change is needed.
- Game-specific art direction takes priority over generic UI defaults. Judge glow, texture, bold text, and strong animation by their role and readability; do not impose blanket dashboard-style bans.
- Treat the dialogue window and crafting work area as intentional parts of the composition. Do not apply an action game's empty-center or HUD-coverage rule to every scene.
- When the user asks for research or comparison only, deliver that scope. When implementation is authorized, complete the requested change and its relevant checks without introducing another approval step.

## Frontend Standards

1. Establish visual direction before coding.
   - Genre and fantasy
   - Material language
   - Typography
   - Palette
   - Motion tone
2. Use CSS variables for the UI theme.
3. Build clear hierarchy.
   - The current dialogue, objective, crafting step, or important game state first
   - Secondary tools second
   - Rarely used settings behind menus or drawers
4. Protect the scene's focal content and the active interaction.
   - The initial screen should feel playable within a few seconds.
   - Reuse the approved HUD zones and group information by role.
   - Keep characters, tools, and the current action readable within the approved composition.
   - Put lore, field notes, quest details, and long control lists behind drawers, toggles, or pause surfaces.
   - Prefer contextual prompts and transient hints over permanent boxed panels.
5. Keep overlays readable over motion.
   - Use backing panels, edge treatment, contrast, and restrained blur where needed.
6. Design for both desktop and mobile from the start.

## Prompting Rules

When asking the model to design or implement game UI, include:

- the game fantasy
- the camera or viewpoint
- the player verbs
- the HUD layers
- the tone of motion
- desktop and mobile expectations
- playfield protection and disclosure strategy
- explicit anti-patterns to avoid

Use [frontend prompts](references/frontend-prompts.md) when preparing a screen brief.

## Motion Rules

- Prefer a few meaningful transitions over constant micro-animation.
- Reserve strong motion for state change, reward, danger, and onboarding.
- Respect reduced-motion settings for non-essential animation.
- Reuse the existing transition helpers and sound cues. Evaluate the timing of press, response, and result together.

## What Good Looks Like

- HUD elements are legible without flattening the scene.
- Menus feel native to the game world, not like a SaaS admin panel.
- Layout adapts cleanly across breakpoints.
- Pointer, keyboard, and game-state feedback are obvious.
- Persistent information density is low enough that screenshots still read as game scenes, not UI comps.

## Anti-Patterns

- Generic app dashboard layouts
- Flat placeholder styling with no theme
- Default font stacks without intent
- Dense overlays that obscure the playfield
- Large title cards or multi-paragraph notes sitting over a live playable scene
- Equal-weight boxed panels distributed around every edge of the viewport
- Controls, objectives, notes, and lore all expanded at once on first load
- Excessive motion on every element
- Canvas-only UI when DOM would be clearer and cheaper
- Letting background gameplay input remain active under a blocking menu or modal

## Visual verification

Use the existing preview or reproducible game state and the [game-playtest workflow](../game-playtest/SKILL.md).
Capture and inspect the actual rendered image, not only DOM assertions. Compare the approved reference, before, and after at the same state and viewport; label a mockup as a mockup.
Check the affected screen at 1280×720 and a landscape phone size such as 844×390; use 740×320 when the target layout is dense or an existing test requires it.
For motion changes, inspect the interaction or a short recording as well as a still image. Emulator results are not evidence of testing on a physical iPhone.
Report the main visible improvements, remaining differences, and the checks actually run. Reuse existing previews and checks instead of adding a new gallery or CI workflow by default.

## Upstream source

Adapted from [OpenAI Game Studio 0.1.2](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/skills/game-ui-frontend/SKILL.md) at commit `981b02c0c44058b595f3b4180002c3ae3c806d40`.
The [upstream plugin manifest](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/.codex-plugin/plugin.json) declares the MIT license and OpenAI authorship. The adaptation adds this repository's source priorities and visual-review workflow, retains the upstream UI principles, and omits unrelated 3D starter/engine guidance.
These repository adaptations are maintained here; do not overwrite them with generic upstream defaults during an update.
