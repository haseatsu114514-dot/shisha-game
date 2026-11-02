# クラブSEAM の背景（2026-11-02 採用）

Issue #2199 #5・#6。Codex（image_gen）の店内3案（`interior-{a,b,c}.png`）と入口3案（`entrance-{a,b,c}.png`）。各 1672×941 RGB の無加工原画。Codex の検品は `codex-QA.md`、指示文は `codex-prompts.json`、寸法は `codex-metadata.json`。

| 採用 | 配布 | 理由 |
|---|---|---|
| 店内 a | `assets/backgrounds/bg_club_seam.png`（SHA-256 先頭 5b6abcad5357b5a8） | ブースの上に2台のデッキとミキサー、左右のスピーカー、右に短いバー。指示どおりで、メニュー・会話の背景として中央が落ち着いている |
| 入口 a | `assets/backgrounds/bg_club_seam_entrance.png`（SHA-256 先頭 fe331738167af098） | 看板が横長の「二つの円を縫い目でつなぐ」印で店名の由来と合う。右の地下への階段と紫の光、濡れた路地 |

- 加工: 幅1280へ縮小（高さ720.6）し、上下を中央で720に切り出しただけ。WebPと目録は `python3 remake/tools/build_manifest.py --backgrounds-only bg_club_seam.png bg_club_seam_entrance.png`。
- 使う場所: `remake/js/daily/dj-club.js`（初回の階段の上は入口、名乗った後に「階段を下りると」で店内＝`data/dialogue/ch3_club.json` の bg 行、メニューとAランクの会話は店内）。
- 注意（Codex の検品より）: 店内の酒瓶のラベルやスピーカーに、非常に小さな文字風の描写がある。読める文字ではないので採用した。
