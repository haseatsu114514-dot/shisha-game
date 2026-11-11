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
| `flavor/black_tea.png` | 1254×1254 | 1772083 | `9775d6e7bfb27461db7205a1ec22dfedaa562157c01d2593180557763a61905a` | 合格: 紅茶1杯と茶葉、受け皿・スプーン・文字なし |
| `flavor/blueberry.png` | 1254×1254 | 1724076 | `858661204c8438d82bd153073b14237351550291ce5dc4ffc22606122e848af0` | 合格: ブルーベリーの小山、葡萄と区別可、文字なし |
| `flavor/cardamom.png` | 1254×1254 | 1732853 | `8273ff6692b3c3a9409ab2553706164a74f63867296dae0c2339f724675ce15f` | 合格: 緑の莢、割れた莢2つ、文字なし |
| `flavor/chocolate.png` | 1254×1254 | 1699779 | `836025396e0d685d4d24fc79cd3e925f8ba5453348fead861ba29cda8b1e4cd5` | 合格: 板チョコと欠片2つ、包装・刻印なし |
| `flavor/cinnamon.png` | 1254×1254 | 1866268 | `1cbafeefe657d60e423683092462a540462e65835f214afba232ea7630114c2e` | 合格: スティック3本と粉、紐なし |
| `flavor/coffee.png` | 1254×1254 | 1667930 | `a8fc3308bbd232a60167095a9ab3c68def0a26b7c8886140fdd7b3a530a0337b` | 合格: エスプレッソと豆、受け皿・スプーンなし |
| `flavor/cool_mint.png` | 1254×1254 | 1799995 | `116e82e477ac8f0cacbf01ff827b7d6d1c1724fbe774c7c8946dd87a2c6a52a0` | 合格: 砕いた氷上のミント、通常ミントと区別可 |
| `flavor/death_by_ice.png` | 1254×1254 | 1953978 | `c979ec47eaa3c136235198dc27447efe2238ccaf0041066af4dfbb6331a55e85` | 合格: 氷塊1つと冷霧、顔・記号なし |
| `flavor/double_apple.png` | 1254×1254 | 1754631 | `4f0b1be56006c7947e84fd3ebd74b5782e68fbbe35458fd27f99fee5c6be8071` | 合格: 赤・緑のりんご各1と八角1 |
| `flavor/ice_grape.png` | 1254×1254 | 2157894 | `0bc44209469187697f025ff6b105002e600e77ddf37f5687f0616a76ad006771` | 合格: 霜つき葡萄と氷2個、ブルーベリーと区別可 |
| `flavor/jasmine.png` | 1254×1254 | 1772394 | `58b8f56e293798baba1051419aba3680fd58157036bb6ab932c4601cc57bd479` | 合格: 白いジャスミンの枝1本 |
| `flavor/lavender.png` | 1254×1254 | 1754772 | `12ade94af688faa49d7f8250e1e61955ed00dca378084d02fd1e93225bf23950` | 合格: ラベンダー5本、紐なし、背景と区別可 |
| `flavor/lemon.png` | 1254×1254 | 1749330 | `e86a4a34357648e6d902220c8b5a103d362724974f0e2cb98b4aacfb04472f8d` | 合格: レモン1個と半分、葉2、中央配置 |
| `flavor/mango.png` | 1254×1254 | 1859629 | `8add6d51eae1a6cefc2fced5bfcdd8cb6eede9a18690f79bcbc1829fa05dc6db` | 合格: マンゴー1個と角切り2つ |
| `flavor/mint.png` | 1254×1254 | 1693541 | `14647a678744b183e2431df5e1e9cc2d829a0dd6f8b3c23296065f057b849c2a` | 合格: 枝1本、主葉6枚、縁の鋸歯を確認 |
| `flavor/peach.png` | 1254×1254 | 1828201 | `f5c2c6b6bac522fac03569279d9778323a2bcbf2f30460fb1cdce880ca95a079` | 合格: 桃1個と1切れ |
| `flavor/rose.png` | 1254×1254 | 1784743 | `35119634f9ecc52799702267fb8228d59978bec7d287a2fd137876a88c498381` | 合格: バラ1輪、花束なし |
| `flavor/spring_water.png` | 1254×1254 | 1709405 | `305e5132b67d32b44810095cc6998797ab460c8687d3fe4ad93a5ccadd83087e` | 合格: 水のグラス1つと水滴、氷・ストローなし |
| `flavor/vanilla.png` | 1254×1254 | 1722558 | `936276640cf11f4b4f950a1def6a339dba60a33347e570e7121cda0c7e6b8333` | 合格: 莢2本と花1輪 |
| `flavor/white_gummy_bear.png` | 1254×1254 | 1672393 | `a9af04dad9e2be01ff440202413223e8dfd9cb57f1d9f8800eacec487f7d0b24` | 合格: 半透明グミベア3つ、顔は控えめ |
| `card/cube.png` | 1254×1254 | 1798633 | `d3c21ad0d61e30e0e696665d6657930d6af775ab9f183a240797669d8bb0140a` | 合格: 立方体3個、灰と微赤熱、炎・煙・機材なし |
| `card/dense_flat.png` | 1254×1254 | 1640668 | `bc7d010e33fef2df83460bf25fc6e79cc40053c2352173d0eff724279cf0493d` | 合格: 黒く平たい炭3個、薄灰と均等な赤い縁、炎・機材なし |
| `card/flat.png` | 1254×1254 | 1696858 | `b58dde12a79af76633ce822b7323bcb12572f2ab973e15dfa73df490ce3a9825` | 合格: 平たい炭3個、灰と微赤熱、炎・煙・機材なし |
| `table/counter.png` | 1536×1024 | 2089626 | `8c75085a55c89780632e59014e5815ecc2d5af035522baa7b329445e215a4e17` | 合格: 2回目を採用。天板のみ、無文字、低コントラスト、暗い四隅 |

天板は同じ指定文で3回生成。1回目と3回目は外周線が入ったため不採用、2回目を採用。葉20枚は一覧で明るさ・題材の大きさ・上から斜めの角度を比較した。炭は50px縮小でフラットとキューブの輪郭を区別できた。

## このあとの弾（第1弾を見てから）

- 技・イベント 23枚（煙や光の動きで描く。人物と機材は描かない）
- 器具 5枚（風防・チャコスタ・キッチンタイマー・アイスホース・ディフューザー。機材なので必須手順に従う）
- 審査カード 7種（吸い方ごとの煙の形）
- 人物カードと審査員は、正規の顔アイコン・立ち絵を使う（新しく描かない）
- カードの枠そのものの見た目は、`docs/design/card_game/card_design_brief.md` の3案から方向を決めてから作り直す
