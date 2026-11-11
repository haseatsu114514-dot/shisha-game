# カードゲーム「一台勝負」の絵（ICG）

ゲーム内のミニゲーム（`remake/js/minigames/ichidai.js`・試遊は `remake/ichidai.html`）に出す絵の、依頼・原画・採用の記録。
カードの枠・文字・数字・温度の帯はコードで描く。**ここで作るのは絵だけ**（1枚1題材・文字や数字は描かない）。
絵が無いカードは色と1文字で出るので、届いた分から順に差し替わる。

## 置き場

| もの | 置き場 |
|---|---|
| Codex への依頼文 | `art-20261111/prompts.md`（第1弾: 卓の天板1・葉20・炭3。依頼の Issue は #3221） |
| 原画（生成したまま） | `art-20261111/raw/<種類>/<id>.png`（Git LFS） |
| 採用した絵 | `assets/ui/ichidai/<種類>/<id>.png`（Git LFS） |
| 画面用の WebP | `remake/img/ui/ichidai/<種類>/<id>.webp`（Git LFS。`remake/tools/build_ichidai_art.py` が作る） |
| ゲームが読む一覧 | `remake/js/minigames/ichidai-art.js` の `ICHIDAI_ART`（同じスクリプトが書き直す） |

種類と id:

- `flavor` … 葉。id は `remake/js/minigames/ichidai-data.js` の `FLAVORS` の id（`lemon`・`rose` など20種）。準備の場の札に出る。
- `card` … デッキのカード。id は同じファイルの `CARDS` の id（`flat`・`cube`・`dense_flat`・`heat_in` など）。手札と、炭ゾーンの表向きの炭に出る。
- `table` … 卓の天板。id は `counter`。対戦の背景に敷く。

## 受け取った後の手順

1. 原画を `art-20261111/raw/<種類>/<id>.png` に保存し、下の表に1枚1行で書く。
2. 採用する絵を `assets/ui/ichidai/<種類>/<id>.png` に置く（加工しない。切り出しと縮小はスクリプトがする）。
3. `python3 remake/tools/build_ichidai_art.py` を実行する。WebP と一覧が作られる。
4. `python3 remake/tools/serve_preview.py --port 8123` を起動し、`http://127.0.0.1:8123/remake/ichidai.html` で見る。
   - 葉は「準備」の場の札（幅約110px）で、何の葉か分かるか。
   - 炭は手札（幅約110px）と炭ゾーン（幅約50px）で、フラットとキューブの区別がつくか。
   - 天板は、上に載る札と文字が読めるか（明るすぎ・模様が強すぎないか）。
5. `node tools/ci/run.mjs --kind quick --suites ichidai-rules`（一覧と WebP がそろっているか）と
   `node tools/ci/run.mjs --kind browser --suites ichidai` を通す。
6. 新しい画像は Git LFS（`git add` のあと `git lfs ls-files` で確かめる）。

炭が写る絵（`card/flat`・`card/cube`・`card/dense_flat`）は、`docs/shisha_reference.md` の「4. 画像生成の必須手順」に従う
（参考写真は非公開リポジトリ `siryou` の `shisha-hardware-reference/web-refs/images/`。4.2 の文を貼る。4.1 の炭の行と 4.4 で検品）。

## 原画の記録（生成したら1枚1行で書く）

| 原画 | サイズ | bytes | SHA-256 | CHECK の結果・採用 |
|---|---:|---:|---|---|
| （未生成） | | | | |

## このあとの弾（第1弾を見てから）

- 技・イベント 23枚（煙や光の動きで描く。人物と機材は描かない）
- 器具 5枚（風防・チャコスタ・キッチンタイマー・アイスホース・ディフューザー。機材なので必須手順に従う）
- 審査カード 7種（吸い方ごとの煙の形）
- 人物カードと審査員は、正規の顔アイコン・立ち絵を使う（新しく描かない）
- カードの枠そのものの見た目は、`docs/design/card_game/card_design_brief.md` の3案から方向を決めてから作り直す
