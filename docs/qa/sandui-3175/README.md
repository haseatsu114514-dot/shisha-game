# サンドボード改善 #3175 ブラウザ確認

Playwright の Chromium で 1280×720 と 844×390 の画面を撮影した。数値と要素の矩形は [checks.json](checks.json) に記録した。

| 画像 | 確認点 |
| --- | --- |
| [left_sign.webp](left_sign.webp), [right_sign.webp](right_sign.webp) | 左右コースの z=250m。絵の看板がコース外縁に立つ |
| [left_curve.webp](left_curve.webp), [right_curve.webp](right_curve.webp) | z=600m。縁の二重線と遠景の流れが反対方向へ曲がる |
| [boost_aura.webp](boost_aura.webp) | ブースト中の人物周りの光、残像、砂の尾 |
| [normal_meter.webp](normal_meter.webp), [debug_meter.webp](debug_meter.webp) | 速度弧、BOOST バー、TIME、終了ボタンが重ならない。デバッグの戻るボタンも離れている |
| [stick_center_final.webp](stick_center_final.webp), [stick_input.webp](stick_input.webp) | 最終版スティックを実CSSの台座144px・つまみ74pxで重ねた中央と右42px倒しの拡大撮影。ボールは中央に収まり、倒しても輪郭が崩れない |
| [phone.webp](phone.webp) | 最終版スティックの実ゲーム画面。844×390の横持ちで右全倒し、入力値100、ブラウザエラーなし |

検証中は `window.__desertRide.pause(true)` と `skipCountdown()` で画面を止め、`game.z` を指定して `redraw()` した。スティックは実ポインター操作で半倒し 50、全倒し 100、離すと 0 を確認した。
