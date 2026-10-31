# 制作（シーシャ作り）の紙×ラベンダーUIの生成原画（2026-10-31・CUI01〜05）

シーシャ作りパート（作業台 `remake/js/craft/`）を、最近の地図・メニュー・Dr.fookah と同じ紙×ラベンダー＋琥珀へ一新するための生成素材（台帳 `docs/owner_requests.md` CUI01〜04、先行する日常UIは `asset_sources/ui/paper-20261031/`）。

## 生成

- モデル: OpenAI `gpt-image-2.5-sunburst`（オーナー指定。`quality: high`、PNG）。板と壁紙は `background: opaque`、温度計の枠とボタン3種は `background: transparent`（透過が正しく出る。`gpt-image-1.5` の透過は全画素透明になる問題があったが、本モデルでは縁が alpha 0→250 で切れ、光彩も alpha に乗る）。
- 指示文は `prompts/`（共通の `style.txt` を各ファイルの先頭に付けて送った）。文字・数字・アイコン・針は焼き込まず、コードで重ねる。

| 原画 | サイズ | SHA-256 | 指示 |
|---|---|---|---|
| `raw/board.png` | 1536×1024 | `9001afbf23fca46e673022adc63344793f1d44ff04b2120d313fc7f5c573935e` | `prompts/board.txt` |
| `raw/backdrop.png` | 1536×1024 | `aadb2650a260b110d3d04448942867cd188011f9972c8ad1c6c707379ef38623` | `prompts/backdrop.txt` |
| `raw/thermo-frame.png` | 1024×1536 | `569d59bfc00f744ce158e69183971dd99e018b589e1f7d7997cb9498f97d2b7f` | `prompts/thermo-frame.txt` |
| `raw/button-paper.png` | 1536×1024 | `0a312603d5f2f067254ab12a76c2e2a8284ecdfb789d3eedf8dfe45f8aeab593` | `prompts/button-paper.txt` |
| `raw/button-lavender.png` | 1536×1024 | `edb0afbad29ba16a37e3dbe70f009764bcc1c051333e8f0e90a9260c473240c4` | `prompts/button-lavender.txt` |
| `raw/button-amber.png` | 1536×1024 | `15f8a86230fc89f1e4f91c1478dc355757f8cedcc197d4cace7adfda47eefb9c` | `prompts/button-amber.txt` |

## 採用（原画 → `assets/ui/craft-paper/`）

色はゲームのラベンダー `#69497e`・琥珀 `#d8963f` に十分近く出たので色合わせはしていない。透過の4枚は、実体（alpha 250 以上）の外接範囲で切り出し、透明画素の色を黒にそろえて縮小時のにじみを防いだ。琥珀のボタンだけ外側の光彩を 40px 残した。

| 採用 | サイズ | 切り出し（原画の左, 上, 右, 下） | SHA-256 |
|---|---|---|---|
| `board.png` | 1536×1024 | そのまま | `c7adfd49ec59924de0ac37ef57ea58b15ae3456c59d221ff98a49cd79379ea1f` |
| `backdrop.png` | 1536×1024 | そのまま | `2704a051bc3f2cb76d46ae9d225eb28a222c164e669ae591569560ffeaf1cd4e` |
| `thermo-frame.png` | 401×1445 | 312, 46, 713, 1491 | `aa0962b6a9351d3ffbe72f6dfb68ca26b85bebc5d9ec7d4e675b274de01bd1b2` |
| `button-paper.png` | 1465×684 | 36, 170, 1501, 854 | `f46a6e1f6e41cac793eeb92c3eba19f0e8eb6bbc2542677a8781e1ed1e4352ea` |
| `button-lavender.png` | 1471×601 | 33, 211, 1504, 812 | `83035e78c5b51de14773a92984444900acace3d267ec3d24b197aa5192c0c0df` |
| `button-amber.png` | 1513×588 | 12, 217, 1525, 805（光彩 40px 込み） | `97a3e0a1b213829b1f768b2ddc3191effdba2ebe54bf2000c5e9baa08a5cd8ae` |

温度計の枠の透明な窓は、採用画像の幅 33.4〜66.3%・高さ 5.1〜92.6%（原画で x 446〜577、y 119〜1383）。`remake/css/craft-paper.css` の `.thermo-housing .thermo-tube` の inset はこの窓に合わせてある。枠を作り直したら窓の位置も測り直す。

## ゲームへの組み込み

- `python3 remake/tools/build_ui_skin.py` が `remake/img/ui/craft-paper/` を作る（板 768px・壁紙 1280px・温度計の枠 160px・ボタン 512px 幅のWebP。切り出し範囲は原画の寸法と組で固定）。
- 使う場所: `remake/css/craft-paper.css`（`.bench` の全モード）。板は左右のウインドウと結果カードの `border-image`（切り分け 40/768px）、壁紙は作業台の背景、温度計の枠は `.thermo-skin` の差し替え、ボタン3種は通常／主（ラベンダー）／特別な一手（琥珀＝吸う・穴をあける・詰め方の決定）の `border-image`。
- 旧素材（`remake/img/ui/making/ui_craft_*.webp`・`ui_temperature_frame.webp`・`ui_mockup_inhale_button.webp`・`ui_refresh_button.webp`）は削除していない。`skin.js` は従来どおり読み込むが、CSS が面を上書きする。

## 工程ごとの舞台（CUI05）

共通の `prompts/style-scene.txt`（明るい絵画調・人物と文字なし）を先頭に付けて生成した。中央を空けた天板で、左右の端だけに小道具がある。採用はそのまま（色合わせ・切り出しなし）、`build_ui_skin.py` で 1280px 幅のWebPにする。

| 原画・採用 | サイズ | SHA-256 | 指示 | 使う工程 |
|---|---|---|---|---|
| `raw/stage-kitchen.png`・`assets/ui/craft-paper/stage-kitchen.png` | 1536×1024 | `0daf09401a665cf76e5fb095c0978ee2e09126d70910074a13a9e1c996e1f205` | `prompts/stage-kitchen.txt` | 炭焼き・調整 |
| `raw/stage-workbench.png`・`assets/ui/craft-paper/stage-workbench.png` | 1536×1024 | `1b1344da5214cd4e3b2099a5a1777004e4173332f494ad0152ab22940f603b5f` | `prompts/stage-workbench.txt` | 穴あけ・蒸らし時間・配合と詰め方のボウルの窓 |
