# 公式プロモーションサイトの素材（2026-11-11）

サイト本体は `promo/`。ここには、サイトの質感パーツを作り直すための原本と、Codex へ依頼した絵の受け取り先を置く。

| フォルダ | 中身 |
|---|---|
| `textures/` | 紙と木目の原本（ambientCG・CC0 1.0・2026-11-11 取得）。`python3 promo/tools/build_parts.py --textures asset_sources/promo-site-20261111/textures` で `promo/img/tex/`・`promo/img/parts/` を作り直す |
| `keyvisual/` | （未着）横長キービジュアルの原画。依頼は #3232 |
| `parts/` | （未着・任意）ちぎった紙の縁・テープの差し替え候補。依頼は #3232 |

## テクスチャの出典

| ファイル | 配布ページ | 作者 | ライセンス |
|---|---|---|---|
| `textures/Paper001/Paper001_1K-JPG_Color.jpg`・`_Displacement.jpg` | https://ambientcg.com/view?id=Paper001 | ambientCG（Lennart Demes） | CC0 1.0 |
| `textures/Paper006/Paper006_1K-JPG_Color.jpg` | https://ambientcg.com/view?id=Paper006 | ambientCG（Lennart Demes） | CC0 1.0 |
| `textures/Wood067/Wood067_1K-JPG_Color.jpg` | https://ambientcg.com/view?id=Wood067 | ambientCG（Lennart Demes） | CC0 1.0 |

CC0 のため商用利用・改変・再配布ができ、作者表示は任意。配布物（1K-JPG の zip）のうち、サイトで使う色と凹凸の画像だけを置いた。
Paper001 は右端に継ぎ合わせの乱れがあるので、`build_parts.py` はきれいな部分だけを切り出し、上下左右がつながる地に直してから使う。

## 画像生成について

2026-11-11 に画像生成API（`gpt-image-2.5-sunburst`）で質感パーツを作ろうとしたが、残高切れ（`credit_balance_exhausted`）で1枚も生成していない。
サイトの絵はすべてゲームの採用済み素材で、ちぎった紙の縁とテープは上の紙の地からスクリプトで形を付けた物。
