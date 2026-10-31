# 炭8差分の作り直し（#896 台帳 A3）

2026-10-30 の決定「炭の絵8枚の作り直し：作り直す」に対応。旧 `coal_*.png` / `coal_flat_*.png`（太い黒線＋平面塗りの箱）を、
既存の質感ある炭 `assets/ui/making/heat_cube_lit.png` / `heat_flat_lit.png` に寄せた絵へ差し替えた。

- 生成: OpenAI Images API `images/edits`、モデル **`gpt-image-2.5-sunburst`**、1024×1024、quality medium、透過背景（2026-10-31 JST 作り直し, Grok Bot。初版 #1985 は gpt-image-1.5）。再実行: `regen_sunburst.py`
- 作り直しで足した点: `coal_cold` は向きを他の状態にそろえる文、`coal_red` は上面に小さな黒い点を出さない文をプロンプトに追加（`generation.json`）
- 手順: ①`heat_flat_lit.png` を参照に `coal_flat_just` ②それを参照に形だけ立方体へ変えて `coal_just` ③各 just を参照に cold / red / white を形・角度を保って状態だけ変更
- 状態の意味（`remake/js/craft/heat_logic.js` に合わせた）: cold＝未着火の黒、red＝焼け上がり前（黒い面が少し残る）、just＝全面が赤い、white＝待ちすぎ（灰をまとう）
- 原画: `originals/`（生成そのまま）。ゲーム用は透過の外接矩形で切り出し、旧素材と同じ 320×320・同じ下端（キューブ y=298／フラット y=238）・幅最大 270px に収めた
- `python3 remake/tools/build_manifest.py --making-only coal_*.png` で WebP と manifest を更新
- プロンプト全文は `generation.json`
- 炭1個・炎や煙なし・文字なし・キューブは立方体／フラットは適度な厚みを目視確認。採否の最終判断はオーナー
