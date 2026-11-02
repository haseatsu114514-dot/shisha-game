# NF04 新フレーバー7種の箱絵（採用記録）

2026-11-02、Codex（built-in image_gen）が `PROMPTS.md` で生成した7種×3案（`candidates/`、1254×1254 RGBA、原画無加工）から各味1案を採用した。PR #2272 のコメントでギガファイル便経由で受領。SHA256は `codex-qa.json` / `codex-image-manifest.json` と全21枚一致を確認。生成時の実プロンプトと参照は `codex-generation-log.json`。

## 採用

| 商品ID | メーカー（参照） | 採用 | 理由 |
|---|---|---|---|
| grapefruit | アルファーヘブン（`heaven10/lemon.webp`） | A | 3案ほぼ同等。断面のルビー色と筆跡の珊瑚色/淡黄の配分が参照レモンに最も近い |
| lime | アルファーヘブン（同上） | A | 果皮・断面とも明確に緑でレモンに見えない。筆跡の幅が参照と同程度 |
| honey | アフサール（`remaining8/lychee.webp`） | B | ディッパーと蜂の巣が丸い枠に収まり、垂れる蜂蜜の量が控えめ（A/Cは枠外にあふれ気味） |
| cherry | アフサール（同上） | B | 2果＋1葉が枠の中央に収まり、葉の形がはっきりしている |
| milk | ドバジ（`remaining8/mango.webp`） | A | 青帯が3案で最も細く、指定の「薄い青の縁」に最も近い（Cは青が強い） |
| passion_fruit | ドバジ（同上） | B | 紫の丸ごと＋黄色果肉と黒い種の断面が大きく読める |
| biscuit | ドバジ（同上） | B | 縁が波形の2枚が重なり屑もあり、指定どおり。Cは表面がのっぺり、Aは2枚の重なりが分かりにくい |

## Codexの留保の確認

- アフサールの日輪下の曲線（ハニー/チェリー）: 原寸で参照ライチと並べて確認。アーチ・放射線・半円・下の波線2本の構成は同じで、線の形がわずかに違うだけ。店の箱サイズ（66px前後）では判別できないため許容。
- パッションの葉: 参照のマンゴーにも葉が付いており、同メーカーの画風として自然なので許容。
- ミルクの青帯: 3案で最も細いAを採用。
- 微小alphaノイズ: 箱の外のノイズはすべて alpha=1。変換時に alpha<=4 を0にしてから縮小した（原画は変更しない）。
- 実在ブランドのロゴ・文字・数字は無い（既存箱と同じ架空メーカーの紋章のみ）。

## 変換

`python3 tools/build_new_flavor_art.py`（`--check` で再現確認）。採用原画の SHA256 を `sources.json` で固定し、alphaノイズ除去 → 512×512 LANCZOS → WebP（quality 88）で `remake/img/shop/new-flavors/<商品ID>.webp` に出力。箱の見える範囲（alpha>16＋2px）を測って `remake/js/daily/shop-art-new-flavors.js` に登録し、`shop.js` の画像表から引く。測定結果は `validation.json`。
