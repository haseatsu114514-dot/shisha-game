# 大会の演出リニューアル（TSH）の画像パーツ

オーナー要望（2026-11-20・[要望台帳](../../../docs/owner_requests.md) の TSH）: 「大会の演出面をリニューアルしたい　パーツをコーデックスで画像生成とか使ってもいいし豪華で派手な感じに」。

## いまの状態

- 演出そのものは実装済み（`remake/js/craft/tournament-show.js`・`remake/css/tournament-show.css`）。
- 光・冠と月桂冠・票の粒・紙吹雪・後光は**コード（CSS／SVG）と既存の絵**で描いている。この実装の時点では OpenAI の画像生成 API が残高切れ（`credit_balance_exhausted`）で、新しい絵は1枚も生成していない。
- 既存の絵の流用: 後光＝`remake/img/ui/kuji/burst.webp`、結果のカウントの舞台＝`remake/img/ui/continue/backdrop_stage.webp`、板・帯・メダル＝`remake/img/ui/craft-night/`。
- 下の4枚は「あれば差し替えるともっと豪華になる」部品。**無くても動く**。届いたら実画面で見比べて、良い方を残す。

## Codex への依頼（2026-11-20）

オーナー「絵のパーツはコーデックスに依頼」。**Codex にそのまま貼る依頼文は [codex-request.txt](codex-request.txt)**（4枚の生成・保存先・確かめること・Draft PR まで。ゲームへの組み込みは頼んでいない）。下の表と `prompts/` はその中身の元。

## 依頼文（部品ごと）

共通の書き出し（各依頼文の先頭に貼る）は [prompts/style.txt](prompts/style.txt)。1回の生成で1枚。文字・数字・ロゴは描かない（コードが載せる）。シーシャの台・ハガル・炭は描かない。

| 部品 | 依頼文 | 寸法・透過 | 原画の保存先 | 使う場所 |
|---|---|---|---|---|
| 舞台の背景 | [prompts/backdrop.txt](prompts/backdrop.txt) | 1536×1024・不透明 | `raw/backdrop.png` | 中間投票の後ろ（`.fx-dim.ts-show-dim`）・大見出し（`.ts-splash`）・アイキャッチ（`.ts-eyecatch-l/-r`） |
| 票のコイン | [prompts/vote-token.txt](prompts/vote-token.txt) | 1024×1024・透過 | `raw/vote-token.png` | 飛ぶ票の粒（`.ts-token b`。いまは色つきの光る玉。審査員の色は外側の光で残す） |
| 優勝の紋章 | [prompts/crest-gold.txt](prompts/crest-gold.txt) | 1024×1024・透過 | `raw/crest-gold.png` | 大見出しの冠と月桂冠（`.ts-splash .ts-crest`。いまは SVG） |
| 幕（左半分） | [prompts/curtain.txt](prompts/curtain.txt) | 1024×1536・透過 | `raw/curtain.png` | アイキャッチの左右の板（いまは紫の面と金の線）。鏡写しで右にも使う |

## 受け取った原画（記録）

生成は Codex 内蔵 imagegen、1回につきPNG 1枚。票のコインと優勝の紋章は生成後に透明部のノイズ除去を行ったため、生成時の記録（`RESULT.md`）とは bytes・SHA-256 が異なる。幕・背景は生成時のまま。

| 原画 | サイズ | bytes | SHA-256 | 採用先 |
|---|---:|---:|---|---|
| `raw/backdrop.png` | 1536×1024 | 1707032 | `30850fd248b77b1d7e27673785dfd84c96e504ab0b7e1be27fb16a7fd2827f56` | `assets/ui/tournament-show/backdrop.png`（同寸・そのまま採用） |
| `raw/vote-token.png` | 1254×1254 | 1594090 | `9c922a5f5b562985051af1cbc4b3d50b2635d4b5cb44f902bcaa6227b49c05ee` | `assets/ui/tournament-show/vote-token.png`（同寸・そのまま採用） |
| `raw/crest-gold.png` | 1254×1254 | 1371460 | `819b903e8d4adb0904fe6f09a5e6af78043ff4efdde54ac07657e9254144c36b` | `assets/ui/tournament-show/crest-gold.png`（同寸・そのまま採用） |
| `raw/curtain.png` | 1024×1536 | 1965083 | `4b02729b75deae47049fe390d6a4e794fc5b53412d9f4c9a1120d24c5912a306` | `assets/ui/tournament-show/curtain.png`（同寸・そのまま採用） |

配布用 WebP は `remake/tools/build_ui_skin.py` の `TOURNAMENT_SHOW_PARTS` で生成し、`remake/img/ui/tournament-show/` に置く（背景1280・コイン128・紋章512・幕640）。

## 縦表彰で追加した生成装飾（2026-11-28）

優勝専用の `assets/ui/tournament-show/champion-seal.png`（1254×1254・透過）と、表彰紙面の見出し用の `assets/ui/tournament-show/result-foil.png`（2172×724）を画像生成で制作。この2点は採用 PNG が原画。前者は王冠・金の月桂冠・紺の七宝で中央を空け、後者は金箔の煙を右に寄せて左に見出しを載せる。順位と文字は本編で描画する。`python3 remake/tools/build_ui_skin.py tournament-show` で幅512・960の配布用 WebP を再生成できる。

## 受け取った後（組み込みの手順）

1. 原画を `raw/` に置き、この表に寸法・SHA-256・採用先を足す（[夜紫UIの記録](../craft-night-20261102/README.md) と同じ形）。
2. 採用する絵を `assets/ui/tournament-show/<名前>.png` に置き（新規画像は Git LFS）、`remake/tools/build_ui_skin.py` に `TOURNAMENT_SHOW_PARTS` を足して `remake/img/ui/tournament-show/<名前>.webp` を作る（幅は背景1280・コイン128・紋章512・幕640が目安）。
3. `remake/css/tournament-show.css` の該当箇所を絵に差し替え、`python3 remake/tools/build_css_bundles.py` でバンドルを作り直す。
4. 実画面で確認する: コンソールで `__remake.dev.show("vote-2")`・`("result")`・`("result-lose")`・`("interval")`（[remake/README.md](../../../remake/README.md) の開発用ジャンプ）。1280×720 と 844×390 の両方。
5. `node remake/test/browser/ch1_tournament.mjs` と `node remake/test/browser/tournament_story.mjs` を通す。
