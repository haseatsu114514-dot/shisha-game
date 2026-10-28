# ロード画面漫画 Batch 1（パイロット）— 第41話『炭の耳』

『水煙前線 -EN:CODE-』のロード画面用2コマ漫画の新規量産バッチ。制作ルールは `work/loading-comic-ref/REFERENCE.md`、見本パッケージは同フォルダの `mockup/MOCKUP.md` に従う。

**各話は左の①が導入、右の②がオチ。読み順は左から右。** 本バッチはパイロットとしてシート1枚に『炭の耳』1話のみを描き、シートの残り（2〜4行目）は今後の話のための空白行とする。在庫（暴走編・前作）の未登録話はオーナー決定により採用しない。

キャラの個性を膨らませた番外編ギャグであり、本編の能力・人物設定・ゲーム挙動を変更するものではない。ネーム・作画プロンプト・参照画像パス・画像ハッシュ・目視検品は `comics.json`。

| 話 | 登場人物 | 画像 |
| --- | --- | --- |
| 41　炭の耳 | スミさん・はじめ | [41-sumi-charcoal-ear](41-sumi-charcoal-ear.png) |

## 原画

![第41話『炭の耳』・左から右へ](41-sumi-charcoal-ear.png)

## ゲーム内ロードへの採用

第41話「炭の耳」を作業台（craft）のロードへ採用。`remake/img/loading/loading-batch1.webp` は原画シート全体の WebP 変換（quality 88）で、内容の加筆・反転・変更はなし。`remake/js/core/loading-comics.js` の表示領域で左→右に出す。確認入口は `/remake/craft-preview.html?loading=comic` と `/remake/loading-preview.html`。
