# Issue385 公開QA — 独立実行 e7c6a1

今回の公開URLだけを対象にした新規実行。以前のローカルQAや旧runの安全停止を結果へ合算していない。実装・原画・採用表は変更していない。

- WORKER: `codex-a-385-publicqa-20261015-e7c6a1`
- CLAIM: [38766518836](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38766518836)、最新bot台帳は同owner/claim_runのclaimed。
- 開始status: [38769698991](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38769698991)、request `publicqa-e7c6a1-20261016-status-01` SUCCESS。実notice `CLAIM_VALIDATED_ISSUE=385 OWNER=codex-a-385-publicqa-20261015-e7c6a1 RUN=38766518836` を確認。
- 公開先: https://haseatsu114514-dot.github.io/shisha-game/remake/
- deploy SHA: `1d19f2be95aabbf8376acc1c09e8bd2143cdf967`。[Pages run 38738599276](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38738599276) SUCCESS、Pages build `1286824081` built（2026-10-15T13:03:49Z）。[hashes.json](hashes.json) の公開9リソースと当該checkoutのSHA256がすべて一致。
- 実行時刻: 2026-10-15 UTC（2026-10-16 JST）。各JSONに時刻、Chrome `155.0.8059.41` を記録。system Chrome/headless/Playwright、ケースごとの新しいcontext。ユーザーのセーブを開いていない。ローカルserverなし。
- Open PRの全変更filesと本ディレクトリの衝突なし（開始時）。

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

consoleの完全無異常判定は**FAIL**：[preview.json](preview.json)に404 errorを観測。[追加診断](console-diagnostic.json)でorigin rootの `/favicon.ico` 404を確認（CDP Other、ゲーム資源ではない）。プレビューの4枚・進行・保存検証自体はPASS。初回PCの2件のうちURL未記録の1件は、初回追加診断（ページ読込のみ）では再現せず。下の追記で操作付き再現を記録するが、元の未記録1件を推測して分類しない。修正は対象外。通常suiteはpageerrorとHTTP400以上/非abort失敗要求を検査し、成功ケースはそれらなし。consoleメッセージ監視は追加previewのみ。

実機Safari/iPhone/Android、別ブラウザ、NEW GAMEから大会の手動完走、第4/5章の本編自然到達、画像破損/15秒timeoutの追加公開QAは未実施。第3章と保留英題は今回の検証から除外。quota guardは開始・区切り・終了で既知のline45 literal\n SyntaxError、利用枠取得不可、推測も修正もしていない。

## 追記: console URL・発生操作とquota構文（2026-10-15 UTC）

同ownerの再開status [38771585030](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38771585030) SUCCESSと実noticeのIssue385/owner/claim run38766518836一致を確認。公開Pagesは引き続き同じdeploy SHAでbuilt、他Open PRに本ディレクトリの衝突なし。既存の結果JSON・PNGは変更せず、下記追加証跡だけを採取した。

[操作付きconsole診断](console-followup.json) / [採取script](console-followup.mjs)：既存Chrome 155.0.8059.41のfresh PC context（1280×720）で、公開プレビューを開き、1→2→4→5章を実select/playで一巡した。CDP Network/Logとconsole locationに時刻・操作phaseを付与。公開preview HTMLのSHA256は元のcheckoutと一致した。開始前の1回はPlaywright依存解決で失敗しブラウザ起動前に終了。その後、前回npmキャッシュから同job内へオフラインでQA依存だけを復元し、以下の実行を1回行った。新しいブラウザ/アプリ/設定は導入していない。

| UTC | 発生操作 | URL・分類 |
|---|---|---|
| 16:48:56.921 | 初回preview読込 `initial-navigation` | `https://haseatsu114514-dot.github.io/favicon.ico`、404、CDP `Other`、initiator `other` |
| 16:48:59.571 | 第1章を選択し「再生する」をクリック `chapter-1-select-and-play` | 同じ `/favicon.ico`、404、同じ分類 |

追加再現のconsole error 2件は上の2件とlocationまで一致し、favicon以外のHTTP400以上・failed request・pageerrorは0件。4章とも1280×720画像のdecode/contain/DOM二重表示なし/再生完了/localStorage不変を確認した。**この追加再現では章画像の欠落や進行・保存への影響は観測していない。** 元のpreview.jsonにはerrorごとのURL・時刻・操作phaseがないため、初回PCの未記録1件と今回の2件目の同一性は遡って断定しない。今回の結果を元の結果へ合算したり、console完全無異常FAILをPASSへ変更したりしていない。

最小修正の判断：現在の証拠から章タイトルruntimeの不具合修正は必要と判断できない。console完全無異常を満たす目的なら、プレビューHTMLに有効なfaviconを明示する1ファイルの変更が最小候補（画像再制作・共通ui.js変更は不要）。実施する場合は別予約/境界調整とし、このPRでは修正しない。元の未記録1件は情報不足の留保を残す。

[quotaソース診断](quota-source-diagnostic.json)：`tools/agent_quota_guard.py` の `describe()`、元の物理42行にliteral `\n` 6個、45行に1個が混入。ASTは45行31列で `unexpected character after line continuation character`。42行はコメントから `try` / `fresh` / `numbers` 定義までが同じ物理行へ入っており、45行だけ直しても `numbers` 定義が実行コードへ戻らない構造である。ソースSHA256は `aa1daae5c64dd4373f9fea97704c0f5f7462367e908796362955085e96606334`。この2物理行だけliteral改行を実改行へ置いた**メモリ上の文字列のAST解析**はPASSしたが、実行・元ソースの変更・利用枠ファイルの読取はしていない。必要な修正の最小範囲は当該関数の2箇所で、別タスクで構文検査とfresh/stale/missing観測の回帰を確認する。実際の利用枠取得成功や動作修正済みとは扱わない。

親の独立レビューは元head `d5244d45` の14 JSON・リンク・fadeログ・一部PNG整合を対象に、証跡保存としてPASS・必須不具合なし。**全画像の目視や公開再実行を行ったレビューではない。** 上の操作付き追加再現は今回QA workerの別実行。実機Safari/実スマホの検証は引き続き未実施で、新規ソフト・設定導入はしていない。

## 再現

同じ公開deploy・確認済みcheckout rootで実行する。既存と同じPlaywright依存とsystem Chromeを利用する。**この証跡ディレクトリを出力先にして再実行しない。** 下の手順で同じ階層に新規の複製/出力先を作り、コピーしたscriptだけを実行する。元のJSON・PNGは再生成・上書きしない。

`preview.mjs` はscript所在ディレクトリに保存するため、`ARTIFACT_DIR`を変えるだけでは不十分。必ず新規複製先の `preview.mjs` を実行する。supportの相対root参照を保つため、複製先は同じ `docs/qa/chapter-titles/` 直下とする。以下の再実行手順そのものは今回実行しておらず、元証跡は保全した。

```sh
set -eu
QA_SOURCE_DIR=docs/qa/chapter-titles/public-qa-20261015-e7c6a1
QA_RERUN_DIR=$(python3 -c 'import tempfile; print(tempfile.mkdtemp(prefix="public-qa-rerun-", dir="docs/qa/chapter-titles"))')
for QA_SCRIPT in support.mjs chapter_titles.mjs save_load.mjs ch1_opening_resume.mjs preview.mjs; do
  cp "$QA_SOURCE_DIR/$QA_SCRIPT" "$QA_RERUN_DIR/$QA_SCRIPT"
done
export BASE_URL=https://haseatsu114514-dot.github.io/shisha-game/remake/
export CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export ARTIFACT_DIR="$QA_RERUN_DIR"
export TEST_REF=1d19f2be95aabbf8376acc1c09e8bd2143cdf967
node "$QA_RERUN_DIR/chapter_titles.mjs"
node "$QA_RERUN_DIR/save_load.mjs"
CASE_FILTER=new-game-first-scene-save-replays-opening node "$QA_RERUN_DIR/ch1_opening_resume.mjs"
node "$QA_RERUN_DIR/preview.mjs"
```

chapter_titles/save_load/ch1_opening_resumeは同deployの既存テストをコピー。章タイトルは対象ケースだけを選び、第3章や破損注入を実行しない。preview4/5の証跡を追加。supportは保存先基準とブラウザversion/時刻記録のみ変更。旧READMEと採用記録は保持。
