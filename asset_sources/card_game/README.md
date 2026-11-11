# カードゲーム「一台勝負」の絵（ICG）

ゲーム内のミニゲーム（`remake/js/minigames/ichidai.js`・試遊は `remake/ichidai.html`）に出す絵の、引き当て・依頼・原画・採用の記録。
カードの枠・名前・数字・温度の帯はコードで描く。**ここで作るのは絵だけ**（1枚1題材・文字や数字は描かない）。

## いま画面に出ている絵（2026-11-11）

卓はプレイマットの枠に札を置く形で、**札の絵は本編の正規の絵**を使っている（現物の絵は卓に置かない）。引き当ては `remake/js/minigames/ichidai-art.js`。

| もの | 使っている絵 |
|---|---|
| マットの面・ボタン・温度計・票のメダル | 夜紫UI（`remake/img/ui/craft-night/`・`craft-stage/counter-stone.webp`）。札の枠は CSS（仮） |
| 葉の札 | ショップの箱絵（`remake/js/daily/shop-art*.js` と同じ引き方） |
| 炭カード | シーシャ作りの炭（`remake/img/ui/making/coal_*.webp`） |
| チャコスタのカード | シーシャ作りのコンロ（`heat_stove.webp`） |
| ボウル（ハガル）・HMD の札 | シーシャ作りのボウル（`bowl_*.webp`）・ショップのHMD（`remake/img/shop/equipment/`） |
| 自分・相手・審査員・人物カード | 顔アイコン（`remake/img/ui/face_icons/`） |
| 技・イベント・器具（チャコスタ以外） | **仮**: 成長盤の線画アイコン（`remake/img/ui/growth_board/icons/`） |
| 裏面（デッキ・審査カード） | **仮**: 夜紫UIの札（`entry-rival.webp`・`entry-me.webp`） |

箱絵の無い葉は4種（クールミント・ジャスミン・チョコレート・コーヒー）で、系統の色の丸で出る。アイスグレープはグレープの箱を借りている。

## このゲームのために作る絵の置き場

絵を置けば、上の「仮」と本編の絵より優先して画面に出る。

| もの | 置き場 |
|---|---|
| 依頼文 | `art-20261111/gen.py`（`--list` で一覧、`--print <id>` で文）。説明は `art-20261111/prompts.md` |
| 原画（生成したまま） | `art-20261111/raw/<種類>/<id>.png`（Git LFS） |
| 採用した絵 | `assets/ui/ichidai/<種類>/<id>.png`（Git LFS） |
| 画面用の WebP | `remake/img/ui/ichidai/<種類>/<id>.webp`（Git LFS。`remake/tools/build_ichidai_art.py` が作る） |
| ゲームが読む一覧 | `remake/js/minigames/ichidai-art.js` の `ICHIDAI_ART`（同じスクリプトが書き直す） |

種類と id:

- `card` … デッキのカード。id は `remake/js/minigames/ichidai-data.js` の `CARDS` の id（`heat_in`・`read`・`hype` など）。手札・詳細・相手が使った札に出る。
- `table` … 卓。id は `mat`。対戦の背景に敷く（1280×720）。
- `back` … 裏面。id は `deck`（デッキ・相手の手札）と `judge`（審査カードの山・めくった審査カードの地）。5:7。
- `flavor` … 葉。id は `FLAVORS` の id。ショップの箱絵が無い葉だけ要る（箱絵は本編のショップでも使うので、本編の箱絵の作り方に合わせる）。

## 受け取った後の手順

1. 原画を `art-20261111/raw/<種類>/<id>.png` に保存し、下の表に1枚1行で書く。
2. 採用する絵を `assets/ui/ichidai/<種類>/<id>.png` に置く（加工しない。切り出しと縮小はスクリプトがする）。
3. `python3 remake/tools/build_ichidai_art.py` を実行する。WebP と一覧が作られる。
4. `python3 remake/tools/serve_preview.py --port 8123` を起動し、`http://127.0.0.1:8123/remake/ichidai.html` で見る。
   - カードの絵は手札（絵の窓は幅約100px）で、何の絵か分かるか。24枚を並べて、明るさ・大きさ・光がそろっているか。
   - 卓は、上に載る札・炭・白い文字が読めるか（明るすぎ・模様が強すぎないか）。
   - 裏面は、相手の手札（幅50px）と山札で、デッキと審査カードの区別がつくか。
5. `node tools/ci/run.mjs --kind quick --suites ichidai-rules`（一覧と WebP がそろっているか）と
   `node tools/ci/run.mjs --kind browser --suites ichidai` を通す。
6. 新しい画像は Git LFS（`git add` のあと `git lfs ls-files` で確かめる）。

シーシャ台・ハガル・HMD・炭・ホースが写る絵（風防・アイスホース・ディフューザーのカードなど）は、`docs/shisha_reference.md` の「4. 画像生成の必須手順」に従う
（参考写真は非公開リポジトリ `siryou` の `shisha-hardware-reference/web-refs/images/`。4.2 の文を貼る。4.1 と 4.4 で検品）。`gen.py` には入れていない。

## 原画の記録（生成したら1枚1行で書く）

| 原画 | サイズ | bytes | SHA-256 | CHECK の結果・採用 |
|---|---:|---:|---|---|
| （未生成。2026-11-11 に `gen.py` を実行したが、画像生成APIの残高が無く 1 枚も作れなかった） | | | | |

## 依頼の状況

- 第2弾（`gen.py` の27枚: 卓1・裏面2・技16・イベント7・キッチンタイマー1）と、機材が写る器具3枚、箱絵の無い葉: Issue #3221。
- 相手の立ち絵・表情・演出で「対戦している感じ」を強める: Issue に分けた（`docs/owner_requests.md` ICG18）。
- カードの枠・裏面・プレイマット・しるしのデザイン（トレカ風）: Issue #3257。依頼書は `docs/design/card_game/card_design_brief.md`、原画と記録は `asset_sources/card_game/design-20261111/`。
