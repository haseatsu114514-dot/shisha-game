# 葉として読める赤いフレーバー（TH78）

生成: Codex image generation / 2026-10-10。発光が強かったTH67の赤い葉を、自然な輪郭・葉脈・短い葉柄のある葉へ再制作した。原画への色補正はしていない。

参照1: 前の赤い葉 `assets/ui/making/ui_mockup_flavor_leaf.png`（Git `9f3d6a1`）。参照2: オーナーの赤いシーシャ葉の写真 `1-写真1.jpg`（SHA256 `c4ddf719279e25422638195e20cb0f6cd0f12b794f52ff0205a123e103f9a432`）。写真は葉色だけの参照。刻んだ葉の形、ボウル、機材、果物、背景は取り込んでいない。

生成原画: `/workspace/generated_images/exec-8174a2e0-6933-4f93-ae56-de8b4bc29a68.png`。
採用原画: `assets/ui/making/ui_mockup_flavor_leaf.png`。表示用: `remake/img/ui/making/ui_mockup_flavor_leaf.webp`。透過を保った既存エンコーダーでWebPへ変換。

実画面は5枚から開始。使用中の1枚だけを表示時のフィルターで茶色→黒へ変え、次に消す。予備の赤い葉にフィルターは掛けない。最後の赤が茶色になって赤い葉が0枚になった時点で失敗。現在の採用はこの素材で、[前の発光する赤い葉](red-leaf-prompt.md)は制作履歴。

実行プロンプト:

> Redesign ONLY the isolated red leaf UI icon in reference image 1 so that it is unmistakably a NATURAL LEAF when displayed at 34 pixels. Keep its compact pointed oval silhouette and bottom-left to top-right diagonal orientation, but add a short gently curved leaf stem at the lower-left base and clearly readable organic branching veins. Rich natural crimson/red tobacco color from reference image 2; reference 2 is for leaf COLOR ONLY, never its shredded shape, bowl, hardware, berries or background. A matte, softly dimensional painterly leaf, subtly irregular natural edges, red central vein and 3 restrained paired side veins, crimson body with darker burgundy shading and modest warm red highlights. Remove ALL neon rim glow, white-hot veins, fire/ember appearance, glassy or gemstone appearance. It must look like a red botanical leaf, not a flame, jewel, chili pepper or glowing feather. Strong readable leaf shape, calm elegant game UI art on a completely transparent background, good contrast on a dark plum panel. No text, panel, extra objects, or background. One leaf only, with the stem visible. Preserve alpha.
