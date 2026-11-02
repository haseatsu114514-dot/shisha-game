# 新フレーバー7種の箱絵（NF04）

2026-11-02 に追加した7種（`data/flavors.json`）の商品箱。各メーカーの既存の箱に形・画風・ブランドマークを合わせる。実在の製品・ロゴ・包装は複製しない。

- 生成: Codex の画像生成（または OpenAI 画像API `gpt-image-2.5-sunburst` の images/edits）。2026-11-02 にAPIで生成しようとしたが、残高切れ（`credit_balance_exhausted`）で未生成。
- 添付する参照画像（メーカーごとに1枚）
  - アルファーヘブン: `remake/img/shop/heaven10/lemon.webp`
  - アフサール: `remake/img/shop/remaining8/lychee.webp`
  - ドバジ: `remake/img/shop/remaining8/mango.webp`
- 保存先: `asset_sources/new-flavor-cartons-nf04/<商品ID>.png`（正方形・透過PNG、1024px以上）。
- 受け取り後: 512×512 の透過WebPにして `remake/img/shop/new-flavors/<商品ID>.webp` へ置き、箱の見える範囲を測って店の画像表に登録する（`tools/build_limited_flavor_art.py` と同じ手順）。
- 生成後チェック: 箱が1つだけ・画像内に全体が収まる・背景が透過・文字や数字や実在ロゴが無い・同じメーカーの既存の箱と並べて違和感がない・果物や素材が商品名どおり（ライムが緑でレモンに見えない等）。

```text
Common rules for every image below:
Create ONE isolated upright rectangular shisha tobacco carton for a fictional game manufacturer.
Match the attached reference carton exactly in packaging design system: the same 3/4 perspective,
compact proportions, softly rendered matte paper, gentle studio light, emblem placement, layout and
illustration style. Truly transparent background, square canvas (1024x1024 or larger), the whole
carton fully inside the frame with generous margins, no cast shadow on the background.
No words, letters, numerals, readable labels or watermark. No people, no hookah, no other products.
This is an original fictional game asset, not a reproduction of a real product.

--- 1/7: asset_sources/new-flavor-cartons-nf04/grapefruit.png （添付: remake/img/shop/heaven10/lemon.webp） ---
Keep the BLACK carton and the same small white winged-halo emblem at the upper front exactly as in
the reference. Replace the yellow painterly brush-stroke band with a coral-pink and pale yellow
painterly brush stroke, and replace the lemons at the bottom with one whole pink grapefruit and one
halved grapefruit showing juicy ruby-pink segments, rendered in the same realistic painted style.

--- 2/7: asset_sources/new-flavor-cartons-nf04/lime.png （添付: remake/img/shop/heaven10/lemon.webp） ---
Keep the BLACK carton and the same small white winged-halo emblem at the upper front exactly as in
the reference. Replace the yellow painterly brush-stroke band with a vivid lime-green painterly brush
stroke, and replace the lemons at the bottom with one whole green lime and one halved lime showing
pale green juicy segments (clearly green limes, not lemons), rendered in the same realistic painted style.

--- 3/7: asset_sources/new-flavor-cartons-nf04/honey.png （添付: remake/img/shop/remaining8/lychee.webp） ---
Keep the pale matte paper carton style of the reference, the same small dark sunrise-over-water-lines
emblem on the upper front and on the right side, the diagonal ribbon across the front and the round
cream vignette. Change the carton color to warm pale amber cream, the diagonal ribbon to a golden
honey-colored ribbon, and the round vignette illustration to a wooden honey dipper dripping glossy
golden honey beside a small hexagonal honeycomb piece, drawn in the same clean geometric painted style
as the lychee.

--- 4/7: asset_sources/new-flavor-cartons-nf04/cherry.png （添付: remake/img/shop/remaining8/lychee.webp） ---
Keep the pale matte paper carton style of the reference, the same small dark sunrise-over-water-lines
emblem on the upper front and on the right side, the diagonal ribbon across the front and the round
cream vignette. Change the carton color to pale blush pink, the diagonal ribbon to a deep crimson
ribbon, and the round vignette illustration to a pair of glossy dark red cherries joined by their
stems with one green leaf, drawn in the same clean geometric painted style as the lychee.

--- 5/7: asset_sources/new-flavor-cartons-nf04/milk.png （添付: remake/img/shop/remaining8/mango.webp） ---
Keep the cream-white carton of the reference with the black vertical band on the left of the front and
the black right side panel, the same small white stylized emblem on both black areas, and the flowing
swoosh ribbon. Change the swoosh ribbon colors to soft milky white with a light sky-blue edge and
replace the mango illustration with a gentle splash of fresh white milk curling into a crown above a
small plain glass of milk (no label on the glass), drawn in the same flat illustrated style.

--- 6/7: asset_sources/new-flavor-cartons-nf04/passion_fruit.png （添付: remake/img/shop/remaining8/mango.webp） ---
Keep the cream-white carton of the reference with the black vertical band on the left of the front and
the black right side panel, the same small white stylized emblem on both black areas, and the flowing
swoosh ribbon. Change the swoosh ribbon colors to deep purple and sunny yellow and replace the mango
illustration with one whole wrinkled purple passion fruit and one halved passion fruit showing golden
yellow pulp with dark seeds, drawn in the same flat illustrated style.

--- 7/7: asset_sources/new-flavor-cartons-nf04/biscuit.png （添付: remake/img/shop/remaining8/mango.webp） ---
Keep the cream-white carton of the reference with the black vertical band on the left of the front and
the black right side panel, the same small white stylized emblem on both black areas, and the flowing
swoosh ribbon. Change the swoosh ribbon colors to golden toasted brown and butter yellow and replace
the mango illustration with two round golden butter biscuits with crimped edges, one overlapping the
other, with a few crumbs, drawn in the same flat illustrated style.
```
