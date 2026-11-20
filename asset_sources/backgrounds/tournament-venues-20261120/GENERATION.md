# 大会会場の背景（#3620、2026-11-20）

オーナー採用: 第2章 F（柚ヶ谷）、第3章 M（東京）、第4章 M（ドバイ。夜景の尖塔の重複を直した版）、第5章 O（SMOKE LAB の研究室そのもの）。後続章で会場の建築・客席・視点を変え、第5章は客40人と同条件の2卓へ絞った。台本の変更やホールへの移動は行わない。

| 原画 | 参照・生成方針 | SHA-256 |
|---|---|---|
| `bg_tournament_yuzugaya_dusk.png` | 採用済み `kemurikusa` の筆致・第1章の照明強度を参照。柚ヶ谷の高窓と4本の琥珀色の灯り。 | `75819822340722ed9d396e15b47d41d342b83a90fb50fa6f323510ab1c0b2caf` |
| `bg_tournament_tokyo_day.png` | `kemurikusa` の筆致を参照。都市型展示場。白い天窓、鉄骨、仮設舞台、丸椅子付きの4卓を斜めから。 | `b91b65590e10e6dec0fa445f41733a44e9836ec1622f4bb5fbb15b50513624d3` |
| `bg_tournament_dubai_dusk.png` | 同じ描画基準。砂丘を思わせる天井、楕円舞台と4卓、手前と奥の客席、右の扉とランプ。 | `b3673478dba8e6ec19c6ff6b9a40012e6cdb03a65a4305e7d4f1af9222cf4f7b` |
| `bg_smoke_lab_duel_day.png` | 現行 `bg_smoke_lab` の窓、白い実験台と機器、奥の木枠を参照。高さを変えず、中央通路と2卓で対決を見せる。 | `88ebcf9b3c6fc988466629e12cbc05a87174a0f4a5415d833917147d59db748b` |

Codex 内蔵画像生成による原画はいずれも RGB PNG、1672×941。規格の内蔵生成の例外に従い拡大せず、PNGは `originals/`、配信用WebPは `runtime/` に保管。現行の `remake/tools/build_manifest.py --backgrounds-only` で、支給されたWebPを4点とも再現できた。本編では既存のゲーム素材を天板へ合成し、第5章の登場CGは引き継ぐ。
