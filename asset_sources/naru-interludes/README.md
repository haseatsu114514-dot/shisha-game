# なるの章間カットとスチル

2章以降も、はじめと離れているなる自身の仕事と挑戦を描くための採用CG。

| 原画 | 配信元PNG | 接続先 |
| --- | --- | --- |
| `after-hours-source.png` | `assets/cgs/cg_naru_after_hours.png` | `ch2_naru_window` の両分岐後 |
| `last-chance-source.png` | `assets/cgs/cg_naru_last_chance.png` | `ch4_opening` の代表決定大会優勝 |
| `next-entry-source.png` | `assets/cgs/cg_naru_next_entry.png` | `ch3_naru_reconcile` の出場準備 |

生成は `image_gen.imagegen`。指示と参照は `generation.json`。正規なる立ち絵を本人性の基準とし、閉店後の背景は正規 `kemurikusa.png` の緑壁・木製カウンター・照明へ合わせて修正した。顔、髪、目、衣装、手、横長構図を原画で目視確認。喫煙・シーシャ機材を写さない場面に限定。外部の製品画像・ロゴ・ストック素材は不使用。

PNGを原画からそのままコピーし、`build_manifest.py --cgs-only` で本編用WebPと目録を生成。既存の `show_cg` / `hide_cg` と閲覧済みギャラリーを使う。追加カットは能力・好感度・勝敗を変更しない。地域大会と代表決定大会は全国後の六週間に置く。4章冒頭は既存の正史台本へ反映済みで、本編進行の接続は既存どおり未実装。5章には追加しない。
