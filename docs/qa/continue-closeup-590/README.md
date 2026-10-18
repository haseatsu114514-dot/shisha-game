# #590 採用C顔アップ

Issue #590本文の「採用確定：C案の顔アップ（2.05倍）」を、通常neonの開始時から適用する独立差分。
基準main: `4834e9eccb54d7aff466cac03bf784b5227e5735`。
worker: `codex-a590-closeup-20261016-4bbd263e`。
claim run: [38861468538](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38861468538) SUCCESS、bot台帳6209557867のowner/run/UUID一致を確認してから実装。

## 結果

- 顔bbox高524.8px、中心(640,273)、人物枠top0/height720。既存manifestのcx/top/sizeで表情ごとに再配置する。
- 字幕送りで倍率・位置を変えない。軽減時も同じ構図。通常の登場・表情beatは既存動作を維持する。
- production変更は `remake/js/chapters/continue-view.js` と `remake/css/continue-neon.css` だけ。
- 画像、alpha、manifest、字幕、見出し、HUD、2択、音、時計、資源・セーブ処理は未変更。
- classic/比較用4レイアウト×44表情のinline画像styleと枠寸法は、元mainと176/176完全一致。

[変更前・44表情](before-all44.png) / [採用C・44表情](after-all44.png) / [スミさん拡大](after-sumi.png) / [横持ちタッチ・軽減](touch-reduced.png)

## Chrome実測

macOS上の実Google Chrome 155.0.8059.80をPlaywrightの新規・使い捨てcontextから操作。本セーブ/profileは開いていない。既存/追加回帰はlockfileの1.62.1、独立したbaseline/ライフサイクルQAは隔離導入の1.64.1を使用（各比較内で同一環境）。[バージョン](browser-versions.json)。

| 検査 | 結果 |
| --- | --- |
| 7話者44表情×1280×720 / 1920×1080 / 844×390 / 667×375 | 176/176 PASS |
| 同じview内で全表情を往復、字幕prefix→全文表示 | 88切替 PASS、画像style不変 |
| C実測の最大誤差（stage px） | bbox高0.0023、中心X0.0159、中心Y0.0145 |
| 変更前後の見出し・HUD・字幕・2択 | 176ケースで位置・寸法差0px |
| 全44表情の一覧を目視 | 目・口は見出し/HUD/字幕に覆われず、文字・操作可読。帽子/髪の重なりは採用どおり |
| 390×844縦タッチ→844×390回転、OS軽減へ変更 | 構図保持、横向きで実tap、retry callback一度、保存不変 |
| 正規人物画像を1.2秒遅延 | 準備待ち中は未表示、表示開始20、C構図・選択可能 |
| 人物画像を故意404 | 準備のfalseを確認、20で開始、metadataによるC配置を維持し操作可能。欠損絵自体の復旧は既存どおり |
| 4サイズ×通常/早送り/軽減の実20秒終了 | 12/12 PASS、ロゴ(640,360)±1px、760×220、顔/字幕/数字/2択非表示、title callback一度 |
| 通常ケースのpageerror/画像取得失敗 | 0 / 0。故意404は独立ケース |
| state/storage | 既存回帰の資源・保存不変PASS、新規44表情/タッチ検査も保存不変 |

[変更前の全実測](baseline-metrics.json) / [Cの全実測](candidate-metrics.json) / [他UI比較](ui-comparison.json) / [タッチ・読込・比較レイアウト](lifecycle-metrics.json)

変更前は取得済み元mainのJS/CSSとbyte単位一致を確認した上でChromeに読み込んだ。最初の測定後、プレビューの非同期縮尺更新に対応して実stage幅/1280で正規化した再測定を採用。本体を巻き戻していない。

## 回帰

- `continue_neon.mjs`: PASS。旧256pxの仮定を実測C bboxの目〜口の保護領域へ更新。タイトルの実alphaが保護領域に0pxであるassert、HUD、20秒・非表示・callback契約を維持。
- `continue_typing.mjs`: PC/横持ちタッチPASS。頭上の余白条件を採用Cの固定bboxへ更新。26字/秒・白・prefix中央・非拡大・全9台本/18反応・選択色・保存不変を維持。
- `continue_readiness.mjs`: PC/mobile/warm-premium 3/3 PASS。
- `continue_screen.mjs`: 全件PASS。全18分岐、20秒、実時計、早送り、離脱/非表示、各比較レイアウト、プレビュー保存不変。
- `continue_classic_count.mjs`, `continue_premium.mjs`, `continue_audio.mjs`: PASS。
- `browser/gameover_title_center.mjs`: 12/12 PASS。C人物枠の期待値だけ更新し、#595のロゴ位置assertを維持。
- `browser/continue_closeup.mjs`: PASS。今回追加した176測定/88切替の再利用可能な回帰。
- JavaScript構文、diff check、Git Safety/hooks: PASS。

初回neon/readiness/screenにはsparse checkoutで未取得だった顔アイコン/店舗ロゴの404が記録された。現HEADの必要共有素材を追加取得し、元assertを削除せず再実行した。初回失敗をPASSには数えていない。

```sh
BASE_URL=http://127.0.0.1:8590/remake/ \
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node remake/test/browser/continue_closeup.mjs
```

既存のroot直下テストは固定lockfileのPlaywrightを用い、`NODE_PATH=./remake/test/browser/node_modules`を指定。音声VM検査には`--experimental-vm-modules`を指定した。

最終9回帰の[結果とログ](regressions.json)。[実行ソースのSHA-256](tested-source-sha256.json)と記録したファイルを照合済み。

## 範囲・未実施

- 縦案内中のタイマー進行はbaselineとCの両方で20→15を再現した既知問題。今回修正しておらず、pause仕様の完成とは扱わない。
- 再戦体力・字幕改稿・全20秒の刻み音・他の#590残件は対象外。
- 物理スマホ、Safari、音声実聴、自然な敗北までの全章通し、公開版QAは未実施。
- Draftで保全。merge/main push/Issue590 close/予約releaseは今回行わず、専用checkoutとclaimを保持する。
