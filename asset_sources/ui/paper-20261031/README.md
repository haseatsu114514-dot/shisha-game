# 紙×ラベンダーUIの生成原画（2026-10-31・DUI09）

日常パートUIを Dr.fookah の紙×ラベンダー基調へ統一するための生成素材（[設計](../../../docs/design/daily-ui-menu-design.md)、台帳 `docs/owner_requests.md` DUI01〜11）。

## 生成

- モデル: OpenAI `gpt-image-1.5`（`quality: high`、`background: opaque`、PNG）。`gpt-image-2` は透過背景に未対応で、不透明でも上流で失敗が続いたため使っていない。`gpt-image-1.5` の透過指定は全画素が透明の画像になり使えなかった（不採用・保存なし）。
- 透過に頼らず、紙が画像の端まで埋まる不透明の絵を作り、角の丸めと九分割はコードで行う。
- 指示文は `prompts/`（共通の `style.txt` を各ファイルの先頭に付けて送った）。

| 原画 | サイズ | SHA-256 | 指示 |
|---|---|---|---|
| `raw/panel.png` | 1024×1024 | `2acaa896e4d1a790837354592e14ec27e04657d240f608011dbcae534845f39d` | `prompts/panel.txt` |
| `raw/dialogue.png` | 1536×1024 | `08f2ab1cd362c8d216d124fe1b37796c692156b62bb8298ae14fab5b6d6b6bf4` | `prompts/dialogue.txt` |
| `raw/lavender.png` | 1024×1024 | `999979182207ae69774f175ac1a49a9a1e7589a80301e57bd7d926d8c8609a59` | `prompts/lavender.txt` |
| `raw/menu-bg.png` | 1536×1024 | `aee47acf68a3ac7ee65fdf79cb520e58970333879fa4125aee02841e48b6b0fd` | `prompts/menu-bg.txt` |

## 色の合わせ込み（原画 → `assets/ui/paper/`）

生成の線は青みの紫（色相約258°）だったので、ゲームのラベンダー `#69497e`（色相約275°）へ寄せた。紙の部分（彩度0.05未満）は変えず、線の部分だけ色相を合わせ、彩度を約1.35倍・明るさを約0.78倍にした（HSVで、彩度0.05〜0.17の間はなめらかに混ぜる）。ラベンダーの面は中央の904px四方を切り出し、平均色が `#69497e` になるよう色ごとに寄せてから（揺らぎは0.55倍）512pxへ縮小した。生成の縦線2本はこの切り出しで外している。

| 採用 | SHA-256 |
|---|---|
| `assets/ui/paper/panel.png` | `16e6d915ddcfd7422f6026953347aefcaf15f0d3a9f7b147dec76286515261da` |
| `assets/ui/paper/dialogue.png` | `4d13bd1ed55356b9a4ad0f816f4cc0705ee9acdcc1a2138c1f387ff73b2b02ec` |
| `assets/ui/paper/lavender.png` | `b76ab7e25ec8e3348f3e2ecee112b7f1102200619592871d62b4684bf7d87d94` |
| `assets/ui/paper/menu-bg.png` | `49c8696a2fb9e710b92a9b9bb759f1d0f3fe953f5a718c6884d3ae624c3045b1` |

## ゲームへの組み込み

- `python3 remake/tools/build_ui_skin.py` が `remake/img/ui/paper/` を作る。会話窓は表示（1232×192）と同じ縦横比の @2x へ九分割で組み、右下の煙と上の罫線が潰れないようにする。板は512px（CSSの `border-image` で九分割、切り分け72px）、ラベンダーは256pxのタイル。
- 使う場所: `remake/css/ui-paper.css`（UIテーマ `paper`、既定）。会話窓・名前札・操作札・選択肢・モーダル・HUD・地図の案内・tonari の選択・ボタン。
- `menu-bg.png` は全画面MENU（設計 §4・次の段階）で使う予定。まだ実行時のWebPは作っていない。
