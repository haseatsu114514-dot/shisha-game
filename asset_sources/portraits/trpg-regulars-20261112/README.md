# TRPG常連A・Bの専用画像候補（#3503）

**未採用候補。画像制作・検品まで。本編の参照、人物設定、台詞、UIは変更していない。**

正本 `3da1f351338b16b970a90215dfd141df09fdbff5` の `data/characters.json` で確定しているのは、サイの店でTRPGのプレイヤー席を手伝う、主要人物やtonariの客とは別人という点だけ。今回の容姿・服装・性別表現は画像案であり、固有名・年齢・経歴・身長・性別の設定を正史へ追加していない。各1人・通常1表情。画像制作が未完と記録されている台詞PR #3505 とは別の納品。

| 候補 | 区別する特徴 | 原画 | 人物高（髪頭頂〜靴底） | 頭身 |
|---|---|---|---:|---:|
| A | 短髪・眼鏡・黄土色カーディガン | [regulara-normal.png](originals/regulara-normal.png) | 1511px | 6.963 |
| B | ボブ・青緑の上着 | [regularb-normal.png](originals/regularb-normal.png) | 1475px | 7.487 |

原画は両方1024×1536 RGBA。1300px以上・標準6.4〜7.7頭身を満たす。頭頂などは目視計測なので数pxの読取誤差を含む。主要キャラの顔・衣装を流用せず、画風・頭身参照だけに使った。シーシャ台・ホース・吸い口・喫煙描写はない。

## 配信用書き出し

- `delivery/chr_regular{a,b}_normal.png` / `.webp`: 896×1200 RGBA、人物高1080px・足元y1140。原画から同比縮小と配置だけ。色や顔は加工していない。
- `delivery/face_regular{a,b}.png` / `.webp`: 同じ計測値から作った128×128の顔。頭高0.58、頭の中央高0.48の既存規格を使用。
- [metrics.json](metrics.json): 原画のSHA・計測点・縮小率・書き出しSHA・候補の立ち絵manifest値・TRPGの顔枠。
- [sources.json](sources.json) / [prompts.md](prompts.md): 参照のパスとSHA、参照の役割、全生成・修正プロンプトと生成ファイルID。
- `superseded/regulara-v1.png`: 改稿前のA。`rejected/regularb-v1-head-ratio.png`: 頭が大きかったBの初回案。最終候補と混同しない。

`prepare.py` は `tools/fit_portrait.py` と同じalpha>=16の人物範囲を使い、LANCZOSで縮小・配置する。原画は無編集で保持し、拡大・彩度補正・手描き修正はしない。WebPはlossless。原画にはalpha 1〜7の微小な点が残るため、原画外周がすべて厳密にalpha=0とは扱わない。広く色づいて見えた背景RGBはalpha=0であり、白・暗色・市松の実合成では表示されない。

## 検品

- [透過・64/32px顔](qa/alpha-and-small-faces.png): 白・暗色・市松で透明部分を確認。白縁・目立つ色にじみ・足や指の切れなし。A/Bの髪型・眼鏡・色を区別できる。
- [同高の全身比較](qa/height-lineup.png) / [同じ枠での顔比較](qa/face-size.png): 規格の千須・凛想と比較。候補の身長設定は未確定のため、全員を同じ人物高で並べた検品用の図であり、本編の身長差を示す図ではない。
- 実Chromium: PC 1280×720、タッチ相当844×390（iPhone実機ではない）。現行 `trpg-preview.html` の `regular-harbor` で、表紙・A発言・B発言・席アイコンを確認。[PC A](qa/pc-regulara.png) / [PC B](qa/pc-regularb.png) / [タッチ A](qa/touch-regulara.png) / [タッチ B](qa/touch-regularb.png)。
- [実行結果](qa/report.json): 2ケース成功、両方の発言画面取得、画像取得失敗0・JavaScriptエラー0。画像URLと計測に基づく既存の切り抜き値をブラウザのリクエスト内だけで差し替えた。ゲームのJS・CSS・セーブは書き換えていない。**本番への接続済みという意味ではない。**
- 本編側に残る長い名札の重なりは既存の #3199 の範囲で、今回修正していない。

最初の確認は検品スクリプトの属性指定不足と軽量checkoutの素材不足で失敗した。既存の `data-test` 属性を指定し、必要になった57ファイルのみ補完（うち51ファイル・約9.11MB追加取得）。開幕演出の終了と画像decodeを待って撮影し直し、上記の最終画面を目視した。画像の欠落や演出中の画面を合格証拠にしていない。

## 再現と次の作業

```bash
python3 asset_sources/portraits/trpg-regulars-20261112/prepare.py
# repo rootからプレビューサーバーを起動した後（Chromium / Playwright使用）
BASE_URL=http://127.0.0.1:8127/ node asset_sources/portraits/trpg-regulars-20261112/review.mjs
BASE_URL=http://127.0.0.1:8127/ node asset_sources/portraits/trpg-regulars-20261112/lineup.mjs
```

依存が別の場所にあるときは `PLAYWRIGHT_PACKAGE` にそのpackage.json、ブラウザは `CHROME_EXECUTABLE_PATH` を指定できる。

候補採用後、正式な素材パス・人物の計測記録・配信用manifestへ登録し、`regularPortrait()` の中立SVG参照を専用画像へ替える。中立SVGの固定頭位置（0.125）は新画像と異なるため、`metrics.json` の計測値を使用する。見た目のレイアウトや配役・判定・報酬・保存仕様は変更不要。台詞の残りは #3505 / #3503 で継続する。
