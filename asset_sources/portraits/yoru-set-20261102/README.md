# 針間ヨル・立ち絵5表情（2026-11-02 採用）

Issue #2199。Codex（image_gen）が PR #2228 で作った5枚組（normal / smile / serious / surprise / sad）。人物の正本は `data/characters.json` の `yoru` と `brand/character_profiles.md`「針間ヨル」。

- **採用の経緯**: 先に `../yoru-original-20261101/` の normal（v2、オーナーがギガファイル便で受け渡した3案から採用）を組み込んだ（#2227）。その後 #2228 に表情差分つきの別の組が届いたが、体格・ポーズ・頭の大きさが違い、v2 の normal と表情を混ぜると切り替えで絵が跳ぶ。2026-11-02 オーナーが「#2228 の5枚に替える」を選んだので、normal ごとこの組に差し替えた（DJS18）。v2 の原画と候補は `../yoru-original-20261101/` に履歴として残す。
- 原画は無加工（各 1086×1448 前後の透過 PNG）。#2228 では `yoru-original-20261101/` に置かれていたが、v2 の原画と同じ名前になるのでこのフォルダへ移した。

| 原画 | SHA-256 |
|---|---|
| `normal-source.png` | `929520bb850e2e7e810a4f05b033bf4996db765165cc9f9e9fe3aefe7975fe8f` |
| `smile-source.png` | `657d59a4d0da425bcb661f54c104751c8aad48c30088cbf49758746fb3ae9b8a` |
| `serious-source.png` | `8b237f9b5f55a6114fa5a3fe6f40a7f3541647d1829c88e49e81d17172222467` |
| `surprise-source.png` | `6aaef3623931f0555845ef703f80411843c8abcd2d116d4bb9dd23195444f9aa` |
| `sad-source.png` | `fec2e72eb1909ce19dc666e8d0ad1d5b96b55b2e427c25a451ae15823b6c8eb4` |

- Codex の記録（#2228）: normal は41歳の落ち着いた表情、左側の刈り上げと銀メッシュ、首のヘッドフォン、紫の縫い目、全身と両足、透明アルファを確認して採用。残り4枚は normal を同一性参照として1表情ずつ生成し、同じ衣装・髪型・体格と透明アルファを確認。久世・あげはの採用済み立ち絵は画風だけの参照で、実在の DJ・アーティストは参照していない。
- 配布用 `assets/sprites/characters/yoru/chr_yoru_<表情>.png`（896×1200 透過）と WebP は #2228 のものをそのまま使う（`tools/fit_portrait.py` で人物の高さ1160・足元を下から20pxにそろえてある）。5枚とも人物の高さ・足元の位置が同じで、表情を切り替えても上下にずれないことを確認した。
- 顔アイコン `assets/ui/face_icons/face_yoru.png` は `python3 tools/make_face_icons.py yoru` で作り直し、#2228 のものと画素まで一致。目録は `python3 remake/tools/build_manifest.py --portraits-only yoru` と `--intros-only yoru`（旧絵柄のカットインの人物位置）。
