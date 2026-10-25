# 半分こ用の縦長プリクラシール（#947）

## 現行：旧作の盛りを生かした3パターン

本人の「以前の方が可愛く盛れていた」「今回の仕様にしてパターンも欲しい」を受け、旧4コマを直接参照して再制作。本人指定の3方向で、A＝旧作寄りの盛り強め、B＝淡いピンクの甘め、C＝平成ギャルの派手め。前回v3/v4は旧稿として保全した。

| 案 | 完成版 | 特徴 |
|---|---|---|
| A | `cg_ch2_ageha_purikura_strip.png` | 艶のある瞳、赤い頬、黒い影付きギャル文字、指ハート |
| B | `cg_ch2_ageha_purikura_strip_soft.png` | ミルキーピンク、淡い豹柄、柔らかい微笑み |
| C | `cg_ch2_ageha_purikura_strip_gal.png` | ホットピンクとライム、ウインクと二人の笑顔 |

存在する案から撮影ごとに1枚選び、左右に同じ絵を表示する。縦長がなければ従来の4コマ／立ち絵へ戻る。保存データ・報酬・会話は変更しない。

`retro-*-source.png` は無加工原画、`retro-*-draft.png` は修正前、`retro-*-prompt.txt` は実指示。Aは端のスタンプと胸の星、Cは下段の帽子と王冠位置を生成ツールで修正。`finish-retro.sh` で各領域をサイズ調整し、写真の左右に余白を加えて24px安全域を確保。落書きは旧作寄りの密度へ変更し、Bでは胸の星を省略している。

3案すべて640×1080・不透明。指定3語各1回、顔・服、文字の端切れなしを実画素確認。実Chromiumで3案×PC／横タッチの6ケースを確認し、`qa/retro/` に画面と測定結果を保存。左右URL一致・画像デコード・切断・終了後のDOM解放・pageerrorなし。再現は `SHOTS=/tmp/purikura947-retro node asset_sources/purikura-939/qa/capture-retro.cjs`。既存VM検査へ3案の選択と左右一致を追加し成功。通常quickも7群成功。

以下はv3/v4制作時の履歴。`qa/` 直下は旧稿の画面、現行3案は `qa/retro/` を参照。

あげはのギャル友の回で、同じ絵を2枚並べて中央を切るための1列分。
完成版は `assets/cgs/cg_ch2_ageha_purikura_strip.png`、表示用は `remake/img/cgs/cg_ch2_ageha_purikura_strip.webp`。
640×1080、不透明。既存の #946 の受け口を使い、撮影・落書き・切断のコードは変更していない。

![完成版](../../assets/cgs/cg_ch2_ageha_purikura_strip.png)

## 原画と参照

- `strip-v3-source.png`：今回の初稿。左上の文字が端に近いため、仕上げには使用しない。
- `strip-v4-source.png`：文字を内側へ動かした修正版。生成出力の965×1629を無加工で保存。
- `strip-v3-prompt.txt` / `strip-v4-prompt.txt`：実際の生成・修正指示。ChatGPTの画像生成で制作。外部配布素材は追加していない。
- 本人参照：`chr_ageha_normal.png`、`chr_ageha_smile.png`、`chr_hajime_surprise.png`、`chr_hajime_smile.png`。盛りの質感だけ `cg_ageha_first_purikura.png` を参照。

旧4コマとその初稿は [#921の一覧](../ch2-city-issue921/README.md)、旧縦長候補2枚は [比較一覧](../review-candidates-20261024/README.md) に残している。今回のv3/v4と混同しない。

## サイズ仕上げ

`bash asset_sources/purikura-939/finish-strip.sh` で再現する。生成モデルが区画の画素寸法を厳密には出さないため、原画の帯・写真2枚・フッターを個別にリサイズして白い台紙へ配置。写真領域のリサイズは縦横独立で、無加工原画は別保存した。

| 区画 | 完成版の範囲 |
|---|---|
| ピンク＋豹柄の帯 | x=0–639、y=0–39 |
| 写真1（1pxの白枠込み） | x=20–619、y=40–489、600×450 |
| 白い間隔 | y=490–519、30px |
| 写真2（1pxの白枠込み） | x=20–619、y=520–969、600×450 |
| 水玉＋豹柄ハート2個のフッター | y=970–1079、110px |

目録とWebPは `python3 remake/tools/build_manifest.py --cgs-only cg_ch2_ageha_purikura_strip.png` で生成。

## 確認（2026-10-25 JST）

- 完成PNGと表示WebPを実画素確認。指定の3語「ハジメっち♡」「答え合わせ係」「あげ↑」が各1回で、写真2・上下の帯に文字がない。
- 文字と個別のスタンプは左右端から24px以上内側。文字・スタンプの切断なし。帯の豹柄・背景のぼかし模様は端まで続く。
- 立ち絵4枚と顔を比較。上段のはじめの驚き、あげはの閉じ目の笑顔、下段の笑顔と指ハート、髪・クマの留め具・服・首飾りを確認。
- 隔離した実ChromiumのPC 1280×720／横タッチ844×390で `__remake.dev.motion("purikura")` を通常速度で再生。同じ640×1080 WebPが2枚並び、中央を切って右の1枚が寄り、終了時に演出DOMが消える。pageerrorなし。本人のブラウザ・SAVEは使用していない。
- `qa/` に印刷・切断中の画面とブラウザ測定結果を保存。
- 既存 `node --experimental-vm-modules remake/test/purikura_motion.mjs` 成功。通常quick検査は7群すべて成功（既存の台詞WARN 137、ERROR 0）。

制作プラン #16 を完了へ更新した。`docs/owner_requests.md` のMG939-03は同じファイルを変更中の未マージPR #964／#990との並行編集を避けるため、このPRでは変更していない。画像の生成・登録・画面確認は完了しており、台帳の同期だけが残る。
