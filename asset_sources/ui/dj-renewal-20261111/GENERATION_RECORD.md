# DJ フロア観客原画の生成記録（Issue #3224）

## 生成条件
- 生成: Codex 組み込み imagegen。画像生成 API／CLI は使用していない。
- 依頼文: 2026-11-11 に `gh issue view 3224` で読んだ Issue 本文のコードブロックをそのまま共通文＋各枚の Mood として使用。main に `CODEX_PROMPTS.md` と `README.md` がなかったため Issue 本文を正本とした。
- 添付画像の役割ラベルを生成文の前置きに明記した。`bg_club_seam.png` は店と画風の固定基準。`crowd-b.png` は光と人数のみの参考で、ヤシ・ランタン・アーチ・中東風装飾を模倣しない。2枚目以降は `floor-3.png` を人物、服、髪、位置、カメラ、構図の固定基準に追加。
- 順番: `floor-3.png` → `floor-4.png` → `floor-2.png` → `floor-1.png`。`floor-4.png` は手の高さを下げるため、最初の出力、`floor-3.png`、店の背景を参照して1回だけ修正した。
- 4枚とも生成ツールからの PNG を無加工で `raw/` にコピーした。各画像は 2172×724 ピクセル。

## 目視検査
- 同じコンクリートの地下クラブ、同じ前列8人、髪・服・横並びの配置を確認。背景にはトラス、ダクト、片側のバー棚がある。
- 冷えた状態には腕組み、スマホ3人、あくび1人、奥の退場客と隙間がある。様子見には静止とドリンク、踊る状態には笑顔と片手、最高潮には両手と歓声がある。`floor-4` と `floor-1` の差は明瞭。
- 文字、ロゴ、吹き出し、音符、紙吹雪、DJ機材、前景の手や人影、ヤシ、ランタン、アーチは目視では見当たらない。
- **未達**: `floor-3` の片手と `floor-4` の一部の指先は、高さ40%より上にある。`floor-4` は修正で上端寄りの手を下げたが、全ては40%〜85%に収まっていない。上30%にも照明光が入る。採用時はこの点を確認すること。

## 原画の SHA-256
- `raw/floor-1.png`: `fbc63b285cac7f647cd907be74f4afd9c04cd32b75c560ac315c0698bd501c9d`
- `raw/floor-2.png`: `3ef8ef0fdabe6317ad3f0fd914f457593d6237bad616f25fbc9b15f9df1bcf3b`
- `raw/floor-3.png`: `031e9a9e4f4197101c4a481280974504af0417a81212401ac74dd5aefbe6229b`
- `raw/floor-4.png`: `4a8da1e06f8e6a03efdfe340e8a93752a565f4ad1e33ee2d7bb96aa20943eaa0`

## 使用した依頼文

前置きの役割ラベルは上記。下記コードブロックの共通文と対象 Mood を組み合わせた。`floor-4` の修正時だけ、手と指先を上端から290ピクセルより下へ収める追加指示を前置きした。

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
