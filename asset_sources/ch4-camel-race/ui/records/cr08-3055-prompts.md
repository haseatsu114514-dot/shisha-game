# CR08 #3055 生成指示（2026-11-10）

画像は Codex 組み込み `image_gen` を各候補1回使用。参照画像は下記の役割だけを使い、形状の複写が必要な UI02 を除き構図は複写しないよう指定した。全プロンプトに以下の固定画風を含めた。

> STYLE LOCK: Japanese pixel-painterly visual novel UI at a Dubai desert camel racetrack at sunrise; fine painterly pixel texture, confident dark outline, real used material, upper-left warm light and 2–3 crisp shadow steps. No glossy gradients, glow, bloom, airbrush, glassmorphism, plastic bevel, excessive ornament, letters, digits, pseudo-writing, logos or watermark. Front-facing flat object, true transparent alpha outside, no external shadow.

| 候補 | 参照の役割 | 寸法・比率・帯を含む個別指示 |
|---|---|---|
| rank-plate-A | 背景＝画風と光。program-card＝画風と素材感 | `512×160, 3.2:1. Nine-slice left/right 48px, top/bottom 40px. Pale sun-bleached white wood plate; narrow vertical groove and small circular recess entirely within LEFT 48px fixed band; tiny brass nails in four fixed corners; plain stretchable center for code-drawn names/numbers.` |
| rank-plate-player-A | rank-plate-A＝形状・配置。背景＝画風 | `512×160, 3.2:1. Exactly same shape, left groove, circular recess and nails as UI01, with only a thin dull brass band around the outside. Nine-slice left/right 48px, top/bottom 40px; all left features within fixed band.` |
| medal-gold-A | program-card＝画風のみ | `256×256, 1:1. Round struck gold racing medal, shallow camel head profile at center, broad flat plain outer ring for game-drawn number, no ribbon or string. Metal face alpha=255, outside circle alpha=0 including four edges.` |
| gauge-frame-A | program-card＝素材。背景＝光 | `800×96, 8.333:1. Very long thin front-facing gauge window, dull brass bezel, inside an empty dark channel. Nine-slice left/right 48px; screws entirely in end bands; parallel stretchable edges.` |
| gauge-fill-A | gauge-frame-A＝幾何。program-card＝画風 | `800×64, 12.5:1. Bright green liquid strip almost end to end, uniform continuous subtle ripple pattern, no end caps or taper. Game recolors amber/red/blue. Real alpha outside.` |
| call-plate-A | dash-panel＝画風と素材。背景＝光 | `720×160, 4.5:1. Front of in-car radio, matte black resin, thin dull brass edge. Nine-slice left/right 160px, top/bottom 48px. TRUE CIRCULAR recessed window and adjacent fine perforated speaker MESH fully within LEFT 160px band; x=160..560 and right side plain for code-drawn dialogue.` |

原出力の寸法・crop 座標・alpha 処理・提出後の SHA-256 は `cr08-3055-generation.json` を参照。
