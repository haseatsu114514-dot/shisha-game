# 大会「生中継」フレームの素材（2026-10-31・TC02）

設計書 [docs/design/tournament-craft-redesign-20261031.md](../../../docs/design/tournament-craft-redesign-20261031.md) の見た目を作るための生成素材。
オーナー「画面は OpenAI の画像API（sunburst）で作るのもあり。市販ゲーム並みの見た目にしたい」に対応。

- 生成: `python3 tools/openai_image_batch.py asset_sources/ui/tournament-broadcast-20261031/prompts.json asset_sources/ui/tournament-broadcast-20261031/generated`
- モデル: `gpt-image-2.5-sunburst`（プロキシ経由の api.openai.com。手元では `OPENAI_API_KEY`）。
- 指示の全文は [prompts.json](prompts.json)、実行記録（寸法・品質・SHA256・所要秒）は [generated/generation.json](generated/generation.json)。
- **文字・数字・ロゴは焼き込まない**（コンセプト画2枚だけ、読めない棒で文字の位置を示す）。値・名前・顔・ゲージの中身はコードが描く。
- 原画は `generated/*.png`（Git LFS）。見本ページ用の縮小 WebP は `remake/img/ui/tournament-preview/`。本編へ採用するときは `assets/ui/tournament/` へ置き直して `python3 remake/tools/build_manifest.py` で登録する。
- 現行画面の記録（比較用）は `current/`（2026-10-31 main `81ed5c4d`、1280×720、名前は面識前の「???」のまま）。

## 素材の一覧と契約

| ファイル | 寸法 | 透過 | 用途（設計書 §4） | 備考 |
|---|---|---|---|---|
| `stage_backdrop.png` | 1536×1024 | なし | 大会の作業台の背景差し替え候補、中間投票・会話の裏 | 4台の作業カウンター、観客のシルエット。人物なし |
| `result_backdrop.png` | 1536×1024 | なし | 10カウント・順位発表・表彰の背景 | スポットライトの台座と一台、金の紙吹雪 |
| `topbar_plate.png` | 1536×1024 | あり | 上バー（LIVE・時計・4人チップ・審査員ボード）の下地 | 中は空。横に引き伸ばして使う（`background-size: 100% 100%`） |
| `contestant_chip.png` | 1536×1024 | あり | 4人の進行チップ・対戦席の名札 | 左の丸に顔アイコン、下の溝が進行バー |
| `heat_gauge.png` | 1536×1024 | あり | **ヒートライン**（一台の熱の記録）の枠。当初の観客ゲージ用途は TC06 で廃止 | 管の中は空。帯の色・線・節目の印は SVG で描く |
| `round_plate.png` | 1536×1024 | あり | ラウンド／セグメントのタイトルプレート | 中央に文字をコードで載せる |
| `judge_cutin_frame.png` | 1536×1024 | あり | 審査員4分割カットインの額 | 中に立ち絵、文字はコード |
| `stamp_ring.png` | 1024×1024 | あり | 決めカードの輪（◎○△はコードの文字） | △のときは CSS で灰色に |
| `hype_burst.png` | 1024×1024 | あり | ◎の瞬間の閃光（`mix-blend-mode: screen`） | 動きを減らす設定では出さない |
| `vote_token.png` | 1024×1024 | あり | 審査員の持ち点の札（飛ぶ演出） | 真鍮の一色。審査員の色は `hue-rotate`／`drop-shadow` で |
| `crown_emblem.png` | 1024×1024 | あり | SMOKE CROWN CUP の紋（CHAMPION・称号） | 煙でできた王冠と月桂樹の輪 |
| `concept_bench_live.png` | 1536×1024 | なし | **方向決め用のコンセプト画**（生中継の作業台） | ゲームには組み込まない |
| `concept_result_reveal.png` | 1536×1024 | なし | **方向決め用のコンセプト画**（順位発表） | 同上 |

## 検品メモ（2026-10-31）

- 透過指定（`background: transparent`）は全部効いた（アルファ 0〜254）。縁の余白は見本の変換時に自動で切り落とした。
- `crown_emblem` と コンセプト画2枚は `quality: high` で 502 が続いたため `medium` で生成した（`prompts.json` にその値を残す）。
- `judge_cutin_frame` は傾きが約12度・右上がり。4分割で左右対称に使うときは CSS で左右反転する。
- `heat_gauge` の管の内側は白っぽい半透明。ヒートラインは管の内側に暗い面を敷いてから帯の色と線を描く（見本の `.heat-svg`）。
- コンセプト画 `concept_bench_live` の下帯にある炎のゲージは TC06 前の「会場の熱」案。採用時はヒートラインに読み替える。
- 実物のシーシャ構造（ボウル・ステム・ホース）が写るのは背景2枚だけで、どちらも遠景のシルエット。近接描写の規約（`docs/asset_ai_guidance.md`）に反する要素はない。

## 見本ページ

`python3 remake/tools/serve_preview.py --port 8123` → `http://127.0.0.1:8123/remake/tournament-broadcast-preview.html`。
①生中継の作業台（決めカード・4分割・ラウンドプレート・ライバルの台の事件・ヒートライン）、②中間投票（札が飛ぶ）、③結果発表 2.0（10カウント→順位発表→CHAMPION→表彰）、スマホ横 844×390、動きを減らす、の切り替えができる。保存データには触れない。
