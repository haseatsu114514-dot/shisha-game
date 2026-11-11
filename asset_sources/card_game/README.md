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
| 技16・イベント7・キッチンタイマー | **このゲーム用の絵**（2026-11-11 Codex 生成・#3221。`remake/img/ui/ichidai/card/`） |
| 器具3枚（風防・アイスホース・ディフューザー） | **このゲーム用の絵**（2026-11-11 Codex 生成・#3332。`remake/img/ui/ichidai/card/`） |
| 裏面（デッキ・審査カード） | **仮**: 夜紫UIの札（`entry-rival.webp`・`entry-me.webp`） |

葉の札は全種に箱絵がある。クールミント・ジャスミン・チョコレートは #3287 の箱、コーヒー（ドバジ）は #3221 C で作った箱（原画 `coffee-20261111/`、PR #3329）を本編のショップと同じ `remake/js/daily/shop-art-flavor-cartons-3287.js` から引く（`tools/build_flavor_cartons_3287.py` が WebP と一覧を作る）。アイスグレープはグレープの箱を借りている。

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
| （2026-11-11 に `gen.py` を API で実行したが、残高が無く 1 枚も作れなかった。下の24枚は同じ日に Codex の内蔵画像生成で作ったもの） | | | | |
| `raw/card/add_coal.png`（追い炭） | 1254×1254 | 1413402 | `7ec75da076708cf9129ca3e08e096898de29386e14087aeff846c336f32f20b1` | 合格・採用（`assets/ui/ichidai/card/add_coal.png` は原画のまま） |
| `raw/card/all_in.png`（渾身の一口） | 1254×1254 | 1726660 | `1ea70a563c2ec198ac4756b8d1b4274f2b3c7dbba90a679edc6ff1208e4fb1d0` | 合格・採用（`assets/ui/ichidai/card/all_in.png` は原画のまま） |
| `raw/card/ash_tap.png`（灰落とし） | 1254×1254 | 1741240 | `89fa06efd98b917b7205b245ee4f045830d536b6392ed3bcef1209a96dce65c2` | 合格・採用（`assets/ui/ichidai/card/ash_tap.png` は原画のまま） |
| `raw/card/blow.png`（ブロー） | 1254×1254 | 1705968 | `005a6c76e19d01c7c5ad175ad9a2f8ea75d1045937c52343d011f724c605cc57` | 合格・採用（`assets/ui/ichidai/card/blow.png` は原画のまま） |
| `raw/card/breath.png`（ひと息） | 1254×1254 | 1640028 | `8f4646e2a7504eba8e2aae7f550b1925be18b6505843de2a4c027fa53236a15e` | 合格・採用（`assets/ui/ichidai/card/breath.png` は原画のまま） |
| `raw/card/buyout.png`（買い占め） | 1254×1254 | 2054712 | `58259208ef093e46f218a023e8d80e73dd29ffbc46df25c22b9712b519fefb27` | 合格・採用（`assets/ui/ichidai/card/buyout.png` は原画のまま） |
| `raw/card/draft.png`（すきま風） | 1254×1254 | 1773298 | `caf9922229e2953e1b479b1d7ee394ade751027976a414f8e8ec14349c4a8645` | 合格・採用（`assets/ui/ichidai/card/draft.png` は原画のまま） |
| `raw/card/duel.png`（勝負の一服） | 1254×1254 | 1873838 | `56894b2bf116171fe932dc59a0243e07c398eac4c0c77397b5e6153410a42431` | 合格・採用（`assets/ui/ichidai/card/duel.png` は原画のまま） |
| `raw/card/encore.png`（アンコール） | 1254×1254 | 1777696 | `1c2e4b996d9e13386fa52056e1b66f051a215bdc90aef86975eb2979fea0e0b9` | 合格・採用（`assets/ui/ichidai/card/encore.png` は原画のまま） |
| `raw/card/fan.png`（火おこし） | 1254×1254 | 1733949 | `936a5bffc486acf0a71d3e38d0567652d53cbe7daa3073482f16807ed7712676` | 合格・採用（`assets/ui/ichidai/card/fan.png` は原画のまま） |
| `raw/card/go_second.png`（後の先） | 1254×1254 | 1702885 | `a1cba1b698a65af368b3564bd88b4f496f3ec25ca3fc06c521253c198d0f7515` | 合格・採用（`assets/ui/ichidai/card/go_second.png` は原画のまま） |
| `raw/card/heat_in.png`（熱を入れる吸い） | 1254×1254 | 1669976 | `5f47b3f43b00e503ea709c61b2bdce3241852cec108e8372d8e8d8032583020c` | 合格・採用（`assets/ui/ichidai/card/heat_in.png` は原画のまま） |
| `raw/card/heat_out.png`（熱を逃がす吸い） | 1254×1254 | 1618917 | `a15c2784aa4eeb0cca4174e923e0c440b8f7d961bb130b4d783d74f0f1b34885` | 合格・採用（`assets/ui/ichidai/card/heat_out.png` は原画のまま） |
| `raw/card/hype.png`（実況の煽り） | 1254×1254 | 1745492 | `28481ea4f111ce95b726bf27f498e0d4695779b5f4f0ff92ceb8a216fe7fd5eb` | 合格・採用（`assets/ui/ichidai/card/hype.png` は原画のまま） |
| `raw/card/inner.png`（内寄せ） | 1254×1254 | 1445135 | `0bf8dfba7410ed7133f0114956759a5330623a06505ece2df6a0a8b908877787` | 合格・採用（`assets/ui/ichidai/card/inner.png` は原画のまま） |
| `raw/card/loosen.png`（葉をほぐす） | 1254×1254 | 2005653 | `e5c5c57f5ff26884cd9ae8bd9898a294185d2d7142b479a386722146d0567954` | 合格・採用（`assets/ui/ichidai/card/loosen.png` は原画のまま） |
| `raw/card/outer.png`（外寄せ） | 1254×1254 | 1572776 | `9525b8c98726bf00323f743ebebf5b30c39469d6bc80a451b74b18fc3ccd3235` | 合格・採用（`assets/ui/ichidai/card/outer.png` は原画のまま） |
| `raw/card/read.png`（吸い方を読む） | 1254×1254 | 1725563 | `1ee9abfe179583802a624deb57e1cf4ce0ac1ea5374cce9cd5197dcf975ee7bb` | 合格・採用（`assets/ui/ichidai/card/read.png` は原画のまま） |
| `raw/card/repack.png`（詰め直し） | 1254×1254 | 1624859 | `f35229aacdeff5d7c5a1b30428b04ee2c3e2720c646b81a672419879c0f36acf` | 合格・採用（`assets/ui/ichidai/card/repack.png` は原画のまま） |
| `raw/card/reset.png`（仕切り直し） | 1254×1254 | 1660348 | `3ae8ca4637a3d99deb6a946e0e5f8cabe3df6fdb3a26ecba3abf08b9e19c290d` | 合格・採用（`assets/ui/ichidai/card/reset.png` は原画のまま） |
| `raw/card/show_smoke.png`（見せ煙） | 1254×1254 | 1791801 | `982ae2ce6e779be0e05ab1dbe85f47fb00daf6ea0e971364051b049a512362de` | 合格・採用（`assets/ui/ichidai/card/show_smoke.png` は原画のまま） |
| `raw/card/timer.png`（キッチンタイマー） | 1254×1254 | 1636206 | `7bd284319708c77a19de706adfa250bd9b26bb8f541cd5046db89d4686380f6a` | 合格・採用（`assets/ui/ichidai/card/timer.png` は原画のまま） |
| `raw/card/tongs.png`（トングさばき） | 1254×1254 | 1685848 | `0d9568728b2c06d97a4e9053db13f924a04a73b17318ea0348833fa5d0e9f32f` | 合格・採用（`assets/ui/ichidai/card/tongs.png` は原画のまま） |
| `raw/card/venue_heat.png`（会場の熱気） | 1254×1254 | 2041356 | `d0056375dcb8fa5b1d9613a2bae4a5eef831e499861034e051322b65748f9891` | 合格・採用（`assets/ui/ichidai/card/venue_heat.png` は原画のまま） |
| `raw/card/diffuser.png`（ディフューザー） | 1254×1254 | 1713193 | `7f0507ae60d81b03754bc4ae2f06a9df93990bae430b591ba0e48a3734a984ae` | 合格・採用（`assets/ui/ichidai/card/diffuser.png` は原画のまま。検品は `hardware-20261111/README.md`） |
| `raw/card/ice_hose.png`（アイスホース） | 1254×1254 | 1638636 | `63e83129b6810acdf6e77e3d3885148000bf6db4ea9a194caa51f95017c04b14` | 合格・採用（`assets/ui/ichidai/card/ice_hose.png` は原画のまま。検品は `hardware-20261111/README.md`） |
| `raw/card/windguard.png`（風防） | 1254×1254 | 1820825 | `b8120b65aec52ca2da6ecfd705280141df340a8d97d21a25672d8410d771776c` | 合格・採用（`assets/ui/ichidai/card/windguard.png` は原画のまま。検品は `hardware-20261111/README.md`） |

2026-11-11 受領（#3221・技16・イベント7・キッチンタイマー1）。Codex の内蔵画像生成で 1 回に 1 枚、`gen.py` の文（STYLE_ART＋SUBJECT）をそのまま使った（入力文は `art-20261111/prompts-3221/`。`gen.py --print` の文と24枚とも一致を確認）。
依頼は 1024px だったが、生成ツールが返した実寸は 1254×1254。原画は加工していない。Codex の検品（一覧・100px の一覧・記録）は `art-20261111/qa-3221/`、SHA-256 は受け取ったファイルと全件一致。
こちらでの検品: 24枚とも題材が1つ・夜紫の地・文字／数字／ロゴ／人物／手／顔／シーシャの機材なし。手札（絵の窓は幅約100px）で何の絵か分かる。
拡大した札（幅240px）は絵の窓が横長なので上下が切れる。窓の縦横比は札のデザイン（#3257・#3264）で決まるので、そのときに原画から切り直す（`build_ichidai_art.py` の `cover` を窓に合わせる）。

## 依頼の状況

- Issue #3221: 技16・イベント7・キッチンタイマー1 は**採用済み**（2026-11-11）。機材が写る器具3枚（風防・アイスホース・ディフューザー）も**採用済み**（#3332）。箱絵の無い葉4種は、3種が #3287 の箱、コーヒーが #3329 の箱で埋まった（2026-11-11）。卓1・裏面2は #3257 の担当。
- 相手の立ち絵・表情・演出で「対戦している感じ」を強める: Issue に分けた（`docs/owner_requests.md` ICG18）。
- カードの枠・裏面・プレイマット・しるしのデザイン（トレカ風）: Issue #3257。依頼書は `docs/design/card_game/card_design_brief.md`、原画と記録は `asset_sources/card_game/design-20261111/`。
