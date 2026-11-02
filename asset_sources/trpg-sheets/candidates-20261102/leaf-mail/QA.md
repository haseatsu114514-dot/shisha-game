# 03 Leaf Mail — candidate QA (2026-11-02)

**Preferred: C, pending owner selection and production-size decision. No adoption or installation.**

Canon: main `asset_sources/trpg-scenarios/README.md`, blob `b6c51024d50634b9922bb18fd45e7d59871a20b2`. Top row consists of four 18–24-year-old androgynous night-watch looks. Bottom row explicitly consists of fictional roles created by companions for this story: Yura, Neri, Leon, Gran. They are NOT the real-world players and do not inherit their standing-art identities. No image references used; text canon only.

All three: exactly 8 human faces in 4×2, correct order, genuine RGBA transparency, muted fine storybook ink/watercolor, consistent costumes, no text/logos/frames/scenery/shisha/extra faces. Native size is **1774×887**, not requested 2048×1024. No resampling, crop, recolor or alpha cleanup performed.

- A: detailed and readable. Top portraits touch row boundary; Neri axe reaches cell edge. Reject for extraction safety.
- B: better separation, yet top-row bottom margins only 1–5px (alpha>32), extras ladder/axe/bell are canonical-role-compatible but too busy. Not preferred.
- C: restrained compact busts. Clear role styling; lantern, star scarf/gloves, moon hat, glasses/satchel; Yura work outfit, Neri cat charm, loud Leon, astronomer Gran. Neri strong forearms not fully visible in shoulders-up composition, acceptable role tradeoff. Entire silhouettes separated, minimum alpha>32 gutter to own cell edge 34px. Recommend C for selection, not certify as production-size compliant.

Full prompts and SHA-256 are adjacent. `generation.json` margin field uses [left, top, right, bottom] order; all values native pixels with alpha threshold 32. No scenario JSON or gameplay files changed.
