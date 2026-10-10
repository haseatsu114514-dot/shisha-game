# フレーバーの持ちの葉（TH64）

初回の緑の葉の制作記録。現在はTH67・68の指示で赤へ変更し、消耗は黒い焦げで示す。[赤い葉への編集記録](red-leaf-prompt.md)。

生成: Codex image generation / 2026-10-10。参照: [オーナー提示モックアップのゲーム部分](reference-game.png)。
採用PNG: `assets/ui/making/ui_mockup_flavor_leaf.png`。表示用: `remake/img/ui/making/ui_mockup_flavor_leaf.webp`。
透過の葉を4枠へ繰り返し表示する。残量は既存のフレーバーHP（最大4）を使い、消耗した枠は暗くする。
原画へ後から彩度・明度の加工は加えていない。WebPは既存の `build_images.encode`、余白は `build_manifest.making_boxes` で処理する。

実行プロンプト:

> Create one standalone UI icon extracted stylistically from the four luminous green leaves in the flavor-life bar of this Japanese shisha game mockup. ONLY ONE leaf, no panel, no text, no letters, no other object, completely transparent background. A delicate fresh mint-green pointed oval leaf leaning diagonally from lower left to upper right at about 45 degrees. Compact soft leaf shape, one slightly curved fine ivory central vein and very subtle 2-3 side veins. Pale luminous ivory mint highlight in the center, medium jade edges, gentle yellow-green translucency. Smooth painterly natural surface, softly dimensional, elegant and jewel-like but NOT a gemstone, fine organic texture, subtle tight green glow within a few pixels of its silhouette. Not cartoon vector, not a flat neon green silhouette, not plastic, not lots of noisy veins. It will be used as a small readable 32px life icon and should match the reference exactly in feeling and brightness. Fill about 75 percent of a square canvas, avoid excessive transparent margins. One isolated leaf only. It is a UI part, no background image.
