# サンドボード改善 #3175 ブラウザ確認

Playwright の Chromium で 1280×720 と 844×390 の画面を撮影した。数値と要素の矩形は [checks.json](checks.json) に記録した。

| 画像 | 確認点 |
| --- | --- |
| [left_sign.webp](left_sign.webp), [right_sign.webp](right_sign.webp) | 左右コースの z=250m。絵の看板がコース外縁に立つ |
| [left_curve.webp](left_curve.webp), [right_curve.webp](right_curve.webp) | z=600m。縁の二重線と遠景の流れが反対方向へ曲がる |
| [boost_aura.webp](boost_aura.webp) | ブースト中の人物周りの光、残像、砂の尾 |
| [normal_meter.webp](normal_meter.webp), [debug_meter.webp](debug_meter.webp) | 速度弧、BOOST バー、TIME、終了ボタンが重ならない。デバッグの戻るボタンも離れている |
| [stick_input.webp](stick_input.webp), [phone.webp](phone.webp) | スティック全倒しと横持ちの操作配置 |

検証中は `window.__desertRide.pause(true)` と `skipCountdown()` で画面を止め、`game.z` を指定して `redraw()` した。スティックは実ポインター操作で半倒し 50、全倒し 100、離すと 0 を確認した。
