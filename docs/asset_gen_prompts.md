# 画像生成プロンプト集（codex用）— シーシャ作りパート＋立ち絵

> 2026-10-09 TA13: 制作済みのヒロイン原画は[共通の採用候補一覧](../asset_sources/title-daily-heroines-20261009/README.md)から選ぶ。今回の19案と旧15案を保存し、ゲームの差し替え・自動採用は行わない。原画・生成指示・実参照SHA・目視メモを候補集に残す。

> 2026-10-09 CI71: [首掛けマイマウスピースがチェーンだけ／ホースが実機につながらない生成ミスの出力後QA](../asset_sources/shisha-hardware-reference/visual-qa-necklace-hose-20261009.md)。キャラは正規立ち絵優先。**チェーン＋立体吸い口本体**と**ホースポートからハンドルまでの連続性**を検品し、NGなら再生成（構図上の遮蔽・見切れは自然なら可）。

> 2026-10-09 CI70: [追加マウスピース3点＋ハンドル4点の実物写真とルール](../asset_sources/shisha-hardware-reference/mouthpiece-handle-skins-20261009.md)。先端チップ（消耗品/マイチップ）・硬いハンドル・柔らかいホースを分ける。色・素材・装飾は自由、首のチェーンはホースではない。スキンは構想のみ、実装変更なし。トングは実物資料待ち。

> 2026-10-09 CI69: [ホースとマウスピースの実物6写真・外部調査・誤描写防止](../asset_sources/shisha-hardware-reference/hose-and-mouthpieces-20261009.md)。[自作のホース接続図](../asset_sources/shisha-hardware-reference/hose-mouthpiece-connections-20261009.svg)も見る。横のポート→1本のホース→硬い持ち手→着脱式衛生チップ→人物の口元。使い捨てチップ／首掛けマイチップは別の選択肢で、首の紐をホースにしない。

> 2026-10-09 CI68: [構造図3点と部品/空気の通り道](../asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md)、[ハガルの伝統型・ファンネル型・ボルテックス型、アルミ穴、炭配置、HMD比較調査](../asset_sources/shisha-hardware-reference/bowl-interiors-foil-coal-placement-20261009.md)。[自作の内部模式図](../asset_sources/shisha-hardware-reference/bowl-interiors-types-20261009.svg)も参照。実際のパーツ配置と既存ゲーム工程を優先し、唯一の炭/穴の正解と決めない。

> 2026-10-09 CI67: [アルミ・煙突・シーシャの構図9写真](../asset_sources/shisha-hardware-reference/usage-and-installation-20261009.md)と[これまでの37写真を横断したAI誤描写防止ガイド](../asset_sources/shisha-hardware-reference/ai-generation-structural-pitfalls.md)。ボウル内部の穴の型式、アルミ小穴、HMD・チムニー・トレー、人物・ホース・複数台の接続を区別。既存ゲーム工程・設定は維持。

> 2026-10-09 CI66: [アルミ・HMD・炭の近接写真9点](../asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md)。アルミに炭を置く方式と別体HMDを区別し、炭の灰と赤熱の描写、器具のスリットと取っ手、陶器の大きさと接続を参考にする。既存の穴あけ・機材を変更しない。

> 2026-10-09 CI65: [実際の喫煙シーンとヒートマネジメントの参考10点](../asset_sources/shisha-hardware-reference/smoking-and-heat-management-20261009.md)。人物の使い方・比率・ホース・煙の描写、ボウルとHMDの違い、炭をトングで扱う位置関係を参考にする。写真の人物・製品は完コピしない。

> 2026-10-09 CI64: シーシャ台を描く際は[実物写真9種の縮小一覧と生成ルール](../asset_sources/shisha-hardware-reference/README.md)を必ず参照。形と材質の理解が目的で、メーカー商品の模写は禁止。色・装飾・比率の創作は自由。描かない指定は優先。

> 2026-10-08 CI62／63: 制作成功カットインの[目元／漫画コマの2案](../asset_sources/craft-success-cutins/concepts-v1-20261008/README.md)。同じ炭焼き画面とはじめを参照した比較モックアップ。[目元の生成指示](../asset_sources/craft-success-cutins/concepts-v1-20261008/eyes-prompt.txt)は工程共通の斜め帯、[漫画コマの生成指示](../asset_sources/craft-success-cutins/concepts-v1-20261008/comic-prompt.txt)は成功した手元と笑顔。本編接続・演出頻度・採用案は未決定。

> 2026-10-08 TA08〜12: [新版19案](../asset_sources/title-art/heroine-concepts-v2-personality-pixel-20261008/README.md)。サメちゃんを加えた6人×3案＋みんとの公私の中間1案。メーカーの異なる木／真鍮／ガラス／ピンクのカット形／黒い金属／青いキューブ型の台を個別参照し、場所と色も分ける。現行ましろタイトル絵はドットの画風だけを参照。[生成指示の記録](../asset_sources/title-art/heroine-concepts-v2-personality-pixel-20261008/make-prompts.py)と各 `.prompt.txt` を保存。最初の15案は比較履歴。

> 2026-10-08 TA01〜07: [ヒロイン5人×3種類のタイトル用アート比較](../asset_sources/title-art/heroine-concepts-v1-20261008/README.md)と各 `.prompt.txt`。採用済み立ち絵を第一参照、現在のタイトル絵を画風のみの参照とする。シーシャ案はメーカー実物写真を併用し、ハガルの上に閉じたHMD・その内側に炭、台の側面から手元へ1本のホースを描く。残りは本人らしい日常や趣味。15枚を独立した縦2:3の原画で保存し、タイトルへの採用は別途扱う。

> 2026-10-08 CI58〜61: 採用登場背景の修正は[アダム・はじめの修正版](../asset_sources/character-intros/adam-hajime-v4-20261008/README.md)を参照。[アダム](../asset_sources/character-intros/adam-hajime-v4-20261008/adam/prompt.txt)は葉・花を除いて二つのリンゴと蛇・古い書物風の装飾、[はじめ](../asset_sources/character-intros/adam-hajime-v4-20261008/hajime/prompt.txt)はシーシャ本体・ホース・マウスピースを除く。人物は再生成せず、文言は正本データを使う。

> 2026-10-08 CI57: 最新の検討案は[紫系のシンプルで抽象的な3案](../asset_sources/transitions/concepts-v5-minimal-purple-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v5-minimal-purple-20261008/prompt.txt)。紫と淡いラベンダーを中心に少数の曲線・面・余白へ絞り、一筆の煙／丸い波／余白が開くを比較。網点や細かな装飾の多い前案は履歴。今回は静止モックアップのみ。

> 2026-10-08 CI55／56: 最新の煙トランジション案は[紫系の3パターン](../asset_sources/transitions/concepts-v4-purple-smoke-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v4-purple-smoke-20261008/prompt.txt)。紫・ラベンダー・少量のピンクを統一配色にし、巻き込む渦／もくもく流れ／交差する煙リボンを比較。前の水色・コーラル案は履歴。今回も比較用の静止画像のみ。

> 2026-10-08 CI54: 最新の追加案は[抽象的な煙のポップな生成モックアップ](../asset_sources/transitions/concepts-v3-abstract-smoke-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v3-abstract-smoke-20261008/prompt.txt)。リアルな煙ではなく、水色・コーラル・クリームの大きな渦、太い輪郭、網点で動きを表す6コマ。今回は静止した比較用のみ。

> 2026-10-08 CI52／53: 最新トランジションは[大胆なグラフィック3案の生成モックアップ](../asset_sources/transitions/concepts-v2-persona-inspired-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v2-persona-inspired-20261008/prompt.txt)。オーナー指定で煙・黒・金への固定を撤回し、P4/P5のような大きな形・強い配色・斜めの構成を参考にする。黄ポップ／赤シャープ／青×ピンク。今回は比較ボードのみ。

> 2026-10-08 CI51: トランジション再制作の[生成モックアップ3案](../asset_sources/transitions/concepts-v1-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v1-20261008/prompt.txt)。煙の流れ／黒と金の斜め帯／炭の光と煙の輪。今回は比較ボードのみで、runtime素材ではない。個別の本番レイヤーは選択後に制作する。

> 2026-10-08 GP41: 現行remake/の温度計・操作ボタン・リフレッシュ・共通パネルは[4枚の生成指示](../asset_sources/ui/craft-luxury-20261008/prompts.json)と[素材・配線契約](../asset_sources/ui/craft-luxury-20261008/README.md)を参照。黒ガラス・真鍮・煙の刻印の静的素材。温度、最適温、予測、文字、使用回数はコードが表示する。

> 2026-10-07: この資料は旧ブラウザ版向け制作手順の履歴。旧 `web/` は削除済み。現行版の画像取り込み・制作手順は `CLAUDE.md`、`.claude/skills/` の該当スキル、`remake/README.md` を参照する。
>
> 2026-10-08の採用タイマーは[最終プロンプト](../asset_sources/ui/craft-focus-20261008/kitchen-timer-final-prompt.txt)と[素材・配線契約](../asset_sources/ui/craft-focus-20261008/README.md)を参照。白い100均風の本体、空の液晶、分／秒／スタート＆ストップ／リセットの4ボタン。文字と7セグ数字は実際の状態をコードで重ねる。下記の旧「数字は出さない」リングタイマー案は採用していない。

「水煙前線 -EN:CODE-」ブラウザ版の素材生成用。**作りパートの“作ってる感”リニューアル**（docs/next_session_prompts.md §9）と、
**立ち絵マスク撤廃**（最優先のUI改善）の素材を、codexの画像生成にそのまま渡せる形でまとめる。

## 共通スタイル指針（全アセット冒頭に付ける）
```
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。
```

---

## 1. 作りパート 作業台アセット（2026-07-02 改訂: コンポーネント合成方式）

作業台は現在 **CSS多層アート**（`web/js/game.js`「作業台アート」セクション）で
組み立てられており、**PNGを `assets/ui/making/` に置いてビルドするだけで
該当パーツが自動で差し替わる**（`artAsset()` が拾う。コード変更ゼロ）。

### 2026-07-03 改訂: 見当合わせは自動（キャンバス余白は自由になった）

`web/build_data.py` が `assets/ui/making/*.png` の**実コンテンツbbox**（透過を除いた絵の範囲）と、
`bowl_*` の**リム楕円の高さ**（上から最初に輪郭が最大幅になる行）を計測して `data.js` に埋め、
web側（`normalizeMakingAsset()` / `buildBowlArt()`）が余白を打ち消して絵を箱に正着させる。
アルミ・炭・葉・開口部の重なり位置は**リム実測値から自動で決まる**。

生成側への影響:
- **キャンバスサイズ・余白は自由**（1024角/1536角などモデル既定サイズでOK。表の推奨pxは目安に格下げ）
- そのかわり以下は厳守（自動計測の前提）:
  - **完全透過**で書き出す（半透明の黒地・市松模様の焼き込み禁止）
  - **1ファイル1オブジェクト**。本体から離れた影・飛沫・小物を同居させない（bboxが狂う）
  - **床への影を焼き込まない**（置き先はコードが決める。真下の淡い接地影のみ可）
  - ボウル系は「**リム（口）が絵の最上部にあり、そこが最大幅**」の斜め俯瞰構図（リム自動計測の前提）

### 再生成キュー（2026-07-03 プレイ報告より・優先順）

| # | ファイル | 何が問題か | 再生成の指示 |
|---|---|---|---|
| 1 | `bowl_empty_silicone.png`＋`bowl_packed_airy/normal/firm.png`（ストレート型4枚） | 浅い皿型で**ハガルの下部（胴・台座）がほぼ無い**。「ハガルの下の部分が無い」報告の原因 | clay/phunnel と同じく「深いカップ＋くびれ＋裾広がりの台座」のシルエットで丸ごと描き直す。packed 3枚は empty と**同じ器・同じ構図**で葉だけ入れる。葉は**リムより下でフラット**（山盛りにしない。上にアルミが乗る前提）。airy=ふんわり隙間あり/normal=ならし/firm=ぎゅっと圧縮の3密度 |
| 2 | `foil_surface.png` | 真上視点の**正円**で、ボウルの斜め俯瞰と視点が合わない | ボウルと同じ斜め俯瞰の**横長楕円（幅:高さ ＝ およそ 2.5:1）**。上面はしわなくピンと張り、外周にごく浅い折り込みスカート。穴は開けない |
| 3 | `bench_base.png` | 中央に**物のない楕円影**と**黒い革マットの四角い枠**が焼き込まれており、オーナーから「変な四角い枠が気になる」報告 | 同じ構図・同じ木の天板で、**マット・影なしのプレーンな木天板**に差し替え |
| 4 | `hookah_tray.png` `hookah_stem.png` `hookah_base.png` `hose_line.png` | **未生成**。蒸らし/調整/吸い出しの一台と右サイドバーがCSS簡易アートのままで、PNGボウルと質感が揃わない | 下表（配線コントラクト）の仕様どおり。最優先は stem と base |
| 5 | `jar_glass.png` | 未生成（棚のタッパーがCSSアート） | 透明な保存タッパー（ラベル無し・中身なし）。中身の色はコードが下に敷く |
| 6 | `jar_open.png` | 現行の計量は一枚絵 `jar_pour.png`（手＋フォーク＋タッパー）で、腕を動かすと**タッパーごと揺れる**（オーナー報告） | **タッパー単体**（開いた保存タッパー・中に赤い刻み葉・手なし）をやや俯瞰で。置くだけで、コードが「タッパー据え置き＋すくう手（hand_fork）だけ動く」分離合成へ自動切替する |

### 分業の大原則（画像に焼き込まないもの）

| 担当 | 内容 |
|---|---|
| **画像（生成AI）** | 静物: 穴のあるボウル・保存タッパー・湿った赤い葉片・スケール・コンロ・炭・短いトング・一式の各部・手 |
| **コード（既実装）** | 葉の量と配置、アルミの**穴**（開けた角度と同位置）、炭の**熾き明滅・灰化**、ベースの**水・泡**、**煙**、注ぎの**葉粒**、火の粉、ゲージ/数値/文字 |

数値・文字・ゲージ・穴・煙は絶対に画像へ焼き込まない（ゲーム状態と食い違う）。

### 配線コントラクト（ファイル名 → 差し替え先）

表示ボックスは `web/css/style.css` の `.art-*` 各クラス。**キャンバスのアスペクト・余白は
自動見当合わせ（上記2026-07-03改訂）が吸収する**ので、推奨pxは「中身の縦横比の目安」として
使えばよい。効くのは中身の形・構図。

| ファイル | 差し替え先 | 推奨px(@2x) | 透過 | 構図・見当合わせ |
|---|---|---|---|---|
| `bench_base.png` | `.bench-base`（下地全面） | 1320×1040 | 不透過 | 木の作業台を一人称で見下ろす。中央に作業の“間”。**シンク・排水口・水回りなし** |
| `bench_note.png` | `.bench-note` | 440×320 | 透過 | 作戦ノートの俯瞰 |
| `vignette_focus.png` | `.bench-vignette` | 1320×1040 | 透過 | 周辺減光（中央明るい） |
| `bowl_empty_silicone.png` | `.art-bowl[data-kind=silicone]` | 400×340 | 透過 | ストレート型。底の通気穴を明瞭に描く。口の楕円が横16〜84%・縦9〜30% |
| `bowl_empty_clay.png` | `.art-bowl[data-kind=clay]` | 400×340 | 透過 | ストレート型の素焼き。底の通気穴を明瞭に描く |
| `bowl_empty_phunnel.png` | `.art-bowl[data-kind=phunnel]` | 400×340 | 透過 | 中央スパイアの通気穴を明瞭に描く |
| `bowl_packed_airy.png` / `_normal.png` / `_firm.png` | `.art-bowl.packed-asset` | 400×340 | 透過 | ストレート専用3段階。湿った赤い葉片をワーム状にせず詰める |
| `bowl_packed_phunnel_airy.png` / `_normal.png` / `_firm.png` | `.art-bowl.packed-asset[data-kind=phunnel]` | 400×340 | 透過 | ファンネル専用のリング詰め。**中央穴を絶対に塞がない** |
| `foil_surface.png` | `.art-foil`（ボウル上のアルミ） | 400×150 | 透過 | 上面はしわなくピンと張り、余りだけを外側面まで折り込む（穴は描かない） |
| `hole_punched.png` | `.art-hole`（穴1個のスプライト） | 32×32 | 透過 | 黒い穴＋凹み影1個 |
| `mix_scale.png` | `.art-scale` | 700×280 | 透過 | デジタルスケール（上皿含む）。**液晶は空欄**（gはコードが表示） |
| `jar_pour.png` | `.art-jar-hand`（盛る手元の一枚） | 620×500 | 透過 | 開いた保存タッパーから小さなフォークで湿った赤い葉片を盛る。瓶・注ぎ動作なし |
| `leaf_pile_1.png`〜`leaf_pile_4.png` | `.art-leaf-fill` | 360×360 | 透過 | 量4段階。赤〜赤褐色の不定形な葉片・小塊、シロップの湿った艶。ワーム状・石状NG |
| `leaf_grain.png` | `.art-grain`（落ちる葉片） | 32×32 | 透過 | 小さな赤い刻み葉片。細長い虫状にしない |
| `hand_fork.png` | `.art-fork` | 60×500 | 透過 | フォーク（柄が上・先が下）。CSSが回転させるので直立で |
| `hand_pin.png` | `.art-pick` | 30×380 | 透過 | 千枚通し/爪楊枝。直立で |
| `stove_coil.png` | `.art-stove` | 660×380 | 透過 | 電熱コンロ（本体＋渦巻きコイル）。**赤熱の光は控えめ**（明滅グローはコード） |
| `coal_cold.png` / `_red.png` / `_white.png` / `_just.png` | `.art-coal` | 124×108 | 透過 | 整った25×25×25mmキューブ。黒→赤熱→白灰→**白灰＋強い赤熱**。大穴・マグマ模様なし |
| `coal_flat_cold.png` / `_red.png` / `_white.png` / `_just.png` | `.art-coal` | 124×108 | 透過 | 整った25×25×15mmフラット。同じ正方形底面で高さだけ低い4状態 |
| `hand_tongs_open.png` / `_closed.png` | `.art-tongs` | 400×320 | 透過 | 12〜15cm程度の短いトング。右手前から左奥へ |
| `hookah_tray.png` | `.art-hookah-tray` | 380×52 | 透過 | 受け皿（真鍮）楕円 |
| `hookah_stem.png` | `.art-hookah-stem` | 30×480 | 透過 | ステム（縦棒・真鍮） |
| `hookah_base.png` | `.art-hookah-glass`（ガラス層） | 340×300 | 透過 | ガラスベース。**全体を半透明**に（水・泡divが下に透ける） |
| `hose_line.png` | `.art-hose-line` | 700×300 | 透過 | たわんだホースの曲線 |
| `hose_tip.png` | `.art-mouthpiece` | 500×150 | 透過 | マウスピース（一人称・手前） |
| `smoke_thick.png` | `.art-pull-smoke` | 760×480 | 透過 | 濃いめの煙のかたまり（漂いはコード） |
| `heat_glow.png` | `.heat-glow` | 600×340 | 透過 | 炭の熱の赤いグロー（screen合成） |

`steam_wait_bg.png` / `serve_hose.png` は背景なしの独立候補として保持できるが、標準表示は
シーンごとに組み替えられるコンポーネント合成を使う。

### 生成プロンプト（コピペ用・共通スタイル指針を先頭に付ける）

```
【ボウル3種】シーシャのボウル（ハガル）を1個、側面やや俯瞰（見下ろし角は
bowl_empty_phunnel.png に合わせる）。silicone=黒〜チャコールのシリコン製 /
clay=素焼きの土色 / phunnel=中央に煙突スパイアのあるファンネル型。
シルエットは必ず「上のリム＝最大幅 → 深いカップ → くびれ → 裾広がりの台座」
まで描き切る（**皿のように浅くしない・台座を切らない**。既存の
bowl_empty_clay.png の脚元が良い見本）。中は空。ストレート型は底の通気穴、
ファンネル型は中央スパイアの通気穴を必ず明瞭に描く。背景完全透過、文字なし。
中身の縦横比はおよそ 4:3。
```
```
【詰め済みボウル（airy/normal/firm 各3枚）】上の empty と**同じ器・同じ構図**の中に、
赤〜赤褐色の湿った刻み葉が入った差分。葉の面は**リムより一段下でフラット**
（山盛りにしない。あとで上にアルミが乗る）。airy=ふんわり隙間が見える /
normal=軽くならした面 / firm=ぎゅっと圧縮した密な面。ファンネル版は中央
スパイアの通気穴を絶対に塞がない。背景完全透過。
```
```
【アルミ】ボウルに張ったアルミ箔だけを単体で。ボウルと同じ斜め俯瞰の
**横長楕円（縦横比 およそ 2.5:1）**。上面は一枚の平滑面としてしわなくピンと張り、
外周にごく浅い折り込みスカートが少しだけ見える。穴は開けない。真上からの
正円にしない。背景完全透過。
```
```
【スケール】デジタルキッチンスケール。上に丸い金属皿、手前に黒い液晶窓
（表示は空欄のまま）。やや俯瞰。背景透過、700×280px。
```
```
【フレーバー】透明な保存タッパーを開き、小さなフォークでシーシャフレーバーを
取り分けて盛る一人称の手元。葉は赤〜赤褐色の不定形な薄片と小塊で、薄いシロップに
濡れた艶がある。細長いワーム状・石状にしない。背景透過。
```
```
【コンロと炭】(1) stove_coil: 背景なしの卓上電熱コンロ。黒い本体の上面に渦巻き状の
電熱コイルが赤熱。660×380px。(2) 25×25×25mmの正方形キューブと25×25×15mmの
フラットを各4状態（黒い生 / 赤熱 / 白い灰膜 / 白い灰膜＋はっきりした赤熱）。
辺は整え、大きな丸穴やマグマ状の割れ目は描かない。各124×108px、背景透過。
```
```
【一式の部品】(1) hookah_tray: 真鍮の受け皿を横から見た楕円 380×52px。
(2) hookah_stem: 真鍮のステム（縦の棒、上下に継ぎ目）30×480px。
(3) hookah_base: ガラスベース（丸い花瓶型）。**画像全体を半透明**にして
中が透ける質感 340×300px。(4) hose_line: たわんで垂れるホースの曲線
700×300px。(5) hose_tip: 木口のマウスピースを手前に構えた一人称 500×150px。
すべて背景透過。
```
```
【手・道具】細身で中性的な腕、明るいピーチ色の同一肌色。hand_fork: 葉をほぐす
ミニフォーク。hand_pin: アルミに穴を開ける千枚通し。hand_tongs_open/closed:
12〜15cm程度の短い炭用トングを持つ開閉差分。背景透過。
```

### Codex 作業手順（そのまま渡せるチェックリスト）

1. PNGを `assets/ui/making/` に上記ファイル名で置く（マゼンタ背景で生成した
   場合は `tools/pixelize.py` 等で透過に抜いてから）
2. `python3 web/build_data.py && python3 web/build_standalone.py`
3. `python3 -m http.server 8123` を起動し、ブラウザのコンソールで
   `beginMaking("tournament")` → `tournamentStep("mix")` 等で各工程を確認
   （theme/mix/pack/foil/coal/coalfire/steam/adjust/pull）
4. アスペクトが合わず伸び・欠けが出たら `web/css/style.css` の該当
   `.art-*` クラスの width/height/left/bottom を微調整（`.has-asset` が
   付いた要素はCSS塗りが消えPNGだけになっている）
5. ヘッドレステスト: `node web/test/playthrough.mjs`（通し）と
   `node web/test/screenshots.mjs`（敗北ルート）が緑のこと
6. **やらないこと**: 数値/文字/ゲージ/穴/煙の焼き込み、テストフック
   （`__pullDebug`/`__heatDebug`/`__steamDebug` ほか CLAUDE.md 記載）と
   `stageFoilPunch`・`spawnBaseBubbles`・`spawnPourGrains` の削除、
   `web/js/data.js` の直接編集（生成物）

### 1.5 ゲージ計器スキン（任意・2026-07-03 追加）

ゲージ4系統（`.gauge-bar` 汎用ゲージ／`.temp-bar` 温度計／`.hole-meter-bar` 均等度／
`.trial-gauge-bar` 納得ゲージ）は **2026-07-03 にCSSで「琥珀ネオンの計器盤」に統一済み**
（黒ガラスの奥に目盛り・狙いゾーンが琥珀に灯る・針は白熱）。**PNGスキンなしで完成形**として
成立しているので、生成は「さらに質感を上げたい場合のみ」でよい。

生成する場合のプロンプト（共通スタイル指針を先頭に付ける）:
```
【ゲージ枠】横長バー計器の「枠」だけ。真鍮×黒ガラスの水平計器で、両端に
小さな真鍮リベット、上辺に細かい目盛りの刻印、角はわずかに丸い。
中央は素通しの空洞（バー本体・ゾーン・針はゲーム側が描くので、
中を塗らない・目盛り数字を入れない）。9スライスできる均一な枠。
1200×120px・背景完全透過・文字なし。→ assets/ui/making/ui_gauge_frame.png
```
```
【計器の針】ゲージ用の針を直立で1本。白熱した琥珀ガラスのダイヤ型ヘッド＋
細い真鍮の柄。発光は控えめ（明滅はコードがやる）。60×140px・背景完全透過。
→ assets/ui/making/ui_gauge_needle.png
```
```
【円形リング計器】円形ゲージの盤面。外周に真鍮の目盛りリング、内側は
黒ガラスの空洞（進捗の弧・数字はコードが描く）。600×600px・背景完全透過。
→ assets/ui/making/ui_ring_gauge.png（蒸らし待ち等の将来用）
```
配線メモ: 現状は未配線（CSSだけで完結）。導入する場合は `.gauge-bar`/`.temp-bar` の
border・背景を消して枠PNGを `border-image`（9スライス）で重ねる数行を足す。
針PNGは `.gauge-needle`/`.temp-marker` の背景差し替えで済む。

### Codex への追加演出タスク候補（画像が入った後のクオリティアップ）

- **熱ゆらぎ**: coalfire/steam で炭の上に陽炎（CSS `filter: blur` ではなく
  SVG turbulence か、細い透明グラデ帯の揺れアニメ）
- **蒸らしタイマー**: steam 工程の待ちに、円形のリングゲージ（conic-gradient）
  ＋残り時間の抽象表示（数字は出さない）
- **注ぎの弧**: `spawnPourGrains` の落下軌道を瓶口から弧を描くベジェに
  （現在は直下＋ドリフト）
- **灰のひとひら**: 長時間の炭に灰の薄片がはらりと落ちる粒子
- **提供カット**: pull で「提供する」を押した瞬間、煙が濃くなって
  画面手前へ流れるトランジション（`smokeWipe` 流用可）

## 2. 立ち絵（最優先のUI改善：マスク撤廃）

現状 なる/アダム/みんと/アゲハ/ましろ/レイ の6人は、背景一枚絵をCSSの“煙窓”で小さく切り抜いて立ち絵代用＝切り貼り感が露骨。
**透過の立ち絵スプライト**を生成し、engine.js の `BG_FULL_PORTRAITS` から外せば会話画面が一番化ける。

格納先: `assets/sheets_inbox/sheet_<id>.png`（既存の取り込みパイプライン）。**横5表情・単色背景**のシート形式。
取り込み: `tools/split_sheet.py` → `make_face_icons.py` → build2本 → engine.js の BG_FULL_PORTRAITS からそのidを外す。

| id | キャラ | visual_concepts 参照元 | 表情5種（左→右） |
|---|---|---|---|
| `naru` | 鳴切 亮太（人格者の好敵手）| data/characters.json | normal / smile / serious / surprise / sad |
| `adam` | 吾妻 大夢（DA職人・大仰）| 同上 | normal / smile / smug / serious / excited |
| `minto` | 緑川 栞（店モードのギャル）| 同上（素はura_*別途）| smile / wink / normal / surprise / sad |
| `ageha` | 宵野 葉子（ヒョウ柄ギャル）| 同上 | smile / excited / normal / serious / wink |
| `mashiro` | 水瀬 ましろ（シガーマン）| 同上 | normal / smile / serious / sad / surprise |
| `rei` | 田中 健太（V系カリスマ）| 同上 | serious / smug / normal / evil / sad |
```
立ち絵 共通: 一人称ゲームなので主人公hajimeは不要。胸〜頭の半身、正面〜やや斜め。
単色背景（後で透過に抜く前提のグリーン/単色）、横に5表情を等間隔で並べたシート。
キャラのvisual_concept（characters.json）に厳密に従う。ステは見せない。
```
> ⚠️ 凛(rin)の立ち絵＋顔アイコン、凛CG（cg_rin_confession/epilogue）も未生成。優先度高（ch1で出る）。

---

## 3. 既存UI素材は「ダミー（自動生成プレースホルダ）」＝再生成が必要

⚠️ **訂正**: `assets/ui/` の下記は「未使用の即戦力」ではなく、**ファイル名が書かれただけの色板ダミー**（各 0.8〜5KB、`tools/generate_dummy_images.py` 由来）。
コードが使っていないのは“ダミーだから”。繋ぐと**悪化する**ので、**まず codex で本物を生成**してから配線する。

| ファイル | 用途 | 生成の方向性 | 寸法/透過 |
|---|---|---|---|
| `ui_hud_action.png` `ui_hud_calendar.png` `ui_hud_money.png` | HUDの行動/日付/所持金アイコン | 煙・炎・カレンダー・コインを琥珀ネオンの線画アイコンで（小さく視認性重視）| 透過 ~64px角 |
| `ui_map_pin.png` `ui_map_pin_event.png` | マップのピン（通常/イベント）| 下端が尖ったピン。イベント版は光る縁取り。下端アンカー | 透過 ~96×128 |
| `ui_phone_frame.png` | LIMEのスマホ筐体フレーム | スマホの外枠（ベゼル＋上部ノッチ）。中央は空（チャットを抜く）| 透過 ~520×900 |
| `ui_lime_bubble_left.png` `ui_lime_bubble_right.png` | LIME吹き出し（相手/自分）| 角丸の吹き出し（9スライス可能な余白）。相手=淡灰／自分=琥珀 | 透過 ~80px角(9-slice) |
| `ui_dialogue_box.png` `ui_dialogue_namebox.png` | 会話ウィンドウ枠/名前枠 | 半透明の黒枠＋金のコーナー装飾（9スライス）| 透過 横長(9-slice) |
| `ui_status_radar.png` | ステータスのレーダー下地 | 五角形グリッド＋グロー枠の装飾下地（数値は載せない）| 透過 ~520px角 |
| `ui_hand_left.png` `ui_hand_right.png` | 一人称の手（作りパート＝§1で用途別に分岐）| §1の `hand_*` 群で代替推奨 | 透過 |

→ 生成後は同名で上書き → build2本 → コード側で CSS図形/絵文字から差し替え（その時点で“配線”は数行）。
