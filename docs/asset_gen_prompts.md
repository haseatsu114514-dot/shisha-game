# 画像生成プロンプト集（codex用）— シーシャ作りパート＋立ち絵

「水煙前線 -EN:CODE-」ブラウザ版の素材生成用。**作りパートの“作ってる感”リニューアル**（docs/next_session_prompts.md §9）と、
**立ち絵マスク撤廃**（最優先のUI改善）の素材を、codexの画像生成にそのまま渡せる形でまとめる。

## 共通スタイル指針（全アセット冒頭に付ける）
```
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。
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

### 分業の大原則（画像に焼き込まないもの）

| 担当 | 内容 |
|---|---|
| **画像（生成AI）** | 静物: ボウル・瓶・スケール・コンロ・炭・トング・一式の各部・手 |
| **コード（既実装）** | 葉の**色層**（FLAVOR_COLORSで着色）、アルミの**穴**（開けた角度と同位置）、炭の**熾き明滅・灰化**、ベースの**水・泡**、**煙**、注ぎの**葉粒**、火の粉、ゲージ/数値/文字 |

数値・文字・ゲージ・穴・煙は絶対に画像へ焼き込まない（ゲーム状態と食い違う）。

### 配線コントラクト（ファイル名 → 差し替え先）

表示ボックスは `web/css/style.css` の `.art-*` 各クラス。PNGは**表示ボックスの
@2x・同アスペクト**で作ると無調整で収まる（違うアスペクトならCodexがCSSの
width/heightを微調整する。それも想定内の作業）。

| ファイル | 差し替え先 | 推奨px(@2x) | 透過 | 構図・見当合わせ |
|---|---|---|---|---|
| `bench_base.png` | `.bench-base`（下地全面） | 1320×1040 | 不透過 | 木の作業台を一人称で見下ろす。中央に作業の“間” |
| `bench_note.png` | `.bench-note` | 440×320 | 透過 | 作戦ノートの俯瞰 |
| `vignette_focus.png` | `.bench-vignette` | 1320×1040 | 透過 | 周辺減光（中央明るい） |
| `bowl_empty_silicone.png` | `.art-bowl[data-kind=silicone]` | 400×340 | 透過 | 側面やや俯瞰。**口の楕円が横16〜84%・縦9〜30%の位置**（コードの葉色層・アルミ・炭がそこへ重なる） |
| `bowl_empty_clay.png` | `.art-bowl[data-kind=clay]` | 400×340 | 透過 | 同上（素焼きの土色） |
| `bowl_empty_phunnel.png` | `.art-bowl[data-kind=phunnel]` | 400×340 | 透過 | 同上（中央スパイア付き） |
| `foil_surface.png` | `.art-foil`（ボウル上のアルミ） | 400×150 | 透過 | 楕円に張ったアルミ。しわ・縁の折り込みまで描く（穴は**描かない**） |
| `hole_punched.png` | `.art-hole`（穴1個のスプライト） | 32×32 | 透過 | 黒い穴＋凹み影1個 |
| `mix_scale.png` | `.art-scale` | 700×280 | 透過 | デジタルスケール（上皿含む）。**液晶は空欄**（gはコードが表示） |
| `jar_glass.png` | `.art-jar-glass`（瓶。置き姿） | 240×300 | 透過 | ガラス瓶＋蓋。**胴に透明窓**（中身色のdivが下に透ける）。ラベル帯は無地 |
| `jar_pour.png` | `.art-jar-hand`（注ぐ手元の一枚） | 264×328 | 透過 | 瓶を傾けて注ぐ手。瓶口は左下向き（葉粒はコードが落とす） |
| `leaf_grain.png` | `.art-grain`（落ちる葉粒） | 32×32 | 透過 | 刻み葉数粒。無彩色ベージュ（色はコード側の層で表現） |
| `hand_fork.png` | `.art-fork` | 60×500 | 透過 | フォーク（柄が上・先が下）。CSSが回転させるので直立で |
| `hand_pin.png` | `.art-pick` | 30×380 | 透過 | 千枚通し/爪楊枝。直立で |
| `stove_coil.png` | `.art-stove` | 660×380 | 透過 | 電熱コンロ（本体＋渦巻きコイル）。**赤熱の光は控えめ**（明滅グローはコード） |
| `coal_cold.png` | `.art-coal`（生・灰） | 124×108 | 透過 | 黒いキューブ炭1個 |
| `coal_red.png` | `.art-coal.lit-heating` | 124×108 | 透過 | 赤熱中の炭1個（明滅はコード） |
| `coal_white.png` | `.art-coal.lit-on` | 124×108 | 透過 | 白熱の炭1個 |
| `hand_tongs_open.png` | `.art-tongs` | 400×260 | 透過 | トングを持つ手（開）。右手前から左奥へ |
| `hookah_tray.png` | `.art-hookah-tray` | 380×52 | 透過 | 受け皿（真鍮）楕円 |
| `hookah_stem.png` | `.art-hookah-stem` | 30×480 | 透過 | ステム（縦棒・真鍮） |
| `hookah_base.png` | `.art-hookah-glass`（ガラス層） | 340×300 | 透過 | ガラスベース。**全体を半透明**に（水・泡divが下に透ける） |
| `hose_line.png` | `.art-hose-line` | 700×300 | 透過 | たわんだホースの曲線 |
| `hose_tip.png` | `.art-mouthpiece` | 500×150 | 透過 | マウスピース（一人称・手前） |
| `smoke_thick.png` | `.art-pull-smoke` | 760×480 | 透過 | 濃いめの煙のかたまり（漂いはコード） |
| `heat_glow.png` | `.heat-glow` | 600×340 | 透過 | 炭の熱の赤いグロー（screen合成） |

**廃止（コード表現に置換済み・生成不要）**: `leaf_pile_1〜4.png`（葉の量・色は
コードの色層）、`bowl_packed_*.png`（詰め圧は色層の嵩で表現）、`hand_press.png`、
`steam_wait_bg.png` / `serve_hose.png`（全画面一枚 → コンポーネント合成に変更）。

### 生成プロンプト（コピペ用・共通スタイル指針を先頭に付ける）

```
【ボウル3種】シーシャのボウル（ハガル）を1個、側面やや俯瞰。
silicone=黒〜チャコールのシリコン製 / clay=素焼きの土色 / phunnel=中央に
煙突スパイアのあるファンネル型。口の楕円が画像の横16〜84%・縦9〜30%に
収まる構図。中は空。背景完全透過、文字なし。400×340px。
```
```
【アルミ】ボウルに張ったアルミ箔だけを楕円で。細かいしわ、縁の折り込み、
鈍い銀の反射。穴は開けない。背景透過、400×150px。
```
```
【スケール】デジタルキッチンスケール。上に丸い金属皿、手前に黒い液晶窓
（表示は空欄のまま）。やや俯瞰。背景透過、700×280px。
```
```
【瓶2種】(1) jar_glass: フレーバーの広口ガラス瓶＋金属蓋。胴の中央は
中身が透けて見える透明ガラスのまま（中身は描かない）。無地のラベル帯。
置いた姿。240×300px。(2) jar_pour: 同じ瓶を手で傾けて注ぐ手元。瓶口が
左下を向く。中身は描かない。264×328px。どちらも背景透過。
```
```
【コンロと炭】(1) stove_coil: 卓上の電熱コンロ。黒い本体の上面に渦巻き状の
電熱コイルがうっすら赤い。660×380px。(2) coal_cold / coal_red / coal_white:
ココナッツキューブ炭1個の3状態（黒い生 / 赤熱 / 白熱＋薄い灰）。各124×108px。
すべて背景透過。
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
【手・道具】hand_fork: 葉をほぐすミニフォーク（直立・柄が上）60×500px。
hand_pin: アルミに穴を開ける千枚通し（直立）30×380px。
hand_tongs_open: 炭用トングを持つ手（開いた状態・右手前から）400×260px。
背景透過。
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

### Codex への追加演出タスク候補（画像が入った後のクオリティアップ）

- **熱ゆらぎ**: coalfire/steam で炭の上に陽炎（CSS `filter: blur` ではなく
  SVG turbulence か、細い透明グラデ帯の揺れアニメ）
- **温度ゲージの絵替え**: `.temp-bar`（吸い出し/調整）を琥珀ネオンの
  温度計デザインへ（`ui_status_radar.png` と同じ装飾言語）
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
| `mashiro` | 真白 ましろ（シガーマン）| 同上 | normal / smile / serious / sad / surprise |
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
