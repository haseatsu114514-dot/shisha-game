# ガラガラくじを自然に・ラストワン賞・章題の手直し（2026-10-16・CI130〜CI133）

オーナー「１章の出現の仕方はもっとふわっと全体的に出したい　なんか今違和感ある　あとガラガラくじいい感じだけどAIっぽいから自然にしたい」「２章はいい感じだけど目を光らせたい」「ラストワン賞を実装したい　ガラガラくじ　中身はプレミアムなハガルで性能は考え中だけど実装しといて」「ナイトサイドプレミアハガルで」。前の版は [garagara-chapter-20261016](../garagara-chapter-20261016/README.md)。

| 動画 | 内容 |
|---|---|
| [chapter-1.mp4](chapter-1.mp4) | CI130。横歩き・煙の玉をやめ、白いもやが上へ晴れる中で絵全体が少し下からふわっと上がる。6人と題字はぼけた姿からピントが合うように重なって現れ、最後は採用画像と同じ並びで約2秒 |
| [chapter-2.mp4](chapter-2.mp4) | CI133。ピントが合いきった直後、アゲハの瞳がオレンジにふわっと光り、瞳の白い点に小さな星が一度広がる。寄りと一緒に動くので目からずれない |
| [garagara-S_free.mp4](garagara-S_free.mp4)・[garagara-A_free.mp4](garagara-A_free.mp4)・[garagara-C_mono.mp4](garagara-C_mono.mp4) | CI131。光の筋・ぼけた光の玉・金箔・光る輪をやめ、落ち着いた壁と木のカウンター、手書きの案内の紙、使い込んだ漆と真鍮。S賞は係の人の手持ちの鐘が下りてきてカランカラン。A・B・C賞は静かに止まる |
| [garagara-LAST_free.mp4](garagara-LAST_free.mp4) | CI132。ラストワン賞だけの場面。貼り紙が「ラストワン賞」に変わり、鐘を鳴らしてから回す。藍色に銀の輪の特別な玉 → 黒地と銀のカードに「ナイトサイド プレミアハガル」 |
| [garagara-C-then-LAST_flow.mp4](garagara-C-then-LAST_flow.mp4) | CI132。最後の1枚を引いたときの通し。C賞のカードを閉じると、そのままガラガラが重なってラストワン賞へ続く |

ラストワン賞の景品 `nightside_premier_hagal`（`data/equipment.json`）は性能をオーナー検討中のため、見た目と容量は80beatハガルと同じで、採点の加点はない。SKIP中・高速送りではガラガラを回さず、カード1枚と「手に入れた！」のお知らせで伝える。

試し方: `__remake.dev.motion("garagara-LAST")`（景品はもらえない）、`"garagara-C+LAST"`（C賞のあとにラストワン賞）、`"chapter-1"`・`"chapter-2"`。確認: 全動画でブラウザエラー0、`remake/test/browser/shop_ui.mjs`（くじを含む）と `remake/test/browser/chapter_titles.mjs` PASS。
