# B5 bg_ryuji_shop.png 原画台帳

- 原画: `original.png`（無加工、1672×941、SHA-256 `e98da8e5af35deb1187f2531e1e45e96f2e2a017ddf7f3f6ba38a085d7885679`）
- accepted: 未採用（オーナー判断待ち、寸法1672×941）
- 検品: 2回目を保存。初回は暖簾と商品に文字状の模様が出て不合格。2回目は人物・文字なし。台は小上がりの卓に1台、ボウル・HMD・炭・ホースなし。§4.4の構造・縮尺を目視確認。表の煙草屋として作成。事務所との位置付けはオーナー判断待ち。
- 生成経路: Codex 内蔵画像生成

## 参照画像と役割

- `assets/backgrounds/bg_ryuji_shop.png（同じ場所・構図の正本）`
- `assets/backgrounds/bg_eden_shop.png（画風）`
- `haseatsu114514-dot/siryou/shisha-hardware-reference/web-refs/images/stand-russian-01.jpg（日本の店向け台の写真。構造と縮尺だけ）`

## 生成前の8行

```text
人物      : なし
場面      : 準備中（ボウル未装着）。奥の小上がりの卓に置いた展示の台
台の型    : 日本の店の業務用。細いステンレスのステム＋幅の広い透明ガラスのベース、小さめの金属の受け皿。握りに木のパーツ
HMD       : なし（ボウル未装着）
炭        : なし
ホース    : 付けない（片付けてある）
吸い口    : なし
構図      : 店の表（煙草のガラスケース）から奥の小上がりを見る、今の絵と同じ構図。台は画面右寄りの中景、低い卓の上で受け皿とステム全体が見える。人物なし・昼の外光
```

## 依頼文（Issue #3282 原文）

```text
Anime visual novel background, detailed digital painting, warm lighting, no people, 16:9, painterly brushwork. Interior of "Kanzaki Tobacco", an old Japanese tobacco shop that quietly serves shisha in the back, in the same composition and furniture layout as the attached bg_ryuji_shop.png but painted fresh and clean (do not copy its coarse grainy texture). Front area: an aged wooden counter and glass display cases with rows of cigars and pipe-tobacco tins (plain, no labels with writing), faded wooden shelves with lidded ceramic jars, a short noren curtain at the entrance on the left with soft daylight from the street. In the back, a small raised tatami nook with flat cushions and one low table, a hanging round paper lantern, a muted woven wall hanging. On that low table stands ONE display hookah that is not set up yet: its stem ends in a small convex metal post, with NO bowl, NO heat management device, NO charcoal and NO hose. Shisha flavor tobacco is kept out of sight in closed cabinets, never on open shelves. Dust motes in a shaft of warm light. Dead quiet, spotless, slightly intimidating dignity. Aged wood browns with deep green and gold accents. Keep the center foreground open for a character overlay.
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
This scene is the "bowl not mounted" case: the top of the stem is a small convex metal post; draw no bowl, no HMD, no coals, no hose and no smoke.
No people, no text, no labels with writing, no signboards, no logos, no numbers, no watermark. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

## 再生成時の補足

商品・暖簾・容器は文字・疑似文字・書道風の線を一切描かず、無地または文字のない幾何模様にする。
