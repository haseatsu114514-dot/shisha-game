# Project Memory

## Godot Binary Location

`~/Desktop/Godot_standard.app/Contents/MacOS/Godot` (v4.6.1.stable)

Not in `/Applications/` — always use the Desktop path.

## Parse Check Command

```bash
~/Desktop/Godot_standard.app/Contents/MacOS/Godot --headless --quit 2>&1
```

Clean output (only "ObjectDB instances leaked" warning) = no parse errors. This is the standard
known-harmless quirk from quirks.md.

## Screenshot Capture (macOS, no xvfb)

macOS has a real GPU (Apple M3), so capture runs directly without xvfb:

```bash
~/Desktop/Godot_standard.app/Contents/MacOS/Godot \
    --write-movie screenshots/folder/frame.png \
    --fixed-fps 1 --quit-after 5 \
    --script test/test_script.gd 2>&1
```

Output files are named `frame00000000.png`, `frame00000001.png`, etc.

## ch1_tournament Scene Layout (verified 2026-03-19)

- **HUD** (`scenes/ui/hud.tscn`): CanvasLayer at layer=10, TopBar height=48px (offset_bottom=48)
- **MainPanel**: offset_top=52, offset_bottom=718 → height=666px, left panel
- **SidePanel**: offset_top=52, offset_bottom=718 → height=666px (same as MainPanel), right panel
- Both panels start 4px below the HUD bottom (52 vs 48), so NO overlap between HUD and panels
- `get_rect()` on SidePanel reports 1459px height in headless — this is because `RichTextLabel`
  nodes inside use `fit_content=true`, making the container's virtual size expand beyond viewport.
  Visually the panel renders correctly within y=52–718. Not a real bug.

## Autoloads (project.godot)

GameManager, CalendarManager, PlayerData, AffinityManager, RivalIntel, EventFlags, SystemData
All registered with `*` prefix = enabled at startup.

## Background Texture Import Issue

`bg_tournament_stage.png` fails to load in headless mode because `.import` file
references a `.ctex` in `.godot/imported/` which is not present in this checkout.
Run `godot --headless --import` first to generate these if needed.
The scene still loads and renders correctly despite this error.

## Tutorial Functions (ch1_tournament.gd) — Verified Clean

- `_show_tutorial_intro()` (line 1262): Sets phase, clears choices, adds "練習を始める" button
- `_finish_tutorial_phase()` (line 1279): Sets EventFlags, gives stat rewards, resets state,
  then calls `_prepare_run_competition()` directly
- `_prepare_run_competition()` (line 1300): Resets all minigame state variables, then adds
  "本番大会を始める" button → `_show_setting_step`. Clean syntax, no issues.

All three functions passed the headless `--quit` parse check with zero errors.

## Orphan File Cleanup (2026-03-19)

- `scripts/autoload/dialogue_box.gd` was a stale copy of the UI dialogue box. Not referenced by
  project.godot, any .tscn, or any .gd file. Safely deleted along with its `.uid`.
- The real dialogue box is `scripts/ui/dialogue_box.gd` (used by interaction scenes).
- `ch1_tournament.gd` has its own `SPEAKER_NAMES` dict used for the mini-dialogue display during
  tournaments. Updated to include all 30 characters from characters.json plus aliases (tumugi, hazime)
  and staff_choizap from the UI version.

## Tournament UI Assets (Task 2, 2026-03-19)

Generator: `tools/gen_tournament_ui_assets.gd` (SceneTree script, runs headless)

Generated 6 assets in `assets/ui/`:
- `ui_tournament_main_panel.png` (900x666) — main panel background
- `ui_tournament_side_panel.png` (380x666) — side panel background
- `ui_tournament_header.png` (1280x60) — step name header bar
- `ui_tournament_fullscreen_bg.png` (1280x720) — immersive fullscreen background
- `ui_tournament_step_card.png` (300x110) — step card frame
- `ui_mini_dialogue_bg.png` (600x140) — mini dialogue panel

Techniques used:
- FBM noise with bilinear interpolation for smooth smoke patterns
- Additive blending for bright smoke highlights
- Diagonal streak overlays (Persona-style)
- Corner glow hotspots for depth
- Scanlines for digital feel
- Purple glow borders with noise variation
- All assets use RGBA8 with alpha for semi-transparency

## Tournament UI Assets — Task 3 (2026-03-20)

Generator: `tools/gen_tournament_ui_task3.gd` (SceneTree script, runs headless)

Generated 7 assets in `assets/ui/`:
- `ui_tournament_button_normal.png` (400x64) — purple gradient button, rounded corners, smoke texture
- `ui_tournament_button_hover.png` (400x64) — brighter purple, stronger glow, outer halo effect
- `ui_tournament_button_pressed.png` (400x64) — dark, inverted gradient (concave), inner shadow, dim glow
- `ui_tournament_gauge_frame.png` (600x48) — metallic purple border with sheen, inner bevel, corner notches
- `ui_tournament_gauge_fill.png` (590x40) — purple→pink→red gradient with glossy highlight stripe
- `ui_tournament_choice_box.png` (700x60) — Persona-style parallelogram (diagonal cuts), glow edges
- `ui_smoke_particle.png` (128x128) — radial smoke blob, white center→purple edge, transparent bg (alpha=0 at corners)

Techniques: Same as Task 2 (FBM noise, additive blending, diagonal streaks, scanlines) plus:
- Rounded rect fill with corner-radius clipping for buttons
- Metallic sheen via sin() horizontal brightness variation for gauge frame
- Quartic alpha falloff for soft smoke particle edges
- Parallelogram masking via per-row left/right boundary calculation for choice box

## Tournament Scene Layout Redesign — Task 4 (2026-03-20)

Builder: `tools/apply_tournament_textures.gd` (SceneTree script, loads existing scene, modifies, saves)

Changes applied to `scenes/tournament/ch1_tournament.tscn`:
- **MainPanel**: StyleBoxFlat → StyleBoxTexture (ui_tournament_main_panel.png), NinePatch margins 24px
- **SidePanel**: StyleBoxFlat → StyleBoxTexture (ui_tournament_side_panel.png), NinePatch margins 20px
- **StepCard**: StyleBoxTexture (ui_tournament_step_card.png), NinePatch margins 16px
- **MiniDialoguePanel**: StyleBoxTexture (ui_mini_dialogue_bg.png), NinePatch margins 20px
- **PreviewPanel**: New purple StyleBoxFlat (no dedicated texture)
- **FullscreenStage/Backdrop**: ColorRect → TextureRect (ui_tournament_fullscreen_bg.png), KEEP_ASPECT_COVERED
- **HeaderDecoration**: New TextureRect node (ui_tournament_header.png), positioned y=48-108px (below HUD)
- **FullscreenStage panels**: StageTitlePanel, BodyPanel, ContentPanel, StatusPanel → purple StyleBoxFlat
- **Overlay**: Color changed from blue tint to purple tint
- **Font colors**: White/purple theme applied (white headers, light_purple phase labels, accent_purple tags, soft_lavender hints)

Note: Runtime script (`ch1_tournament.gd`) dynamically overrides many label colors and texts.
The scene-level colors serve as defaults when the script hasn't set them yet.

Technique: Load existing PackedScene → instantiate → modify properties → re-pack → save.
This preserves unique_name_in_owner flags and all node properties not explicitly changed.

## Tournament Script UI Theme — Task 5 (2026-03-20)

Applied purple×black theme to ALL dynamically generated UI elements in `ch1_tournament.gd`:

### Color Palette Used
- `#7b2fbe` — Primary purple (borders, lines, scanlines)
- `#6a1eb0` — Deep purple (pressed states, fallback borders)
- `#b55088` — Magenta pink (soul color, damage, hot state, bullet phase 3)
- `#c9a0ff` — Lavender (graze effects, score popups, stat popups, bullet phase 2)
- `#9b6ddb` — Medium lavender (bullet phase 1, tutorial border, cold state, labels)
- `#0d0818` — Dark purple-black (TV ticker bg, overlay bg)
- `#3d1f6d` — Dark purple (gauge frames, arena borders)
- `#140d1f` — Very dark (stage card bg, existing)
- `#120d22` — Slightly different dark (tutorial card bg)

### Changes Applied
1. **Buttons** (`_create_action_button`): StyleBoxFlat → StyleBoxTexture with `ui_tournament_button_normal/hover/pressed.png`, fallback to purple StyleBoxFlat
2. **Choice buttons** (`_add_choice_button`): Override with `ui_tournament_choice_box.png` (Persona-style parallelogram)
3. **Stage cards** (`_create_stage_card`): Border color changed from gold to purple `#7b2fbe`
4. **Tutorial card**: Changed from blue to lavender border `#9b6ddb`
5. **TempGaugeVisual**: Background dark purple, gradient purple→pink→red, frame outline `#3d1f6d`, markers magenta/gold
6. **PullGaugeVisual**: Background `#0d0818`, frame `#3d1f6d`, zone colors magenta/indigo, fill `#3d1f6d`
7. **Mind Barrage** (弾幕):
   - Soul node: `#b55088` (was red)
   - Graze rings/flash: `#c9a0ff` (was cyan)
   - Arena grid: `#7b2fbe` (was grey)
   - Arena border: `#7b2fbe` (was red)
   - Bullet colors per phase: lavender→lavender/magenta→magenta (was grey→gold/grey→red)
   - Burst flash: `#c9a0ff` (was gold)
   - Hit flash/popup: `#b55088` (was red)
   - Trail dots: magenta/lavender (was red/cyan)
   - Phase vignette: deep purple (was red)
   - Graze popup: lavender (was cyan)
   - Combo colors: lavender→gold→magenta (was cyan→gold→red)
8. **Scanlines**: `#7b2fbe` (was cyan)
9. **Glitch transition**: Magenta/purple/lavender/dark-purple bars (was red/cyan/gold/dark)
10. **TV ticker**: Dark purple bg, purple accent line (was dark grey bg, red accent)
11. **Score popup**: Default lavender (was gold), negative magenta (was red)
12. **Screen flash**: Default purple (was red)
13. **Fullscreen transition**: Purple tint (was blue-black)
14. **Phase transition flash**: Purple→magenta (was gold→red)
15. **Beat pulse**: Purple tint (was red tint)
16. **Mid-score reveal**: Purple title, purple overlay, purple separator line
17. **Heat indicators**: Magenta for hot, lavender for cold (was red/blue)

### Preserved As-Is
- STEP_STAGE_META colors (per-step identity)
- Aluminum hole gameplay feedback (perfect gold, good green, miss red)
- Quality rating miss color (gameplay indicator)
- Temperature gradient endpoint (red is correct for high-heat end)

## Smoke Particle Effect — Task 6 (2026-03-20)

Added CPUParticles2D-based smoke effect to `ch1_tournament.gd` (programmatic, no .tscn changes needed):

### Implementation
- **SmokeAmbient**: CPUParticles2D, z_index=-1 (behind panels), 25 particles normal / 50 fullscreen
  - Emission from bottom of screen (y=760), rectangle shape spanning screen width
  - Rises slowly upward with slight left-right wobble
  - Color: purple (0.6, 0.3, 0.8) fading to white with alpha fadeout
  - Lifetime 6s, preprocess 4s (pre-fills on scene load)
  - Scale curve: starts small, grows, then shrinks slightly
- **SmokeBurst**: CPUParticles2D, one_shot, 15 particles, explosiveness=0.9
  - Fires on `_step_transition()` for dramatic effect
  - Centered in screen (640, 400), wider spread (60 degrees)
  - Slightly brighter purple than ambient
- `_set_smoke_density()` adjusts ambient amount for immersive mode
- `_fire_smoke_burst()` restarts the burst emitter

### Integration Points
- `_ready()` → `_init_smoke_particles()` creates both emitters
- `_enter_immersive_stage()` → increases density to 50
- `_exit_immersive_stage()` → resets density to 25
- `_step_transition()` → fires burst

### Variables Added
- `_smoke_particles_ambient`, `_smoke_particles_burst` (CPUParticles2D)
- Constants: `SMOKE_AMBIENT_AMOUNT_NORMAL = 25`, `SMOKE_AMBIENT_AMOUNT_FULLSCREEN = 50`
