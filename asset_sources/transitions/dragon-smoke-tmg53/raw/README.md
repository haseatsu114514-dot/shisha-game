# 龍の煙（TMG53）原画

- 生成ツール: Codex 内蔵 imagegen。Issue #3413 の英文プロンプトを改変せず、同じ入力で3回生成。第3候補を採用候補として保存。
- 原画: `dragon-smoke.png`（生成出力の PNG を無加工コピー、1672×941、RGB・不透明、16:9）
- SHA-256: `55ffba941d7f19a754702f61c116516dc854672b7300b28bf70d0035d3b06ba4`
- 生成前の 307,200B コピーと SHA-256 照合: 成功（前 run および watchdog による再確認）。

## 参照画像と役割

1. `assets/sprites/characters/master_hookah/chr_master_hookah_normal.png` — 王煙楼の顔・白い三つ編み・ひげ・衣装の正本。添付。
2. `remake/img/backgrounds/bg_dubai_grand_smoke_stage.webp` — GRAND SMOKE 会場の建物、4つのカウンター、金色の照明と色。中の小さな台は手本にしない。添付。
3. `assets/ui/title_arts/title_art_keyvisual_01.png` — ピクセルペインター風の質感だけ。人物・構図・台は写さない。添付。
4. siryou `shisha-hardware-reference/web-refs/images/` の日本の店の台の全体写真 — この環境に存在せず、添付できなかった。Issue 本文の「生成前に決める8行」と `docs/shisha_reference.md` §4 の構造・縮尺指定で代替。早見表・構造図は添付していない。

## 原寸検品

- [x] 王煙楼の顔、白い三つ編み、白いひげ、深紅の上着が立ち絵と概ね一致。
- [x] 顔・右手・龍の頭は下35%に入らず、下25%は客席のシルエット中心。
- [x] 龍は口元から続く煙の形。うろこ・爪・目・歯・炎・色付きの光・きらめき・オーラは見られない。
- [x] 煙の発生は口元だけ。HMD・ホースからの発煙は見られない。
- [x] 台は1台。ベース→ステム→受け皿→ハガル→HMD→炭の順で、炭はHMD内に2個。直炭は見られない。
- [ ] **縮尺 NG**: ハガル＋HMD＋炭の高さは画像上の概算で約58〜64px、台全体は約275px、比率約0.21〜0.23。Issue 指定0.12〜0.20を超える。顔の高さ約120pxとの比率約0.48〜0.53は0.6以下。HMDの直径もハガルの口より少し大きく見える。
- [ ] **ホース要確認**: 右手ハンドルから下がる部分と側面ポートから下がる部分が台の下部付近で重なり、原寸でも1本の連続を両方向に確証できない。腰の組紐は台につながらない。
- [x] 4つのカウンターが描かれ、ほかの3つは空。はじめ・ヒロイン・ほかの名前のある人物はいない。奥の王者の席は画面内で明瞭に確認できない。
- [x] 文字・ロゴ・数字・UI・透かし・枠なし。

3回とも全項目を満たさなかったため、最も条件に近い第3候補を保存した。第1・第2候補はいずれもカウンターが3台に見え、台上部の縮尺も指定超過。採否は Claude とオーナーが判断する。

## Git LFS 送信

`git lfs ls-files` は既知の `too many open files` で失敗。ステージ済みPNGがLFSポインタであることと SHA-256 を確認し、`git lfs push --object-id origin 55ffba941d7f19a754702f61c116516dc854672b7300b28bf70d0035d3b06ba4` で実体1件（2.7MB）を先行送信。`tools/check_git_safety.sh` を手動で通してから、LFS一括走査を避けるためブランチを `git push --no-verify` で送信する。

## 実際に送ったプロンプト（全文・3回共通）

```text
Use case: compositing. Create one finished visual novel event CG for 水煙前線 -EN:CODE-. Opaque landscape 16:9, at least 1672x941 (larger is better), warm cinematic 2D anime illustration with fine pixel-painter shading.
Image 1 is THE canonical Wang Yanlou: preserve his face, long white single braid, long white beard tied at the end, thick sharp white eyebrows, tanned wrinkled skin, deep crimson high-collared martial-arts long jacket with black frog-knot buttons and dark-gold smoke-swirl embroidery, short crimson half-cape, wide black sash. Image 2 is the venue, the GRAND SMOKE competition stage in Dubai at night: copy its architecture, the four counter stations, the gold spotlights and the palette, but not its small hookahs. Image 3 is only the pixel-painter texture: never copy its character, composition or hookah. Image 4 is a photo of a Japanese shisha bar hookah: look at it only for the overall shape and the proportions of the whole rig, not for its size in the photo, its colours or its room.
Scene: the eve-of-tournament party on the GRAND SMOKE stage. The hall has gone completely silent. View from the middle of the audience seats, looking slightly up at the stage; first-person, Hajime is not shown. Wang Yanlou stands alone behind the centre station counter, seen from the waist up, slightly left of centre, his face in the top 40% of the image. He is calm and focused, eyes half-closed, lips just parted, finishing one long slow exhale. Exactly one completed hookah stands on his counter right beside him, at the same depth as him, with its ash tray and upper stem in view. He holds its rigid hose handle in his right hand at chest height. The other three station counters are dark and empty, and the champion's raised seat at the back of the stage is empty.
The dragon: from his mouth a single stream of thick, milky-white shisha smoke rises and grows into the shape of a long Eastern dragon made only of smoke. It climbs above the stage, turns in one large S-curve across the upper half of the image, and stretches its head out over the audience toward the viewer, in the upper right. The head is only suggested by rolling smoke curls: a long snout, two swept-back horn-like wisps and trailing whisker-like wisps; no eyes, no teeth. The body is soft, billowing, layered vapour, denser near the head and thinning into translucent wisps, so the stage lights show through it. The gold spotlights from above catch its upper edges in warm gold; its underside is in soft shadow. Thin veils of smoke drift down over the front rows. It must read as real smoke first and a dragon second: no scales, no claws, no glowing eyes, no fire, no magic aura, no coloured glow, no sparkles, never a solid creature. The smoke comes only from his mouth, never from the hookah's HMD or hose.
Audience: in the game a dialogue box covers the bottom 25% of the image, so keep that area simple: the dark backs of the front seats and the silhouetted heads and shoulders of a few audience members looking up, no faces. Do not put Wang's face, his hand or the dragon's head in the bottom 35%.
No text, letters, logos, numbers, UI, watermarks or borders. Do not draw Hajime, the heroines or any other named character.
The hookah of this scene: one competition rig matching the stage stations: a slim stainless-steel stem, a wide clear glass base with water only in its lower part, a small ash tray, a low wide-mouthed ceramic bowl with a Turkish-lid HMD (a low metal lid sitting over the bowl mouth, with one small handle), and two fingertip-sized grey coals inside the HMD. One hose from the side port of the stem, sagging in front of the counter, to the rigid handle in his right hand. The braided crimson cord around his sash with the small brass ornament at his hip is part of his costume: a closed belt cord that never connects to the hookah and is not a second hose. For this scene the room is the competition stage from Image 2, not a shisha bar; the hookah itself follows the Japanese-bar shapes in the rule below.
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
```
