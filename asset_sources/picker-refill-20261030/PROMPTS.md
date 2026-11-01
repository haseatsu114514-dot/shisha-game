# 画像選別の補充プロンプト（2026-10-30）

画像選別（Muse の「画像候補セレクター」）で、オーナーが全没にした／修正版を求めた **28件** の補充用プロンプト集。各件 **5枚**、計140枚を Codex（画像生成）で作るためのもの。

- 作成日: 2026-10-30（入力: オーナーの選別結果から作った補充対象28件。ownerHint＝オーナーのメモ・タグ）
- 種類: **新規補充**（候補が全没。新しく5案）15件 ／ **修正版**（オーナーが残した1枚を元に直す。5通り）13件
- 書き方の正本: `.claude/skills/codex-image-prompt/SKILL.md`。各ブロックの共通スタイル指針・シーシャ構造の文は正本から改変なしで転記している（転記元は各ブロックに明記）。シーシャが写るものは `asset_sources/shisha-hardware-reference/drawing-sheet/README.md` の「生成前に決める8行」を1枚ごとに埋めてある。

## 使い方

1. 下の表から対象を選び、その **コードブロック1つを丸ごと** Codex に貼る（ブロックは1つずつ完結。他のブロックを見なくても作れる）。
2. ブロック内「添付する画像」の画像を添付する。**修正版は元画像（オーナーPCの選別データにある原寸）を必ず添付**。シーシャの早見表・構造図（drawing-sheet の PNG）は添付しない。
3. 5枚は「--- n/5: ファイル名 ---」ごとに **1回に1枚** 生成し、指定のファイル名で `work/picker-refill-1030/<targetId>/` に保存する。
4. 各ブロック末尾の「生成後チェック」で原寸確認。NGは直すか作り直す。
5. 全部（または区切りごと）を `work/picker-refill-1030/` ごと ZIP にまとめ、選別ページの **ZIP取り込み** で取り込む（targetId のフォルダ名で対象に振り分ける）。

## オーナーの選別基準（全ブロックに反映済み）

- 没の最大の理由は **シーシャ描写の誤り**（ハガル＝ボウル・炭・HMD・ボウル上部）。完成・喫煙状態は **HMD必須・直炭禁止**、HMDは1枚につき具体的な1モデル（ONMO型／Kaloud Lotus I+型）。
- **植物は原則0**（「謎植物」は不可）。
- **背景はゲーム内の実背景に合わせる**（架空の店の内装は没）。各ブロックで使う実背景ファイルを指定した。
- 地名: 第1章の街は **橙須**、第2章は **柚ヶ谷**（画像には地名・文字を入れない）。

## 対象一覧（28件）

| # | targetId | 名前 | 種類 | 主な直し・狙い |
|---|---|---|---|---|
| 1 | `t-title-sumi` | スミ | 新規補充 | レモン・余分なホース・謎店舗・植物を除去。tonari背景。元new05の顔・構図・雰囲気は維持 |
| 2 | `t-ext-mashiro` | ましろ | 新規補充 | シーシャ中心5案。mukai実背景、HMD必須、植物0 |
| 3 | `t-ext-naru` | なる | 新規補充 | シーシャ中心5案。KEMURIKUSA実背景、HMD必須、植物0 |
| 4 | `t-ext-samechan` | サメちゃん | 新規補充 | シーシャ中心5案。SHISHARK実背景、パペット右手、ホース両端を画面内 |
| 5 | `t-city-ch5` | 第5章・橙須フィナーレ | 新規補充 | 第1章橙須マップと同じ地形・カメラで、緑を大幅に減らした都会版を時間帯違いで5枚 |
| 6 | `t-lime-volk` | ヴォルク | 新規補充 | 本人寄り2＋物モチーフ3（紅茶とジャム・ストップウォッチ）。細長い物は避ける |
| 7 | `t-logovar-b1` | ベース B1（金×深紫）のバリエーション | 新規補充 | B1のゴールド明朝＋金粉を保ち、1点ずつ微調整×5 |
| 8 | `t-logovar-d5` | ベース D5（筆文字）のバリエーション | 新規補充 | D5の銀灰の筆致＋煙の尾を保ち、1点ずつ微調整×5 |
| 9 | `t-logovar-j4` | ベース J4（勢いのある筆致）のバリエーション | 新規補充 | J4のマーカー筆致＋多重影を保ち、1点ずつ微調整×5 |
| 10 | `t-logovar-l5` | ベース L5（静かな夜）のバリエーション | 新規補充 | L5のマット黒文字＋細い銀の縁光を保ち、視認性を少し上げる×5 |
| 11 | `t-nv-master` | マスター・フーカ | 新規補充 | 老武人の方向性で衣装・ポーズ違い5案。マゼンタ背景の立ち絵マスター。特定作品の模写なし |
| 12 | `t-trailer-ch3-04` | 第3章予告カット4 会場と審査席 | 新規補充 | 本編の大会ステージ背景に準拠。機材は未点火・ボウル未装着で事故を避ける |
| 13 | `t-trailer-ch3-05` | 第3章予告カット5 なるの後ろ姿（工房） | 新規補充 | 機材の縮尺を卓・手と同じ奥行きで正す／HMD・ボウルを1モデルで／植物0 |
| 14 | `t-trailer-ch3-06` | 第3章予告カット6 煙のみ | 新規補充 | 煙と小さな火点だけ。人物・手・機材・植物なし |
| 15 | `t-trailer-ch5-03` | 第5章予告カット3 ロボットアーム接写 | 新規補充 | アーム先端とボウルの接写のみ。HMD内の炭／未点火工程で直炭を避ける |
| 16 | `t-title-samechan` | サメちゃん | 修正版 | 植物をすべて除去。他は元画像のまま |
| 17 | `t-title-minto` | みんと | 修正版 | ホース・本体を正しい構造に、手元に硬いハンドル（マウスピース）。顔は維持 |
| 18 | `t-trailer-ch5-01` | 第5章予告カット1 夜の店内・スマホ動画 | 修正版 | ハガル・炭を正しく（HMD内の炭）＋目の周りの光を消す |
| 19 | `t-map-ch3` | 第3章 東京 | 修正版 | 植物を減らす。構図・雰囲気は維持（ピン座標のため地形を動かさない） |
| 20 | `t-ext-hiyori` | ひより | 修正版 | 植物をなくす・シーシャ部品を図解どおり（洗浄中なので炭・煙なし）。構図維持 |
| 21 | `t-trailer-ch4-06` | 第4章予告カット6 はじめの手とホース | 修正版 | ホース・本体・HMD・ボウル・炭をすべて図解どおりに。手と構図は維持 |
| 22 | `t-trailer-ch4-05` | 第4章予告カット5 南雲の後ろ姿 | 修正版 | ハガル・炭・HMD・ボウルを正しく。南雲の後ろ姿と構図は維持 |
| 23 | `t-trailer-ch3-03` | 第3章予告カット3 久世の視線 | 修正版 | 機材を図解どおり＋背景を煙幕の実背景へ。人物・構図は維持 |
| 24 | `t-trailer-ch5-06` | 第5章予告カット6 二台のシーシャ | 修正版 | 2台ともHMD・ボウル・炭・ホース・本体を正しく。構図は維持 |
| 25 | `t-trailer-ch3-02` | 第3章予告カット2 ましろと茶杯 | 修正版 | 機材を正しく＋植物0＋背景をmukaiの実背景へ |
| 26 | `t-map-ch4` | 第4章 ドバイ | 修正版 | 植物を減らす。構図は維持（ピン座標のため地形を動かさない） |
| 27 | `t-trailer-ch4-02` | 第4章予告カット2 世界大会の会場 | 修正版 | 画面内の全台のハガル・炭・HMD・ボウルを正しく |
| 28 | `t-trailer-ch4-04` | 第4章予告カット4 スミの横顔 | 修正版 | 機材を正しく＋植物0＋背景をtonariへ＋画風を第1章予告スチルへ |

## 参照が無かった・推定した点（作業メモ）

- **修正版の元画像**（pattern2.webp・r2/r6/r7/r9.webp・ref-decided-ch3/ch4.webp・title_art_hiyori_new33 等）はリポジトリに無いので、オーナーPCの選別データから添付する。みんとの mint_cloud だけはリポジトリにもある（ブロック内に記載）。
- **ロゴのベース**（B1・D5・J4・L5）は main に無く、Draft PR #1392／#1394 のブランチにある。前回の「マイナーチェンジ」の没理由は記録が無いため、1枚につき1〜2点だけ変える比較しやすい5案にした。
- **LIMEアイコン**には共通スタイル指針の正本が無い。採用済み3案の書き方と表示寸法（28〜136pxの丸）から条件を書いた。
- **第3章予告カット5**「工房」は、本編ではなるがKEMURIKUSAを休業中で、地方大会の控室にいるため「控室の作業台」として描く指定にした。
- **第4章予告カット6** は本編では夜の宿で道具の手入れをする場面。元画像が未点火なら炭・HMDを描かない条件分岐を入れた。
- **マスター・フーカ** は本編名「王煙楼（煙楼先生）」。#1177 で一度立ち絵が組み込まれたが、今回の選別で全没のため新しい方向（老武人）で作る。特定作品の衣装は写さない。
- 第3〜5章予告スチルの生成指示（work/trailer-expansion/DESIGN.md・Opusプロンプト版）はリポジトリに無いので、画風は第1章予告の採用カットの指示文（trailer-90s-anime-concept）と採用画像を正本にした。

## 1. `t-title-sumi` — スミ（新規補充）

```text
【対象】t-title-sumi ／ セットA：タイトルアート候補 ／ スミ（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-title-sumi/ に refill1030-t-title-sumi-01.png 〜 refill1030-t-title-sumi-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/sumi/chr_sumi_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_sumi_01_own_clay_bowl.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_tonari_inside_day.png（昼）
4. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_tonari_inside_night.png（夜）
5. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
6. 構図・雰囲気・顔の良い例（オーナー評価「顔・構図・雰囲気・シーシャは良い」）: title_art_sumi_new05_own_clay_bowl（画像2と同じ絵。※レモン・使っていない2本目のホース・謎の店舗背景・植物は引き継がない）
【オーナー指示】レモン不要。使っていないシーシャのホースも不要。背景が謎の店舗で実際と違う→tonariの実背景に合わせる。植物を減らす（このバッチでは0）。顔・構図・雰囲気・シーシャの良さは保つ。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Sumi, 46-year-old Japanese man, shisha shop owner of tonari and the hero's mentor: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with rolled sleeves, brown waist apron, black trousers. Calm, seasoned, quietly warm; small restrained smile.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1030-t-title-sumi-01.png ---
Late evening after closing at tonari. Sumi sits at the wooden counter, waist-up three-quarter view, and turns his OWN well-worn unglazed terracotta bowl in his hands, checking the rim with a cloth, quiet pride. Unlit: no coals, no HMD on it. One complete hookah stands beside him at the same depth with its bowl not fitted (bare small convex metal post on top). Low warm lamp light, olive/cream tonari interior softly defocused. No fruit, no lemon, no plants.
8行:
人物      : sumi（立ち絵添付）
場面      : 準備中（ボウル未装着。自作の素焼きボウルを手入れ）
台の型    : 伝統の金属ステム＋透明ガラスベース
HMD       : なし（未加熱）
炭        : なし
ホース    : 台の側面ポートからたわんでハンドルが台の脇に静かに置かれる。人物の前を通さない
吸い口    : なし
構図      : 腰上・斜め45度、閉店後の夜、手とボウルと台は同じ奥行き

--- 2/5: refill1030-t-title-sumi-02.png ---
Morning before opening at tonari in soft daylight from the existing windows. Sumi stands behind the counter fitting his own packed terracotta bowl onto the stem of one hookah, then about to set an ONMO-type open HMD on its rim (HMD held in his other hand, empty, cold). Gentle concentrated half-smile toward the bowl, face large and clear. Bright warm-wood and cream palette.
8行:
人物      : sumi
場面      : 詰める→装着直前（炭なし）
台の型    : 木製ステム＋丸いガラスベース
HMD       : ONMO型（蓋なし低容器）を手に持つ・空・冷たい
炭        : なし
ホース    : 側面ポートからカウンター上に沿って手前へ自然にたわみ、ハンドルはカウンターに置く
吸い口    : なし
構図      : 腰上・正面寄り、朝の店内

--- 3/5: refill1030-t-title-sumi-03.png ---
Evening service at tonari. Sumi sits on a stool beside one finished hookah and takes a slow, satisfied exhale; a soft stream of smoke leaves HIS MOUTH and drifts upward away from his face. He holds the rigid handle loosely near his chin. On the bowl sits an ONMO-type open HMD with two small cube coals inside it (grey ash, faint red glow). Warm lamp light, tonari olive seats softly blurred.
8行:
人物      : sumi
場面      : 完成・喫煙
台の型    : 伝統の金属ステム（真鍮色）＋丸いガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 本体の側面ポート→床方向へ一度たわむ→人物の膝の前を横切らず脇から上がり→手のハンドルへ
吸い口    : なし（ハンドル直）
構図      : 腰上・斜め、夕方〜夜、台は人物の左隣

--- 4/5: refill1030-t-title-sumi-04.png ---
Close three-quarter view at the tonari work counter at night: Sumi uses small tongs to place the second cube coal into a Kaloud Lotus I+-type HMD that already sits on his terracotta bowl (lid set aside on the tray, one coal already inside). Eyes on the coal, calm craftsman focus. Only the warm counter lamp; background of tonari's wood and cream walls deep in shadow and blurred.
8行:
人物      : sumi
場面      : 炭を置く（HMD内へ）
台の型    : 角型モダンの黒いステム＋透明低重心ベース
HMD       : Lotus I+型（蓋は受け皿の上に外して置く・取手1本）
炭        : 小さな角炭2個（1個は置き済み、1個はトングで置く途中）
ホース    : 側面ポートから台の後ろへ回り、画面外ではなく台の脚元に置かれたハンドルで終わる
吸い口    : なし
構図      : 胸上・近距離、夜、トングとHMDと手は同じ奥行き

--- 5/5: refill1030-t-title-sumi-05.png ---
Quiet daytime break at tonari: Sumi sits sideways on the olive sofa near the existing window, one arm on the backrest, holding the rigid handle of the one hookah beside the low table, looking toward the viewer with a small kind smile as a thin wisp of smoke fades from his lips. The bowl wears a Lotus I+-type HMD with its lid closed (coals hidden, faint glow at the vents). Soft afternoon light.
8行:
人物      : sumi
場面      : 完成・喫煙（一服の合間）
台の型    : 透明ガラスの低い台（短いステム）
HMD       : Lotus I+型（蓋を閉じた状態・取手1本）
炭        : 小さな角炭2個（蓋の下で見えない）
ホース    : 側面ポート→低いテーブルの縁に沿ってたわむ→手のハンドル
吸い口    : なし
構図      : 膝上・斜め、昼、ソファと低いテーブル

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 2. `t-ext-mashiro` — ましろ（新規補充）

```text
【対象】t-ext-mashiro ／ タイトルアート拡充（シーシャ中心） ／ ましろ（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-ext-mashiro/ に refill1030-t-ext-mashiro-01.png 〜 refill1030-t-ext-mashiro-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/mashiro/chr_mashiro_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_mashiro_04_cherry_petals.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_mukai_shop.png（第3章・東京のmukai店内。青灰色の壁・オリーブ色の長椅子・珈琲カウンター・夕方の東京の窓景）
4. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
【方針】シーシャが主役級のタイトル絵。5枚で行動（喫煙／詰める／炭を置く／休憩）・時間帯・台の型・HMDモデルを変える。背景はmukaiの実背景から切り出した一角として描き、新しい店を作らない。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Mashiro, 22-year-old Japanese woman, staff at mukai (tonari's sister shop in Tokyo): pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes. Relaxed, gently sleepy, peer-friend vibe. Loves dark-leaf / cigar-leaf blends and heavy dense smoke.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1030-t-ext-mashiro-01.png ---
At mukai in the evening: Mashiro sits on the olive bench by the existing window with Tokyo dusk outside, and lets out one long, slow, velvety exhale; the dense smoke leaves her lips sideways and folds downward, kept below her eyes so her sleepy face stays clear. Her hand rests the rigid handle on her knee. Beside her on the low table, one finished hookah whose bowl wears an ONMO-type open HMD with two small coals inside.
8行:
人物      : mashiro
場面      : 完成・喫煙
台の型    : 伝統の金属ステム（いぶし銀）＋丸いガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→低いテーブルの縁からたわむ→膝の上のハンドル。脚を囲まない
吸い口    : なし
構図      : 膝上・斜め、夕方、mukaiの窓際のベンチ

--- 2/5: refill1030-t-ext-mashiro-02.png ---
Morning at the mukai coffee counter: Mashiro packs dark, glossy, finely chopped dark-leaf tobacco loosely into a ceramic bowl held in one palm, the other hand using a slim pick, half-lidded but attentive. Unlit: no foil yet, no HMD, no coal. The hookah body waits beside her with a bare small convex metal post on top. A cup of tea steams on the counter.
8行:
人物      : mashiro
場面      : 詰める（炭なし・HMDなし）
台の型    : 木製ステム＋丸いガラスベース
HMD       : なし
炭        : なし
ホース    : 台の側面ポートから下がりハンドルはカウンター上に置く
吸い口    : なし
構図      : 腰上・正面寄り、朝、mukaiの珈琲カウンター

--- 3/5: refill1030-t-ext-mashiro-03.png ---
Late night after mukai has closed: Mashiro sits sideways on the bench, cheek resting on her hand, sleepy contented smile at the viewer, the rigid handle held loosely in her other hand. One finished hookah stands on the floor beside the bench; on its bowl a Kaloud Lotus I+-type HMD with its lid closed and one short handle, faint glow at the vents. Only a small warm lamp and the blue-grey walls.
8行:
人物      : mashiro
場面      : 完成・喫煙（一服の合間）
台の型    : 黒い角型モダン（床置き・全高は座った肩くらい）
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 床置き台の側面ポート→床で一度たわむ→ベンチ脇から手へ。人物の前を大回りしない
吸い口    : なし
構図      : 膝上・横からやや斜め、深夜、mukai

--- 4/5: refill1030-t-ext-mashiro-04.png ---
Afternoon at mukai: Mashiro uses small tongs to set the second small cube coal into an ONMO-type HMD on the bowl of the hookah on the counter, sleepy eyes suddenly careful. One coal is already inside. Her teacup and saucer sit safely away from the hot parts.
8行:
人物      : mashiro
場面      : 炭を置く（HMD内へ）
台の型    : 伝統の金属ステム（真鍮）＋淡い緑のガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（1個置き済み・1個トングで置く途中）
ホース    : 側面ポートからカウンター奥へたわみ、ハンドルはカウンター上に置く
吸い口    : なし
構図      : 胸上・近距離、午後、手とHMDは同じ奥行き

--- 5/5: refill1030-t-ext-mashiro-05.png ---
Rainy evening, mukai window side: Mashiro sits at a small table holding a warm teacup in both hands, looking out of the existing rain-streaked window, then glancing back at the viewer with a soft half-smile. The finished hookah stands on the table beside her and its handle rests on the table edge; a thin trail of smoke lingers in the air from her last exhale (not from the hardware). Bowl with a Lotus I+-type HMD, lid closed.
8行:
人物      : mashiro
場面      : 完成・喫煙（お茶を飲む合間）
台の型    : 透明ガラスの低い台
HMD       : Lotus I+型（蓋を閉じる）
炭        : 小さな角炭2個（蓋の下）
ホース    : 側面ポート→テーブルの上をたわんで手前の縁→ハンドルがテーブル縁に置かれる
吸い口    : なし
構図      : 腰上・斜め、雨の夕方、窓の外は東京の街並み（文字なし）

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 3. `t-ext-naru` — なる（新規補充）

```text
【対象】t-ext-naru ／ タイトルアート拡充（シーシャ中心） ／ なる（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-ext-naru/ に refill1030-t-ext-naru-01.png 〜 refill1030-t-ext-naru-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/naru/chr_naru_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_naru_01_bakery_morning.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/kemurikusa.png（店内。長いカウンターと作業台・白い作業灯・半インダストリアル）
4. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_kemurikusa_outside_night.png（外観・夜。5枚目だけ使う）
5. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
【方針】シーシャ中心。5枚で行動（詰める／提供／炭を置く／試し吸い／片付け）・時間帯・台・HMDを変える。（第3章のなるはKEMURIKUSAを休業し各地で修行中。店の場面ではこの実背景を使う）背景の棚に並ぶ機材は遠くでぼかし、本数を増やさない。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Naru, 23-year-old Japanese man, rival shisha craftsman and former pastry-school student: short dyed silver-ash hair, sharp focused eyes, multiple silver rings, dark necklace, oversized plain dark tee with no lettering, stylish streetwear jacket. Confident, serious about craft; his flavor axis is vanilla and baked-sweets.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1030-t-ext-naru-01.png ---
KEMURIKUSA, early evening before opening: Naru stands at the long straight counter and loosely builds layers of vanilla-and-caramel flavored tobacco strands into a ceramic bowl with fine tweezers, rings catching the white task light, serious face large and clear. Unlit: no foil, no HMD, no coal. The hookah body next to him has a bare small convex metal post on top. Background prepped hookahs, if any, stay far, blurred and few.
8行:
人物      : naru
場面      : 詰める（炭なし）
台の型    : 黒い角型モダン＋透明ガラスベース
HMD       : なし
炭        : なし
ホース    : 台の側面ポートからカウンター上に沿い、ハンドルはカウンターに置く
吸い口    : なし
構図      : 腰上・やや俯瞰、開店前、KEMURIKUSAのカウンター

--- 2/5: refill1030-t-ext-naru-02.png ---
KEMURIKUSA at night service: Naru leans on the counter with a confident grin and slides one finished hookah toward the viewer (the viewer is the guest; no guest hands shown). The bowl wears a Kaloud Lotus I+-type HMD with the lid closed and its single handle turned aside; faint glow at the vents. The hose lies along the counter with the rigid handle pointing to the viewer.
8行:
人物      : naru
場面      : 完成（提供の瞬間）
台の型    : 伝統の金属ステム（銀）＋丸いガラスベース
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 側面ポート→カウンターの上をまっすぐ手前へ→手前を向いたハンドル
吸い口    : なし（使い捨てチップは付けない）
構図      : 胸上・正面寄り、夜、客席目線

--- 3/5: refill1030-t-ext-naru-03.png ---
KEMURIKUSA counter: Naru uses small tongs to set the second small cube coal into an ONMO-type open HMD on the bowl, eyes narrowed in precise focus, the other hand steadying the tray edge. One coal is already inside. Crisp white task light, warm ambient light behind.
8行:
人物      : naru
場面      : 炭を置く（HMD内へ）
台の型    : 木製ステム＋丸いガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 側面ポートからカウンター奥へたわみ、ハンドルは置かれたまま
吸い口    : なし
構図      : 胸上・近距離、夜、トングとHMDと手は同じ奥行き

--- 4/5: refill1030-t-ext-naru-04.png ---
Test draw at KEMURIKUSA: Naru sits on a bar stool beside the hookah, eyes closed, judging the sweetness after a draw; a short controlled stream of smoke leaves his lips. He holds the rigid handle near his chin. ONMO-type HMD with two coals on the bowl.
8行:
人物      : naru
場面      : 完成・喫煙（試し吸い）
台の型    : 黒い角型モダン（卓上）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→カウンターの縁からたわむ→手のハンドル。身体を囲まない
吸い口    : なし
構図      : 腰上・横からやや斜め、夜

--- 5/5: refill1030-t-ext-naru-05.png ---
After closing, in front of KEMURIKUSA at night (exterior official background): Naru crouches by the shop door with a hard equipment case open, checking a cleaned, empty ceramic bowl against the light, the disassembled hookah parts neatly in the case (glass base, stem, tray, coiled hose). No coal, no smoke, no assembled hookah. Calm proud expression.
8行:
人物      : naru
場面      : 準備中（分解して片付け・炭なし）
台の型    : 分解した部品（ガラスベース・ステム・受け皿・巻いたホース）
HMD       : なし
炭        : なし
ホース    : 巻いた状態でケース内。どこにも接続しない
吸い口    : なし
構図      : 全身寄り・斜め、夜、KEMURIKUSAの外観

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 4. `t-ext-samechan` — サメちゃん（新規補充）

```text
【対象】t-ext-samechan ／ タイトルアート拡充（シーシャ中心） ／ サメちゃん（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-ext-samechan/ に refill1030-t-ext-samechan-01.png 〜 refill1030-t-ext-samechan-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/samechan/chr_samechan_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_samechan_04_throne_pose.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_shishark.png（SHISHARK店内）
4. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_shishark_preparing_night.png（準備中の夜。3枚目で使う）
5. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
【方針】シーシャ中心。パペット（コロちゃん）は必ず右手、シーシャの作業とハンドルは左手。過去QCでホースの遠端が画面外に抜けて接続を確認できない点が残ったため、5枚ともホースの両端（側面ポートとハンドル）を画面内に入れる。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Samechan (Nagisa), 20-year-old Japanese young woman of ordinary adult height, owner of the shark-themed shisha shop SHISHARK: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, soft half-lidded eyes with blue highlights, small jagged shark-tooth grin, plain dark full-length trousers. A crowned shark hand puppet (Koro-chan) is ALWAYS worn on her RIGHT hand; it is a fabric toy, not alive. She does shisha work with her LEFT hand. Her personal hookah bowl is an unglazed terracotta bowl.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1030-t-ext-samechan-01.png ---
Inside SHISHARK in daytime: Samechan stands at her ocean-blue counter and packs her unglazed terracotta bowl with her LEFT hand using a small pick, while the crowned shark puppet on her RIGHT hand leans over the bowl as if supervising. Shy-proud smile, face clear under the hood brim. Unlit: no HMD, no coal. The hookah body beside her shows a bare small convex metal post on top.
8行:
人物      : samechan
場面      : 詰める（炭なし）
台の型    : 透明アクリルの小さな角型ベース（低重心）
HMD       : なし
炭        : なし
ホース    : 台の側面ポートから下がりハンドルはカウンターに置く
吸い口    : なし
構図      : 腰上・正面寄り、昼、SHISHARK店内

--- 2/5: refill1030-t-ext-samechan-02.png ---
SHISHARK booth in the evening: Samechan sits in her booth seat and exhales a soft stream of blue-tinted smoke from her lips, holding the rigid handle in her LEFT hand; the puppet on her RIGHT hand rests on her knee, "watching" with its toothy grin. On the hookah beside the booth table, her terracotta bowl wears an ONMO-type open HMD with two small coals inside.
8行:
人物      : samechan
場面      : 完成・喫煙
台の型    : 伝統の金属ステム（青い陽極酸化風）＋丸いガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→テーブルの縁からたわむ→左手のハンドル。膝を囲まない
吸い口    : なし
構図      : 膝上・斜め、夕方、SHISHARKのブース

--- 3/5: refill1030-t-ext-samechan-03.png ---
SHISHARK while preparing at night (use the preparing-night official background): Samechan, tongs in her LEFT hand, carefully sets the second small cube coal into a Kaloud Lotus I+-type HMD (lid resting on the tray) on her terracotta bowl; the puppet on her RIGHT hand is raised a little away from the heat, its mouth open as if cheering. Focused face, tongue slightly out.
8行:
人物      : samechan
場面      : 炭を置く（HMD内へ）
台の型    : 黒い角型モダン＋透明ベース
HMD       : Lotus I+型（蓋は受け皿の上に外して置く・取手1本）
炭        : 小さな角炭2個（1個置き済み・1個トングで置く途中）
ホース    : 側面ポートからカウンター奥へたわみ、ハンドルは置かれたまま
吸い口    : なし
構図      : 胸上・近距離、夜、準備中の店内

--- 4/5: refill1030-t-ext-samechan-04.png ---
SHISHARK aisle check: Samechan walks the shop aisle with the finished hookah set safely on a small low serving tray carried with her LEFT hand under it and the puppet hand steadying the glass base from the side, testing the guest route with a serious-cute shop-owner face. The HMD on the bowl is a Lotus I+-type with lid closed. Hose coiled loosely and secured on the tray with its handle, not dangling.
8行:
人物      : samechan
場面      : 完成（運ぶ）
台の型    : 透明ガラスの低い台（全高は胸より低い）
HMD       : Lotus I+型（蓋を閉じる）
炭        : 小さな角炭2個（蓋の下）
ホース    : 側面ポート→トレー上でゆるく一巻き→ハンドルがトレーに留まる。床に垂らさない
吸い口    : なし
構図      : 腰上・斜め、昼、SHISHARKの通路

--- 5/5: refill1030-t-ext-samechan-05.png ---
Blue evening light in SHISHARK: Samechan blows one small smoke ring from her lips toward the puppet on her RIGHT hand, which opens its fabric mouth as if catching it; she laughs with her shark-tooth grin. Her LEFT hand holds the rigid handle low. Hookah beside her with ONMO-type HMD and two coals. Only one ring.
8行:
人物      : samechan
場面      : 完成・喫煙（煙の輪）
台の型    : 伝統の金属ステム（銀）＋青みのガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→床側へ一度たわむ→左手のハンドル
吸い口    : なし
構図      : 腰上・斜め、夕方、店内

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 5. `t-city-ch5` — 第5章・橙須フィナーレ（新規補充）

```text
【対象】t-city-ch5 ／ 都会マップ（第2〜5章の緑を減らした版） ／ 第5章・橙須フィナーレ（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-city-ch5/ に refill1030-t-city-ch5-01.png 〜 refill1030-t-city-ch5-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1280x720 へ縮小して使う
【添付する画像（役割を区別する）】
1. 地形・画風の正: assets/backgrounds/bg_osu_map_day.png（第1章 橙須マップ。同じ街・同じ並び・同じカメラ）
2. 比較用（第5章の選定済みマップ。雰囲気の参考のみ・緑の量は真似しない）: remake/img/backgrounds/bg_osu_map_finale.webp（夜）/ bg_osu_map_finale_day.webp（昼）
【方針】第5章は世界大会から帰った橙須（第1章の街。名古屋の大須・栄がモデルの架空の街）。第1章マップと同じ地形・同じカメラ・同じ建物配置のまま、緑を大きく減らした「都会」の見え方にする。オーナーの過去指示「植物・緑が多すぎる」への対応セット。前回の都会版4枚（昼／夜ネオン／夕景／真昼の白）はすべて没。

【共通スタイル指針（正本: tools/bg_prompts.txt 冒頭・改変なし）】
画風参考: bg_eden_shop.png を第一基準にする。温かい照明の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調にしない。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。

Create a NEW variant of the attached chapter-1 town map (image 1) for the game's final chapter: the same fictional Japanese town (modelled loosely on Nagoya's Osu and Sakae, but fictional), seen from EXACTLY the same high bird's-eye camera, zoom and boundaries, with the same street grid, covered arcade crossroads, temple grounds, elevated railway, tall tower and dome and all building footprints in the same positions, so that the game's existing pins still line up. Do not move, add or delete landmarks or streets. Do not reproduce real famous buildings exactly.
URBAN DIRECTION: dense, lived-in city texture — mid-rise buildings, concrete and tiled roads, shop awnings, vents, water tanks, bicycles, utility poles, small paved squares. ZERO ivy, vines or rooftop gardens; at most a few small isolated street trees in the whole built-up area; the temple grounds and the central park strip keep only a thin, small amount of green with visible paths. Fine pixel-painter texture matching image 1, crisp architecture, not photographic, not 3D, not chunky low-res pixel art.
No lettering, numbers, place names, labels, map pins, arrows, route lines, compass, UI, borders, logos or watermark. No readable signs (shop signs are blank colored shapes). No large people; tiny pedestrians only for scale. No hookahs or giant smoke.

--- 1/5: refill1030-t-city-ch5-01.png ---
Homecoming morning: clear early light, long soft shadows, clean washed streets, warm cream/grey rooftops.
--- 2/5: refill1030-t-city-ch5-02.png ---
Eve of the final match, dusk: warm orange sky light on the roofs, first windows lit, arcade roof glowing softly; restrained, not neon-soaked.
--- 3/5: refill1030-t-city-ch5-03.png ---
Night (around 8–9 pm): readable deep indigo ambient light, amber windows and streetlamps, arcade and station lit; avoid purple floodlight and giant neon billboards; roofs and streets must stay readable.
--- 4/5: refill1030-t-city-ch5-04.png ---
Overcast after rain: soft grey daylight, wet reflective roads and arcade roof, muted urban palette, high readability.
--- 5/5: refill1030-t-city-ch5-05.png ---
Bright crisp winter noon: clear blue sky light, sharp shadows, no snow, high-contrast clean concrete city.

【生成後チェック】第1章マップと重ねてランドマーク・道・建物の位置がずれていない／緑は寺と公園の少量だけ／つた・屋上緑化なし／文字・ピン・ラベル・看板文字なし
```

## 6. `t-lime-volk` — ヴォルク（新規補充）

```text
【対象】t-lime-volk ／ LIMEアイコン候補 ／ ヴォルク（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-lime-volk/ に refill1030-t-lime-volk-01.png 〜 refill1030-t-lime-volk-05.png
【サイズ】正方形1:1・1024x1024 PNG・不透明（背景色あり）。ゲームでは丸く切り抜いて28〜136pxで表示する（remake/css/daily.css の .lime-face 等）。主題は中央の円（直径の約70%）に収め、四隅は切れてよい
【添付する画像（役割を区別する）】
1. 本人（顔・髪・服の正。本人寄りの案で使う）: assets/sprites/characters/volk/chr_volk_normal.png
2. 本人の顔アイコン（今のLIMEの代替表示）: assets/ui/face_icons/face_volk.png
3. 採用済みLIMEアイコンの雰囲気の例（形式の参考のみ・内容は真似しない）: assets/ui/lime/adam-b.png（物モチーフ）／ assets/ui/lime/minto-b.png（本人寄り）
【方針】オーナー「LIMEアイコン。本人用・私用のどちらか1枚でよい。本人寄りか物モチーフ」。選別の方針は「本人寄り」と「本人が選びそうな物モチーフ」の両方を残す（今回は物モチーフ多め）。前回の没理由: B案（金属製プローブ）が細身で穴あけ具にも見え、小さいと判読できない → 細長い物・細い線の物を主題にしない。太く単純なシルエットで、28pxでも何か分かること。
【共通スタイル指針】LIMEアイコン専用の共通指針は正本に無い。採用済み3案（PR #1175 の adam-b / minto-b / tsumugi-a。指示は asset_sources/lime-icons-1081-i01/evidence/generation.json、ブランチ art/1081-i01-lime-comparison）の書き方に倣い、ゲームの立ち絵と同じ落ち着いたアニメ調の塗りで、背景は無地に近くする。

CHARACTER (from data/characters.json and brand/character_profiles.md): Volk Ivanov, 37, Russian shisha professional who runs NIGHTSIDE and the Tokyo shop "Iron Smoke". Cold, sharp features, pale skin, short blonde hair, sleek black turtleneck; precise and measuring by nature, but he stops measuring when a guest puts the hose down and asks the person first. Private soft spot: he drinks black tea while licking his grandmother's homemade jam, and that one amount he never measures.
ICON RULES: one clear subject, large, centered inside the central circle; strong simple silhouette and value contrast readable at 28px; plain or softly graded background; restrained shading that matches the game's character art. No thin long tools (probes, needles, skewers, thermometers) as the subject. No shisha hardware in these icons. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image. No Cyrillic or any letters on jars, cups or labels (jar labels blank or absent).

--- 1/5: refill1030-t-lime-volk-01.png ---
本人寄り: Volk's head and shoulders, three-quarter view, calm cool gaze toward the viewer with the faintest hint of a smile, black turtleneck, short blonde hair fully inside the circle with safe margin. Plain cold slate-blue background with a soft warm rim light on one side. Same face as image 1.
--- 2/5: refill1030-t-lime-volk-02.png ---
本人寄り: close bust of Volk lifting a plain white porcelain tea cup near his chin, steam rising, eyes softened as if off duty. Cup and face both inside the circle; dark navy background.
--- 3/5: refill1030-t-lime-volk-03.png ---
物モチーフ: a single plain white tea cup of dark red-brown black tea on a saucer, seen from a slight high angle, with a small silver teaspoon resting on the saucer holding a glossy spoonful of deep red berry jam. Large, simple, centered; charcoal background with warm light.
--- 4/5: refill1030-t-lime-volk-04.png ---
物モチーフ: a small homemade jam jar with a gingham cloth cover tied with string (no label) beside a tea glass in a simple metal holder, both chunky and close together, warm amber tea and ruby jam glowing; dark slate background.
--- 5/5: refill1030-t-lime-volk-05.png ---
物モチーフ: one heavy, round, polished steel pocket stopwatch, lid open, face shown WITHOUT any numerals or marks (only two hands), lying on dark slate with a single red jam drop beside it — "measured man, unmeasured jam". Thick bold silhouette, no thin parts.

【生成後チェック】28px相当に縮小しても主題が分かる／主題が中央の円に収まる／細長い道具が主題になっていない／ラベル・文字・数字なし／本人寄り案は立ち絵と同じ顔
```

## 7. `t-logovar-b1` — ベース B1（金×深紫）のバリエーション（新規補充）

```text
【対象】t-logovar-b1 ／ 正式ロゴ マイナーチェンジ（残し候補の微調整版） ／ ベース B1（金×深紫）のバリエーション（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-logovar-b1/ に refill1030-t-logovar-b1-01.png 〜 refill1030-t-logovar-b1-05.png
【サイズ】横2:1・1774x887 前後 PNG（ベース候補と同じ比率）。背景はベースと同じ暗い無地（深紫黒 #100b19）。清書・透過化は採用後にこちらで行う
【添付する画像（役割を区別する）】
1. ベース候補（必ず添付・デザインの正）: asset_sources/logo-candidates-20261029/candidates/B1.png（Draft PR #1392・ブランチ muse/logo-candidates-20261029。オーナーPCの選別データにも同じ画像がある）
2. 現行ロゴ（字形の確認用）: remake/img/ui/ui_title_logo_rich.webp（元PNG: assets/ui/ui_title_logo_rich.png）
【方針】オーナーが残した候補 B1 を土台にした「マイナーチェンジ」。前回の微調整版はすべて没だった（没理由の記録は無い）ため、ベースのデザイン（書体の系統・配色・構成）は崩さず、変える点を1枚につき1〜2点に絞って違いが比べられるようにする。
【ロゴ共通の約束（正本: 正式ロゴ候補 README。PR #1392 asset_sources/logo-candidates-20261029/README.md・PR #1394 …-round2/README.md）】
- 正式タイトルは「水煙前線 -EN:CODE-」。漢字4字「水煙前線」の字形を正しく（簡体字・別字・崩れた偽漢字にしない）。サブタイトル「-EN:CODE-」は両端のダッシュをはっきり見せる（過去の検品で「ダッシュが弱い」が繰り返しの欠点）。
- タイトル画面のパレット: 深い茄子紺〜紫黒（#1d0f21 / #100b19）、シャンパンゴールド（#c8a05d / #e8c27a / #ffe2a6）、温かいクリーム（#fbe6c1）
- ロゴ文字以外の文字・数字・英字・記号・署名・透かし・ロゴマーク・UIを入れない。シーシャの絵や人物を足さない。

Keep the design of image 1 (lettering style, layout, color scheme, materials and mood). Make ONLY the specific change listed for each variation. The title text must read exactly: 水煙前線 and the subtitle exactly: -EN:CODE- (hyphen, E, N, colon, C, O, D, E, hyphen). Correct, standard Japanese kanji glyphs. Nothing else written anywhere. Background: the same plain dark background as image 1 (deep purple-black #100b19), no scenery.

--- 1/5: refill1030-t-logovar-b1-01.png ---
Reduce the gold dust to a few fine sparkles so the letter edges read cleaner; everything else identical.

--- 2/5: refill1030-t-logovar-b1-02.png ---
Make the subtitle -EN:CODE- slightly larger and heavier, with clearly visible end dashes and colon; title unchanged.

--- 3/5: refill1030-t-logovar-b1-03.png ---
Slightly heavier stroke weight of the gold Mincho kanji for small-size legibility; same gradient and dust.

--- 4/5: refill1030-t-logovar-b1-04.png ---
Add ONE thin, faint champagne-gold smoke wisp rising from behind the last character (very subtle); no other changes.

--- 5/5: refill1030-t-logovar-b1-05.png ---
Warmer, deeper gold gradient (more #c8a05d in the shadows, #ffe2a6 highlights only on top edges) with a subtle dark-purple outer glow for separation from the background.

【生成後チェック】「水煙前線」の4字が正しい字形／「-EN:CODE-」の両端ダッシュとコロンがはっきり見える／ベースと同じデザイン系統（別物になっていない）／余計な文字・透かし・絵なし／小さく縮小しても読める
```

## 8. `t-logovar-d5` — ベース D5（筆文字）のバリエーション（新規補充）

```text
【対象】t-logovar-d5 ／ 正式ロゴ マイナーチェンジ（残し候補の微調整版） ／ ベース D5（筆文字）のバリエーション（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-logovar-d5/ に refill1030-t-logovar-d5-01.png 〜 refill1030-t-logovar-d5-05.png
【サイズ】横2:1・1774x887 前後 PNG（ベース候補と同じ比率）。背景はベースと同じ暗い無地（深紫黒 #100b19）。清書・透過化は採用後にこちらで行う
【添付する画像（役割を区別する）】
1. ベース候補（必ず添付・デザインの正）: asset_sources/logo-candidates-20261029/candidates/D5.png（Draft PR #1392・ブランチ muse/logo-candidates-20261029（README: 墨絵風。銀灰の筆致で煙が尾を引く）。オーナーPCの選別データにも同じ画像がある）
2. 現行ロゴ（字形の確認用）: remake/img/ui/ui_title_logo_rich.webp（元PNG: assets/ui/ui_title_logo_rich.png）
【方針】オーナーが残した候補 D5 を土台にした「マイナーチェンジ」。前回の微調整版はすべて没だった（没理由の記録は無い）ため、ベースのデザイン（書体の系統・配色・構成）は崩さず、変える点を1枚につき1〜2点に絞って違いが比べられるようにする。
【ロゴ共通の約束（正本: 正式ロゴ候補 README。PR #1392 asset_sources/logo-candidates-20261029/README.md・PR #1394 …-round2/README.md）】
- 正式タイトルは「水煙前線 -EN:CODE-」。漢字4字「水煙前線」の字形を正しく（簡体字・別字・崩れた偽漢字にしない）。サブタイトル「-EN:CODE-」は両端のダッシュをはっきり見せる（過去の検品で「ダッシュが弱い」が繰り返しの欠点）。
- タイトル画面のパレット: 深い茄子紺〜紫黒（#1d0f21 / #100b19）、シャンパンゴールド（#c8a05d / #e8c27a / #ffe2a6）、温かいクリーム（#fbe6c1）
- ロゴ文字以外の文字・数字・英字・記号・署名・透かし・ロゴマーク・UIを入れない。シーシャの絵や人物を足さない。

Keep the design of image 1 (lettering style, layout, color scheme, materials and mood). Make ONLY the specific change listed for each variation. The title text must read exactly: 水煙前線 and the subtitle exactly: -EN:CODE- (hyphen, E, N, colon, C, O, D, E, hyphen). Correct, standard Japanese kanji glyphs. Nothing else written anywhere. Background: the same plain dark background as image 1 (deep purple-black #100b19), no scenery.

--- 1/5: refill1030-t-logovar-d5-01.png ---
Make the brush strokes slightly bolder and more confident while keeping the silver-grey ink and smoke tails; kanji structure easier to read.

--- 2/5: refill1030-t-logovar-d5-02.png ---
Shorten the smoke tails so they no longer cross into neighbouring characters; letters fully separated.

--- 3/5: refill1030-t-logovar-d5-03.png ---
Subtitle -EN:CODE- re-set in a clean small Mincho in champagne gold under the brush title, with clear dashes; title unchanged.

--- 4/5: refill1030-t-logovar-d5-04.png ---
Add a soft champagne-gold inner highlight along the top of each brush stroke (subtle), keeping silver-grey as the main color.

--- 5/5: refill1030-t-logovar-d5-05.png ---
Slightly more dry-brush (kasure) texture at stroke ends, and one longer smoke tail only from the final stroke of 線.

【生成後チェック】「水煙前線」の4字が正しい字形／「-EN:CODE-」の両端ダッシュとコロンがはっきり見える／ベースと同じデザイン系統（別物になっていない）／余計な文字・透かし・絵なし／小さく縮小しても読める
```

## 9. `t-logovar-j4` — ベース J4（勢いのある筆致）のバリエーション（新規補充）

```text
【対象】t-logovar-j4 ／ 正式ロゴ マイナーチェンジ（残し候補の微調整版） ／ ベース J4（勢いのある筆致）のバリエーション（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-logovar-j4/ に refill1030-t-logovar-j4-01.png 〜 refill1030-t-logovar-j4-05.png
【サイズ】横2:1・1774x887 前後 PNG（ベース候補と同じ比率）。背景はベースと同じ無地の明るい紙色、またはベースの背景色そのまま。清書・透過化は採用後にこちらで行う
【添付する画像（役割を区別する）】
1. ベース候補（必ず添付・デザインの正）: asset_sources/logo-candidates-20261029-round2/candidates/J4.png（Draft PR #1394・ブランチ muse/logo-candidates-20261029-round2（README: ストリートステッカー。マーカー文字＋シアン/マゼンタ/黄の多重影、破れた紙の縁）。オーナーPCの選別データにも同じ画像がある）
2. 現行ロゴ（字形の確認用）: remake/img/ui/ui_title_logo_rich.webp（元PNG: assets/ui/ui_title_logo_rich.png）
【方針】オーナーが残した候補 J4 を土台にした「マイナーチェンジ」。前回の微調整版はすべて没だった（没理由の記録は無い）ため、ベースのデザイン（書体の系統・配色・構成）は崩さず、変える点を1枚につき1〜2点に絞って違いが比べられるようにする。
【ロゴ共通の約束（正本: 正式ロゴ候補 README。PR #1392 asset_sources/logo-candidates-20261029/README.md・PR #1394 …-round2/README.md）】
- 正式タイトルは「水煙前線 -EN:CODE-」。漢字4字「水煙前線」の字形を正しく（簡体字・別字・崩れた偽漢字にしない）。サブタイトル「-EN:CODE-」は両端のダッシュをはっきり見せる（過去の検品で「ダッシュが弱い」が繰り返しの欠点）。
- タイトル画面のパレット: 深い茄子紺〜紫黒（#1d0f21 / #100b19）、シャンパンゴールド（#c8a05d / #e8c27a / #ffe2a6）、温かいクリーム（#fbe6c1）
- ロゴ文字以外の文字・数字・英字・記号・署名・透かし・ロゴマーク・UIを入れない。シーシャの絵や人物を足さない。

Keep the design of image 1 (lettering style, layout, color scheme, materials and mood). Make ONLY the specific change listed for each variation. The title text must read exactly: 水煙前線 and the subtitle exactly: -EN:CODE- (hyphen, E, N, colon, C, O, D, E, hyphen). Correct, standard Japanese kanji glyphs. Nothing else written anywhere. Background: keep image 1's own plain background color/paper; no scenery.

--- 1/5: refill1030-t-logovar-j4-01.png ---
Tone the multi-color offset shadows down to two colors (cyan and magenta) for a cleaner read; same marker lettering and torn-paper edge.

--- 2/5: refill1030-t-logovar-j4-02.png ---
Increase the lettering's stroke thickness and contrast so it reads at small sizes; keep the energetic slant.

--- 3/5: refill1030-t-logovar-j4-03.png ---
Shift the palette toward the title-screen palette: champagne-gold marker letters with deep-purple and cream offset shadows; same shapes.

--- 4/5: refill1030-t-logovar-j4-04.png ---
Make the torn-paper sticker edge tighter around the words (less empty paper), same lettering.

--- 5/5: refill1030-t-logovar-j4-05.png ---
Subtitle -EN:CODE- given its own small sticker strip under the title with clear dashes; title unchanged.

【生成後チェック】「水煙前線」の4字が正しい字形／「-EN:CODE-」の両端ダッシュとコロンがはっきり見える／ベースと同じデザイン系統（別物になっていない）／余計な文字・透かし・絵なし／小さく縮小しても読める
```

## 10. `t-logovar-l5` — ベース L5（静かな夜）のバリエーション（新規補充）

```text
【対象】t-logovar-l5 ／ 正式ロゴ マイナーチェンジ（残し候補の微調整版） ／ ベース L5（静かな夜）のバリエーション（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-logovar-l5/ に refill1030-t-logovar-l5-01.png 〜 refill1030-t-logovar-l5-05.png
【サイズ】横2:1・1774x887 前後 PNG（ベース候補と同じ比率）。背景はベースと同じ黒（マットブラック）。清書・透過化は採用後にこちらで行う
【添付する画像（役割を区別する）】
1. ベース候補（必ず添付・デザインの正）: asset_sources/logo-candidates-20261029-round2/candidates/L5.png（Draft PR #1394・ブランチ muse/logo-candidates-20261029-round2（README: 闇のミニマル。マットブラックの文字に細い銀の縁光のみ、銀の罫線1本。視認性は最も低い）。オーナーPCの選別データにも同じ画像がある）
2. 現行ロゴ（字形の確認用）: remake/img/ui/ui_title_logo_rich.webp（元PNG: assets/ui/ui_title_logo_rich.png）
【方針】オーナーが残した候補 L5 を土台にした「マイナーチェンジ」。前回の微調整版はすべて没だった（没理由の記録は無い）ため、ベースのデザイン（書体の系統・配色・構成）は崩さず、変える点を1枚につき1〜2点に絞って違いが比べられるようにする。
【ロゴ共通の約束（正本: 正式ロゴ候補 README。PR #1392 asset_sources/logo-candidates-20261029/README.md・PR #1394 …-round2/README.md）】
- 正式タイトルは「水煙前線 -EN:CODE-」。漢字4字「水煙前線」の字形を正しく（簡体字・別字・崩れた偽漢字にしない）。サブタイトル「-EN:CODE-」は両端のダッシュをはっきり見せる（過去の検品で「ダッシュが弱い」が繰り返しの欠点）。
- タイトル画面のパレット: 深い茄子紺〜紫黒（#1d0f21 / #100b19）、シャンパンゴールド（#c8a05d / #e8c27a / #ffe2a6）、温かいクリーム（#fbe6c1）
- ロゴ文字以外の文字・数字・英字・記号・署名・透かし・ロゴマーク・UIを入れない。シーシャの絵や人物を足さない。

Keep the design of image 1 (lettering style, layout, color scheme, materials and mood). Make ONLY the specific change listed for each variation. The title text must read exactly: 水煙前線 and the subtitle exactly: -EN:CODE- (hyphen, E, N, colon, C, O, D, E, hyphen). Correct, standard Japanese kanji glyphs. Nothing else written anywhere. Background: the same plain matte black background as image 1, no scenery.

--- 1/5: refill1030-t-logovar-l5-01.png ---
Slightly brighter and slightly thicker silver rim light on the letters so the title is readable on a dark screen; same matte black letters.

--- 2/5: refill1030-t-logovar-l5-02.png ---
Very faint deep-indigo glow behind the letters (like night air) to separate them from the background; nothing else.

--- 3/5: refill1030-t-logovar-l5-03.png ---
Silver rim light changed to a soft champagne-gold rim, same thickness as the base; silver rule line unchanged.

--- 4/5: refill1030-t-logovar-l5-04.png ---
Subtitle -EN:CODE- in pale silver with clear end dashes and colon, slightly larger; title unchanged.

--- 5/5: refill1030-t-logovar-l5-05.png ---
Add one very thin, faint grey smoke line drifting along the silver rule line; letters unchanged.

【生成後チェック】「水煙前線」の4字が正しい字形／「-EN:CODE-」の両端ダッシュとコロンがはっきり見える／ベースと同じデザイン系統（別物になっていない）／余計な文字・透かし・絵なし／小さく縮小しても読める
```

## 11. `t-nv-master` — マスター・フーカ（新規補充）

```text
【対象】t-nv-master ／ ビジュアルなしキャラ6件 ／ マスター・フーカ（王煙楼／煙楼先生・master_hookah）（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-nv-master/ に refill1030-t-nv-master-01.png 〜 refill1030-t-nv-master-05.png
【サイズ】縦長1枚・人物1人・1表情（normal）。人物の高さが1300px以上になる縦長キャンバス（例 1024x1536 以上）。背景は完全な単色マゼンタ（#FF00FF）。透過はこちらのスクリプトで行う（tools/pixelize.py → 896x1200）
【添付する画像（役割を区別する）】
1. 画質・質感の参照（顔や衣装は移さない）: assets/sprites/characters/minto/chr_minto_normal.png と assets/sprites/characters/ageha/chr_ageha_normal.png（立ち絵の画風の基準。.claude/skills/character-portrait-remaster/SKILL.md）
2. 年配男性の描き方の参照（顔・衣装は移さない）: assets/sprites/characters/sumi/chr_sumi_normal.png
【方針】オーナー指示「東方不敗マスターアジアみたいにしたい」は方向性として解釈する：老武人の威厳、長い白髪（三つ編み風）、堂々とした立ち姿。特定作品のキャラクターのデザイン・衣装・配色・紋章・名前は模写しない。
【正本】名前は王煙楼（ワン・イェンロウ）、通称は煙楼先生（data/characters.json の master_hookah、brand/character_profiles.md）。「マスター・フーカ」は旧名で本編では使わない（docs/owner_requests.md Z5）。58歳・身長165cmの中国の現役職人。龍龍水煙所の当主。白い長髭を先端で束ねる、長い白髪。設定案は麻の武術衣・素朴な土色の長衣（visual_concepts）、前夜祭では金色の装束（本編台詞）。静かで短い言葉、急がない。威圧や説教で強さを見せない。
【前回の没】金色の装束で両手を前に組んだ案（Draft PR #1384 の normal-prompt.txt）。今回は武人らしい姿勢と衣装の方向へ振る。

【共通スタイル指針（正本: docs/prompts/image_generation_guide.md「① マスター1枚を作る」から転記・改変なし）】
【画風】レトロJRPG風のアニメ調ピクセルアート。輪郭は濃くはっきり。
【背景】完全な単色マゼンタ(#FF00FF)。キャラの影や光を背景に落とさないこと。
画面に文字・ロゴ・フレームを入れないこと。
【追加の約束（正本: .claude/skills/character-portrait-remaster/SKILL.md）】高解像度の細かなドット絵のような質感で高級感のある仕上げ。滑らかなアニメ塗りや粗い巨大ドットにしない。1回の生成で1人・1表情。全身が入り、頭・手・足先が切れない。上下左右に余白。

【キャラ（5枚共通）】58歳のアジア人（中国）の老職人・武人の風格。長い白髪を後ろで一本の長い三つ編みにして背中〜腰へ垂らす。白い長い髭を先端で束ねる。太く鋭い白い眉、深いしわ、日焼けした肌、鋭いが穏やかな目。小柄（165cm）だが胸を張った堂々たる姿勢。手は大きく節のある職人の手。シーシャ・ホース・炭・煙は持たない（立ち絵には描かない）。武器は持たない。光のオーラ・魔法・陰陽の煙の演出なし。
【焼き込み禁止】文字・ロゴ・数字・紋章の文字・透かし・枠を入れない。
【NG】特定のアニメ作品の衣装（同じ配色・同じ形の長衣・マント・特定の紋章）をなぞらない。仙人・魔法使い風の杖、道教の札、光るオーラ。マゼンタ背景に影や光を落とす。

--- 1/5: refill1030-t-nv-master-01.png ---
衣装: 生成りの麻の武術衣（立襟・結び留め）に濃茶の帯、ゆったりした黒い袴風ズボン、布靴。ポーズ: 両腕を胸の前で組み、足を肩幅に開いて正面やや斜めに直立。表情: 口を結び、静かに相手を見定める目。
--- 2/5: refill1030-t-nv-master-02.png ---
衣装: 墨色の長衣（膝下丈・立襟）に控えめな金の縁取り、腰に濃紺の布帯。ポーズ: 片手を背中に回し、もう片方の手を胸の前で掌を相手へ向けて静かに構える（武術の礼のような所作）。表情: わずかに口角が上がる余裕。
--- 3/5: refill1030-t-nv-master-03.png ---
衣装: 前夜祭の正装として、深い金色の長衣（金糸の刺繍は控えめ・袖は広すぎない）に黒い内衣。武人の締まった着こなし。ポーズ: 拳と掌を胸の前で合わせる拱手の礼。三つ編みは肩越しに前へ垂らす。表情: 静かな威厳。
--- 4/5: refill1030-t-nv-master-04.png ---
衣装: 土色（焦げ茶〜砂色）の旅装の長衣に肩掛けの布、腰に布帯、脚絆。ポーズ: 片足を少し引き、体をやや斜めにして振り返るように顎を引いて立つ。両手は体の横で軽く開く。表情: 鋭い眼光、口は閉じる。
--- 5/5: refill1030-t-nv-master-05.png ---
衣装: 白に近い灰白色の功夫服（結び留め・袖口を少し折る）に黒い帯と黒い布靴。ポーズ: 背筋を伸ばし、両手を後ろで組んで胸を張る正面立ち。風で三つ編みと髭の先がわずかに揺れる。表情: 目を細めた穏やかな笑み、しかし隙のない立ち姿。

【生成後チェック】全身が入り手足が切れない／背景が一様なマゼンタで影が落ちていない／人物の高さ1300px以上／三つ編みの白髪・束ねた白髭・165cmの小柄だが堂々とした体格／シーシャ・武器・文字なし／既存アニメキャラの衣装の写しに見えない
```

## 12. `t-trailer-ch3-04` — 第3章予告カット4 会場と審査席（新規補充）

```text
【対象】t-trailer-ch3-04 ／ 章末予告スチル（第3〜5章） ／ 第3章予告カット4 会場と審査席（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-trailer-ch3-04/ に refill1030-t-trailer-ch3-04-01.png 〜 refill1030-t-trailer-ch3-04-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 会場の正（ゲーム内の大会ステージ。作業台の並び・照明の雰囲気）: assets/backgrounds/bg_tournament_stage.png（第3章の全国大会「東京 ナショナルステージ」でも本編はこの背景を使う）
2. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
3. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【場面】第3章の全国大会当日（data/chapter_previews/ch3.json の venue-judges。字幕「各審査員の持ち点は10。入れた点は戻せない。最後の合計で決まる」は映像の外で付く）。四つの作業台と審査席。結果表示・順位表・表彰台・スクリーンの文字は描かない。

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.

Story beat: national tournament day in Tokyo; four preparation stations on stage and the judges' table. The mood is "points once given cannot be taken back".

--- 1/5: refill1030-t-trailer-ch3-04-01.png ---
High wide establishing shot from the back of the dark hall: the elevated stage with FOUR identical preparation stations in a row, each with one unlit hookah, and the long judges' table in front of the stage, empty chairs. Haze in the stage lights, audience seats in the dark foreground. No people, or at most tiny indistinct staff silhouettes far away.
8行:
人物      : なし（無人、または遠景の小さなスタッフの影のみ）
場面      : 準備中（ボウル未装着）
台の型    : 4台とも同じ卓上台（ガラスベース＋金属ステム＋広い受け皿）
HMD       : なし
炭        : なし
ホース    : 各台の側面ポートからハンドルが作業台の上に置かれる
吸い口    : なし
構図      : 後方高所からの引き、本番前

--- 2/5: refill1030-t-trailer-ch3-04-02.png ---
Low angle from just behind the judges' table: the backs of the empty judges' chairs and the table edge in the dark foreground, a row of plain blank scoring cards face-down, and beyond it the four lit stations on the stage. Cool blue haze and warm spotlights.
8行:
人物      : なし
場面      : 準備中（ボウル未装着）
台の型    : 4台とも同じ卓上台
HMD       : なし
炭        : なし
ホース    : 作業台上に置かれる
吸い口    : なし
構図      : 審査席の背後・低い位置から舞台へ

--- 3/5: refill1030-t-trailer-ch3-04-03.png ---
Close on ONE empty station in the foreground: neatly laid tongs, a ceramic bowl, foil roll and a small coal tray (coals not yet lit, dark grey), the hookah body with a bare small convex metal post on top. The judges' table is small and blurred far behind, the other stations softly out of focus.
8行:
人物      : なし
場面      : 準備中（ボウル未装着・炭は未点火）
台の型    : 卓上台（ガラスベース＋銀のステム）
HMD       : なし（まだ使わない）
炭        : 未点火の角炭3個がトレーに（ボウルには載せない）
ホース    : 側面ポートからハンドルが作業台の端に置かれる
吸い口    : なし
構図      : 作業台の高さの近景、奥に審査席

--- 4/5: refill1030-t-trailer-ch3-04-04.png ---
Moments before the start: four competitors stand behind their stations seen as small backlit silhouettes from far away (no faces readable), the judges are four small seated silhouettes at the front table. Spotlights cut through haze. Tense stillness.
8行:
人物      : 匿名の小さなシルエット（顔は判別不能）
場面      : 準備中
台の型    : 4台とも同じ卓上台
HMD       : なし
炭        : なし
ホース    : 作業台上
吸い口    : なし
構図      : 客席中ほどからの中景

--- 5/5: refill1030-t-trailer-ch3-04-05.png ---
Side angle along the row of stations from the stage wing: the four stations recede in perspective, each with a simple analog clock face that has NO numerals or marks (only two hands), warm work lights on, the judges' table visible at the lower right edge. Late-afternoon tone.
8行:
人物      : なし
場面      : 準備中（ボウル未装着）
台の型    : 4台とも同じ卓上台
HMD       : なし
炭        : なし
ホース    : 作業台上
吸い口    : なし
構図      : 舞台袖から作業台の列を斜めに

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 13. `t-trailer-ch3-05` — 第3章予告カット5 なるの後ろ姿（工房）（新規補充）

```text
【対象】t-trailer-ch3-05 ／ 章末予告スチル（第3〜5章） ／ 第3章予告カット5 なるの後ろ姿（工房）（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-trailer-ch3-05/ に refill1030-t-trailer-ch3-05-01.png 〜 refill1030-t-trailer-ch3-05-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 本人（後ろ姿の髪・服の確認）: assets/sprites/characters/naru/chr_naru_normal.png
2. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
3. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【オーナー指示】シーシャ機材の大きさがおかしい、HMD・ボウルが変、植物をなくす・減らす（このバッチでは0）。
【場面】data/chapter_previews/ch3.json の naru-back（字幕「今日は、ここで出る味を見る」）。本編 ch3_naru_work では、なるはKEMURIKUSAを休業して修行中で、地方のイベントホールの控室（ラストチャンス予選）にいる。「工房」はこの控室の作業台として描く（新しい店や工房の内装を作らない）。

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.

Scale rule for this cut: the hookah is a TABLETOP model about 50–60cm tall; the bowl mouth and the HMD are about the width of Naru's palm; coals fingertip-sized; tray about 2.5x the HMD. Compare every hardware part with his hands and the table at the same depth.

--- 1/5: refill1030-t-trailer-ch3-05-01.png ---
Seated back view at a plain folding prep table in a regional event hall's backstage prep room: Naru from behind (identity by silver-ash short hair, streetwear jacket, rings on the hands; face not shown or only a sliver of profile). He packs a ceramic bowl in his palm with a pick (unlit), a worn notebook open beside him with only scribbled lines (no readable writing). The hookah body beside him has a bare small convex metal post. Plain painted walls, folding chairs, a single fluorescent light.
8行:
人物      : naru（後ろ姿）
場面      : 詰める（炭なし）
台の型    : 卓上台・黒い金属ステム＋透明ベース（全高は座った肩より低い）
HMD       : なし
炭        : なし
ホース    : 台の側面ポートから作業台の上に置かれる
吸い口    : なし
構図      : 背後やや斜め上・中景・控室

--- 2/5: refill1030-t-trailer-ch3-05-02.png ---
Standing back view, waiting: Naru from behind (identity by silver-ash short hair, streetwear jacket, rings on the hands; face not shown or only a sliver of profile). His finished hookah stands on the prep table in front of him at the same depth as his hands; its bowl carries an ONMO-type open HMD with two small cube coals inside. He has one hand resting on the table edge, the other in his jacket pocket. Warm work lamp on the table, cool backstage around.
8行:
人物      : naru（後ろ姿）
場面      : 完成（吸われるのを待つ）
台の型    : 卓上台・銀の金属ステム＋丸いガラスベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→作業台の上でたわむ→ハンドルは台の脇に置く
吸い口    : なし
構図      : 背後から腰上、手と台は同じ奥行き

--- 3/5: refill1030-t-trailer-ch3-05-03.png ---
Wide pull-back: the whole plain prep room with several bare folding tables; Naru small at the far table, back to us, hunched over his one hookah. Daylight from one high window. Equipment small and correct in scale against the tables and chairs.
8行:
人物      : naru（後ろ姿・小さく）
場面      : 詰める
台の型    : 卓上台
HMD       : なし
炭        : なし
ホース    : 作業台の上
吸い口    : なし
構図      : 引き・昼・部屋全体

--- 4/5: refill1030-t-trailer-ch3-05-04.png ---
Evening, warm lamp: over-the-shoulder from behind Naru as he uses small tongs to set the second coal into a Kaloud Lotus I+-type HMD (lid laid on the tray, one handle) on his bowl. His ringed fingers and the tongs are sharp; background dark.
8行:
人物      : naru（肩越しの後ろ姿）
場面      : 炭を置く（HMD内へ）
台の型    : 卓上台・真鍮色ステム＋ガラスベース
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（1個置き済み・1個トングで置く途中）
ホース    : 側面ポートから台の後ろへ、ハンドルは台の脇
吸い口    : なし
構図      : 肩越し・近景・夕夜

--- 5/5: refill1030-t-trailer-ch3-05-05.png ---
Side-rear angle: Naru stands beside his finished hookah after the judges' tasting, head slightly bowed, fists slowly unclenching; a thin thread of smoke drifts in the air above (not from the hardware). The bowl wears an ONMO-type HMD with two coals. Smoke and the hookah in the foreground at left, him at right.
8行:
人物      : naru（斜め後ろ）
場面      : 完成（試喫の後）
台の型    : 卓上台・黒い角型モダン
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 側面ポート→作業台→ハンドルは台の上に置く
吸い口    : なし
構図      : 斜め後ろ・前景に台、夕方

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 14. `t-trailer-ch3-06` — 第3章予告カット6 煙のみ（新規補充）

```text
【対象】t-trailer-ch3-06 ／ 章末予告スチル（第3〜5章） ／ 第3章予告カット6 煙のみ（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-trailer-ch3-06/ に refill1030-t-trailer-ch3-06-01.png 〜 refill1030-t-trailer-ch3-06-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
2. 比較用（ゲーム内の現行カット・内容の確認だけ。誤りは引き継がない）: assets/cgs/ch3_preview/06-cigar-smoke.webp
【場面】data/chapter_previews/ch3.json の cigar-smoke（字幕「ねえ、聞いた？　葉巻みたいな煙をまとった男の噂。」は映像の外で付く）。噂だけを見せるカット。人物・手・顔・シーシャ機材は描かない。

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.

Subject: smoke only. No people, no hands, no faces, no cigar or cigarette object, no hookah parts, no plants, no room details beyond darkness. The smoke is the actor; strong cinematic negative space.

--- 1/5: refill1030-t-trailer-ch3-06-01.png ---
Dense, heavy, cigar-like smoke fills most of the frame in slow layered curls and eddies, lit from the lower left by a warm amber glow; at the very bottom edge a tiny warm ember glow whose source is not shown.

--- 2/5: refill1030-t-trailer-ch3-06-02.png ---
A thin ribbon of smoke drifts horizontally across a wide black frame from left to right; huge black negative space; a pinpoint ember glow at the far left edge.

--- 3/5: refill1030-t-trailer-ch3-06-03.png ---
Pale blue-white smoke pours down from the upper right like a slow curtain, cold tones, a faint warm ember point far below.

--- 4/5: refill1030-t-trailer-ch3-06-04.png ---
Minimal: a single narrow vertical column of smoke rising at the left third, everything else black; the column twists once near the top.

--- 5/5: refill1030-t-trailer-ch3-06-05.png ---
Two drifting smoke layers at different depths, the near one soft and out of focus, the far one sharp, with a faint silhouette-like hollow shape in the smoke suggesting a figure but no actual person, face, hand or body.

【生成後チェック】人物・手・顔なし／植物なし／文字・ロゴ・数字なし／煙が主役で黒い余白が生きている
```

## 15. `t-trailer-ch5-03` — 第5章予告カット3 ロボットアーム接写（新規補充）

```text
【対象】t-trailer-ch5-03 ／ 章末予告スチル（第3〜5章） ／ 第5章予告カット3 ロボットアーム接写（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】work/picker-refill-1030/t-trailer-ch5-03/ に refill1030-t-trailer-ch5-03-01.png 〜 refill1030-t-trailer-ch5-03-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 機械の材質・色の参照（全体像は描かない）: assets/sprites/characters/shisha_9000/chr_shisha_9000_normal.png
2. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
3. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
4. 比較用（ゲーム内の現行カット・内容の確認だけ。誤りは引き継がない）: assets/cgs/ch5_preview/03-robot-arm.webp
【場面】data/chapter_previews/ch5.json の robot-arm（字幕「だから君と、比べてみたい。同じ葉で二本勝負です」）。SHISHA-9000の全体像は見せず、アームの先端とボウルの接写だけ（本編 ch5_match_day_arrival「細いアームが二本、台の上で折りたたまれている。脚の付け根から配線の束が床へ這い、その配線に小さな検品札」）。

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.

Subject: the slim matte industrial robot arm(s) of the shisha machine and the bowl area only; never show the whole machine, a robot face or a humanoid body. Arms are graphite and off-white with cable bundles at the joints, matching the materials of attached image 1. Anything the arm handles follows the same hookah structure rules as a human would.

--- 1/5: refill1030-t-trailer-ch5-03-01.png ---
Extreme close-up: ONE slim industrial robot arm's two-finger gripper holds a packed, unlit ceramic bowl (cup on a slim neck, foil stretched flat and folded over the rim with small holes) and lowers it toward the bare small convex metal post on top of a hookah stem. No coal, no HMD yet. Cold white lab light.
8行:
人物      : なし（ロボットアームの先端のみ）
場面      : 詰める・アルミ（装着直前・炭なし）
台の型    : 銀の金属ステム＋広い受け皿（先端は小さい凸型ポスト）
HMD       : なし
炭        : なし
ホース    : 画面外（描かない）
吸い口    : なし
構図      : 極接写・研究所の白い光

--- 2/5: refill1030-t-trailer-ch5-03-02.png ---
Two arms face each other from left and right: one gripper steadies the bowl's neck, the other holds slim metal tongs placing the second small cube coal into an ONMO-type open HMD sitting on the bowl (one coal already inside). Symmetric composition, cables visible at the arm joints.
8行:
人物      : なし（アーム2本の先端）
場面      : 炭を置く（HMD内へ）
台の型    : 銀のステム＋受け皿（上部のみ見える）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（1個置き済み・1個トングで置く途中）
ホース    : 画面外
吸い口    : なし
構図      : 左右対向の接写

--- 3/5: refill1030-t-trailer-ch5-03-03.png ---
Low angle in warm golden light: the finished bowl with a Kaloud Lotus I+-type HMD (lid closed, one short handle) seated on its tray and stem; a gripper is just releasing the HMD handle, fingers opening. Faint glow at the HMD vents only, no smoke from the hardware.
8行:
人物      : なし（アーム先端）
場面      : 完成（セット直後）
台の型    : 黒い金属ステム＋広い受け皿（台座まで見せる）
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 画面外
吸い口    : なし
構図      : 低い位置から煽る接写・金色の光

--- 4/5: refill1030-t-trailer-ch5-03-04.png ---
Mirrored side angle: bowl placed at the LEFT of the frame on its stem and tray, a single arm entering from the RIGHT and stretching a sheet of foil flat over the bowl's rim with a pressing tool. No coal, no HMD. Blue-grey lab light.
8行:
人物      : なし（アーム1本の先端）
場面      : 詰める・アルミ（炭なし）
台の型    : 銀のステム＋受け皿
HMD       : なし
炭        : なし
ホース    : 画面外
吸い口    : なし
構図      : 横アングル・左にボウル

--- 5/5: refill1030-t-trailer-ch5-03-05.png ---
Cold blue close-up: a fine sensor tip on a robot arm hovers a few centimeters ABOVE (not touching) an ONMO-type HMD with two glowing coals on the bowl, as if measuring heat; a small blank inspection tag (no writing) hangs from the arm's cable bundle.
8行:
人物      : なし（アーム先端）
場面      : 完成（計測中）
台の型    : 銀のステム＋受け皿（上部のみ）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 画面外
吸い口    : なし
構図      : 接写・青い冷光

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 16. `t-title-samechan` — サメちゃん（修正版）

```text
【対象】t-title-samechan ／ セットA：タイトルアート候補 ／ サメちゃん ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】title_art_samechan_new05_rainy_puddle.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-title-samechan/ に refill1030-t-title-samechan-01.png 〜 refill1030-t-title-samechan-05.png
【サイズ】元画像と同じ縦2:3（1024x1536）PNG・不透明
【添付する画像（役割を区別する）】
1. 元画像 title_art_samechan_new05_rainy_puddle.webp（構図・画風の正。これを編集する）
2. 本人確認用: assets/sprites/characters/samechan/chr_samechan_normal.png（顔・フード・右手のパペットの確認のみ）
【直す点（オーナー指示）】
- 植物をなくす（植え込み・街路の草木・鉢・つる・葉をすべて除去）
【そのまま残す点】
- 植物以外はすべて良い（オーナー評価）。人物・顔・ポーズ・水しぶき・パペット（右手）・長靴・路地・雨上がりの光・色・画風・構図・画面サイズ

【共通スタイル指針（正本: Draft PR #1287 prompts/samechan.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

EDIT RULE: Edit image 1 only where plants are. Remove every plant, shrub, hedge, potted plant, vine, weed and leaf from the scene and fill those areas with what would naturally be there on a quiet Japanese residential lane after rain (as specified per variation below), matching the existing perspective, light, wetness and reflections. Preserve EVERYTHING else exactly: the girl's face and expression, shark hood, the shark puppet on her RIGHT hand, pose, splash, droplets, boots, puddle, camera, crop, colors and cel-paint style. Do not add people, signs, text, numbers or logos. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.

--- 1/5: refill1030-t-title-samechan-01.png ---
Replace all greenery with plain light-grey concrete block walls and the existing house walls; puddle reflections show only sky and walls.
--- 2/5: refill1030-t-title-samechan-02.png ---
Replace greenery with low dark-metal mesh fences and painted house walls; keep the bright clearing sky reflected in the puddle.
--- 3/5: refill1030-t-title-samechan-03.png ---
Replace greenery with wooden fence boards and a utility pole (no signs/plates on it); slightly more wet sheen on the road.
--- 4/5: refill1030-t-title-samechan-04.png ---
Replace greenery with plain stucco walls and closed garage shutters (blank, no markings); keep the same warm sunlight breaking through.
--- 5/5: refill1030-t-title-samechan-05.png ---
Same as 1 but where the plants framed the edges, open up more sky and distant low rooftops so the frame stays balanced without any foliage.

【生成後チェック】植物が1つも残っていない／顔・パペット（右手）・ポーズが元と同じ／水たまりの映り込みにも植物がない／文字・ロゴなし
```

## 17. `t-title-minto` — みんと（修正版）

```text
【対象】t-title-minto ／ セットA：タイトルアート候補 ／ みんと ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】title_art_minto_new02_mint_cloud.webp（リポジトリでは asset_sources/title-arts/issue1243-candidates-20261028/candidates/minto/title_art_minto_new02_mint_cloud.png ＝ 採用中の assets/ui/title_arts/title_art_minto_05_mint_cloud.png と同じ絵）（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-title-minto/ に refill1030-t-title-minto-01.png 〜 refill1030-t-title-minto-05.png
【サイズ】元画像と同じ縦2:3（1024x1536）PNG・不透明
【添付する画像（役割を区別する）】
1. 元画像 title_art_minto_new02_mint_cloud.webp（リポジトリでは asset_sources/title-arts/issue1243-candidates-20261028/candidates/minto/title_art_minto_new02_mint_cloud.png ＝ 採用中の assets/ui/title_arts/title_art_minto_05_mint_cloud.png と同じ絵）（構図・画風の正。これを編集する）
2. 本人確認用: assets/sprites/characters/minto/chr_minto_normal.png
3. 店の正: assets/backgrounds/peppermint.png（背景を直す必要はないが、機材を足す位置の確認に使う）
4. 機材の実写: 選んだHMDをボウルに装着した実写（heat-management-closeups-20261009.md の No.05・06 等の元写真）と、台全体の実写。早見表・構造図は添付しない
5. 避ける例（模写しない）: asset_sources/shisha-hardware-reference/ng-examples/minto-hose-fork-20261009.png（ホースのY字分岐NG）
【直す点（オーナー指示）】
- ホースと本体（台）が変 → 正しい構造に描き直す
- シーシャにマウスピース（ハンドル）を付けたい → ホースの手元側の端に硬いハンドル（吸い口）を付け、彼女の手に持たせる
【そのまま残す点】
- 顔が良い（オーナー評価）。顔・表情（ウインク）・髪・角・衣装・ミント色の煙・構図・光・画風はそのまま

【共通スタイル指針（正本: Draft PR #1287 prompts/minto.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

IDENTITY (keep exactly as in image 1): Minto, adult Japanese woman (29, youthful idol-like look but adult proportions), concept cafe owner of PEPPERMINT: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and heart choker, small devil tail.

EDIT RULE: Keep image 1's face pixel-for-pixel in spirit: same eyes, wink, mouth, face shape, hair, horns, costume, pose of the body, mint-tinted smoke cloud, lighting, camera and crop. Redraw ONLY the hookah and its hose so that: one hookah body stands on the table/floor at the same depth as her; the hose leaves the hose port on the SIDE of the stem above the glass base, sags naturally, and ends in ONE rigid handle (mouthpiece) that she holds near her lips in the hand that previously held the hose; no hose forks, breaks, floats or wraps around her. The mint smoke comes from her mouth, not from the hardware. If the bowl top is visible: a ceramic bowl on a slim neck with ONE HMD model on it and coals only inside the HMD. No plants. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG: Y-shaped hose, a second loose hose end, handle without hose, hose plugged into the bowl or base bottom, bowl merged with the stem, giant HMD.

--- 1/5: refill1030-t-title-minto-01.png ---
Hookah: compact clear round glass base, short silver stem, round tray; ONMO-type open HMD with 2 small coals. White silicone hose, black rigid handle in her hand.
8行:
人物      : minto
場面      : 完成・喫煙
台の型    : 透明ガラスの小型台（銀の短いステム）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 側面ポート→テーブルの縁でたわむ→手のハンドル
吸い口    : ハンドル直（チップなし）
構図      : 元画像どおり
--- 2/5: refill1030-t-title-minto-02.png ---
Hookah: black metal stem with mint-green accents, smoky black glass base; Kaloud Lotus I+-type HMD with lid closed (single handle). Black hose, mint-green rigid handle.
8行:
人物      : minto
場面      : 完成・喫煙
台の型    : 黒い金属ステム＋スモークガラスベース
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 側面ポート→下へたわむ→手のハンドル
吸い口    : ハンドル直
構図      : 元画像どおり
--- 3/5: refill1030-t-title-minto-03.png ---
Same as 1, but the hookah body is moved fully into frame on the side opposite her face so the whole hose path is readable from port to handle.
8行:
人物      : minto
場面      : 完成・喫煙
台の型    : 透明ガラスの小型台
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 側面ポート→画面下側でゆるくたわむ→手のハンドル（全経路が画面内）
吸い口    : ハンドル直
構図      : 元画像どおり（台の位置だけ調整）
--- 4/5: refill1030-t-title-minto-04.png ---
Hookah: white-and-silver modern stem, clear base; ONMO-type HMD with 2 coals. Mint-green hose, silver rigid handle; she holds the handle slightly lower, just after exhaling.
8行:
人物      : minto
場面      : 完成・喫煙
台の型    : 白×銀のモダンステム＋透明ベース
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 側面ポート→たわむ→胸元の高さのハンドル
吸い口    : ハンドル直
構図      : 元画像どおり
--- 5/5: refill1030-t-title-minto-05.png ---
Keep the hookah body out of frame except the hose port region at the frame edge if the original framing needs it; the hose enters the frame from that port with a clear, continuous path to the rigid handle in her hand. No bowl top visible.
8行:
人物      : minto
場面      : 完成・喫煙
台の型    : 画面端に側面ポート付近だけ見える
HMD       : 画面外（描かない）
炭        : 画面外
ホース    : 画面端のポート→連続したホース→手のハンドル
吸い口    : ハンドル直
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 18. `t-trailer-ch5-01` — 第5章予告カット1 夜の店内・スマホ動画（修正版）

```text
【対象】t-trailer-ch5-01 ／ 章末予告スチル（第3〜5章） ／ 第5章予告カット1 夜の店内・スマホ動画 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】pattern2.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch5-01/ に refill1030-t-trailer-ch5-01-01.png 〜 refill1030-t-trailer-ch5-01-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 pattern2.webp（構図・画風の正。これを編集する）
2. 店の正: assets/backgrounds/bg_tonari_inside_night.png（第5章の帰郷後のtonari・夜）
3. 人物の確認: 元画像に写る人物の正規立ち絵（assets/sprites/characters/<id>/chr_<id>_normal.png。はじめなら hajime）
4. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
5. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- ハガル・炭が変 → ボウル・HMD・炭を正しい構造に
- 目の周りの光がいらない → 目元の発光・光彩・グロー・光る縁取りを消す（スマホ画面の光が顔に当たる程度の自然な照り返しだけ）
【そのまま残す点】
- 構図・人物・スマホ（画面はぼけた舞台光と人影のみ・文字なし）・夜の店内・色調・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. Also remove any glow, halo, sparkle or light effect around the eyes; the face is lit only naturally by the phone screen and the shop lamps. The phone screen stays a blurred stage-light image with no text or numbers.

--- 1/5: refill1030-t-trailer-ch5-01-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
8行:
人物      : 元画像の人物（そのまま）
場面      : 完成（夜の店内に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch5-01-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
8行:
人物      : 元画像の人物（そのまま）
場面      : 完成（夜の店内に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch5-01-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
8行:
人物      : 元画像の人物（そのまま）
場面      : 完成（夜の店内に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch5-01-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
8行:
人物      : 元画像の人物（そのまま）
場面      : 完成（夜の店内に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch5-01-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
8行:
人物      : 元画像の人物（そのまま）
場面      : 完成（夜の店内に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 19. `t-map-ch3` — 第3章 東京（修正版）

```text
【対象】t-map-ch3 ／ セットB：マップ候補 ／ 第3章 東京 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】ref-decided-ch3.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-map-ch3/ に refill1030-t-map-ch3-01.png 〜 refill1030-t-map-ch3-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1280x720 へ縮小して使う
【添付する画像（役割を区別する）】
1. 元画像 ref-decided-ch3.webp（構図・画風の正。これを編集する）
2. 画風の参考（元画像の画風を優先）: assets/backgrounds/bg_osu_map_day.png（第1章 橙須のマップ。細かなピクセルペインター調）
3. 比較用（ゲーム内の現行）: remake/img/backgrounds/bg_tokyo_map_day.webp / bg_tokyo_map_night.webp
【直す点（オーナー指示）】
- 植物を減らす（植物が多すぎる）
【そのまま残す点】
- 構図はこのまま・構図が良い（オーナー評価）。雰囲気が良い。「植物が多すぎる、他はいい」。東京マップは高円寺・中野の高架と路地＋上野の動物園・池を組み合わせた架空地区（tools/bg_prompts.txt TM01）。

【共通スタイル指針（正本: tools/bg_prompts.txt 冒頭・改変なし）】
画風参考: bg_eden_shop.png を第一基準にする。温かい照明の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調にしない。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。

EDIT RULE: This is a vegetation-reduction edit of image 1 ONLY. Preserve the exact camera, zoom, map boundaries, street layout, every building footprint and roof, landmarks, water and roads so that game pins placed at fixed coordinates still line up. Do not move, add or delete buildings, roads or landmarks. Do not change time of day or the overall color mood. Replace removed greenery with what a dense real city has there: plain concrete and asphalt, paved plazas, rooftops with vents and water tanks, awnings, parked bicycles, utility poles. ZERO ivy or vines on buildings, ZERO rooftop gardens. Greenery may remain only in the zoo / pond park area (if present in image 1), thinned so paths, animal enclosures and water stay visible. No lettering, numbers, place names, labels, pins, arrows, route lines, compass, UI, borders, logos or watermark. No large people.

--- 1/5: refill1030-t-map-ch3-01.png ---
Light reduction: remove about half of the street-side trees and planters in the built-up area; remove all vines and rooftop greenery.
--- 2/5: refill1030-t-map-ch3-02.png ---
Medium reduction: keep only 2–3 isolated street trees per district; all other urban greenery becomes paving and rooftops.
--- 3/5: refill1030-t-map-ch3-03.png ---
Strong reduction: urban blocks have almost no green at all; greenery remains ONLY in the designated park / landmark greens, which are also thinned so their paths and open ground are visible.
--- 4/5: refill1030-t-map-ch3-04.png ---
Same amount as 2, but replace removed greenery mostly with small paved squares, shop awnings and bicycle parking so the streets read livelier, still no new buildings.
--- 5/5: refill1030-t-map-ch3-05.png ---
Same amount as 3, with slightly crisper architecture edges and a cleaner, more urban grey/cream rooftop palette; same light direction and time of day as image 1.

【生成後チェック】元画像と重ねて建物・道路・ランドマークの位置がずれていない／緑の量が指示どおり減っている／つた・屋上緑化なし／文字・ピン・ラベルなし
```

## 20. `t-ext-hiyori` — ひより（修正版）

```text
【対象】t-ext-hiyori ／ タイトルアート拡充（シーシャ中心） ／ ひより ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】title_art_hiyori_new33_parts_wash_rack.png（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-ext-hiyori/ に refill1030-t-ext-hiyori-01.png 〜 refill1030-t-ext-hiyori-05.png
【サイズ】元画像と同じ縦2:3（1024x1536）PNG・不透明
【添付する画像（役割を区別する）】
1. 元画像 title_art_hiyori_new33_parts_wash_rack.png（構図・画風の正。これを編集する）
2. 本人確認用: assets/sprites/characters/hiyori/chr_hiyori_normal.png
3. 場所の正: assets/backgrounds/bg_tonari_inside_day.png（tonariの素材・色。新しい内装を足さない）
4. 機材の実写: 洗浄・乾燥中の部品の実写（ガラスベース・ステム・受け皿・ホース・ボウル）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- 謎植物が多い → 植物をなくす（鉢・つる・吊り草・葉をすべて除去）
- シーシャを図解どおりに（部品の形・積み順・接続を正しく）
【そのまま残す点】
- 構図はこのまま（オーナー指定）。人物・顔・ポーズ・洗い場の配置・光・画風

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

IDENTITY (keep exactly as in image 1): Hiyori, 25-year-old Japanese office worker and former tonari part-timer: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse (opaque lining) with small stand collar and short French sleeves, black slacks.

EDIT RULE: Keep image 1's composition, the woman, her face, pose, the wash/drying rack location, lighting and art style. (1) Remove every plant, pot, vine and leaf; fill those areas with the plain wall, tiles or shelf surface already present. (2) Redraw the shisha parts so they are physically correct for a WASHING / DRYING scene: parts are separated and each is a recognizable real part — a glass water base standing upside-down or upright to drain, a straight metal stem with its round ash tray (tray is a separate wide shallow dish or still on the stem), a hose hung in one simple loop to dry with its rigid handle at one end and its port connector at the other end, and a ceramic bowl (cup on a slim neck) drying rim-down. No charcoal, no HMD with coals, no smoke, no lit parts in a washing scene. Do not merge parts into each other or into the rack. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG: bowl fused to stem, cup-shaped stem top, hose with two handles or three ends, extra unexplained tubes, plants.

--- 1/5: refill1030-t-ext-hiyori-01.png ---
Parts as in image 1's positions, corrected. Hose: one hose hanging on a hook, port end and handle end both visible.
8行:
人物      : hiyori
場面      : 準備中（洗浄・乾燥。炭なし）
台の型    : 分解した部品（ガラスベース・ステム・受け皿・ボウル）
HMD       : なし
炭        : なし
ホース    : 1本をフックに一巻きで掛ける。両端が見える
吸い口    : ハンドルはホースの一端（チップなし）
構図      : 元画像どおり
--- 2/5: refill1030-t-ext-hiyori-02.png ---
Same as 1, but the glass base is shown upside-down on the drying rack, clearly transparent with a few water drops.
8行:
人物      : hiyori
場面      : 準備中（乾燥）
台の型    : 分解した部品
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり
--- 3/5: refill1030-t-ext-hiyori-03.png ---
Same as 1, and she holds the clean ceramic bowl in one hand with a towel, palm-sized, same depth as her hand.
8行:
人物      : hiyori
場面      : 準備中（拭き上げ）
台の型    : 分解した部品
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり
--- 4/5: refill1030-t-ext-hiyori-04.png ---
Same as 1, but the stem and tray are reassembled on the drained glass base at the side (no bowl fitted: top is a small convex metal post).
8行:
人物      : hiyori
場面      : 準備中（組み立て途中・ボウル未装着）
台の型    : ステム＋受け皿＋ガラスベース（先端は小さい凸型金属ポスト）
HMD       : なし
炭        : なし
ホース    : フックに一巻き（まだ接続しない）
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり
--- 5/5: refill1030-t-ext-hiyori-05.png ---
Same as 1 with fewer parts on the rack (only base, stem, bowl), giving the wall more calm empty space where the plants used to be.
8行:
人物      : hiyori
場面      : 準備中（乾燥）
台の型    : ガラスベース・ステム・ボウルのみ
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

【生成後チェック】植物0／部品がそれぞれ実物の形で融合していない／ホースは1本・端は2つ（ポート側とハンドル）／炭・HMD・煙なし／顔と構図が元と同じ／文字・ロゴなし
```

## 21. `t-trailer-ch4-06` — 第4章予告カット6 はじめの手とホース（修正版）

```text
【対象】t-trailer-ch4-06 ／ 章末予告スチル（第3〜5章） ／ 第4章予告カット6 はじめの手とホース ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】r6.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch4-06/ に refill1030-t-trailer-ch4-06-01.png 〜 refill1030-t-trailer-ch4-06-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 r6.webp（構図・画風の正。これを編集する）
2. 場所の参考（ドバイの宿の部屋・夜。本編は仮に bg_ch3_hotel_night を使用）: assets/backgrounds/bg_ch3_hotel_night.png
3. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
4. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
5. 避ける例（模写しない）: asset_sources/shisha-hardware-reference/ng-examples/ の3枚（ホースのY字分岐・短いハガル・足元を囲む大回り）
【直す点（オーナー指示）】
- ホース・本体が変／HMD・ボウルが変／ハガル・炭が変 → シーシャを図解どおりに（ベース→ステム→受け皿→ボウル→HMD→炭の積み順、側面ポートからホース1本、硬いハンドル）
【そのまま残す点】
- 構図・手（素手・素腕の匿名の手）・光・雨の窓など背景・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. Rebuild the whole hookah body as well if needed: glass water base with water only in its lower part, a straight vertical stem, a broad tray, and the single hose port on the side of the stem above the base. The hands stay anonymous bare hands. Story context: in this scene Hajime is caring for his travel gear in his Dubai room at night; if image 1 shows the hookah unlit, keep it unlit and draw NO coals and NO HMD-with-coals (a clean bowl only); if image 1 shows it lit, follow the HMD named in each variation.

--- 1/5: refill1030-t-trailer-ch4-06-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
8行:
人物      : 匿名の手（はじめ）
場面      : 完成（元画像が未点火なら炭・HMDなしの清潔なボウル）
台の型    : 元画像の型・色のまま、ベース／ステム／受け皿／側面ポートを正しく
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch4-06-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
8行:
人物      : 匿名の手（はじめ）
場面      : 完成（元画像が未点火なら炭・HMDなしの清潔なボウル）
台の型    : 元画像の型・色のまま、ベース／ステム／受け皿／側面ポートを正しく
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch4-06-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
8行:
人物      : 匿名の手（はじめ）
場面      : 完成（元画像が未点火なら炭・HMDなしの清潔なボウル）
台の型    : 元画像の型・色のまま、ベース／ステム／受け皿／側面ポートを正しく
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch4-06-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
8行:
人物      : 匿名の手（はじめ）
場面      : 完成（元画像が未点火なら炭・HMDなしの清潔なボウル）
台の型    : 元画像の型・色のまま、ベース／ステム／受け皿／側面ポートを正しく
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch4-06-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
8行:
人物      : 匿名の手（はじめ）
場面      : 完成（元画像が未点火なら炭・HMDなしの清潔なボウル）
台の型    : 元画像の型・色のまま、ベース／ステム／受け皿／側面ポートを正しく
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 22. `t-trailer-ch4-05` — 第4章予告カット5 南雲の後ろ姿（修正版）

```text
【対象】t-trailer-ch4-05 ／ 章末予告スチル（第3〜5章） ／ 第4章予告カット5 南雲の後ろ姿 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】r2.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch4-05/ に refill1030-t-trailer-ch4-05-01.png 〜 refill1030-t-trailer-ch4-05-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 r2.webp（構図・画風の正。これを編集する）
2. 人物の確認（後ろ姿の髪・スーツ）: assets/sprites/characters/nagumo/chr_nagumo_normal.png
3. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
4. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- ハガル・炭が変／HMD・ボウルが変 → 正しい構造に
【そのまま残す点】
- 構図・南雲の後ろ姿（単独）・雨の夜の窓とランプの色調・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions.

--- 1/5: refill1030-t-trailer-ch4-05-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
8行:
人物      : 南雲（後ろ姿のまま）
場面      : 完成（卓に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch4-05-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
8行:
人物      : 南雲（後ろ姿のまま）
場面      : 完成（卓に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch4-05-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
8行:
人物      : 南雲（後ろ姿のまま）
場面      : 完成（卓に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch4-05-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
8行:
人物      : 南雲（後ろ姿のまま）
場面      : 完成（卓に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch4-05-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
8行:
人物      : 南雲（後ろ姿のまま）
場面      : 完成（卓に置かれた一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 23. `t-trailer-ch3-03` — 第3章予告カット3 久世の視線（修正版）

```text
【対象】t-trailer-ch3-03 ／ 章末予告スチル（第3〜5章） ／ 第3章予告カット3 久世の視線 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】r7.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch3-03/ に refill1030-t-trailer-ch3-03-01.png 〜 refill1030-t-trailer-ch3-03-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 r7.webp（構図・画風の正。これを編集する）
2. 店の正（久世の店「煙幕」＝ゲーム内背景）: assets/backgrounds/bg_yohaku_shop.png（墨色の壁・ワイン色のベンチ・ずらした半透明スクリーン・細い鏡と複数の明かり。asset_sources/ch3-enmaku-20261025/README.md）
3. 人物の確認: assets/sprites/characters/kuze/chr_kuze_normal.png
4. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
5. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- ハガル・炭が変／HMD・ボウルが変／シーシャを図解どおりに → 正しい構造に
- 背景をゲームの店に合わせる → 久世の店「煙幕」の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン・細い鏡）の素材・色・家具で描き直す。新しい窓・棚・カウンターを作らない
【そのまま残す点】
- 人物はこのまま・構図はこのまま（オーナー指定）。久世の顔・視線・衣装・ポーズ・カメラ・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. Replace the background behind Kuze with his actual shop "Enmaku" from the attached official background: soot-black walls, wine-red bench, offset translucent screens, a slim mirror and several small lights. Do not invent new windows, shelves or counters; if the camera angle cannot be matched, keep the background tight and softly defocused showing only those materials and colors. No plants.

--- 1/5: refill1030-t-trailer-ch3-03-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
背景: 煙幕の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン）。
8行:
人物      : kuze（そのまま）
場面      : 完成（久世の前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch3-03-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
背景: 煙幕の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン）。
8行:
人物      : kuze（そのまま）
場面      : 完成（久世の前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch3-03-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
背景: 煙幕の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン）。
8行:
人物      : kuze（そのまま）
場面      : 完成（久世の前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch3-03-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
背景: 煙幕の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン）。
8行:
人物      : kuze（そのまま）
場面      : 完成（久世の前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch3-03-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
背景: 煙幕の実背景（墨色の壁・ワイン色のベンチ・半透明スクリーン）。
8行:
人物      : kuze（そのまま）
場面      : 完成（久世の前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 24. `t-trailer-ch5-06` — 第5章予告カット6 二台のシーシャ（修正版）

```text
【対象】t-trailer-ch5-06 ／ 章末予告スチル（第3〜5章） ／ 第5章予告カット6 二台のシーシャ ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】r9.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch5-06/ に refill1030-t-trailer-ch5-06-01.png 〜 refill1030-t-trailer-ch5-06-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 r9.webp（構図・画風の正。これを編集する）
2. 人物の確認（後頭部・肩のみ）: assets/sprites/characters/hajime/chr_hajime_normal.png
3. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
4. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
5. 避ける例（模写しない）: asset_sources/shisha-hardware-reference/ng-examples/ の3枚
【直す点（オーナー指示）】
- HMD・ボウルが変／ハガル・炭が変／ホース・本体が変 → 2台とも正しい構造に
【そのまま残す点】
- 構図（二台が並ぶ対決前の静けさ）・はじめの後頭部と肩・相手が判別できないこと・得票や勝敗の表示なし・雨の窓・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. There are TWO hookahs: fix BOTH. Each has its own single hose from its own side port to its own rigid handle; the two hoses never cross into each other or merge. Both use the same HMD model named in the variation (this is a same-leaf two-round match), and identical bowl proportions. Rebuild the bodies (base, stem, tray, port) where image 1 is wrong.

--- 1/5: refill1030-t-trailer-ch5-06-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
8行:
人物      : はじめ（後頭部・肩のみ）
場面      : 完成（対決前に並ぶ二台）
台の型    : 元画像の型・色のまま（2台）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch5-06-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
8行:
人物      : はじめ（後頭部・肩のみ）
場面      : 完成（対決前に並ぶ二台）
台の型    : 元画像の型・色のまま（2台）
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch5-06-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
8行:
人物      : はじめ（後頭部・肩のみ）
場面      : 完成（対決前に並ぶ二台）
台の型    : 元画像の型・色のまま（2台）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch5-06-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
8行:
人物      : はじめ（後頭部・肩のみ）
場面      : 完成（対決前に並ぶ二台）
台の型    : 元画像の型・色のまま（2台）
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch5-06-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
8行:
人物      : はじめ（後頭部・肩のみ）
場面      : 完成（対決前に並ぶ二台）
台の型    : 元画像の型・色のまま（2台）
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 25. `t-trailer-ch3-02` — 第3章予告カット2 ましろと茶杯（修正版）

```text
【対象】t-trailer-ch3-02 ／ 章末予告スチル（第3〜5章） ／ 第3章予告カット2 ましろと茶杯 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】pattern2.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch3-02/ に refill1030-t-trailer-ch3-02-01.png 〜 refill1030-t-trailer-ch3-02-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 pattern2.webp（構図・画風の正。これを編集する）
2. 店の正（mukai＝ゲーム内背景）: assets/backgrounds/bg_mukai_shop.png（3階の細長い空間・青灰色の壁・オリーブ色の長椅子・珈琲カウンター・夕方の東京の窓景）
3. 人物の確認: assets/sprites/characters/mashiro/chr_mashiro_normal.png
4. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
5. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- ハガル・炭が変／HMD・ボウルが変 → 正しい構造に
- 植物をなくす
- 背景をゲームの店に合わせる → mukaiの実背景の素材・色・家具で描き直す
【そのまま残す点】
- ましろ・茶杯・構図・光・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. Remove all plants. Replace the background with the actual mukai interior from the attached official background: blue-grey walls, olive bench, coffee counter, the existing Tokyo window view. Do not invent new windows, shelves or counters; if the angle cannot be matched, keep the background tight and softly defocused in those materials and colors.

--- 1/5: refill1030-t-trailer-ch3-02-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
背景: mukaiの実背景（青灰色の壁・オリーブの長椅子・珈琲カウンター）、植物0。
8行:
人物      : mashiro（そのまま）
場面      : 完成（ましろの前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch3-02-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
背景: mukaiの実背景（青灰色の壁・オリーブの長椅子・珈琲カウンター）、植物0。
8行:
人物      : mashiro（そのまま）
場面      : 完成（ましろの前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch3-02-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
背景: mukaiの実背景（青灰色の壁・オリーブの長椅子・珈琲カウンター）、植物0。
8行:
人物      : mashiro（そのまま）
場面      : 完成（ましろの前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch3-02-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
背景: mukaiの実背景（青灰色の壁・オリーブの長椅子・珈琲カウンター）、植物0。
8行:
人物      : mashiro（そのまま）
場面      : 完成（ましろの前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch3-02-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
背景: mukaiの実背景（青灰色の壁・オリーブの長椅子・珈琲カウンター）、植物0。
8行:
人物      : mashiro（そのまま）
場面      : 完成（ましろの前の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 26. `t-map-ch4` — 第4章 ドバイ（修正版）

```text
【対象】t-map-ch4 ／ セットB：マップ候補 ／ 第4章 ドバイ ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】ref-decided-ch4.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-map-ch4/ に refill1030-t-map-ch4-01.png 〜 refill1030-t-map-ch4-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1280x720 へ縮小して使う
【添付する画像（役割を区別する）】
1. 元画像 ref-decided-ch4.webp（構図・画風の正。これを編集する）
2. 画風の参考（元画像の画風を優先）: assets/backgrounds/bg_osu_map_day.png（第1章 橙須のマップ。細かなピクセルペインター調）
3. 比較用（ゲーム内の現行）: remake/img/backgrounds/bg_dubai_map.webp（昼）/ bg_dubai_map_dusk.webp（夕景）
【直す点（オーナー指示）】
- 植物を減らす（植物が多すぎる）
【そのまま残す点】
- 構図はこのまま・構図が良い（オーナー評価）。架空のドバイ。宿＝北西／大会会場＝北東／FESTA＝中央北／スーク＝西／中心地のカフェ＝東／路地裏のカフェ＝南西（remake/js/chapters/ch4-map-model.js の配置）を動かさない。

【共通スタイル指針（正本: tools/bg_prompts.txt 冒頭・改変なし）】
画風参考: bg_eden_shop.png を第一基準にする。温かい照明の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調にしない。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。

EDIT RULE: This is a vegetation-reduction edit of image 1 ONLY. Preserve the exact camera, zoom, map boundaries, street layout, every building footprint and roof, landmarks, water and roads so that game pins placed at fixed coordinates still line up. Do not move, add or delete buildings, roads or landmarks. Do not change time of day or the overall color mood. Replace removed greenery with what a dense real city has there: plain concrete and asphalt, paved plazas, rooftops with vents and water tanks, awnings, parked bicycles, utility poles. ZERO ivy or vines on buildings, ZERO rooftop gardens. Palm trees may remain only as short sparse rows along the creek promenade and at the arena forecourt; no lush gardens. Desert-city palette of sand, white and pale stone. No lettering, numbers, place names, labels, pins, arrows, route lines, compass, UI, borders, logos or watermark. No large people.

--- 1/5: refill1030-t-map-ch4-01.png ---
Light reduction: remove about half of the street-side trees and planters in the built-up area; remove all vines and rooftop greenery.
--- 2/5: refill1030-t-map-ch4-02.png ---
Medium reduction: keep only 2–3 isolated street trees per district; all other urban greenery becomes paving and rooftops.
--- 3/5: refill1030-t-map-ch4-03.png ---
Strong reduction: urban blocks have almost no green at all; greenery remains ONLY in the designated park / landmark greens, which are also thinned so their paths and open ground are visible.
--- 4/5: refill1030-t-map-ch4-04.png ---
Same amount as 2, but replace removed greenery mostly with small paved squares, shop awnings and bicycle parking so the streets read livelier, still no new buildings.
--- 5/5: refill1030-t-map-ch4-05.png ---
Same amount as 3, with slightly crisper architecture edges and a cleaner, more urban grey/cream rooftop palette; same light direction and time of day as image 1.

【生成後チェック】元画像と重ねて建物・道路・ランドマークの位置がずれていない／緑の量が指示どおり減っている／つた・屋上緑化なし／文字・ピン・ラベルなし
```

## 27. `t-trailer-ch4-02` — 第4章予告カット2 世界大会の会場（修正版）

```text
【対象】t-trailer-ch4-02 ／ 章末予告スチル（第3〜5章） ／ 第4章予告カット2 世界大会の会場 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】r9.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch4-02/ に refill1030-t-trailer-ch4-02-01.png 〜 refill1030-t-trailer-ch4-02-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 r9.webp（構図・画風の正。これを編集する）
2. 会場の参考（本編は仮に大会ステージ背景を使用）: assets/backgrounds/bg_tournament_stage.png
3. 人物の確認: 元画像に写る選手の正規立ち絵（判別できる人物がいる場合のみ）
4. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp
5. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- ハガル・炭が変／HMD・ボウルが変 → 画面内のすべての台を正しい構造に
【そのまま残す点】
- 構図・会場（ドバイ グランド・スモーク・アリーナ）・人物・垂れ幕は無地・色調・画風

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. Apply the correction to EVERY hookah in the frame, including small background ones; distant ones may be simplified but must still read as bowl + HMD on a tray and stem, never coals on a bare bowl. No results, scores or text on banners or screens.

--- 1/5: refill1030-t-trailer-ch4-02-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
8行:
人物      : 元画像の選手（そのまま）
場面      : 完成（大会の作業台の上）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 2/5: refill1030-t-trailer-ch4-02-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
8行:
人物      : 元画像の選手（そのまま）
場面      : 完成（大会の作業台の上）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 3/5: refill1030-t-trailer-ch4-02-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
8行:
人物      : 元画像の選手（そのまま）
場面      : 完成（大会の作業台の上）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch4-02-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
8行:
人物      : 元画像の選手（そのまま）
場面      : 完成（大会の作業台の上）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

--- 5/5: refill1030-t-trailer-ch4-02-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
8行:
人物      : 元画像の選手（そのまま）
場面      : 完成（大会の作業台の上）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像どおり

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```

## 28. `t-trailer-ch4-04` — 第4章予告カット4 スミの横顔（修正版）

```text
【対象】t-trailer-ch4-04 ／ 章末予告スチル（第3〜5章） ／ 第4章予告カット4 スミの横顔 ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】pattern2.webp（オーナーPCの選別データにある原寸。リポジトリには無い）
【保存先】work/picker-refill-1030/t-trailer-ch4-04/ に refill1030-t-trailer-ch4-04-01.png 〜 refill1030-t-trailer-ch4-04-05.png
【サイズ】横16:9・原寸 1672x941 前後（または 2048x1152）PNG・不透明。ゲームでは 1664x936 に収めて表示（asset_sources/ch3-preview/adoption.json）
【添付する画像（役割を区別する）】
1. 元画像 pattern2.webp（構図・画風の正。これを編集する）
2. 店の正（出発前のtonari＝本編 ch4_sumi_training の場所）: assets/backgrounds/bg_tonari_inside_day.png / bg_tonari_inside_night.png
3. 人物の確認（帽子・四角い眼鏡・髭・前掛け）: assets/sprites/characters/sumi/chr_sumi_normal.png（考える表情は chr_sumi_thinking.png）
4. 画風の参照（絵の塗り・線のみ。場面・人物は移さない）: 採用済み第1章予告スチル assets/cgs/ch2_preview/04-tsumugi-water.webp と assets/cgs/ch2_preview/01-sumi-silence.webp（「画風が合わない」の指摘があるため、この2枚の塗りと線に強く寄せる）
5. 機材の実写（形と縮尺）: 選んだHMDをボウルに装着した実写と台全体の実写（heat-management-closeups-20261009.md No.05・06 等の元写真、installed-and-handheld-scale-20261009.md の出典）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- HMD・ボウルが変／ハガル・炭が変 → 正しい構造に
- 謎植物が多い → 植物0
- 背景が実際と違う・背景が謎の店舗 → tonariの実背景に
- 画風が合わない → 採用済み第1章予告スチル（OVAセル画調）に合わせる
【そのまま残す点】
- スミさんの横顔の構図とカメラ（指示に「構図はこのまま」は無いが、横顔の寄りというカットの狙いは保つ）。回想・若い頃の姿にしない

【共通スタイル指針（正本: asset_sources/trailer-90s-anime-concept/prompts/04-tsumugi-water.v2.txt。第1章予告の採用カットの指示文から転記・改変なし）】
Character input images are IDENTITY MODEL SHEETS ONLY: preserve face geometry, hair, clothing and accessories, but invent the camera, acting, body pose, perspective and light specifically for the described story action. Never paste upright sprites onto an existing background. No characters looking into lens for a promotional portrait.
Art direction: lavish hand-drawn 1994 Japanese OVA animation production cel, precise delicate dark hand-ink contours, expressive 1990s eye/face drawing without changing the canonical person, matte painted cel colors with 2-3 clear flat shadow levels, graphic restrained hair highlight shapes, carefully composed gouache-painted perspective backgrounds. Quiet muted blue/cyan against warm amber, subtle optical halation confined to lamps, very fine analog film grain. The drawing itself is cel animation, not a VHS filter; no scanlines, glossy airbrushed skin, photorealism, modern shiny digital render, pixel art or excessive bloom. Natural believable anatomy and hands.
Do not add any readable text, subtitles, logo, watermark, timecode, UI graphics, borders or collage. Keep cinematic negative space and clear motion paths. No ornamental plants in interiors. Preserve emotional ambiguity; no fantasy transformation or added dramatic event.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.
Wordless still for an in-game chapter preview: no subtitles, no title, no results board, no scores, no rankings, no podium. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
（上の指針の1行目「カメラや演技を新しく作る」は新規生成向け。この修正版では元画像の構図・カメラ・演技を優先する）

EDIT RULE: Edit image 1 with precise hardware corrections only; preserve composition, camera, characters (faces, clothes, poses), lighting, color grade and the matte cel-OVA drawing. Redraw the hookah top so it is physically correct: one ceramic bowl (cup on a slim neck, total height about 1.3–1.5x the HMD width) seated on the stem above a broad ash tray about 2.5x the HMD width; on the bowl rim exactly ONE HMD of the model named in that variation; small cube coals (fingertip size, grey ash with a little red glow, no flames) only INSIDE the HMD — never on bare foil or the ceramic. Smoke only from a person's mouth or as a faint residual haze in the air, never from the HMD, hose root or base. Keep one continuous hose from the side port to one rigid handle. Do not change hand size or poses, subject scale or image dimensions. This is a larger repaint: re-render the whole image in the art direction above, matching attached image 4's cel paint, line and color, while keeping image 1's camera and Sumi's profile pose. Replace the background with the actual tonari interior (wood counter, cream walls, olive seats, small Turkish mosaic lamps) from the attached official background; no invented shelving walls, windows or decor; no plants at all. Sumi must match his official portrait (black newsboy cap, square black glasses, short black beard, charcoal shirt, brown apron), age 46, not a flashback.

--- 1/5: refill1030-t-trailer-ch4-04-01.png ---
HMD: ONMO-type open low cup, 2 coals inside.
背景: tonariの実背景（木のカウンター・クリーム色の壁・オリーブ色の席・小さなモザイクランプ）、植物0。
8行:
人物      : sumi（横顔のまま）
場面      : 完成（スミさんの手元の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 元画像の経路のまま1本（ポート→ハンドル）
吸い口    : 元画像のまま
構図      : 元画像のカメラ・横顔の寄り（背景と画風は描き直す）

--- 2/5: refill1030-t-trailer-ch4-04-02.png ---
HMD: Kaloud Lotus I+-type with its matching lid CLOSED and one short handle; coals hidden under the lid, faint glow at the vents only.
背景: tonariの実背景（木のカウンター・クリーム色の壁・オリーブ色の席・小さなモザイクランプ）、植物0。
8行:
人物      : sumi（横顔のまま）
場面      : 完成（スミさんの手元の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像のカメラ・横顔の寄り（背景と画風は描き直す）

--- 3/5: refill1030-t-trailer-ch4-04-03.png ---
HMD: ONMO-type with 2 coals, one of them more ash-grey than the other; the bowl top seen from slightly higher so both coals are clearly visible inside the cup's rim (no coal outside it).
背景: tonariの実背景（木のカウンター・クリーム色の壁・オリーブ色の席・小さなモザイクランプ）、植物0。
8行:
人物      : sumi（横顔のまま）
場面      : 完成（スミさんの手元の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内・縁の内側に収まる）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像のカメラ・横顔の寄り（背景と画風は描き直す）（ボウル上部だけ少し見下ろし気味に）

--- 4/5: refill1030-t-trailer-ch4-04-04.png ---
HMD: Kaloud Lotus I+-type with the lid set aside on the tray and 2 coals visible inside the open HMD.
背景: tonariの実背景（木のカウンター・クリーム色の壁・オリーブ色の席・小さなモザイクランプ）、植物0。
8行:
人物      : sumi（横顔のまま）
場面      : 完成（スミさんの手元の一台）
台の型    : 元画像の台の型・色のまま
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像のカメラ・横顔の寄り（背景と画風は描き直す）

--- 5/5: refill1030-t-trailer-ch4-04-05.png ---
HMD: ONMO-type with 2 coals, and the bowl/HMD drawn slightly smaller and more refined in proportion (if image 1's bowl looked oversized), keeping the neck long.
背景: tonariの実背景（木のカウンター・クリーム色の壁・オリーブ色の席・小さなモザイクランプ）、植物0。
8行:
人物      : sumi（横顔のまま）
場面      : 完成（スミさんの手元の一台）
台の型    : 元画像の台の型・色のまま
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個
ホース    : 元画像の経路のまま1本
吸い口    : 元画像のまま
構図      : 元画像のカメラ・横顔の寄り（背景と画風は描き直す）

【生成後チェック（1つでもNGなら直すか作り直す。正本: drawing-sheet/README.md §3）】
- 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- 完成・喫煙の台はHMD付き。直炭になっていない
- HMDの蓋・取手・通気口が同じ1モデルの組
- ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- 人物を囲む輪・不自然な大回りがない
- マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- 煙は口元から。HMD・ホース根元・チェーンから出ていない
- 文字・ロゴ・透かし・UIが焼き込まれていない
```
