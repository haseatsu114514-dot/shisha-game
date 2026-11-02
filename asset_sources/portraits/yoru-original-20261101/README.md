# 針間ヨル・立ち絵原画

Issue #2199。人物の正本は `data/characters.json` の `yoru` と `brand/character_profiles.md`「針間ヨル」。Codex 組み込み画像生成機能（image_gen）を使用した。久世・あげはの採用済み立ち絵は画風だけの参照とし、実在の DJ・アーティストを参照していない。

| 原画 | SHA-256 |
|---|---|
| `normal-source.png` | `929520bb850e2e7e810a4f05b033bf4996db765165cc9f9e9fe3aefe7975fe8f` |
| `smile-source.png` | `657d59a4d0da425bcb661f54c104751c8aad48c30088cbf49758746fb3ae9b8a` |
| `serious-source.png` | `8b237f9b5f55a6114fa5a3fe6f40a7f3541647d1829c88e49e81d17172222467` |
| `surprise-source.png` | `6aaef3623931f0555845ef703f80411843c8abcd2d116d4bb9dd23195444f9aa` |
| `sad-source.png` | `fec2e72eb1909ce19dc666e8d0ad1d5b96b55b2e427c25a451ae15823b6c8eb4` |

normal は41歳の落ち着いた表情、左側の刈り上げと銀メッシュ、首のヘッドフォン、紫の縫い目、全身と両足、透明アルファを確認して採用した。残り4枚は normal を同一性参照として1表情ずつ生成し、同じ衣装・髪型・体格と透明アルファを確認した。

原画は無加工で保存。配布用 PNG は `tools/fit_portrait.py` で 896×1200 に縮小・配置し、顔アイコンを `tools/make_face_icons.py`、WebP と manifest を `remake/tools/build_manifest.py` で生成した。
