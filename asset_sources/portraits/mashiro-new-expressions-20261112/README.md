# ましろの新版 H1〜H3（笑顔・悲しみ・眠い）（#3331）

新版（設定「会話の立ち絵」の新バージョン）のましろに、旧版にしかなかった3表情を足した。Codex が #3331 の H1〜H3 の依頼文で作り、オーナーが 2026-11-12（日本時間）に **3枚とも採用**した。

| ファイル | 中身 |
|---|---|
| `smile-untouched.png`・`sad-untouched.png`・`sleep-untouched.png` | 採用した原画（無加工・1084×1451・RGBA）。SHA-256 は `measurements.json` と `integration.json` |
| `prompt-smile.txt`・`prompt-sad.txt`・`prompt-sleep.txt` | Codex が入力した英文の全文 |
| `reference-hashes.json` | 参照に渡した画像（①新版の通常 ②旧版の同じ表情 ③みんとの通常＝画風だけ）の SHA-256 |
| `measurements.json` | 原画の人物の高さ・余白の計測（Codex） |
| `codex-notes.md` | Codex の納品メモ（英語・原文のまま） |
| `qa/mashiro-H1-H3-comparison.png` | Codex の比較図 |
| `qa/runtime-fit-comparison.jpg` | ゲームの位置に合わせたあとの比較（今の新版4表情と並べたもの。オーナー確認に使った） |
| `integration.json` | ゲームへの配置の倍率・位置と、ゲーム用 PNG の SHA-256 |

## 組み込み

- 今の新版の通常（896×1200）と、頭頂〜足元の高さ・足元の下端・体（スカートと足元）の横位置を同じにして縮小・配置した。首を傾ける「眠い」でも体が動かない（今の新版の「あくび」と同じ合わせ方）。人物から離れた極薄の点だけ消した。描き直し・色の調整はしていない。
- 置き場所は `assets/sprites/character_variants/new/mashiro/chr_mashiro_{smile,sad,sleep}.png`。`python3 remake/tools/build_manifest.py --portrait-variants-only mashiro` で WebP と manifest を作った（今ある4表情の WebP と表示位置は変わらない）。
- 通常の絵は変えていないので、顔アイコン・`data/portrait_metrics.json` はそのまま。コンティニュー画面の顔の枠に3表情を足した。
