# mukai の上の屋根裏（`bg_mukai_attic`）

第5章の東京滞在で泊まる屋根裏の背景（依頼: #2222 の追加コメント）。2026-11-02、Codex の画像生成で現行 `bg_mukai_shop.png` を参照して作った3案（オーナーがギガファイル便で受け渡し、PR #2265 のコメント）からC案を採用した。

- 原画: `bg_mukai_attic-C-raw.png`（1672×941 RGB、無加工、SHA-256 `471fbe00ef7468ea9104e6eb9e651ab39c616129df19e80e73ac04d25341e72a`）。プロンプト全文: `prompt-C.txt`。
- ゲーム用: `assets/backgrounds/bg_mukai_attic.png`（1280×720）。中央を1671×940（厳密な16:9）で切り、LANCZOSで縮小しただけで、絵の加工はしていない。配信WebPは `python3 remake/tools/build_manifest.py --backgrounds-only bg_mukai_attic.png`。
- 昼夜とも同じ絵を使い、夜は既存の暗転で表示する（`remake/js/chapters/ch5-tokyo.js` の `ATTIC_BG`）。

## 採否

- C（採用）: 低い屋根と梁、小窓から屋根と電線、畳に布団と畳んだ毛布、木箱にマグ、段ボール、右に下の店へ降りる階段口。余計な小物がない。腰壁の青灰色と暗い木材が店の絵とつながる。
- A: 依頼に無い鉢植え・棚が増えている。
- B: 降り口がはしごより急な階段に見え、Cより屋根裏らしさが弱い。
- 3案とも人物・猫・シーシャ台・文字なし。段ボールも無地。
