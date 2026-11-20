# Frontend Prompts

Use these prompt shapes for the affected screen only. Keep the current approved game style, assets, and implementation as constraints. Follow the parent skill's repository integration rules.

## Prompt ingredients

- game genre and fantasy
- camera or viewpoint
- player verbs
- HUD zones
- menu surfaces
- motion tone
- desktop and mobile expectations
- playfield protection and disclosure strategy
- anti-patterns to avoid

## HUD implementation prompt

```text
Design and implement the HUD for a browser game.

Game fantasy: <genre and world>
Viewpoint: <dialogue scene, crafting stage, map, or the existing minigame view>
Primary verbs: <read, choose, mix, pack, heat, serve, inspect>
HUD zones: <top status, bottom command bar, side objectives, modal panels>
Tone: <ornate, rugged, clean sci-fi, painterly, arcade>
Motion: <restrained, snappy, dramatic only on important state changes>
Platforms: desktop and mobile
Constraints: readable over active gameplay, DOM-based overlays, CSS variables, no generic dashboard look
Playfield protection: retain the approved dialogue/crafting composition, keep the current subject and action readable, and use existing help/menu surfaces for secondary details
Avoid: flat admin UI, default font stack, cluttered overlays, constant micro-animation, equal-weight cards around every edge, broad always-on panels that cover the world
```

## Menu implementation prompt

```text
Build the shell UI for a browser game with the following surfaces:
- title screen
- pause menu
- settings panel
- game-over or victory screen

Keep the menus visually tied to the game world, not to a SaaS app aesthetic. Use strong hierarchy, intentional typography, meaningful motion, and responsive layout.
```

## Compare before implementing

For a design-only request, name one affected screen, reuse its current art and exact game state, and propose two concrete compositions within the approved direction. Explain the three most important differences and provide comparable images or an existing preview. Do not describe a static mockup as working gameplay.

For an implementation request, apply the selected direction to the existing components, compare the real render at desktop and landscape phone sizes, and report the verified result.

## Upstream source

Adapted from [OpenAI Game Studio 0.1.2](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/references/frontend-prompts.md) at commit `981b02c0c44058b595f3b4180002c3ae3c806d40`.
The [upstream plugin manifest](https://github.com/openai/plugins/blob/981b02c0c44058b595f3b4180002c3ae3c806d40/plugins/game-studio/.codex-plugin/plugin.json) declares the MIT license and OpenAI authorship. The examples are narrowed to this game's dialogue/crafting interface and omit the 3D prompts.
These repository adaptations are maintained here; do not overwrite them with generic upstream defaults during an update.
