# 大会パート グラフィック刷新 構想書

## コンセプト：「中継カメラが回り始める」

普段のヴァルハラ風ピクセルアートは「プレイヤー＝始の日常の目線」。
大会に入った瞬間、**テレビ中継のカメラが回り始めたかのように**画面の質感がガラリと変わる。

プレイヤーに「ここからは本番だ」という緊張感と高揚感を、**絵の力で**伝える。

---

## 全体方針

| 要素 | 日常パート (現行) | 大会パート (新) |
|---|---|---|
| **画風** | ヴァルハラ風ピクセルアート | ハイディテール・アニメイラスト調 |
| **テクスチャフィルタ** | `nearest` (ドット感) | `linear` (滑らか) |
| **フォント** | DotGothic16 (ドットフォント) | ゴシック系 or 角ゴシック (Noto Sans JP Bold 等) |
| **カラーパレット** | 暖色系・ダークネイビー基調 | ネオン・煙・スポットライト感 |
| **BGM** | 落ち着いたチル系 | EDM / ハイテンポ (既存の bgm_tournament_edm) |
| **UIパラダイム** | ADVテキストボックス | 実況中継風オーバーレイ |

---

## 具体的な変更ポイント

### 1. 背景 & ステージ演出

**現状**: `bg_tournament_stage.png` (ピクセルアート) + 暗めオーバーレイ

**提案**:
- 高解像度の大会ステージ背景に差し替え（照明リグ・煙・観客シルエット入り）
- 背景にアニメーション要素を追加:
  - スモークパーティクル（GPUParticles2D）が常時ゆっくり漂う
  - スポットライトが揺れる（Light2D or CanvasModulate でライティング変化）
  - 観客の歓声に合わせた微弱なスクリーンシェイク
- ラウンド転換時に照明が切り替わるような色味変化

### 2. キャラクター表示の二重化

**現状**: ピクセルアートのキャラスプライト (`chr_*.png`) + ドット顔 (`face_*.png`)

**提案**: 大会用に**高解像度キャラクターイラスト**を別途用意

```
assets/sprites/characters/         ← 日常用 (現行ピクセルアート)
assets/sprites/characters_hd/      ← 大会用 (ハイディテール)
assets/sprites/faces/              ← 日常用 (現行ピクセルアート)
assets/sprites/faces_hd/           ← 大会用 (ハイディテール)
```

- 対戦相手のカットイン登場時は、画面を大きく使った演出付きで表示
- シーシャ調理中の集中シーンは、キャラの手元クローズアップCGを挿入
- ファイル命名規則は同じ (`chr_naru_normal.png` → `chr_naru_normal.png` in `characters_hd/`)

### 3. UI パネルの刷新（実況中継モード）

**現状**: MainPanel (左) + SidePanel (右) の2カラム ADVレイアウト

**提案**: 大会専用UIレイアウト

```
┌──────────────────────────────────────────────────┐
│ [SMOKE CROWN CUP]     ROUND 2 / 3     [LIVE] 🔴 │  ← ヘッダーバー (中継風)
├────────────────────────────────┬─────────────────┤
│                                │  対戦カード      │
│     メインビジュアル領域        │  ┌───┐ VS ┌───┐ │
│     (ステージ背景 +            │  │始 │    │鳴 │ │
│      キャラクター +            │  └───┘    └───┘ │
│      シーシャビジュアル)        │  62pts   71pts  │
│                                │─────────────────│
│                                │  実況テロップ    │
│                                │  「焚口：おっと │
│                                │   始選手、      │
│                                │   ここで攻めの  │
│                                │   フレーバー！」 │
├────────────────────────────────┴─────────────────┤
│  [アクション選択] ボウル構成 / 火力調整 / 仕上げ   │  ← 下部アクションバー
└──────────────────────────────────────────────────┘
```

主な変更点:
- **ヘッダーバー**: 大会名・ラウンド表示・「LIVE」インジケーター
- **メインビジュアル領域**: 背景＋キャラが大きく表示される演出重視エリア
- **対戦カード表示**: 常にスコアが見える VS パネル
- **実況テロップ**: パッキー＆焚口の実況がスポーツ中継風に流れる
- **下部アクションバー**: 選択肢は画面下部にコンパクトに配置

### 4. カラーパレット（大会専用）

```
TOURNAMENT_BG_DEEP:      #0a0e1a   (深い藍黒)
TOURNAMENT_ACCENT_CYAN:  #00e5ff   (シアンネオン)
TOURNAMENT_ACCENT_MAGENTA: #ff2d78 (マゼンタネオン)
TOURNAMENT_GOLD:         #ffd700   (勝利のゴールド)
TOURNAMENT_SMOKE_WHITE:  #e8e0f0   (煙の白紫)
TOURNAMENT_TEXT_WHITE:   #f0f0f0   (明るいテキスト)
TOURNAMENT_PANEL_BG:     #121828   (パネル背景)
TOURNAMENT_PANEL_BORDER: #00e5ff33 (パネル枠・薄グロー)
```

既存の `THEME_*` 定数はそのまま残し、`TOURNAMENT_*` を GameManager に追加。
大会シーン進入時に `_apply_tournament_theme()` / 退出時に `_apply_default_theme()` を呼ぶ。

### 5. エフェクト＆シェーダー

#### 既存エフェクトの拡張
- **_ScanlineEffect**: 大会パートでは OFF にする（ピクセルアート向けなので）
- **_screen_shake**: 強度を上げて、対戦のクライマックスで使う
- **_screen_flash**: ネオン系カラーに変更

#### 新規エフェクト
| エフェクト | 用途 | 実装方法 |
|---|---|---|
| **スモークパーティクル** | 常時背景に漂う煙 | GPUParticles2D |
| **スポットライト** | ステージ演出 | PointLight2D × 2〜3 + アニメーション |
| **ネオングロー** | UI枠・テキストの発光 | シェーダー or StyleBoxFlat + shadow |
| **カットイン演出** | 対戦相手の登場・必殺技 | Tween + TextureRect スライドイン |
| **スコアポップ (強化版)** | 得点表示がド派手に | パーティクル付き数字アニメーション |
| **煙文字** | ラウンド開始「ROUND 1」等 | テキスト + dissolve シェーダー |
| **集中線** | クリティカルな選択時 | _draw() で放射線 + フェード |

### 6. フォント切り替え

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

### 7. テクスチャフィルタの動的切り替え

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
1. **大会開始宣言** → 会場の全景CG（1枚絵）
2. **対戦相手の登場** → キャラクターのカットインCG
3. **クライマックス（最終ラウンド開始）** → 煙の中に浮かぶ二人のCG
4. **結果発表** → 勝利/敗北の演出CG
5. **名場面リプレイ** → 審査員の反応CG

必要な枚数: 1章あたり **5〜8枚** 程度
既存の `show_cg` / `hide_cg` 命令をそのまま活用できる。

### Phase B: 「UI刷新」（中コスト）

Phase A + UIパネルのデザイン変更。
- カラーパレットの切り替え
- フォントの切り替え
- パネルレイアウトは微調整程度
- 既存のゲームロジック・選択肢構造はそのまま

### Phase C: 「完全中継モード」（フルコスト）

Phase B + レイアウト全面刷新 + パーティクル＆シェーダー。
前述の「実況中継モードUI」を完全実装。

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
- `bg_tournament_stage_hd.png` — 高解像度ステージ背景

### CG (第1章分 - 5〜8枚)
- `cg_ch1_tournament_opening.png` — 大会開始・会場全景
- `cg_ch1_vs_naru.png` — 鳴切との対峙
- `cg_ch1_vs_adam.png` — 吾妻との対峙
- `cg_ch1_vs_minto.png` — 翠川との対峙
- `cg_ch1_climax.png` — 決勝・煙の中の二人
- `cg_ch1_victory.png` — 勝利演出
- `cg_ch1_defeat.png` — 敗北演出
- `cg_ch1_judge_reaction.png` — 南雲・前園の反応

### キャラクター HD (Phase B以降)
- 各キャラクター × 表情差分 (最低でも normal, smile, serious)
- 第1章分: hajime (5表情) + naru (4) + adam (3) + minto (2) + sumi (3) = **17枚**

---

## まとめ

> 「ヴァルハラ風の日常」と「アニメ風の大会」の落差こそが、
> このゲームの大会パートを特別な体験にする最大の武器。

ピクセルアートのぬくもりある日常から、
ネオンと煙が舞うハイディテールの大会ステージへ——
この**画風の落差**がプレイヤーに「今から本気の勝負が始まる」と肌で感じさせる。
