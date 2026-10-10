# 吸うボタンの生成素材（TH58）

生成: Codex image generation / 2026-10-10。オーナー提示モックアップの下段ボタンを参照。
採用PNG: `assets/ui/making/ui_mockup_inhale_button.png`。表示用: `remake/img/ui/making/ui_mockup_inhale_button.webp`。
背景透過、文字・アイコンなし。透明な余白は既存の `makingBox` と `applyCraftSkin` の仕組みで吸収し、実ボタンに合わせる。

プロンプト:

> Create ONE standalone blank game UI button skin, faithfully recreating the large golden inhale button in the BOTTOM LEFT OF THE RIGHT WINDOW in the reference game screenshot. Re-create only that button frame and its dark interior as a clean reusable UI asset. DO NOT include the reference screenshot, character, background, ring gauge, text, symbols, chevrons, hand or mouthpiece icons. All words and icons will be rendered separately by the game. Very wide horizontal rounded rectangle with width-to-height ratio 5:1, delicately rounded corners (about 12% of height). Precisely match the reference's bright warm ivory-gold inner rim, thin layered bronze edge, subtle soft amber outer glow, elegant lacquered deep plum/brown interior with faint warm illumination at the top left. Full FRONT ON flat orthographic interface panel, absolutely no perspective, no 3D floating object, no handles, no ornaments, no decorative curl flourishes. An almost flat rectangular center with painterly fine film grain and a restrained soft sheen. Make it feel part of the reference's premium Japanese shisha lounge game, not a futuristic HUD. A truly EMPTY dark face. Place the single button across nearly the entire canvas width with only a small margin for its outer glow. Transparent background, preserve alpha outside the button, no checkerboard pixels baked into artwork. The button should be large and crisp enough for a 640 by 96 pixel in-game button and reusable scaling.

見出し用書体: [Zen Old Mincho](https://github.com/google/fonts/tree/main/ofl/zenoldmincho)。Google FontsのBoldを「吸い出し熱管理」の8字へサブセット化し、内部名をCraft Minchoに変更。SIL Open Font License 1.1を `remake/fonts/OFL-ZenOldMincho.txt` に同梱。再生成は `python3 remake/tools/build_craft_font.py`。本文と操作は既存のZen Kaku Gothic Newを使用。
