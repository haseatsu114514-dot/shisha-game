# 大会パート グラフィック刷新 構想書

## コンセプト：「中継カメラが回り始める」

普段のヴァルハラ風ピクセルアートは「プレイヤー＝始の日常の目線」。
大会に入った瞬間、**テレビ中継のカメラが回り始めたかのように**画面の質感がガラリと変わる。

プレイヤーに「ここからは本番だ」という緊張感と高揚感を、**絵の力で**伝える。

---

## 美術方向性：「ダンガンロンパ × ペルソナ × ディバインゲート × 海外 Hookah Battle」

### リファレンス作品と取り入れる要素

| 作品 | 取り入れる要素 |
|---|---|
| **ダンガンロンパ** | ネオンピンク×黒の超高コントラスト、ポップアート的な大胆構図、分割スクリーン演出、キャラ紹介カットイン |
| **ペルソナ** | スタイリッシュなUIモーション、キャラ固有カラーのグラフィックデザイン、総攻撃風の「決め」画面、派手なトランジション |
| **ディバインゲート** | ダークファンタジー×ネオン、キャラクターごとのエフェクト付きイラスト、カードゲーム的な「召喚」演出 |
| **海外 Hookah Battle** | 競技ステージのリアルな構図、ジャッジテーブル、タイムドラウンド、スモークアーティストリー、群衆の熱気 |

### 色の方向性

**暖色・ローズゴールド系は使わない。** 以下がこの大会の色。

- **ネオンマゼンタ / ホットピンク** — メインアクセント
- **エレクトリックパープル** — 背景・煙のベース色
- **シアン / エレクトリックブルー** — セカンダリアクセント
- **深い黒 / ダークネイビー** — ベース
- **ネオングリーン** — キャラ固有色・ハイライト
- **ゴールド** — 勝利・スコア限定
- **スポットライトの白** — 煙を貫く光

### ライティングの方向性

暖かい間接照明ではなく、**スポットライト・レーザー・ネオン管**のような硬質でドラマチックな光。
- ステージ上からの白スポットライトが煙を貫く
- キャラクターの背後からネオンカラーのバックライト
- 暗い会場の中で光が当たった部分だけ浮かび上がる構図
- ペルソナの「覚醒シーン」のような、キャラ固有色が爆発する瞬間

---

## キャラクターデザイン（4人の選手）

サンプルイラスト準拠のキャラクター。各キャラに固有のネオンカラーを割り当てる。

### Girl A — 金髪ツインテール

| 項目 | 詳細 |
|---|---|
| **髪** | ロングのウェーブ金髪ツインテール |
| **目** | ゴールド / 琥珀色 |
| **髪飾り** | ピンクのクマ型ヘアクリップ |
| **服装** | ヒョウ柄ジャケット × ピンクのインナー、黒フリルスカート |
| **アクセサリ** | ハート型ゴールドネックレス、ハート型ベルトバックル、複数のブレスレット |
| **固有ネオンカラー** | **ネオンピンク (#ff2d78)** |
| **印象** | 華やかで自信家、挑発的な笑み |

### Girl B — 茶髪パーカー

| 項目 | 詳細 |
|---|---|
| **髪** | ミディアムの茶髪 / オーバーン、前髪あり |
| **目** | 赤（クリムゾン） |
| **服装** | ダークパープルのオーバーサイズパーカー、黒インナー |
| **アクセサリ** | チェーンネックレス、赤ネイル |
| **固有ネオンカラー** | **エレクトリックパープル (#8b5cf6)** |
| **印象** | クール、余裕のある態度、実力者の空気感 |

### Girl C — ミントグリーン三つ編み

| 項目 | 詳細 |
|---|---|
| **髪** | 非常に長いウェーブ / 三つ編みのミントグリーンヘア |
| **目** | 水色 |
| **服装** | クリーム色カーディガン × 白ブラウス、ティールのリボン |
| **アクセサリ** | なし（シンプル・清楚系） |
| **固有ネオンカラー** | **シアン (#00e5ff)** |
| **印象** | 穏やかで静か、しかし底知れない実力 |

### Girl D — 黒髪小悪魔

| 項目 | 詳細 |
|---|---|
| **髪** | 黒のロングストレート |
| **目** | 緑（エメラルド） |
| **髪飾り** | 小悪魔風ツノ型ヘアアクセ + 大きな緑リボン |
| **服装** | へそ出しの黒トップス、ダークな服 |
| **アクセサリ** | ゴールドハートペンダント、ゴールドチェーン、緑のイヤリング |
| **固有ネオンカラー** | **ネオングリーン (#39ff14)** |
| **印象** | エネルギッシュで口が大きく開く笑顔、テンション高め |

---

## 全体方針

| 要素 | 日常パート (現行) | 大会パート (新) |
|---|---|---|
| **画風** | ヴァルハラ風ピクセルアート | ダンガンロンパ/ペルソナ風ハイコントラスト・アニメイラスト |
| **テクスチャフィルタ** | `nearest` (ドット感) | `linear` (滑らか) |
| **フォント** | DotGothic16 (ドットフォント) | ゴシック系 or 角ゴシック (Noto Sans JP Bold 等) |
| **カラーパレット** | 暖色系・ダークネイビー基調 | ネオンマゼンタ・パープル・シアン × ディープブラック |
| **ライティング** | 暖かいランプ光 | スポットライト・ネオン・レーザー |
| **BGM** | 落ち着いたチル系 | EDM / ハイテンポ (既存の bgm_tournament_edm) |
| **UIパラダイム** | ADVテキストボックス | 実況中継風オーバーレイ（ペルソナ風UI演出付き） |

---

## 具体的な変更ポイント

### 1. 背景 & ステージ演出

**現状**: `bg_tournament_stage.png` (ピクセルアート) + 暗めオーバーレイ

**提案**:
- 高解像度の大会ステージ背景に差し替え（照明リグ・煙・観客シルエット入り）
- **海外Hookah Battle的な競技ステージ構成**: 4つのフーカステーション、ジャッジテーブル、電光掲示板
- 背景にアニメーション要素を追加:
  - スモークパーティクル（GPUParticles2D）— パープル〜マゼンタのグラデーション
  - スポットライトが煙を貫く（PointLight2D × 白 + カラー）
  - ネオンサイン風のステージロゴが明滅
  - 観客シルエットの歓声に合わせたスクリーンシェイク
- ラウンド転換時にダンガンロンパ風の画面分割トランジション

### 2. キャラクター表示の二重化

**現状**: ピクセルアートのキャラスプライト (`chr_*.png`) + ドット顔 (`face_*.png`)

**提案**: 大会用に**高解像度キャラクターイラスト**を別途用意

```
assets/sprites/characters/         ← 日常用 (現行ピクセルアート)
assets/sprites/characters_hd/      ← 大会用 (ハイディテール)
assets/sprites/faces/              ← 日常用 (現行ピクセルアート)
assets/sprites/faces_hd/           ← 大会用 (ハイディテール)
```

- 対戦相手のカットイン登場時は、**ダンガンロンパ風の画面分割**＋キャラ固有ネオンカラーの背景
- ペルソナ風の「総攻撃」的な**決めポーズカットイン**（全画面占有）
- ディバインゲート風の**キャラ背後にネオンエフェクトのオーラ**が爆発する演出
- シーシャ調理中の集中シーンは、キャラの手元クローズアップCGを挿入
- ファイル命名規則は同じ (`chr_naru_normal.png` → `chr_naru_normal.png` in `characters_hd/`)

### 3. UI パネルの刷新（実況中継モード × ペルソナ風UI）

**現状**: MainPanel (左) + SidePanel (右) の2カラム ADVレイアウト

**提案**: 大会専用UIレイアウト — eスポーツ中継 × ペルソナ風スタイリッシュUI

```
┌──────────────────────────────────────────────────┐
│ [SMOKE CROWN CUP]     ROUND 2 / 3     [LIVE] 🔴 │  ← ヘッダーバー (eスポーツ中継風)
├────────────────────────────────────┬─────────────┤
│                                    │  MATCH CARD  │
│     メインビジュアル領域            │ ┌──┐  ┌──┐  │
│     (ステージ背景 +               │ │A │VS│B │  │
│      キャラクター +               │ └──┘  └──┘  │
│      ネオンエフェクト)             │  62    71   │
│                                    │─────────────│
│                                    │ COMMENTARY   │
│                                    │ 「焚口：     │
│                                    │  ここで攻めの│
│                                    │  フレーバー！」│
├──┬────────┬────────┬────────┬──────┴─────────────┤
│  │ BOWL   │ HEAT   │ FINISH │      TIMER 01:23  │  ← アクションバー（ネオン枠）
└──┴────────┴────────┴────────┴─────────────────────┘
```

主な変更点:
- **ヘッダーバー**: 大会名・ラウンド表示・「LIVE」インジケーター — eスポーツ配信風
- **対戦カード表示**: キャラアイコン＋固有ネオンカラーの枠でスコア常時表示
- **実況テロップ**: パッキー＆焚口の実況がスポーツ中継風に流れる
- **下部アクションバー**: ネオン枠付き、ペルソナ風の斜めカットデザイン
- **UI全体**: 角度のついたスラッシュ（斜め線）でパネルを区切る（ペルソナ風）

### 4. カラーパレット（大会専用）

```
TOURNAMENT_BG_DEEP:         #0a0a0f   (漆黒に近い闇)
TOURNAMENT_BG_NAVY:         #0a0e1a   (深い藍黒)
TOURNAMENT_ACCENT_MAGENTA:  #ff2d78   (マゼンタネオン — メインアクセント)
TOURNAMENT_ACCENT_PURPLE:   #8b5cf6   (エレクトリックパープル)
TOURNAMENT_ACCENT_CYAN:     #00e5ff   (シアンネオン — セカンダリ)
TOURNAMENT_NEON_GREEN:      #39ff14   (ネオングリーン — キャラD固有)
TOURNAMENT_GOLD:            #ffd700   (勝利のゴールド — 勝利演出限定)
TOURNAMENT_SMOKE:           #c084fc   (煙 — パープル系)
TOURNAMENT_SPOTLIGHT:       #f0f0ff   (スポットライトの白)
TOURNAMENT_TEXT_WHITE:      #f0f0f0   (明るいテキスト)
TOURNAMENT_PANEL_BG:        #0d0d15cc (パネル背景 — 半透明ダーク)
TOURNAMENT_PANEL_BORDER:    #ff2d7866 (パネル枠 — マゼンタグロー)
```

既存の `THEME_*` 定数はそのまま残し、`TOURNAMENT_*` を GameManager に追加。
大会シーン進入時に `_apply_tournament_theme()` / 退出時に `_apply_default_theme()` を呼ぶ。

### 5. エフェクト＆シェーダー

#### 既存エフェクトの拡張
- **_ScanlineEffect**: 大会パートでは OFF にする（ピクセルアート向けなので）
- **_screen_shake**: 強度を上げて、対戦のクライマックスで使う
- **_screen_flash**: **マゼンタ or パープルのネオン色**でフラッシュ

#### 新規エフェクト
| エフェクト | 用途 | 実装方法 | リファレンス |
|---|---|---|---|
| **ネオンスモーク** | 常時背景に漂うパープル〜マゼンタの煙 | GPUParticles2D | Hookah Battle の会場 |
| **スポットライト** | ステージ演出 — 煙を貫く白い光柱 | PointLight2D × 3〜4 + アニメーション | eスポーツステージ |
| **ネオングロー** | UI枠・テキストの発光 | シェーダー or StyleBoxFlat + shadow | ペルソナUI |
| **キャラカットイン** | 対戦相手の登場 — 画面分割＋ネオン爆発 | Tween + TextureRect + ColorRect | ダンガンロンパ |
| **VS スプラッシュ** | 対戦開始時の「VS」画面 | 全画面オーバーレイ + Tween | 格ゲー風 |
| **スコアポップ** | 得点表示がド派手にネオンで飛び出す | パーティクル付き数字アニメーション | eスポーツ中継 |
| **煙文字** | ラウンド開始「ROUND 1」等 | テキスト + dissolve シェーダー + ネオングロー | ダンガンロンパ章タイトル |
| **集中線** | クリティカルな選択時 — マゼンタ色の放射線 | _draw() で放射線 + フェード | 少年漫画 |
| **覚醒エフェクト** | キャラの「本気モード」突入 | 背景色がキャラ固有色に染まる + 風エフェクト | ペルソナ覚醒 |

### 6. 演出シーケンス（ダンガンロンパ/ペルソナ的な「決め」の流れ）

```
1. 大会開始
   → 画面暗転 → 「SMOKE CROWN CUP」のロゴがネオンで点灯（ダンガンロンパ章タイトル風）
   → 会場の全景がスポットライトに照らされて現れる

2. 選手登場
   → 4分割画面で4人のキャラが同時登場（各パネルがキャラ固有色で縁取り）
   → 1人ずつフォーカスが当たり、名前テロップがスタイリッシュにスライドイン

3. 対戦開始
   → 「VS」スプラッシュが画面を横切る
   → マゼンタの閃光 → 競技ステージが映る

4. 調理シーン
   → 手元クローズアップCG
   → 選択肢はネオン枠で表示（ペルソナ風の斜めカットUI）

5. クライマックス
   → 煙を吐く瞬間 — ダンガンロンパの「論破」演出のように画面が裂ける
   → キャラ固有色が画面全体を染める「覚醒」演出
   → 煙が画面を覆い尽くし、パープル〜マゼンタのグラデーション

6. 結果発表
   → 電光掲示板にスコアがネオン文字で表示
   → 勝者にゴールドのスポットライト
   → 敗者は闇に沈んでいく（コントラストで明暗を描く）
```

### 7. フォント切り替え

```gdscript
# GameManager に追加
const FONT_DAILY := "res://assets/fonts/DotGothic16-Regular.ttf"
const FONT_TOURNAMENT := "res://assets/fonts/NotoSansJP-Bold.ttf"
const FONT_TOURNAMENT_SIZE := 20  # ドットフォントより少し小さめでOK

func apply_tournament_font() -> void:
    var font = load(FONT_TOURNAMENT)
    var theme = get_tree().root.theme
    theme.default_font = font
    theme.default_font_size = FONT_TOURNAMENT_SIZE

func apply_daily_font() -> void:
    var font = load(FONT_DAILY)
    var theme = get_tree().root.theme
    theme.default_font = font
    theme.default_font_size = 22
```

### 8. テクスチャフィルタの動的切り替え

大会シーン進入時:
```gdscript
# project.godot のグローバル設定は nearest のまま
# 大会用のテクスチャは .import で個別に filter = true に設定
# もしくは、マテリアルで texture_filter = TEXTURE_FILTER_LINEAR を指定
```

高解像度アセット(`characters_hd/`, `bg_tournament_*`)は個別に `linear` フィルタを設定。
ピクセルアートアセットは `nearest` のまま。

---

## 段階的な切り替え案（ハイブリッド）

全面刷新がリソース的に厳しい場合、**段階的に差し込む**方針もある。

### Phase A: 「ここぞのCG」方式（最小コスト）

大会パートの**特定の場面だけ**高解像度CGを挿入する。
ゲームプレイUIは現行のピクセルアート寄りのまま。

挿入ポイント:
1. **大会開始宣言** → 「SMOKE CROWN CUP」ネオンロゴ＋会場全景CG
2. **選手登場** → 4分割カットインCG（各キャラ固有色背景）
3. **VS スプラッシュ** → 対戦カード風の1枚絵
4. **クライマックス** → 煙の中に浮かぶ選手のCG（覚醒演出風）
5. **結果発表** → 電光掲示板＋勝者にスポットライトのCG

必要な枚数: 1章あたり **5〜8枚** 程度
既存の `show_cg` / `hide_cg` 命令をそのまま活用できる。

### Phase B: 「UI刷新」（中コスト）

Phase A + UIパネルのデザイン変更。
- カラーパレットの切り替え（マゼンタ/パープル/シアン系）
- フォントの切り替え
- ペルソナ風の斜めカットUIパネル
- 既存のゲームロジック・選択肢構造はそのまま

### Phase C: 「完全中継モード」（フルコスト）

Phase B + レイアウト全面刷新 + パーティクル＆シェーダー。
前述の「eスポーツ中継 × ペルソナ風UIモード」を完全実装。

---

## 推奨: Phase B → C の段階実装

1. まず **Phase A** でCGを数枚入れてトーンの差を確認
2. 手応えがあれば **Phase B** でUIテーマを切り替える仕組みを実装
3. 最終的に **Phase C** で完全に別世界にする

これにより、途中で画風の方向性を微調整しながら進められる。

---

## 技術的な実装ポイント

### GameManager への追加

```gdscript
# 大会テーマの適用
var _is_tournament_theme := false

func apply_tournament_theme() -> void:
    _is_tournament_theme = true
    _apply_tournament_colors()
    apply_tournament_font()
    # テクスチャフィルタは個別アセットで管理

func apply_daily_theme() -> void:
    _is_tournament_theme = false
    _apply_default_theme()
    apply_daily_font()

func is_tournament_theme() -> bool:
    return _is_tournament_theme
```

### キャラクタースプライトの自動切り替え

```gdscript
func get_character_sprite_path(char_id: String, expression: String) -> String:
    var base_dir = "characters_hd" if GameManager.is_tournament_theme() else "characters"
    return "res://assets/sprites/%s/chr_%s_%s.png" % [base_dir, char_id, expression]
```

### 大会シーン(_ready)での初期化

```gdscript
func _ready() -> void:
    GameManager.apply_tournament_theme()
    _setup_tournament_particles()
    _setup_tournament_lighting()
    # ... 既存の初期化コード

func _exit_tree() -> void:
    GameManager.apply_daily_theme()
```

---

## 必要なアセットリスト（Phase A の場合）

### 背景 (1枚)
- `bg_tournament_stage_hd.png` — 高解像度ステージ背景（ネオン照明・ジャッジテーブル・4ステーション）

### CG (第1章分 - 5〜8枚)
- `cg_ch1_tournament_opening.png` — 大会開始・ネオンロゴ＋会場全景
- `cg_ch1_player_intro.png` — 4人登場・分割画面
- `cg_ch1_vs_splash.png` — VS スプラッシュ（対戦カード風）
- `cg_ch1_climax.png` — クライマックス・煙の覚醒シーン
- `cg_ch1_victory.png` — 勝利演出（スポットライト＋ネオン）
- `cg_ch1_defeat.png` — 敗北演出
- `cg_ch1_judge_reaction.png` — 南雲・前園の反応

### キャラクター HD (Phase B以降)
- 各キャラクター × 表情差分 (最低でも normal, smile, serious)
- 4人の選手 × 4表情 = **16枚**
- 審査員・MC × 2表情 = **6枚**

---

## DALL-E プロンプト集

### スタイル共通指定（全プロンプトの先頭に付ける）

```
High-contrast anime illustration with a Danganronpa/Persona/Divine Gate aesthetic. Deep black and dark navy background. Neon color accents: hot magenta pink (#ff2d78), electric purple (#8b5cf6), cyan (#00e5ff), neon green (#39ff14). Harsh dramatic spotlights cutting through purple-magenta hookah smoke. Esports tournament atmosphere. Bold graphic design with sharp angular shapes. No warm tones, no rose gold, no amber — only cold neon and darkness. 16:9.
```

---

### Prompt 1 — 大会会場の全景

```
[共通スタイル]
A dark esports-style hookah tournament arena. Four hookah competition stations arranged on an elevated stage, each lit by a harsh white spotlight from above. Dense purple and magenta smoke fills the air, catching the neon light. A massive LED screen behind the stage displays "SMOKE CROWN CUP" in glowing magenta neon text with electric purple outlines. Silhouetted crowd in the darkness below, some holding up phones with glowing screens. Laser beams in cyan and magenta slice through the smoke above the stage. A judges' table with three seats sits at stage-front, bathed in cool white light. The atmosphere is intense, competitive, electric — like a fighting game tournament. Danganronpa-style high contrast. 16:9, 1280x720.
```

### Prompt 2 — 4人の選手登場（4分割画面）

```
[共通スタイル]
Four-panel split screen introducing four anime girl hookah competitors, Danganronpa character introduction style. Each panel has the girl's signature neon color as the background glow.

TOP-LEFT panel (neon pink #ff2d78 background glow): A confident girl with long wavy blonde twin-tails, pink bear hair clips, gold/amber eyes, wearing a leopard-print jacket over a pink top, heart-shaped gold necklace, smirking boldly. She holds a hookah hose like a weapon.

TOP-RIGHT panel (electric purple #8b5cf6 background glow): A cool girl with medium-length brown/auburn hair with bangs, crimson red eyes, wearing a dark purple oversized hoodie, chain necklace, red nail polish. She exhales purple smoke with a calm, superior expression.

BOTTOM-LEFT panel (cyan #00e5ff background glow): A serene girl with very long wavy mint-green hair in a loose braid, light blue eyes, wearing a cream cardigan over a white blouse with a teal bow. She holds her hookah hose delicately, eyes half-closed with quiet confidence.

BOTTOM-RIGHT panel (neon green #39ff14 background glow): An energetic girl with long black hair, small devil-horn hair accessories, a large green bow, emerald green eyes, wearing a black crop top, gold chain accessories, green earrings. Her mouth is open in an excited grin, radiating chaotic energy.

Bold angular dividing lines between panels in white. Name plates in stylish Japanese text at the bottom of each panel. Dramatic, stylish, competitive. 16:9, 1280x720.
```

### Prompt 3 — VS スプラッシュ（対戦カード）

```
[共通スタイル]
A dramatic VS splash screen for a hookah tournament, fighting-game style. The screen is split diagonally by a jagged magenta lightning bolt.

LEFT SIDE: The brown-haired girl (crimson eyes, purple hoodie, chain necklace) in a dynamic pose, hookah hose in hand, surrounded by swirling purple smoke and electric purple neon energy. Her side glows in deep purple.

RIGHT SIDE: The black-haired girl (green eyes, devil horn clips, green bow, black crop top, gold chains) in an excited battle stance, surrounded by neon green smoke trails and electric sparks. Her side glows in neon green.

CENTER: A massive "VS" in chrome metal with magenta neon glow, cracked and sparking with energy. Small text above reads "ROUND 2" in cyan neon.

A tournament bracket display at the very top shows the 4-person tournament structure. The bottom has a dark banner reading "SMOKE CROWN CUP" in glowing text. Background is pure black with neon particle effects. Esports broadcast overlay aesthetic. 16:9, 1280x720.
```

### Prompt 4 — シーシャを作る手元（集中シーン）

```
[共通スタイル]
Extreme close-up of a girl's hands carefully layering shisha tobacco into a clay hookah bowl. The girl has long wavy blonde twin-tails partially visible at the frame edge. A single harsh white spotlight illuminates the bowl from directly above — the tobacco layers are vivid colors. Her hands work with surgical precision.

The bowl sits on a sleek black competition station with a small digital timer glowing in cyan: "02:47". Purple smoke wisps curl from nearby hookahs. The background is near-black with faint magenta and purple neon reflections on the polished surface.

A Persona-style UI overlay appears at the bottom: a dark translucent panel with angular cuts showing "BOWL COMPOSITION" in neon magenta text, with three flavor options in cyan-bordered boxes. The mood is intense concentration — a master at work under tournament pressure. Sharp, clean, high contrast. 16:9, 1280x720.
```

### Prompt 5 — 4人が同時に競う（ワイドショット）

```
[共通スタイル]
Wide shot of four anime girls competing simultaneously at their hookah stations during a tournament round. The dark arena stage is lit by individual white spotlights over each station.

Far left: blonde twin-tail girl (pink neon glow around her station) confidently adjusting her hookah with a smirk.
Center-left: brown-haired girl (purple neon glow) methodically working with focused calm.
Center-right: mint-green-haired girl (cyan neon glow) delicately placing coals with serene precision.
Far right: black-haired girl (green neon glow) energetically working, smoke already rising from her hookah.

Each girl's station emanates her signature neon color in the smoke. The four colors of smoke — pink, purple, cyan, green — rise and intertwine in the air above, creating a spectacular multi-colored haze under the arena lights. A row of three judges sits in silhouette at a table in the foreground. An LED scoreboard shows four names and scores in neon text. Crowd silhouettes in the deep background. Competitive esports atmosphere, Hookah Battle tournament. 16:9, 1280x720.
```

### Prompt 6 — クライマックス（煙の覚醒シーン）

```
[共通スタイル]
A Persona-awakening-style dramatic moment. The brown-haired girl (crimson red eyes, purple hoodie, chain necklace) stands center frame, having just exhaled a massive cloud of hookah smoke. Her eyes glow crimson. Her purple hoodie billows as if caught in a supernatural wind.

The smoke behind her erupts into a towering pillar of electric purple and magenta energy, forming abstract shapes like a Persona summon — swirling, chaotic, beautiful. Neon purple lightning crackles through the smoke. The entire background is consumed by deep purple and magenta, with her figure silhouetted against the light.

The other three girls are visible in the lower corners of the frame, looking up in shock and awe, their faces lit by the purple glow. The judges' eyes are wide.

At the top of the frame, stylized Japanese text appears like a Danganronpa chapter title, glowing in magenta neon. The composition is overwhelming, dramatic — a moment where a competitor transcends the ordinary. 16:9, 1280x720.
```

### Prompt 7 — 審査員の反応

```
[共通スタイル]
Three hookah tournament judges sitting at a sleek black judges' table, reacting to an incredible performance. Harsh white spotlights illuminate them from above against a dark background.

The central judge — a distinguished older man in a dark suit (Nagumo) — has risen slightly from his chair, eyes wide, gripping the table edge. His expression shows genuine shock and respect.

The judge to his left — a jovial middle-aged man (Maezono) — has tears streaming down his face, mouth open in a whisper: experiencing something transcendent.

The judge to his right — a younger, stylish figure — scribbles furiously on a scorecard, hand trembling.

Purple and magenta hookah smoke drifts across the table between them. Their score paddles lie face-down, building tension. Small cyan-glowing digital displays at each seat. Neon magenta accents on the table edges. The atmosphere is of a decisive moment in competition. Dramatic anime reaction shot. 16:9, 1280x720.
```

### Prompt 8 — 結果発表（明暗のコントラスト）

```
[共通スタイル]
Tournament results scene with extreme light-dark contrast, Danganronpa style. A massive LED scoreboard dominates the background, displaying final scores in glowing neon text:

1st — [name] — 94pts (in gold #ffd700 neon)
2nd — [name] — 87pts (in cyan)
3rd — [name] — 82pts (in white)
4th — [name] — 76pts (in dim gray)

CENTER: The brown-haired girl (the winner) stands in a cone of brilliant white-gold spotlight, looking up at her score in quiet disbelief. Purple smoke curls around her feet. Her expression is restrained emotion — she can barely believe it.

The other three girls are partially in shadow:
- The blonde twin-tail girl clenches her fist, her neon pink glow dimming but her eyes burning with determination to come back.
- The mint-green-haired girl offers a gentle smile and slow clap from the shadows, graceful in defeat.
- The black-haired girl has tears in her eyes but flashes a fierce grin — she's already planning her comeback.

Confetti particles fall through the spotlights in magenta and cyan. The crowd is a sea of phone lights in the darkness. The composition tells the story of victory and defeat in a single frame. 16:9, 1280x720.
```

### Prompt 9 — ゲーム画面UIモック

```
[共通スタイル]
Game UI screenshot mockup for a hookah tournament visual novel, Persona-style UI design. 1280x720 resolution.

BACKGROUND: Dark painterly illustration of a competitive hookah arena — purple-magenta smoke, white spotlights, neon accents.

TOP BAR: Angular, slashed design (Persona-style diagonal cuts) in dark translucent panel. Left: "SMOKE CROWN CUP" in magenta neon. Center: "ROUND 2 / SEMIFINAL" in white. Right: "LIVE" indicator pulsing in red with a timer "03:42" in cyan.

RIGHT PANEL: "MATCH CARD" in a vertical dark panel with magenta border glow. Four small circular character portraits stacked vertically — each framed in their neon color (pink, purple, cyan, green). Score numbers beside each in neon text. The currently competing pair is highlighted.

CENTER: Main visual showing two girls facing each other across their hookah stations, dramatic smoke between them.

BOTTOM: Commentary text box — dark translucent panel with angular Persona-style cuts. Japanese commentary text in white. Speaker name "焚口" in a magenta tag.

ACTION BAR: Three buttons at the very bottom — "ボウル構成" / "火力調整" / "仕上げ" — each in dark panels with cyan neon borders, text in white. Stylish angular button shapes.

Overall feel: dark, neon, competitive, stylish. NOT warm or cozy. 16:9.
```

### Prompt 10 — 比較用：日常パート（ピクセルアート）

```
Pixel art game screenshot, VA-11 Hall-A / Read Only Memories style. A cozy Japanese hookah bar interior at night.

Behind the counter: a pixel art girl with long wavy blonde twin-tails and pink bear hair clips, wearing an apron, preparing a hookah. Another girl with long black hair, green bow, and devil horn clips sits at the counter chatting.

Warm pixel lighting from overhead lamps in amber tones. Wooden shelves lined with hookah equipment, glass bottles, and flavor containers. A neon "OPEN" sign glows softly in the window. Retro CRT scanline effect overlay.

A dialogue box at the bottom with a pixel portrait and Japanese text in a retro pixel font. The bar name "tonari" on a small sign.

Cozy, warm, intimate — the complete visual opposite of the tournament scenes. Low-res pixel art, 16-color-feeling palette. 16:9, 1280x720.
```

---

## まとめ

> **日常の「ヴァルハラ風ピクセルアート」と大会の「ダンガンロンパ/ペルソナ風ネオンバトル」——**
> **この圧倒的な画風の落差が、プレイヤーに「本気の勝負」を肌で感じさせる。**

ピクセルアートのぬくもりある日常から、
ネオンマゼンタとスポットライトが煙を切り裂く競技ステージへ——
**静と動、暖と冷、日常と非日常のコントラスト**こそが、このゲームの大会パートの最大の武器。
