# 赤いフレーバーの葉（TH67・68）

これは初回の制作履歴。TH78で発光を抑え、葉脈・葉柄を読みやすくした[自然な赤い葉](natural-red-leaf-prompt.md)へ差し替えた。以下の残量4・全体の色変化は旧仕様で、現在はTH77〜82の5枚・1枚ずつの消耗を使う。

生成: Codex image generation / 2026-10-10。TH64で採用した緑の葉アイコンを編集した。
参照1は編集前の `assets/ui/making/ui_mockup_flavor_leaf.png`（Git `7c6c780`）。参照2はオーナー提示の赤いシーシャ葉の写真（`1-写真1.jpg`）。写真は葉色だけに使用し、機材・果物・背景・刻んだ葉の形は取り込んでいない。

原画: `/workspace/generated_images/exec-f95f3e7e-5806-488d-8da4-123f29f7e94f.png`。
採用原画: `assets/ui/making/ui_mockup_flavor_leaf.png`。表示用: `remake/img/ui/making/ui_mockup_flavor_leaf.webp`。
生成後の原画への色補正はなし。透過と形を維持して既存エンコーダーでWebPへ変換した。

残量4では生成した鮮やかな赤を表示する。残量3・2・1と焼けるにつれて表示時に彩度・明るさを下げ、残量0と消耗した枠は黒い焦げにする。薄く消したり穴を開けたりせず、焦げた葉の形を残す。実際のフレーバーHPと工程間の引継ぎは従来どおり。

実行プロンプト:

> Edit reference image 1 only: the isolated glowing leaf game UI icon. Preserve its exact single-leaf silhouette, diagonal bottom-left to top-right orientation, proportions, elegant central vein, painterly detail, and transparent background. Change ONLY its color palette to the rich saturated scarlet / deep crimson red of the shisha tobacco in reference image 2. Reference image 2 is for tobacco COLOR ONLY: do not copy its bowl, shisha hardware, fruit, setting, lighting composition, or shredded tobacco shape. The finished icon must still be the same beautiful single leaf as image 1, now red: vibrant vermilion/crimson body, burgundy shadows, restrained warm red glow and softly luminous pale-coral highlights along the vein and edges. Keep it legible and polished at 34px on a dark plum game UI. No green, no yellow-green, no text, no new objects. Alpha background, preserve transparency.
