# 電車の乗客の絵（2026-10-23・Issue #891）

オーナーがGPTで生成した、満員電車の乗客3枚（1536x1024・灰色・マゼンタ背景）。生成に使ったプロンプトは [prompts.txt](prompts.txt)。

- 元画像: `train_crowd_{a,b,c}_original.webp`
- 切り抜き（マゼンタを透過に・縁のマゼンタを除いた灰色）: `assets/ui/transitions/train/crowd_{a,b,c}.png`
- ゲームで使う版: `remake/img/ui/transitions/train/crowd_{a,b,c}.webp`

色はゲーム側で付ける（`remake/js/motions/train.js`・昼は青緑、夜はセピア、既定の紫1色）。吊り革をつかむ輪は絵の中にあり、天井の棒と空いた吊り革はコードで描く。

## 録画

| 動画 | 内容 |
|---|---|
| [train-day.mp4](train-day.mp4) | 昼（青緑）・`?mopal=free` |
| [train-night.mp4](train-night.mp4) | 夜（セピア）・`?mopal=free` |
| [train-mono.mp4](train-mono.mp4) | 既定の紫1色 |

動画は前半が実際の速さ、後半が0.5倍速。右から車内が入って画面を覆い（約1.35秒）、覆っている間に次の背景へ替え、そのまま左へ通り過ぎる（約1.35秒）。車体の揺れ・継ぎ目の跳ね・吊り革の振れ・人の小さな上下・窓の外の光が流れる。SKIP中・動きを減らす設定・テストの高速送りでは省いて背景だけ替える。
