# NF04 新フレーバー7種の箱絵（採用版）

2026-11-02、Codex の画像生成で7種×3案＝21枚を作った候補（オーナーがギガファイル便で受け渡し、PR #2272 のコメント）から1案ずつ採用した。生成の指示は `PROMPTS.md`、採用案・SHA-256・参照箱は `sources.json`、21枚の寸法・透過範囲の記録は `candidates-qa.json`（生成担当の計測）。

| 商品ID | 採用案 | メーカー（参照した既存の箱） | 採用理由 |
| --- | --- | --- | --- |
| grapefruit | A | アルファーヘブン（heaven10/lemon） | 3案ほぼ同一。断面の色と筆跡が最も整う |
| lime | B | アルファーヘブン（heaven10/lemon） | 緑のライムで、レモンに見えない |
| honey | A | アフサール（remaining8/lychee） | ディッパーと蜂の巣がはっきり読める |
| cherry | B | アフサール（remaining8/lychee） | 2果＋1葉が丸窓に収まる |
| milk | A | ドバジ（remaining8/mango） | 無地のグラスとミルククラウンがはっきり。青帯は指定より広めだが許容 |
| passion_fruit | B | ドバジ（remaining8/mango） | 紫の果皮と黄の果肉が明瞭。葉の飾りは参照のマンゴー箱にもあるため許容 |
| biscuit | B | ドバジ（remaining8/mango） | ギザ縁の2枚重ねと屑 |

## 変換と表示

- 原画（`<商品ID>.png`、1254×1254 RGBA）は無加工。`python3 tools/build_new_flavor_art.py` で512×512 WebP（`remake/img/shop/new-flavors/`）にし、箱の範囲を測って `remake/js/daily/shop-art-new-flavors.js` に書く。`--check` で再現性を確認できる。
- 透過のごく薄いノイズは alpha>16 で測ると箱の外に無く、箱の範囲は既存の同メーカー箱とほぼ同じ（`validation.json`）。
- `remake/js/daily/shop.js` の店頭とフレーバー選びの絵で使う。

## 確認したこと

- 21枚すべて、受け渡しZIPの `IMAGE-MANIFEST.json` のSHA-256と一致。
- 既存のレモン・ライチ・マンゴーの箱と並べて目視：形・画風・ブランドマーク・文字なし・箱1つ・全体が画面内。
- 実ブラウザ（Chromium）で既存の箱と並べて表示し、同じ倍率で出ることを確認。
- ハニー/チェリーの日輪の下の線は参照と細部が違う（ピクセル一致ではない）。
