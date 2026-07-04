---
name: codex-image-prompt
description: 画像（立ち絵・背景・CG・UIパーツ）の新規生成や修正が必要になり、Codex等の画像生成AIに渡すプロンプトを作るときに使う。「〜の画像が要る」「この画像を直したいからCodex用プロンプトちょうだい」のとき。種類別の正本プロンプト集の参照・仕様の焼き込み禁止事項・受け取り後の組み込み手順まで。Use when the owner needs a copy-paste prompt for Codex/image AI to generate or fix game art assets.
---

# Codex用 画像生成プロンプトの作成

成果物は**オーナーがそのままCodexにコピペできるプロンプト1ブロック**。
ゲーム側の都合（サイズ・透過・保存先・焼き込み禁止）を全部プロンプトに含めるのが仕事。
自分の感覚で画風を創作せず、**種類別の正本プロンプト集から書式とスタイル指針を写す**。

## Step 1 — 種類を特定し、正本を開く

| 種類 | 正本（書式・スタイル指針をここから写す） |
|---|---|
| 背景 | `tools/bg_prompts.txt` — 英語プロンプト・1280x720・no people・painterly。画風基準は `bg_eden_shop.png` |
| 立ち絵・表情差分 | `docs/image_generation_guide.md` — マゼンタ(#FF00FF)背景・表情は1枚のシートで一括生成・pixelize前提 |
| 作りパートUI・小物 | `docs/asset_gen_prompts.md` — 共通スタイル指針＋配線コントラクト（ファイル名→CSSボックス・@2x・透過有無） |
| CG（一枚絵） | `docs/cg_production_plan.md` ＋ 背景の書式を流用 |

- キャラの容姿・雰囲気は `brand/character_profiles.md` と `data/characters.json` から写す。
  ⚠️ ガイド内の旧サンプルに「自信なさげ」等の**旧人格の雰囲気語**が残っていることがある。
  雰囲気の形容は最新の人格設定（CLAUDE.md「主人公」節など）に合わせて書く。
- 夜/昼の差分背景は `_day`/`_night` ペア命名（`resolveSceneBg()` が自動切替に使う）。

## Step 2 — プロンプトに必ず含める6点セット

1. **スタイル指針**（正本の共通指針を冒頭にそのまま貼る。要約・言い換えしない）
2. **保存先とファイル名**（例: `assets/backgrounds/bg_xxx.png`。命名は既存に倣う）
3. **サイズ・アスペクト・透過の有無**（UIパーツは@2x。立ち絵はマゼンタ背景→透過はスクリプト側）
4. **場面の内容**（人物なし/あり、時間帯、光源。既存の近い画像を参照基準として指定）
5. **焼き込み禁止**: 文字・ロゴ・数字・ゲージ・watermark。作りパート素材では
   穴・煙・炭の明滅・水泡など**コードが描く動的要素**も焼き込まない
   （`docs/asset_gen_prompts.md` の分業表が正）
6. **NG形状**: シーシャ台の先端は小さい凸型金属ポスト（カップ型・ボウル一体型にしない）

**修正依頼**の場合はさらに: 現画像のパスと「何がどうダメか」を具体的に
（例:「左腕だけ肌色が違う」「夜なのに影が昼向き」）、維持してほしい要素を明記する。

## Step 3 — 出力形式

- コピペ可能な**1つのコードブロック**で出す（前置き・後書きを混ぜない）。
- 複数枚頼むときは `tools/bg_prompts.txt` 式に「--- n/N: ファイル名 ---」で区切る。
- 立ち絵の表情差分は**必ず同一生成内のグリッドシート**で頼む（別々に生成すると顔が変わる）。

## Step 4 — 画像を受け取った後の組み込み（こちら側の仕事）

```bash
# 立ち絵: 変換→正規化→ビルド（詳細は portrait-fix スキル E節）
python3 tools/pixelize.py sheet.png --char <id> --slice 3x2 --names normal,smile,sad,serious,surprise
# 背景: そのまま保存 or pixelize --key none --grid 360 --out assets/backgrounds/<name>.png
python3 web/build_data.py && python3 web/build_standalone.py
```

- 立ち絵を入れたら `node web/test/portraits.mjs`、UIパーツなら該当画面を目視確認。
- **良いプロンプトができたら正本のプロンプト集（bg_prompts.txt / asset_gen_prompts.md）に
  追記して資産化**する。チャットに使い捨てにしない（プロンプトも一元管理）。
