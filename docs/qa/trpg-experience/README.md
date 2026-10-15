# TRPGの画面演出・探索・判定

[Issue #588](https://github.com/haseatsu114514-dot/shisha-game/issues/588) / [PR #592](https://github.com/haseatsu114514-dot/shisha-game/pull/592)。現行 `remake/` の短編2本が対象。

## 再設計版（2026-10-15）

前回UIへの「文字やウインドウが多く、ワクワクしない」という指摘を受け、場面と選ぶ物の絵を中心に組み直した。
1280×720のステージ全体を物語の背景にし、常設サイドバーを撤去。会話がない時は人物・字幕も畳み、探索点、ノート、相談する仲間、次の行動を場面上に置く。
会話中だけ人物カットと字幕を表示し、GMと物語内の役の区別は残す。

- 探索点は小さなリングで示し、対象名はhover・キーボードfocus時に表示する。通常編は必要な手がかり3つ、サメ編は残り調査数と危機コストも短い一行で伝える。
- 準備は一度に3つの絵から選ぶ。香り・道具を選ぶと次の席・経路へ進み、小さなタブから選び直せる。前に選んだ値は保持する。長い説明はhover・focusした物に添える。
- 見立ても3択を中心にし、取得済みの手がかりは必要な時に開く折りたたみへ移した。
- 判定は場面上の大きなダイスと仲間の助力を中心にする。確率・閾値・説明は初期状態で閉じた「判定の詳細」から開く。助力の＋2と連携札1枚の代償は、詳細を開かず確認できる。
- 上部の道具は小さなアイコンにし、名前と操作目的を読み上げに残す。5段階の進行はスクリーンリーダー用の情報として保持する。
- 横持ちタッチではリングなどの操作領域を拡大する。844×390の検査では、ステージの縮尺適用後も探索点を44px以上に保つ。

選択用に3×3の画像を2枚生成し、通常編9点・サメ編9点の計18点を配置した。香り・席・声のかけ方、道具・経路・最後の作戦を絵から選ぶための素材で、日本語ラベルはUI側で重ねる。
[生成素材と出典記録](../../../asset_sources/trpg-scene-ui/README.md) / [生成メタデータ](../../../asset_sources/trpg-scene-ui/generation.json)。

結末の計算・出目・seed再現性・台詞・価格・行動枠・保存形式は変更していない。サメ編の見立ての正誤は判定前に明かさず、確率は条件付きの範囲で示す。
ノート・判定詳細・振り返りは、ユーザーが開いた時に読む。キーボードのfocus移動、Escapeで閉じる操作、元の操作へのfocus復帰、本文スクロールを維持する。

### 再設計版の画像

以下は最終撮影用の保存先。旧UIの「after」画像は、この再設計版の完成画像として扱わない。

| 場面 | 保存先 |
| --- | --- |
| 表紙 | [cinematic-cover.png](cinematic-cover.png) |
| 全面シーンの探索 | [cinematic-explore.png](cinematic-explore.png) |
| 絵から選ぶ準備 | [cinematic-choices.png](cinematic-choices.png) |
| 見立てと折りたたみメモ | [cinematic-hypothesis.png](cinematic-hypothesis.png) |
| 詳細を畳んだ判定 | [cinematic-roll.png](cinematic-roll.png) |
| 横持ちタッチ | [cinematic-touch.png](cinematic-touch.png) |
| サメ編 | [cinematic-shark.png](cinematic-shark.png) |

### 再設計版の検証

前回UIの検証記録と分けて保存する。現時点で再設計版の通常編PC・横持ちタッチ2ケースはPASSを確認した。その他の最終結果は確認後に記録する。

<!-- 最終確認担当: 撮影画像と実際のPASS結果だけを保存し、この表の未確認・保存待ちを実行結果に合わせて更新する。 -->

| 検査 | 状態 | 最終結果の保存先 |
| --- | --- | --- |
| `trpg_experience.mjs` 通常編 | PC・タッチ2/2 PASS。結果ファイル保存待ち | [cinematic-experience.json](cinematic-experience.json) |
| `trpg_experience.mjs` サメ編 | 最終結果は未確認 | [cinematic-shark.json](cinematic-shark.json) |
| 既存 `trpg.mjs` | 再設計版での最終結果は未確認 | [cinematic-stories.json](cinematic-stories.json) |
| 本編接続 `trpg_main.mjs` | 再設計版での最終結果は未確認 | [cinematic-integration.json](cinematic-integration.json) |

追加検査は、全面の背景、常設サイドバーとidle字幕の撤去、光点のfocusラベル、実タップ領域、空のノート、絵付き3択の切り替えと選択保持、説明の表示、判定詳細の初期closedと開閉を確認する。
従来の長押しキー、判定中のfocus、見立ての非漏洩、振り返り、Storage無アクセス・保存不変の検査も残す。

再現コマンド:

```bash
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg_experience.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg.mjs
BROWSER_TIMEOUT_MS=30000 CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg_main.mjs
```

`CASE_FILTER` で既存ブラウザ検査を1件、`TRPG_EXPERIENCE_GROUP=ordinary|shark` で追加検査を2件に絞れる。既定は全件実行。
PCと844×390の横持ちタッチ入力はChromiumによる検査。物理端末/Safariと公開デプロイは未検証。

## 前回UIの履歴（2026-10-15、再設計前）

以下の画像・結果は `8c34d2c7` 時点の前回UIのQAとして保持する。常設サイドバー、文字の進行ナビ、常時表示の確率欄を含むため、今回の再設計版の完成画面・通過結果ではない。

変更前画像は `42525242` のチェックアウトで撮影し、ベース `6b495588` とのTRPG実装・台本・CSSの差分がないことを確認した。
作業中に取り込んだ `3810c657` は別件のQA資料だけで、ゲーム実装の差分はない。

| 場面 | 前回UIでの変更前 | 前回UIでの変更後 |
| --- | --- | --- |
| 探索 | [数字だけの進行と0/6のボタン](before-explore.png) | [文字の進行、必要3個、残り調査数](after-explore.png) |
| 判定 | [補正と助力の選択](before-check.png) | [閾値、概算確率、助力による変化](after-check.png) |

前回は見立てと手がかりを横並びにし、準備中の選択をサイドに表示していた。
[見立てと手がかり](hypothesis-and-evidence.png) / [選択中の提案](selected-plan.png) / [メモ比較](memo-comparison.png)。
[卓の振り返り](table-recap.png) / [横持ちタッチの振り返り](table-recap-touch.png)も前回UIの撮影記録。

| 前回UIの検査 | 当時の結果 |
| --- | --- |
| `node --test remake/test/trpg.mjs remake/test/trpg_campaign.mjs remake/test/trpg_feedback.mjs` | 30件PASS。全提案・8結末・共有札・seed再現性・確率・隠し情報の非参照 |
| `node --experimental-vm-modules remake/test/trpg_campaign_save.mjs` | schema移行と43破損fixture PASS |
| `python3 tools/lint_dialogue.py trpg_` | 3ファイル、ERROR 0 / WARN 0 |
| `trpg_experience.mjs` | [4ケースPASS](experience-four-cases.json) |
| キーボード追加確認 | [最終PC/タッチ2ケースPASS](experience-keyboard-final.json) |
| 既存 `trpg.mjs` | [初回15/16 PASS](stories-initial.json)。companyは操作待機で時間切れ後、[単独再実行PASS](company-retry.json) |
| 本編接続 `trpg_main.mjs` | [初回記録](integration-initial.json)。10秒上限で3件が時間切れ。下記の再実行ですべてPASS |
| GitHub TRPG専用CI | [run 38791884076](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38791884076) SUCCESS。head `8c34d2c7` の既存16ケース・追加4ケース・本編13ケースと純関数/移行/lint。[実行情報](ci-feature.json) |
| 構文 / `git diff --check` / `check_agent_docs.py` / Git Safety | PASS |

本編の通常会話はturboでも素材の準備を待ち、1枚の上限が15秒ある。共通ブラウザハーネスの `BROWSER_TIMEOUT_MS` は既定10秒を維持し、TRPGのCIでは30秒を指定する。
前回UIでは、初回に時間切れとなった3件を30秒設定で単独再実行してPASSを確認した。
[実訪問・勧誘・保存](integration-visits-retry.json) / [購入・中断・二人卓](integration-small-table-retry.json) / [代役の配役](integration-replacement-retry.json)。
上記GitHub CIでは旧10秒設定でも13ケースを一括して通過している。

## 作業の記録

WORKER: `codex-trpg-experience-20261015-4f9d2c`。GitHub Actionsのclaimは環境認証でForbiddenとなり、オーナーが今回の依頼では予約ルールの免除を明示した。予約だけを免除し、Git Safety・最新mainからの分岐・hooks・通常push・PRでの共有は維持した。
Open PRの実変更ファイルを全ページ取得し、今回のゲーム実装・テスト・説明書と重複しないことを確認した。
