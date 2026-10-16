# #597 斧投げメニュー装飾

採用見本のダークウォルナット・黒鉄・真鍮を、文字なし生成パネルと交差斧メダリオンで既存メニューへ接続した。見出し・本文・11操作・状態・読み上げは既存DOMのまま。ゲームJS・台詞・料金・体力・報酬・保存形式・投擲モデルは変更していない。

- 基準main: `1ec3dddba5fd0524f544e6999e84f029a6bcde87`
- Issue: https://github.com/haseatsu114514-dot/shisha-game/issues/597
- worker: `codex-a597-20261016-d5935d80`
- 正式claim: https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38845787682
- 台帳: https://github.com/haseatsu114514-dot/shisha-game/issues/597#issuecomment-6207444101
- branch: `codex/597-axe-menu-luxury`

## 素材と再現

`reference/adopted-concept.png` はオーナー採用見本の原本。元ZIP SHA256は `84d967b4de2f6b2ef8872d62d492e1b6d52266143a3f702074eaa54dfbc61a5b`。`reference/handed-off-current-menu.png` は受領した現行参考。TRPG資料は取り込んでいない。

Aが組込みOpenAI image_genを2回実行。各回で採用見本を材質参照に添付し、`transparent_background=true`、文字/画面/人物なしを指定。実際の入力は `prompts/`、生成した原本は `originals/`。原本に編集・上書きなし。外部AI・課金API・手描きSVGへの代替は行っていない。

`python3 asset_sources/axe-menu-issue597/build.py`（Pillow）で明示した矩形trim・縮小・WebP変換を再現できる。合成や描き足しはない。manifestに原本/参照/指示のSHA256、trim、元/配信寸法、alpha範囲、配信hashを記録した。

|素材|原本|配信|bytes|用途|
|---|---|---|---:|---|
|木製パネル|2164×727 RGBA|1024×228 WebP alpha|50,046|見出し・小見出しの木面、カード外周の9-slice枠|
|交差斧|1254×1254 RGBA|192×192 WebP alpha|13,172|大画面の見出し右、縦スマホでは省略|

配信画像は `assets/ui/axe_throw/` と `remake/img/ui/axe_throw/` の同名 `menu-*.webp` が同一。合計63,218bytes。CSS背景/空の疑似要素のみで入力や読み上げを増やさない。パネル原本にはalpha縁の微小な色ムラがあるが縮小後の実画面で文字や操作を妨げないことを目視確認。失敗時も独立した暗色背景・文字・輪郭・フォーカスが残る。既存夜ラウンジ/斧/的/人物は不変。

## QA

`qa/before/` は基準mainの実ブラウザ4サイズ、`qa/after/` は最終CSSの上部/下部と画像失敗・動き軽減。1280×720・800×600・390×844・844×390をAが開いて目視。縦スマホの初回切れを既存対戦テストが検出したため、カード高さと余白を修正した。最終は全11操作が初期viewport内に収まり、各操作44px以上。`qa/source-fingerprint.json` に検証対象18ファイルのhash、`qa/manifest.json` にスクリーンショット/証跡のhashを記録。

- モデル: `node --test remake/test/axe_throw.mjs remake/test/axe_match.mjs remake/test/axe_presentation.mjs` → 28/28 PASS。
- 新メニュー: `node remake/test/browser/axe_menu_decor.mjs` → 6/6 PASS。4サイズ/実click・tap/Tab・Enter・Space/フォーカス/3mode開始と取消/無料レッスン終了・帰還/保存不変/画像decode失敗/reduced motion。初期viewportで全操作が収まる検査も含む。
- 既存throw: 初回19/20、polish6/6、versus6/7、lesson5/6。throwの縦ルールとlessonのPCはローカル配信ERR_CONNECTION_RESETと待ちtimeout、versusの縦はメニューボタン切れ。公式 `python3 remake/tools/serve_preview.py --port 8124` に切替え、縦CSS修正後、失敗3ケースを**同じassert/timeout**で各再実行PASS。初回を消さず `qa/results/` に保存。既存39ケースの全ケースが少なくとも1回PASSしたが、初回全suiteが一括PASSだったとは記録しない。
- 新テスト初回の誤った相手ID/見出し/レッスン終了の仮定も失敗logを保持し、現行契約へ訂正。ゲーム実装をテストに合わせて変更していない。
- `node --check`（既存entry/新テスト）、`git diff --check`、Git Safety PASS。
- 文書check: sparse未取得17Markdownを現mainから追加取得後も、mainにも存在しない `.agents/skills/portrait-unify/SKILL.md` への `docs/asset_ai_guidance.md:41` リンク1件でFAIL。範囲外の既存リンクを修正してPASSにはしていない。
- quota helperは現mainの `tools/agent_quota_guard.py:45` にあるliteral `\n`のSyntaxErrorで実行不能。残量不明。認証/利用制限拒否ではない。

ブラウザは隔離したChrome/Playwright context。ユーザーの保存/通常プロファイルに触れていない。実機Safari・物理スマホ・公開Pagesは未実施。Draft PRで保持し、merge/公開/claim解除は行わない。

## 担当境界

#489 owner `codex-axe489-20261015-7c92b4e1` の速度調整、#540 owner `codex-finish-541-20261014-8d2191d9` の本編解禁/専用店舗ロゴには触れていない。最新Open PR7件の全filesを確認し、更新された#587も再取得した。直接パス重複なし。未pushや実稼働範囲は読取では分からない。#598は未予約/未実装の後続。#597 Draft/予約保持中は同時着手しない。
