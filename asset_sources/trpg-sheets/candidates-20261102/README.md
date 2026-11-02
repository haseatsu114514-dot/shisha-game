# TRPG人物シート候補 03〜13（2026-11-02受領・採否済み）

Codex生成の4×2シート（PR #2264 コメント 6569501973、ギガファイル便 `02-trpg-portraits.zip`）。31枚すべて1774×887 RGBAの原画を無加工で保存した（要求2048×1024は未達だが、01・02で採用したシート `../candidates-20261101/` も同じ1774×887）。同梱 `IMAGE-MANIFEST.json` のSHA-256・サイズ・モードは受領時に全31枚の一致を確認した。生成側の説明は `CODEX-README.md`・`HANDOFF.txt`・各フォルダの `QA.md`、プロンプトは `prompt-*.txt`、役柄の正本の写しは `canon-latest.md`。

上段＝はじめのPCの見た目4種、下段＝仲間が作る役4人。すべて作中の架空人物で、実在の参加キャラ立ち絵では置き換えていない。

## 採否（11本すべて採用）

基準: 8人がそれぞれ自分のセル内に収まり、切り出し後の丸窓（58〜64px）で顔と役の手がかりが読める／文字・枠・背景・シーシャなし／01・02と画風が並ぶ。Codexの「余白不足」は指定（セル内に十分な透明余白）との差で、切り出しツールはセル内の最大の塊を使うため、正の余白があれば欠けない。セル境界をまたぐ案だけを不採用にした。

| シナリオ | 採用 | 判断 | 書き出し（assets/ui/trpg/*.png・remake/img/ui/trpg/*.webp） |
|---|---|---|---|
| leaf-mail | **B** | Bは梯子・斧・鐘・天文具と役の手がかりが最も読める。セル内余白1〜24pxで切り出しに支障なし。Aはセル境界をまたぐ。Cは顔中心で小物が少ない。 | look-leaf-mail-lantern, look-leaf-mail-scarf, look-leaf-mail-cap, look-leaf-mail-glasses, pc-yura, pc-neri, pc-leaf-mail-leon, pc-gran |
| apple-thief | **B** | B（Codex推奨）。余白31px以上。Aはセル境界をまたぐ。 | look-apple-thief-cap, look-apple-thief-glove, look-apple-thief-bowtie, look-apple-thief-tail, pc-rosa, pc-marta, pc-apple-thief-shion, pc-nocto |
| shark-island | **B** | B（Codex推奨）。バンダナ・麦わら・三角帽・三つ編みの見分けが丸窓でも明確。 | look-shark-island-bandana, look-shark-island-brim, look-shark-island-tricorn, look-shark-island-braid, pc-ruri, pc-nerine, pc-doran, pc-jiruba |
| mist-kingdom | **B** | Bは騎士の鎧・大工のバンダナ・研究家の眼鏡が役に合う。余白28px以上。 | look-mist-kingdom-ink, look-mist-kingdom-silver, look-mist-kingdom-auburn, look-mist-kingdom-dawn, pc-orchard, pc-grants, pc-koban, pc-sharuku |
| smoke-robot | **A** | Codexは推奨なし（余白6〜11pxを指定違反と判定）。切り出しはセル内に全員が収まれば十分で、Aは全セル正の余白・はみ出しなし。コノハのフードに猫の飾りがあり役に近い。Bはセル中心がずれて隣のセルへはみ出すため不採用。Cも使用可だがAを採用。 | look-smoke-robot-ink, look-smoke-robot-silver, look-smoke-robot-rust, look-smoke-robot-helmet, pc-nova, pc-cosmo, pc-luna, pc-konoha |
| fading-familiar | **A** | 唯一の案A。下段のヒレナ・フカミ・マルスの髪先が隣のセルへ少しはみ出すが、切り出しは各セルの最大の塊だけを残し、丸窓に入る範囲に欠けは見えないため採用。B（出力審査で拒否）・C（未実行）は無し。 | look-fading-familiar-ink, look-fading-familiar-silver, look-fading-familiar-ember, look-fading-familiar-owl, pc-hirena, pc-fukami, pc-mars, pc-nox |
| fox-market | **B** | B（Codex推奨）。余白26px以上。 | look-fox-market-indigo, look-fox-market-ash, look-fox-market-rust, look-fox-market-moss, pc-kasumi, pc-shizuku, pc-namimaru, pc-fukajiro |
| stage-ghost | **B** | B（Codex推奨）。サメ着ぐるみ・旅芸人の帽子が読める。 | look-stage-ghost-ink, look-stage-ghost-rust, look-stage-ghost-silver, look-stage-ghost-long, pc-mirei, pc-serena, pc-minamo, pc-hiremaru |
| moonflower-encore | **C** | C（Codex推奨）。Aは下段がセル境界をまたぐ、Bは上段の余白4px。 | look-moonflower-encore-apron, look-moonflower-encore-tailcoat, look-moonflower-encore-glasses, look-moonflower-encore-cloak, pc-moonflower-encore-kirara, pc-moka, pc-moonflower-encore-leon, pc-ziek |
| purikura-hero | **A** | Codexは推奨なし。Aは全セル余白8px以上で隣へのはみ出しなし、ハートの盾・カメラ・薔薇・黒薔薇の杖が役に合う。Bは下段がセル境界をまたぐため不採用。 | look-purikura-hero-gold, look-purikura-hero-night, look-purikura-hero-berry, look-purikura-hero-chestnut, pc-lovely, pc-beatrice, pc-nocturne, pc-purikura-hero-shion |
| doll-requiem | **C** | C（Codex推奨）。Bは全セルが境界に接する。 | look-doll-requiem-ink, look-doll-requiem-snow, look-doll-requiem-wine, look-doll-requiem-braid, pc-doll-requiem-kirara, pc-marie, pc-cecilia, pc-chloe |

## 加工

`python3 tools/trpg_crop_portraits.py scenario <sheet.png> <id>` で切り出し（各セルの最大の不透明部分→頭を中心に正方形→512×512 PNG、256×256 WebP）。JSONの `builder.looks[].portrait`・`companionBuilds…portrait`・`cast[].sheet.portrait` もツールが埋めた。

仲間の役のidが別シナリオと重なる3人（`leon`＝鐘つき／林檎の紋章のハンター、`shion`＝似顔絵係／人見知りの魔法使い、`kirara`＝追っかけのファン／人形服のデザイナー）は別人なので、ツールを直してファイル名を `pc-<シナリオid>-<id>` にした（上書き防止の検査は残る）。

採用原画・派生のSHA-256は `ADOPTED.json`。不採用案も比較用に残す。
