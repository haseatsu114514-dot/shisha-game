# 別案: PR #3234 の原画（未採用・保存のみ）

Codex が PR #3234（branch `codex/3222-naru-rider`）で作った、なるのライダー6ポーズの原画。ゲームには入れていない（採用はオーナーが ZIP で受け渡した組で、PR #3242 でマージ済み）。
2026-11-11 オーナー「解消してマージへ」で、#3234 の競合を main 側（採用済みの組）で解消し、この原画だけを別案として残した。PNG の SHA-256 は #3234 の LFS と一致を確認済み。

## なぜ採用しなかったか

#3234 のゲーム用 WebP は、主人公のキャンバス寸法へ中央に縮めただけで、基準点も主人公の値をそのまま使っていた。測ると板の中心が基準点から 4〜39px ずれ、頭から板までの長さも主人公の 94〜98%だった（採用した組は `../build.py` で揃えてある）。絵そのものの出来は採用した組と同等。

## この別案に差し替えるとき

1. この6枚を `../rider_naru_<pose>.png` に上書きする。
2. `python3 asset_sources/desert-ride-naru-3222/build.py` を実行する（主人公と同じ縮尺・板の中心が基準点になるよう WebP と `adoption.json` を作り直す）。
3. 出力された寸法・基準点を `remake/js/minigames/desert-ride-art.js` の `naruRider…` に写し、`node --test remake/test/desert_ride.mjs` で照合する。

---

以下は #3234 に Codex が書いた記録（そのまま）。

# Issue #3222 なるのサンドボードライダー

Codex 内蔵 image_gen で、1回につき1ポーズを生成した透過 PNG 原画。ゲーム用 WebP は `remake/img/ui/desert_ride/rider_naru_*.webp`。2026-11-11 作成。

## 参照画像と役割

- **人物**: `assets/sprites/characters/naru/chr_naru_normal.png`。なる本人の銀灰色の短髪、日焼け肌、白い切り替えのある黒いボンバージャケット、黒いカーゴパンツと腰のチェーン、白いスニーカーを固定。
- **構図と縮尺**: 各ポーズに対応する `remake/img/ui/desert_ride/rider_<pose>.webp`。背面の視点、姿勢、画面内の縮尺、板の遠近、板の基準点を合わせる。
- **同一人物**: 2枚目以降は最初に生成した `rider_naru_ride.png`。人物・服・クリーム色の板を統一。
- **画風固定**: 既存 `rider_*` の日本アニメ調、明瞭な輪郭線、柔らかいセル調の陰影、背面視点、板の遠近を合わせる。

## 生成指示

通常滑走は Issue #3222 の「コピペ用プロンプト」を使用し、参照画像に上記の役割ラベルを付けた。2枚目以降は同 Issue の差し替え文に従い、人物・画風・禁止事項を維持してポーズと寸法のみ差し替えた。共通指示は次の通り。

> Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune. Same character as the attached portrait (chr_naru_normal.png): short spiky silver-gray hair, tanned skin, a black bomber jacket with white panels from the shoulders down the sleeves, collar up, black cargo pants with a silver wallet chain at the hip, white chunky sneakers strapped to the board. Camera from behind and slightly above, his face not visible. Match the attached rider_<pose>.webp exactly for camera angle, pose framing, character scale and board perspective, so the two sprites can stand side by side in the same game: clean Japanese anime style, clear outlines, soft cel shading. Fully transparent background. No ground, no sand, no dust, no ground shadow, no text, no logos, no other people, no hookah equipment.

| 原画 | ポーズ指示 | WebP寸法 | anchor（比率） |
| --- | --- | --- | --- |
| `rider_naru_ride.png` | 安定した通常滑走、膝を軽く曲げ両腕でバランス | 489×768 | 0.6125, 0.833 |
| `rider_naru_lean_left.png` | 画面左へ強く傾けて旋回 | 536×724 | 0.6294, 0.8209 |
| `rider_naru_lean_right.png` | 画面右へ強く傾けて旋回 | 542×771 | 0.5103, 0.8261 |
| `rider_naru_jump.png` | 空中で膝を曲げ、板を傾ける | 537×670 | 0.5761, 0.8388 |
| `rider_naru_brace.png` | 着地に備えて深くしゃがむ | 561×644 | 0.558, 0.8198 |
| `rider_naru_fall.png` | 横へ転倒し、板が離れる | 554×655 | 0.5256, 0.9569 |

WebP は原画を表のキャンバス寸法へ Lanczos で縮小し、透過を保持して品質92で保存した。`anchor` は現行の主人公・ヌールと同じ値。転倒のみ体の中心と下端が基準。

## 検品

- 6枚の原画・WebP は RGBA 透過で四隅の alpha がすべて 0。WebP の寸法は表と一致。
- 主人公・ヌールの6ポーズと並べて確認し、背面の人物の高さと板の位置、銀灰色の髪、白い袖、クリーム色の板を目視確認。
- ゲーム内でのヌール勝利後の対戦と 360 回転は、受け口 PR #3231 が未マージのため未確認。
