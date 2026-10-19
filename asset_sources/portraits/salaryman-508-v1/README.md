# #508 サラリーマン normal / smile（Draft確認用）

承認本文は [Issue #508](https://github.com/haseatsu114514-dot/shisha-game/issues/508#issuecomment-6165638554) と `approved-request.txt`。41歳の日本人男性、tonari常連。高橋さんとは別人。名前・電話相手・会社・家族構成は追加していない。

`normal-raw.png` は最初の生成。若く見えたため `normal-age-raw.png` へ修正した。`smile-raw.png` はその通常原画を本人参照として、目元と口角だけをわずかに和らげた差分。各生成は1人・1表情。実プロンプト3件、参照パス・用途・hash・配置は `generation.json` に記録した。

旧desktop_backupは外見参考のみ。最新mainにsalarymanの採用立ち絵・manifest登録は存在しなかった。画質は現行のみんと・アゲハ、男性の年齢感と並びはスミさんを実画像で参照した。他人物の顔や衣装は移していない。

原画は835×1884 RGBA、人物高1854px以上。既存 `normalize_sprites.py` のunion bbox・縮小配置を使い、共通倍率0.5926724138で896×1200へ配置、足元余白24px。アルファを閾値削除・二重適用せず保存した。`align_sprite_anchor.py -c salaryman --dry-run` は移動0枚。`build_manifest.py --portraits-only salaryman` で本人のみ計測・配布WebPを更新。PNG／WebPのRGBA完全一致、他のmanifestキー保持を確認済み。

ゲームへの接続はユーザーが指定したDraft内の確認用。mainへの採用・マージ・公開・Issue終了は行わない。実画面・分岐・save-load等の検証結果はPRと `docs/qa/issue508-theme/` へ追加する。
