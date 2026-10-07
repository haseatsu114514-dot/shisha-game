# タイトルロゴと昇る煙（2026-10-07〜08）

オーナー指定：今の雰囲気は良いので少しリッチに。ロゴの後ろの煙は自然に上へ昇るアニメーションにする。

built-in imagegenによる編集。元ロゴを参照し、白銀・真珠色の控えめな立体感と暖かい縁の反射を追加。`with-smoke-source.png` は最初の生成元。次の編集で文字を保持して煙のみを除いた `logo-source.png` を採用。無加工の生成元は両方保存。

最終プロンプト：Remove only all smoke and background glow. Keep exact 水煙前線 and -EN:CODE-, sharp Mincho shapes, pearl-silver bevels, warm champagne edges, and side rules. Genuine transparent background; no redesign.

使用画像は alpha>=8 の外接範囲に20pxの透明余白を足して切り出し、`assets/ui/ui_title_logo_rich.png` と `remake/img/ui/ui_title_logo_rich.webp`（q94）へ保存。書体や人物画像の変更はなし。

文字と煙は別レイヤー。煙は `remake/css/daily.css` の低透明度の複数のぼかしを異なる周期で上へ移動・拡散させる。動きを減らす設定では静止する。
