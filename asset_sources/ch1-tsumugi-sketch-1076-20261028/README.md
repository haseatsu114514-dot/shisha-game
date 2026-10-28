# cg_ch1_tsumugi_sketch_wip（#1076 DAY3 下描き素材, #896 台帳）

- 用途：第1章 DAY3 `ch1_tsumugi_work_in_progress` でつむぎが見せる「描きかけの下描き」。DAY1 research の「LIMEで届く下描き」にも流用可。
- **v3（2026-10-28 14:1x JST、現行・Codex版）**：オーナー指摘「つむぎの下書きは実際にゲームで使われてる背景と矛盾でてきそうなので、つむぎなりのアートな世界観の抽象的な絵がいい」により作り直し。オーナー規則（13:49 JST）「画像素材は既存の絵柄に合わせるため Codex で生成が既定」に従い、本編素材は Codex 版。
  - 内容：葉の耳と煙の尾を持つ猫（つむぎの設定モチーフ：植物×動物×煙）。猫の顔・葉の耳・肩・尾の付け根だけ着色、ラベンダー〜薄紫の煙が蔓と葉にほどけ、下半分と右側は鉛筆の探り線だけで未着色。店内・カウンター・窓・人物・手・文字なし。
  - 焦点化の目安（1920×1080基準・実画像で確認すること）：(a) 葉の耳の猫の顔（おおよそ x 300–800, y 60–560）、(b) 未着色の下〜右側の線（x 800–1850, y 450–1060）。
  - 生成：Codex（slot-c2、gpt-6.1-sol、imagegen、既存CG `cg_ch1_tsumugi_heart_art.png`・その画面内の絵の拡大・`cg_tsumugi_smoke_color.png` を絵柄参照）。原画 1672×941 `v3-codex/cg_ch1_tsumugi_sketch_wip_codex.png`、プロンプト全文 `v3-codex/prompt.txt`。LANCZOS で 1920×1080 にして `assets/cgs/cg_ch1_tsumugi_sketch_wip.png`、`remake/img/cgs/*.webp` は build_images.py と同じ規則（lossless と q90 の小さい方）。
- **比較用（v3・GenerateImage版、本編未使用）**：同じ指示を Grok Bot の画像生成で作ったもの。原寸 1280×720 `v3-grok/cg_ch1_tsumugi_sketch_wip_grok_raw_1280x720.jpg`（commit 113281cf では一時的に本編素材だった）。オーナーがこちらを選んだ場合は差し替える。
- 旧版：v1（10:4x JST、はじめの胴がカウンターに沈み込む）、v2（11:5x JST、カウンター奥のはじめ）。どちらも店内を描いていたため v3 で置き換え。
- 制作許可：オーナー 2026-10-28 10:32 JST「1076は生成して」、13:30 JST の v3 指示。採用の最終判断は実表示確認後。
- 注意：ギャラリーの収集スチルには出さない。

## プロンプト（要約、v3 比較用 GenerateImage版）
Full-frame open sketchbook page filling the image (no table, room or scenery), textured watercolor paper. Unfinished abstract drawing by a quiet art student: a cat whose ears are leaves and whose tail dissolves into curling smoke, merging with smoke/steam ribbons that bloom into plant tendrils and leaves; synesthetic translucent watercolor in lavender, pale violet, muted teal, faint peach; graphite construction lines, charcoal smudges, hatching; right third only light pencil outlines, blank areas, erased ghost lines, colour swatches and thumbnail doodles in the margin, a pencil at the lower edge. No people, hands, text, signature, buildings, interior or furniture.
