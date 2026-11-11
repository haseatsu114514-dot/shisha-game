# Codex への依頼文: DJ のフロアの観客 4枚（盛り上がり4段階・DJS25）

DJ ミニゲームのリニューアル（2026-11-11・DJS20〜）で、お客さんの反応を絵で見せるための4枚。いまは、ブースから見た空の店内（`bg-purple.webp`）の手前に、以前の候補 a 案（`crowd-a.png`）の中央の観客を切り出して重ね、明るさで4段階に描き分けている（DJS28）。客は影絵で、表情としぐさ（腕を組む・スマホを見る・笑う）は出ないので、下の文をそのまま Codex へ渡す。

- 添付する画像（2枚）: `assets/backgrounds/bg_club_seam.png`（同じ店・画風の基準）、`asset_sources/ui/dj-floor-crowd-20261102/crowd-b.png`（光と人の量の参考。ヤシ・ランタン・アーチは真似しない）。
- 3 を先に作り、1・2・4 は 3 の出力を添付に足して「同じ店・同じ人たち・同じ構図」で描き分ける。
- 受け取ったら: 原画を `asset_sources/ui/dj-renewal-20261111/raw/` に置き、同じフォルダの README の「4枚が届いたら」の手順で組み込む（観客の帯を切り出して `floor-pov-1`〜`4.webp` を置き換える）。

```text
【共通（4枚とも同じ）】
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines. No text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area.
The people are drawn as Japanese 2D visual-novel game art in the same world: confident dark outlines, flat local colors with two to three clearly shaped cel-shadow steps, natural faces with different ages and builds (no identical "AI pretty faces"), no skin gloss, no photographic texture.

Place: the small underground club "SEAM" in a Tokyo back alley, the SAME room as the attached bg_club_seam.png: raw concrete walls and square pillars, exposed pipes and ducts on a low ceiling, a black lighting truss with moving-head lights, a bar with warm amber bottle shelves on one side. Lighting colours are violet (#b45cf0) and cyan (#3fd0e8) with light haze. It is a small room for about 30 people. NOT a festival, NOT a big hall. No palm trees, no lanterns, no arches, no Middle Eastern decoration.

Camera: the DJ's own point of view from behind the booth, standing eye level, looking straight out over the dance floor. The guests FACE THE CAMERA. Do not draw the DJ, DJ equipment, turntables, hands or a booth in the foreground.

Composition: a very wide strip, 3:1. Output 2172x724 or larger. The picture is shown as a wide band and its top and bottom are cropped, so:
- every face, shoulder and raised hand sits between 40% and 85% of the image height;
- the top 30% is only the dark ceiling with the truss and lights;
- the bottom 10% is a plain dark shadow with nothing important in it;
- the guests are spread evenly from the left edge to the right edge (both ends may be cropped a little).
About 28 guests: a front row of 8 young Japanese adults in their 20s and 30s (mixed men and women, casual street clothes, natural black or brown hair, one or two dyed) whose faces and upper bodies are clearly lit and readable; two looser rows behind them in softer light; dark silhouettes at the back near the far wall. Each front-row guest has a clearly readable expression and pose, because the picture's job is to show how the room feels.

Do not bake in: any text, letters, digits, logos, gauges, speech bubbles, musical notes, confetti, UI or watermark.

--- 1/4: floor-3.png （踊っている・最初に作る） ---
Mood: the floor is warm and dancing. The guests move to the beat with relaxed shoulders and open smiles, a few have one hand raised, one has her eyes closed enjoying the music, two are laughing to each other. Violet and cyan beams sweep through the haze. Lively, but not wild yet.

--- 2/4: floor-4.png （最高潮。floor-3.png を添付に足す） ---
Use the attached floor-3.png as the exact reference: the SAME room, the same camera, the same composition, the same guests in the same places with the same clothes and hair. Change only the mood.
Mood: the PEAK of the night. Everyone is jumping with BOTH HANDS UP, cheering with open mouths and big joyful smiles, some pointing at the DJ, hair and clothes in motion. The lights are at their brightest: strong violet, cyan and hot pink beams, white flashes, rim light on the raised hands, thicker glowing haze. Raised hands stay inside the 40%-85% band.

--- 3/4: floor-2.png （様子見。floor-3.png を添付に足す） ---
Use the attached floor-3.png as the exact reference: the SAME room, the same camera, the same composition, the same guests in the same places with the same clothes and hair. Change only the mood.
Mood: the guests are only WATCHING and waiting. Everyone stands still with arms down or a drink in one hand, heads slightly tilted, neutral curious faces looking at the DJ, one or two nodding faintly. Nobody dances, no hands are raised. The lights are calmer and dimmer: a soft steady violet wash, few beams, little haze.

--- 4/4: floor-1.png （冷えている。floor-3.png を添付に足す） ---
Use the attached floor-3.png as the exact reference: the SAME room, the same camera, the same composition, the same guests with the same clothes and hair. Change only the mood, and let a few guests at the back leave.
Mood: the floor has gone COLD. The guests are bored: arms crossed, frowning or blank faces, three looking down at their phones (the screens light their faces), one yawning, two turned sideways talking to each other, and a few at the back walking away toward the exit so there are visible gaps in the crowd. Nobody dances, no hands are raised. The lights are low and dull: a dim bluish-grey wash, almost no beams. The room feels flat, but faces and clothes are still readable (not a black picture).

【生成後チェック（人が見る）】
- 4枚とも同じ店・同じ構図・同じ人たちに見える（切り替えたときに別の店へ飛ばない）
- 顔と上げた手が、画像の高さ 40%〜85% に入っている
- 文字・ロゴ・吹き出し・音符・紙吹雪・DJ機材・手前の人影が無い
- ヤシ・ランタン・アーチが無い（地下のコンクリートの店）
- 4（最高潮）と 1（冷えている）を並べて、ひと目で差が分かる
```
