# フェイスラインの調査・先行2枚の修正

対象は現行manifestの22キャラ100表情。`index.html` をリポジトリのプレビューサーバーから開くと、キャラ・背景（白／灰／暗）・倍率（100%／50%／200%）を選べる。`catalog.json` にキャラ名・表情・元PNG・配信用WebP・顔の切り出し座標を記録した。`faces-*.jpg` は一覧の補助で、評価はPNG/WebPを使う。

## 原因

- みんと10表情・あげは5表情は、修正前の元PNGとWebPがRGBA画素単位で一致。`remake/tools/build_images.py` はこの2キャラを可逆圧縮している。
- 添付の絵は `chr_ageha_sad.png` と一致。問題の顎と首の境目はほぼ不透明（α252〜254）。背景を変えても線が残り、素材内の濃い輪郭と明るい縁が主因。透過の黒縁や縮小時だけの不具合ではない。
- `remake/css/vn.css` の話者立ち絵は `filter: none; image-rendering: auto`。顎へ線を描く処理はない。表示ロジック・透過処理の変更は不要。
- ほか85表情は顔一覧で正常な輪郭・影として一次判定。髭・髪・首の影・チョーカーは除去対象ではない。全画像について背景／実ゲームまで精査済みという意味ではない。

## 先行反映

ユーザー指定の「最初は各1枚」に合わせ、あげは `sad` とみんと `normal` のみを標準image_genで修正。生成出力全体は採用せず、個別に指定した顎と首の境目のマスク内だけ合成した。原寸・50%・200%、白／灰／暗で前後を確認し、濃い線を柔らかい茶色の境目へ寄せた。黒線の全消しや全キャラ再生成はしていない。

- あげは: 262画素、変更範囲 `[483,377,523,400)`。
- みんと: 230画素、変更範囲 `[491,376,525,402)`。
- 全αとマスク外RGBAは完全一致。目・口・表情・髪・手・チョーカー・衣装は変更なし。
- 修正後PNGと配信用WebPもRGBA完全一致。`pixel-check.json` に検証結果を記録。
- `before-after.png` に修正前後を保存。`browser-check.json` と `game-*.jpg` は実ゲームのPC／横持ちスマホ寸法での表示確認。通常のストーリー進行そのものをテストしたものではない。

残りのみんと9表情・あげは4表情は未修正。今回の2枚を比較基準にして個別に進める。判断が割れた画像の別AI確認は未実施（今回の原因切り分けには不要だった）。

## 再現

```sh
python3 remake/tools/serve_preview.py --port 8123
# http://127.0.0.1:8123/docs/qa/portrait-jawline/
python3 docs/qa/portrait-jawline/build_catalog.py
python3 asset_sources/portraits/jawline-cleanup/apply.py
```

生成原画・元画像・マスク・再合成スクリプトは `asset_sources/portraits/jawline-cleanup/` に保存。WebPは `remake/tools/build_images.py` の `encode()` を対象2枚に限定して実行した。

GitHub照会は環境から `Forbidden` が返ったため、最新main／競合PR照合・push・PR作成は未実施。作業開始HEADは `1ce4527b6b4ad2629beab58e27e17824e67873b8`。
