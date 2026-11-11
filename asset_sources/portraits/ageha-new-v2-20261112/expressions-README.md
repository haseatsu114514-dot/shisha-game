# あげは A基準の4表情原画（#3331 G2〜G5）

オーナー採用済みの通常A（PR #3350）を本人の基準に、smile・surprise・serious・sadを1人1表情ずつ生成した原画候補。採用前のDraft納品で、ゲームへの組み込みは含まない。ましろH1〜H3は今回の範囲外。

## 基準A

- 原画: `asset_sources/portraits/ageha-new-v2-20261112/normal-untouched.png`
- 参照コミット: `f39a9dfca66ce0deebf248977ef8ae1fe4f611ae`（PR #3350）
- SHA-256: `d02f63ec34452381f771446d222dda14b280ff3459ee22ae75cb29357661d92c`
- Aの原画・既存READMEはこのPRに重複追加しない。

## 原画と比較

- `smile-untouched.png`: 閉じ目の笑顔、開いた口、腰に手と開いた手。
- `surprise-untouched.png`: 大きく丸い目、小さなO形の口、顔の両側に開いた両手。
- `serious-untouched.png`: 集中した眉と閉じた口、腰の手とジャケットを持つ手。再生成候補から選定。
- `sad-untouched.png`: 眉の内側が上がる小さな口、頬の近くに手、涙なし。

全原画は生成出力とバイト一致の無加工PNG。リサイズ、顔の描き足し、透過清掃はしていない。各原画の英文全文は [`expressions-prompts.json`](expressions-prompts.json)、参照順・パス・ハッシュは [`expressions-generation.json`](expressions-generation.json) に記録した。参照は①旧版の同表情 `assets/sprites/characters/ageha/chr_ageha_<face>.png`（表情・仕草のみ）、②上記A（本人・衣装・大きさの基準）、③ `assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png`（画風のみ）の順。

## 納品前の本人性チェック

1. AのSHA-256を照合し、未採用の別normalを基準にしない。
2. Aと4表情の全身を、共通のピクセル倍率で並べる。次の生座標比較で人物の倍率・足元のずれも確認する。
3. 顔を同じ座標の矩形で拡大し、丸い輪郭、大きな丸い目、柔らかい頬、短いあごを確認する。閉じ目の笑顔は眼窩・まぶたの幅と頬の輪郭を見る。
4. 旧版の同表情と表情・手の仕草を比べ、髪と豹柄が似ているだけで本人性を合格にしない。
5. 透過・人物高・両靴の見切れを数値と目視で確認する。

実施結果: Aと4表情を全身・顔拡大で並べて目視し、選定した4枚はAと同じ人物に見えると自己確認した。真剣は初回の顎と靴底を見直して再生成した。最終採用判断はオーナーに残す。

![Aと4表情・生座標比較](qa/expressions-native-comparison.jpg)

次は全身の高さと足元を一様倍率＋平行移動でAに合わせた**比較専用**の画像。顔の輪郭や目などは個別変形していない。原画のサイズ一致を示す画像ではない。

![Aと4表情・整列した顔拡大](qa/expressions-A-and-four-comparison.jpg)

## サイズ・透過と組み込み時の残項目

| 原画 | PNGサイズ | alpha>=16の人物高 | 人物の下端（排他的y） |
|---|---|---:|---:|
| A | 1084×1451 | 1432px | 1447 |
| smile | 1084×1451 | 1436px | 1449 |
| surprise | 1084×1451 | 1428px | 1440 |
| serious | 1054×1493 | 1476px | 1488 |
| sad | 1084×1451 | 1433px | 1445 |

4枚とも真のRGBA透過PNG、人物高1300px以上、全身と両靴あり。背景・床・文字なし。

**原画の配置はピクセル一致していない。** 特に真剣は生成器が異なるキャンバスを返しており、Aと同位置にそのまま差し替えられる状態ではない。比較上は約0.97019倍の一様縮小で人物高がAにそろう。組み込み担当は採用後、通常Aに対して頭の大きさと足元を重ねて配置を合わせること。既存 `spriteScale` を変更して帳尻を合わせない。比較用変換値と生座標の測定値は [`qa/expressions-measurements.json`](qa/expressions-measurements.json) にある。

無加工原画には低alphaの微小な残りがある（sadの左下隅alpha=1を含む）。この納品で清掃済みとは扱わず、採用後に通常の透過縁QAを行う。ランタイム・顔アイコン・`portrait_metrics.json` は変更しておらず、実画面での重ね合わせ検証は未実施。

画像はOpenAI画像生成ツールで作成。参照は本プロジェクトの既存キャラクター画像とオーナー採用Aのみ。外部の写真・素材は追加していない。画像・比較図はGit LFS保存。
