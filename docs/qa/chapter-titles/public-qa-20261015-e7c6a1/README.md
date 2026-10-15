# Issue385 公開QA — 独立実行 e7c6a1

今回の公開URLだけを対象にした新規実行。以前のローカルQAや旧runの安全停止を結果へ合算していない。実装・原画・採用表は変更していない。

- WORKER: `codex-a-385-publicqa-20261015-e7c6a1`
- CLAIM: [38766518836](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38766518836)、最新bot台帳は同owner/claim_runのclaimed。
- 開始status: [38769698991](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38769698991)、request `publicqa-e7c6a1-20261016-status-01` SUCCESS。実notice `CLAIM_VALIDATED_ISSUE=385 OWNER=codex-a-385-publicqa-20261015-e7c6a1 RUN=38766518836` を確認。
- 公開先: https://haseatsu114514-dot.github.io/shisha-game/remake/
- deploy SHA: `1d19f2be95aabbf8376acc1c09e8bd2143cdf967`。[Pages run 38738599276](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38738599276) SUCCESS、Pages build `1286824081` built（2026-10-15T13:03:49Z）。[hashes.json](hashes.json) の公開9リソースと当該checkoutのSHA256がすべて一致。
- 実行時刻: 2026-10-15 UTC（2026-10-16 JST）。各JSONに時刻、Chrome `155.0.8059.41` を記録。system Chrome/headless/Playwright、ケースごとの新しいcontext。ユーザーのセーブを開いていない。ローカルserverなし。
- Open PRの全変更filesの変更filesと本ディレクトリの衝突なし（開始時）。

機能結果: [章タイトル12/12 PASS](chapter-titles.json)、[保存6/6 PASS](save-load.json)、[冒頭1/1 PASS](ch1-opening-resume.json)、[追加プレビュー8/8 PASS](preview.json)。console無異常だけは下記FAIL。

## 実施範囲

| 確認 | 今回の方式・証跡 |
|---|---|
| 第1章「煙がつなぐ街」実入口 | 実NEW GAMEボタン、VN turboで既存導入を進行。画像表示後にintroDoneを確認。[画像](new-game-chapter-1.png) |
| 第2章「才能の壁」実入口 | 第1章clear済みfixtureを準備し、実「第2章の初日へ」ボタン。大会の手動完走ではない。章2/day15/map/titleSeen、所持金・所持品不変を確認。[画像](clear-to-chapter-2.png) |
| 第4「継承の煙」・第5「機械仕掛けの神」 | **chapter-titles-preview.htmlの表示プレビューのみ。本編自然到達ではない。** PC・横持ちタッチで実select/play操作、localStorage不変。[PC4](pc-preview-4.png) / [PC5](pc-preview-5.png) / [touch4](touch-preview-4.png) / [touch5](touch-preview-5.png) |
| 全体表示・二重文字 | 1280×720素材、object-fit contain、viewport内、cc-copy非表示を検証。PC1280×720、横touch844×390、縦DS390×844・動き軽減。[縦DS](portrait-ds-chapter-1.png) |
| 入力・進行 | PC1280×720・横touch640×360、通常/AUTO/SKIPの実ボタンとmouse/touch/Enter/Space、loading/title/fade-out中の入力遮断、前後VN、fadeと読書時間、解除後操作を検証。合成の短い前後VN fixtureで、自然な章4進行ではない。 |
| 実SAVE/LOAD | [save-load.json](save-load.json)：6件。APIの全枠/旧形式/不正JSON、PC1280×720・横touch844×390の実メニューSAVE/LOADと上書き/cancel/reload、縦→横回転。状態セットアップはfixture、保存とLOADは実UI。 |
| 冒頭の保存・再開 | [ch1-opening-resume.json](ch1-opening-resume.json)：1件。既存の自動保存を再読込し、接客後の日常まで。VN/craft test hooks使用。 |
| 章2途中LOAD | PC/横touchで章画像途中のセーブを旧schema14枠fixtureにし、実LOAD。資源/手動枠不変、移行、titleSeen、読了後再LOADの二重タイトルなし。 |

## 目視・異常・未実施

第1/2章実入口・縦DS・横touch全4枚・PC4/5のPNGを実際に開いて確認。日本語の主題は識別でき、全構図と文字は切れていない。縮小された英字/小さいブランド文字は横touchプレビューおよび縦DSで読みにくくなる。英字までPC同等の可読性とは判定しない。

consoleの完全無異常判定は**FAIL**：[preview.json](preview.json)に404 errorを観測。[追加診断](console-diagnostic.json)でorigin rootの `/favicon.ico` 404を確認（CDP Other、ゲーム資源ではない）。プレビューの4枚・進行・保存検証自体はPASS。初回PCの2件のうちURL未記録の1件は追加診断で再現せず、推測して分類しない。修正は対象外。通常suiteはpageerrorとHTTP400以上/非abort失敗要求を検査し、成功ケースはそれらなし。consoleメッセージ監視は追加previewのみ。

実機Safari/iPhone/Android、別ブラウザ、NEW GAMEから大会の手動完走、第4/5章の本編自然到達、画像破損/15秒timeoutの追加公開QAは未実施。第3章と保留英題は今回の検証から除外。quota guardは開始・区切り・終了で既知のline45 literal\n SyntaxError、利用枠取得不可、推測も修正もしていない。

## 再現

同じ公開deployで実行する。Playwrightをこのcheckoutのnode_modulesに用意し、既存ファイルを上書きしない。

```sh
export BASE_URL=https://haseatsu114514-dot.github.io/shisha-game/remake/
export CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export ARTIFACT_DIR=docs/qa/chapter-titles/public-qa-20261015-e7c6a1
export TEST_REF=1d19f2be95aabbf8376acc1c09e8bd2143cdf967
node "$ARTIFACT_DIR/chapter_titles.mjs"
node "$ARTIFACT_DIR/save_load.mjs"
CASE_FILTER=new-game-first-scene-save-replays-opening node "$ARTIFACT_DIR/ch1_opening_resume.mjs"
node "$ARTIFACT_DIR/preview.mjs"
```

chapter_titles/save_load/ch1_opening_resumeは同deployの既存テストをコピー。章タイトルは対象ケースだけを選び、第3章や破損注入を実行しない。preview4/5の証跡を追加。supportは保存先基準とブラウザversion/時刻記録のみ変更。旧READMEと採用記録は保持。
