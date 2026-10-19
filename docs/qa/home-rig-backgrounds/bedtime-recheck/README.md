# 寝る前モーダルのタッチ背景再確認（PR #646）

旧担当停止をオーナーが確認後、[移管記録](https://github.com/haseatsu114514-dot/shisha-game/issues/640#issuecomment-6233638348)に基づく正式transfer [39030879626](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39030879626) がSUCCESS。最新bot台帳6233647503のowner/runは `codex-pr646-resume-20261017-a71f9c` / `39030879626` と一致。元PRと他Open PR10件のfilesに重複なし。最新main `0c3cf24f18582e2da33004f3707b7a8aeb7f8ceb` を競合なしでmergeした。

## 同条件の再現

system Chromium **154.0.8037.57**。PC 1280×720、タッチ844×390 / isMobile / hasTouch、deviceScaleFactor 1。DAY8・夜・両方所持・同じ所持葉・同じ実 `runHomeShisha()` の最初のモーダルで比較。各ページを新規contextとし、差分ファイルを選択した完全commitの内容で配信する。スクリーンショットはPNG、有限アニメーションを完了させてから撮影。比較中の追跡ソースはclean・固定。

| 版 | 完全commit | タッチ画像 |
|---|---|---|
| 本PR導入前 | `13bf4a125d781c1d1bc4e6e94687e72f8d9477f4` | [変更前](before-touch-both.png) |
| 元提出版 | `b427a933977b8ce5ffbe9dc317e25a5d565ff9ac` | [元提出](submitted-touch-both.png) |
| 今回の修正版 | `7a0986c778ea479054d7fd16dcc98794de12f3b1` | [修正後](fixed-touch-both.png) |

導入前・元提出の両方で、タッチの背景が鏡像のように反復する。いずれも背景DOMは1枚。元提出の背景合成を取り除いても起きるため、所持台の重複ではない。共通の `.modal-backdrop` の `backdrop-filter: blur(3px)` と縮小stageの組合せで再現し、同場面でぼかしだけを外すと部屋が一枚へ戻る。

修正は `pointer: coarse` かつ家シーシャのモーダルだけでぼかしを外す。暗幕、文字、タップ、消費・成長・保存処理は維持。[PC修正版](fixed-pc-both.png)には従来のぼかしを残す。一般の他モーダルへは適用しない。

ぼかしなし対照との比較は、タッチ画像のモーダル外側（x=75〜768、y=0〜109/280〜389）の152,680画素で、RGBいずれかが2超違う画素を数えた。導入前118,165画素（77.39%）、元提出117,978画素（77.27%）、修正後**0画素**。スクリーンショットの独立目視でも、部屋・机上台・床台が一枚の配置へ戻った。

## 回帰と負の対照

- [同条件比較JSON](comparison.json): 3版×PC/タッチ×未所持/両方の12表示、ブラウザ例外・HTTPエラー0。未所持では一服が自然には発生しないため、同じクラスの共通モーダルを使う表示対照であり、実一服の自然到達とは扱わない。全例でキャンセル後のstate不変。
- [本件スイート](regression.json): 修正ソースcommitでPC/タッチ **8/8 PASS**。取得・LOAD/NEW GAME・曇天・各台本・家preview・実夜→朝を含む。
- タッチの実寝る前モーダルに、同場面のぼかしなし参照との画素比較を追加。操作窓の領域を除外して背景だけを比較する。
- [負の対照](negative-control.json): 別previewサーバで `daily.css` だけを元提出版へ戻し、同じテストを実行。新assertが **175,576 / 281,945画素** の差を検出して期待どおりFAIL。消費処理・assert・他ソースは変更せず、失敗をPASSに数えない。
- 専用workflowの対象に `daily.css` と `craft/worker.js` を追加。CIと独立レビューの最終結果・完全HEADはPR本文/コメントに記録する。

再現（必要な3commitが既存checkoutにあること。全履歴/素材の一括取得はしない）:

```sh
python3 remake/tools/serve_preview.py --port 8123
node docs/qa/home-rig-backgrounds/bedtime-recheck/reproduce.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/home_rig_backgrounds.mjs
```

実機スマホ/Safari、公開版は未検証。自然なDAY7受取・くじ当選までの通しプレイの未実施は元記録どおり。元素材・manifest・所持表示ロジックへの追加変更なし。初回比較の診断CSSが次fixtureへ残った試行と、checkout切替と重なった試行は採用せず、固定ソースで再実行したこの12表示だけを証拠とした。
