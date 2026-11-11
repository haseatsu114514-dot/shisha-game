# Codex への依頼文: DJ のフロア（DJブースから見た客席）— シルエットの観客4段階＋誰もいない店内（DJS25・DJS31）

DJ ミニゲームのリニューアル（2026-11-11・DJS20〜）で、**お客さんがこっち（DJ＝主人公）を向いて盛り上がってくれる**のを絵で見せるための5枚。

- オーナー「やはりお客さんがこっち向いて盛り上がってくれる感欲しいから画像生成いる」→ Codex が4枚を作った（PR #3233 の `raw/floor-1`〜`4.png`。こっちを向いた客の顔と服まで描いた絵）。
- それを見てオーナー「**お客さんはシルエットにしたい**」（2026-11-11）。顔や服の描き込みはやめ、逆光の影絵にする。**立ち位置・ポーズ・こっちを向いた体の向きは PR #3233 の4枚をそのまま使う**（4段階の差はポーズで十分に出ているので、作り直さずに影絵へ描き変える）。
- 画面では「奥の店内」と「手前の観客の帯」を重ね、観客の帯だけを拍に合わせて揺らす。そのため **誰もいない店内の1枚**も要る。
- 手の高さは直さなくてよい（ゲーム側で表示位置を合わせる）。
- OpenAI の画像 API はクレジット切れで使えない。下の文をそのまま Codex へ渡す。

## 渡すもの

| 作る絵 | 添付する画像 | 置き場所 |
|---|---|---|
| `floor-sil-3.png`（踊っている・最初に作る） | PR #3233 の `raw/floor-3.png`（ポーズと構図の元）、`assets/backgrounds/bg_club_seam.png`（店と画風の基準） | `asset_sources/ui/dj-renewal-20261111/raw/` |
| `floor-sil-4.png`（最高潮） | `raw/floor-4.png`（ポーズの元）、`floor-sil-3.png`（影絵の描き方の基準） | 同上 |
| `floor-sil-2.png`（様子見） | `raw/floor-2.png`、`floor-sil-3.png` | 同上 |
| `floor-sil-1.png`（冷えている） | `raw/floor-1.png`、`floor-sil-3.png` | 同上 |
| `floor-room.png`（誰もいない店内） | `floor-sil-3.png`（店・カメラ・照明の基準）、`bg_club_seam.png` | 同上 |

PR #3233 の `raw/floor-1`〜`4.png`（顔のある版）は消さずに残す（ポーズの元として記録）。受け取ったら同じフォルダの README の「5枚が届いたら」の手順で組み込む。

```text
【共通（5枚とも同じ）】
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines. No text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area.

Place: the small underground club "SEAM" in a Tokyo back alley (the attached bg_club_seam.png): raw concrete walls and square pillars, exposed pipes and ducts on a low ceiling, a black lighting truss with moving-head lights, a bar with warm amber bottle shelves on one side. Lighting colours are violet (#b45cf0) and cyan (#3fd0e8) with haze. NOT a festival, NOT a big hall. No palm trees, no lanterns, no arches, no curtains, no Middle Eastern decoration.

Camera: the DJ's own point of view from behind the booth, standing eye level, looking straight out over the dance floor. Do not draw the DJ, DJ equipment, turntables, hands or a booth in the foreground.

THE GUESTS ARE SILHOUETTES. Every guest is a dark, backlit silhouette: filled with deep shadow (very dark plum, around #0d0718 to #1a0f2a, never pure black), with no facial features, no eyes, no mouths, no skin colour, no clothing pattern or text. Their shapes stay clear and readable: hair outlines, heads, shoulders, arms, open hands and fists. A thin rim light from the stage lights runs along the outer edges of heads, shoulders and raised arms (violet and cyan; hot pink at the peak). The haze and lights behind them are bright enough that every silhouette separates cleanly from the people behind it; the back rows are slightly lighter and bluer silhouettes for depth. The guests FACE THE DJ (the viewer): shoulders square to the camera, arms reaching and pointing toward the viewer, nobody turned away unless the mood says so.

Composition: a very wide strip, 3:1, 2172x724 (or larger at 3:1). The top part is the ceiling with the truss and lights, the guests fill the middle and lower part, the bottom 10% is a plain dark floor in shadow. Keep the room identical in all five pictures (the same walls, pillars, truss and light positions in exactly the same places), so they can be layered and swapped without the room moving.

Do not bake in: any text, letters, digits, logos, gauges, speech bubbles, musical notes, confetti, UI or watermark.

--- 1/5: floor-sil-3.png （踊っている・最初に作る） ---
Use the attached floor-3.png as the exact source of the composition: the same room, the same camera, every guest in the same place with the same pose, outline and hair shape. Repaint ONLY the guests as silhouettes as described above, and keep the room and its lights as they are.
Mood: the floor is warm and dancing to the DJ: relaxed bodies on the beat, a few single hands raised toward the DJ. Violet and cyan beams sweep through the haze behind them.

--- 2/5: floor-sil-4.png （最高潮。floor-4.png と floor-sil-3.png を添付） ---
Use the attached floor-4.png as the exact source of the composition and poses, and the attached floor-sil-3.png as the exact reference for how the silhouettes are painted. Repaint ONLY the guests as silhouettes; keep the room and its lights.
Mood: the PEAK of the night, for the DJ: everyone jumps with BOTH HANDS UP toward the DJ, fists and open hands, some pointing straight at the DJ, hair in motion. The lights are at their brightest: strong violet, cyan and hot pink beams, white flashes and thick glowing haze behind the crowd, and a stronger rim light on every raised arm.

--- 3/5: floor-sil-2.png （様子見。floor-2.png と floor-sil-3.png を添付） ---
Use the attached floor-2.png as the exact source of the composition and poses, and the attached floor-sil-3.png as the exact reference for how the silhouettes are painted. Repaint ONLY the guests as silhouettes; keep the room and its lights.
Mood: the guests are WATCHING the DJ and waiting: standing still facing the DJ, arms down or holding a drink (the glass is part of the silhouette), heads slightly tilted. No hands raised. The lights are calmer: a soft steady violet wash, few beams, little haze, a softer rim light.

--- 4/5: floor-sil-1.png （冷えている。floor-1.png と floor-sil-3.png を添付） ---
Use the attached floor-1.png as the exact source of the composition and poses, and the attached floor-sil-3.png as the exact reference for how the silhouettes are painted. Repaint ONLY the guests as silhouettes; keep the room and its lights.
Mood: the floor has gone COLD on the DJ: crossed arms, slumped shoulders, heads down; the three guests looking at their phones keep a small glowing phone screen that lights the underside of their silhouette faces faintly (the only light on the front of the crowd); two turned sideways to each other; a few at the back walking away toward the exit with gaps in the crowd. No hands raised. The lights are low and dull: a dim bluish-grey wash, almost no beams, almost no rim light — but the silhouettes still separate from the background.

--- 5/5: floor-room.png （誰もいない店内。floor-sil-3.png を添付） ---
Use the attached floor-sil-3.png as the exact reference: the SAME room, the same camera, the same composition, with the walls, pillars, truss, lights and bar in exactly the same places and the same lighting. Remove every guest: the dance floor is completely EMPTY, no people and no silhouettes at all. Paint the floor where the guests stood as a plain concrete floor with soft light reflections and haze.

【生成後チェック（人が見る）】
- 1〜4 の客は全員シルエット（顔・目・口・肌の色・服の柄が無い）。ふちの光で形が読める
- 1〜4 の立ち位置とポーズが、PR #3233 の同じ番号の絵と同じ（両手を上げる・グラス・腕組み・スマホの光が残っている）
- みんなこっち（DJ）を向いている体の向き。冷えている絵だけ、横を向く人・帰る人がいる
- 5枚とも同じ店・同じ構図（重ねて切り替えたときに壁や照明が動かない）
- floor-room.png に人もシルエットも残っていない
- 文字・ロゴ・吹き出し・音符・紙吹雪・DJ機材・手前の人影が無い
- ヤシ・ランタン・アーチ・カーテンが無い
- 4（最高潮）と 1（冷えている）を並べて、ひと目で差が分かる
```
