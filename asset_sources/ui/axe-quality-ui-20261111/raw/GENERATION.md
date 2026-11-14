# AXQ03 生成記録

- 生成: Codex 組み込み `image_gen`（ツールはモデル ID を公開しない）。
- 生成回数: 初回7枚、背景除去の編集2回、cut-mark は3回拒否（安全判定 `moderation_blocked`, output category `sexual`）。
- 技術処理: 生成 PNG を指定キャンバスへトリミング・再標本化して透明余白を追加。alpha 16 未満を0へ丸めた。緑帯は橙帯の alpha マスクを適用して形と位置を一致させた。
- 参照画像の役割（形は写さず素材と光のみ）:
  - `assets/ui/axe_throw/target_board_watl_c.png — 明るい松材・光のみ`
  - `assets/ui/axe_throw/menu-walnut-panel.webp — 濃い胡桃・黒鉄・真鍮材・光のみ`
  - `remake/img/ui/axe_throw/tag-slate.webp — 黒板・胡桃枠材・光のみ`

## 生成プロンプト全文

各生成で以下の共通文を冒頭に付け、該当番号の項をそのまま続けた。参照画像は上記の役割ラベル付きで添付した。6/8 は `banner-orange` を形の参照として追加した。背景除去編集には対象 PNG と背景除去指示を渡した。

```text
共通（全8枚の冒頭に付ける）:
Game UI prop for an axe-throwing mini game set in a Japanese night lounge with amber lamps, burgundy upholstery and black steel lanes. High quality illustrated anime adventure game prop with painterly realistic materials: chalkboard slate, dark walnut wood, pale pine, blackened steel, brushed brass, safety-orange enamel paint. Same look as the existing target board `assets/ui/axe_throw/target_board_watl_c.png`, the menu panel `assets/ui/axe_throw/menu-walnut-panel.webp` and the aim tag `remake/img/ui/axe_throw/tag-slate.webp` (attach all three as style references; copy their material and lighting, not their shape).
Perfectly front-facing orthographic view, no perspective, no tilt. Soft even light from the upper left. One object only (or one sprite sheet where stated), centered, with a small transparent margin. True transparent background (RGBA PNG), no floor, no wall, no external cast shadow, no glow outside the object.
STRICTLY NO text, NO letters, NO numbers, NO icons, NO arrows, NO check marks, NO logo, NO watermark printed anywhere. The game code draws every label, score, rank letter and mark on top.
For panels: the middle area must stay flat, calm and evenly lit (no knots, no scratches, no strong grain, no highlights) so that white or cream text stays readable on it. Wear, screws, rivets and brackets only on the outer rim. Borders the same thickness on all four sides so the panel can be 9-sliced.

--- 1/8: hud-plate.png ---
A long, low header plate that runs across the top of the game screen: dark walnut face set in a slim blackened-steel frame, a hairline brass inner line, and one small brass rivet in each corner. Very subtle warm highlight on the upper edge only. The face is one quiet dark wood surface (the game puts the title, score slots and total score on it).
Canvas 2048x192 px, object about 1984x144 px. Frame about 20 px thick on every side (it will be 9-sliced and stretched horizontally).
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/hud-plate.png

--- 2/8: score-slot.png ---
A small recessed slot that holds one throw's score on the header plate: a dark, matte, slightly sunken blackened-steel well with a thin brushed-brass lip around it. Looks like a slot milled into the plate. Blank flat inside.
Canvas 512x192 px, object about 448x144 px. Lip about 14 px on every side (9-sliced; it is shown from 44x38 to 160x38 px).
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/score-slot.png

--- 3/8: chalk-window.png ---
A framed chalkboard panel used for the throw result, the end-of-game summary and the companion's comment: dark green-black slate face with very faint chalk dust near the rim only, a dark walnut frame, and small blackened-steel corner brackets with brass screws. The slate face is calm, flat and evenly lit.
Canvas 1536x1024 px, object about 1440x928 px. Frame about 72 px thick on every side (it will be 9-sliced; shown from 278x164 to 594x335 px).
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/chalk-window.png

--- 4/8: rank-medallion.png ---
A round plate for the end-of-game rank: a pale pine wood disc with a dark scorched ring burned into it (like the area around a hot-iron brand), a thin brushed-brass bezel, and a calm, flat, lighter centre where the game draws the rank letter (S, A, B...). No letter, no stars, no laurel.
Canvas 768x768 px, object about 704x704 px. Perfectly round.
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/rank-medallion.png

--- 5/8: banner-orange.png ---
A wide painted steel sign banner with swallowtail (V-cut) ends on both sides, like a lane sign hung for a big moment: safety-orange enamel face, a slim black steel rim, two small rivets near each end. Blank flat middle (the game writes LAST THROW / SWITCH / SUDDEN DEATH on it).
Canvas 1536x384 px, object about 1440x288 px. Left-right symmetric.
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/banner-orange.png

--- 6/8: banner-green.png ---
The SAME banner as 5/8 (same size, same shape, same rim and rivets, pixel-aligned if possible), repainted in a fresh green enamel (#3f9a5a to #b8e5aa family) for "CHALLENGE CLEAR". Attach 5/8 as the shape reference.
Canvas 1536x384 px, object about 1440x288 px.
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/banner-green.png

--- 7/8: wood-chips.png ---
A sprite sheet of 8 small wood splinters and chips that fly off the target board when the axe bites in: pale pine (same wood as the target board), torn fibres, a few with a darker cut face. Each chip different in shape and size (thin long splinter, short wedge, curled shaving, tiny flake...). Each chip alone, centred in its own cell, not touching the cell edges.
Canvas 1024x512 px: a 4x2 grid of 256x256 cells, one chip per cell, each chip about 80 to 200 px long.
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/wood-chips.png

--- 8/8: cut-mark.png ---
A fresh vertical axe cut in a pale pine board, seen straight on: a thin, dark, slightly open vertical slit with torn fibres on both lips and a little lighter raw wood around it, fading to fully transparent at the edges so it blends into the existing target board. Only the cut; no axe, no board edge.
Canvas 256x512 px, object about 160x420 px, the slit vertical and centred.
Save as: asset_sources/ui/axe-quality-ui-20261111/raw/cut-mark.png
```

## 寸法・SHA-256・検品

| 原画 | 寸法 | SHA-256 | 検品 |
|---|---:|---|---|
| `hud-plate.png` | 2048×192 RGBA | `8d4bbef362e62ebbd9043e4254452af6cf24efa434fd433d71e50237a1e4daa8` | 透過・無文字・正面・余白を目視確認 |
| `score-slot.png` | 512×192 RGBA | `01b2293291f91210fbd515d189ea82db471270ab8596f8f0fb0999a5f070f2e2` | 透過・無文字・正面・余白を目視確認 |
| `chalk-window.png` | 1536×1024 RGBA | `1a6ebcacf142601cf855d77c1070f5f7b05d5b2c033ac7a38ee6308edff7b313` | 透過・無文字・正面・余白を目視確認 |
| `rank-medallion.png` | 768×768 RGBA | `f8bd98d2df17c0c88088531084b85790b740b8fd98045a920bbcb3250e15cda9` | 透過・無文字・正面・余白を目視確認 |
| `banner-orange.png` | 1536×384 RGBA | `8632e753125752cb6ee09903bd4d0ad5ef7d52f6f92ad9af6ce10ec2dfe84f9f` | 透過・無文字・正面・余白を目視確認 |
| `banner-green.png` | 1536×384 RGBA | `8eefb757c5603d112a5d4b68aacae695aa284927c4e958fb87b9196763a64fa1` | 透過・無文字・正面・余白を目視確認、橙帯と alpha マスク一致 |
| `wood-chips.png` | 1024×512 RGBA | `26b083af9e6fa8ac8b359945dd25cb6e4df4450b0188c366266fbe993957cc3b` | 4×2・各マス内の分離と余白を確認 |
| `cut-mark.png` | 256×512 RGBA | `07c216ea1857bff5623cb2e7f840c9800ec62bfa69b9588d8d1a1a6839fca736` | 2026-11-14 に言い回しを変えて再挑戦し生成成功（下記）。生成そのままは `cut-mark-source.png`（1086×1448）。後処理で裂け目を中心に切り出し、楕円フェードで周囲を板に馴染ませた。実物の的ボードへ合成して目視確認 |

## 未解決

- （2026-11-14 解消）`cut-mark.png` は初回3回とも安全判定で拒否されたが、オーナー判断で「斧・武器の語を外し、松板の縦の割れ目という素材表現に言い換える」方針で Codex C が1回で生成成功。OpenAI API 経路は同日クレジット枯渇で使用不可だった。
- ゲームへの組み込み（刺さった跡の表示へ）と配信用 WebP（`remake/img/ui/axe_throw/cut-mark.webp` 128×256）は 2026-11-14 に実施。
