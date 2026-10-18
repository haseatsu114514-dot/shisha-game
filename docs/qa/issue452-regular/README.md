# #452 B・常連接客の実回答と後日の反応

WORKER: `codex-tsumugi452-20261015-3d1c4d7902`（既存予約を保持）
BASE: `7d63fbdc5ce75e57c3cca438476452b7238bd12e`
BRANCH: `codex/452-regular-service-20261018`

DAY2 `ch1_salaryman_regular` の注文確認2行を、同じ長さの「注文を先に聞く／水を出して少し待つ」二択へ接続した。実選択時にだけ回答を排他的に保存する。読了は従来の夜イベント完了時に確定し、回答保存だけでは読了にしない。

DAY10 `ch1_salaryman_change` はDAY2読了と実回答が両方ある場合だけ、その接し方への短い反応を返す。未回答旧セーブ・未読は既存の中立な内心のまま。注文のミント変更、入口の席、スマホ、電話での笑顔、つむぎの最後の言葉、既存報酬・延期条件は共通で維持した。接し方で事情や通話相手を聞き出さず、正解報酬も作らない。

既存つむぎ実装PR #568は `4aa8b95fc0e5abda476875fa3de51f6794c227cf` で統合済み、当時のhead `18632c98` の公式CIも22/22成功と確認。再実装していない。Aのmap.js/spots.jsは#675/#481と重なるため変更せず、Cと全体添削#564も対象外。変更直前のOpen PR14件の実filesを照合し、今回の変更パスとの重複なし（#675は全146件を取得済み）。

## 検証結果

Chromium、PC 1280×720／横タッチ844×390のエミュレーション。実JSON・実VNエンジン・実state・夜イベント／延期・保存APIと枠選択UI・本番CSS／書体を使った場面fixtureから検証した。

- 専用ブラウザ **8ケースPASS**。両回答／未回答 × DAY2読了／未読 × 現行／schema13の12経路で、DAY10の全ゲーム状態が基準と一致。DAY2の両回答も、回答flagsと保存時刻だけを除いて全状態一致。報酬・記憶・乱数・日付などの変化を比較している。
- 休養でDAY2を延期→実読了→保存／LOAD→DAY10の反応を確認。未読中は回答・読了を作らず、同夜の再実行は発話・状態変化ともゼロ。
- PC／タッチの全6経路で実クリック／タップ、SAVE枠→文書再読込→LOAD、SKIPを確認。SKIPは接客二択で停止し、自動で回答しない。選択直後のオートセーブは実回答だけを残し、DAY2を読了扱いにしない。
- 既存 `issue508_theme.mjs` の6場面比較は **19経路PASS**。追加した常連の両回答について、意図した2flagsと保存時刻だけを別検証し、他の全ゲーム状態の比較を維持した。つむぎ等の既存assertは保持。
- 新しいfixture入口を使う既定コマンドの状態比較もPASS。
- 対象会話lint ERROR 0 / 既存WARN 6、tidy dry-run変更0、JSON解析・JS構文・Git Safety・agent docs・diff check PASS。

### クリック数

文字速度「全表示」、AUTO／SKIPなし。同じレンダラーで[基準mainの2場面](baseline-scenes.json)と変更後を比較。表の送り回数は選択や保存UIの操作を含まない。

| 端末 | 回答 | DAY2送り 前→後 | DAY2選択 前→後 | DAY10送り 前→後 |
| --- | --- | --- | --- | --- |
| PC | 注文を先に聞く | 17→17 | 0→1 | 19→19 |
| PC | 水を出して少し待つ | 17→17 | 0→1 | 19→19 |
| PC | 未回答旧セーブ | 再生なし | 0→0 | 19→19 |
| タッチ | 注文を先に聞く | 17→17 | 0→1 | 19→19 |
| タッチ | 水を出して少し待つ | 17→17 | 0→1 | 19→19 |
| タッチ | 未回答旧セーブ | 再生なし | 0→0 | 19→19 |

追加操作はDAY2の1選択だけ。新しい場面は増やしていない。マップ再訪の時間圧縮や壁時計による読了時間の測定は対象外。

### 環境不足・未実施の範囲

最初の通常起動ではsparse環境に未取得だったテキスト `remake/data/lover.json` があり、必要テキスト取得で解消した。その後の通常起動を使う比較は、対象外の顔アイコン `face_hiyori.png`／`face_pakki.png` がキャッシュになく、先読み404でスイートが失敗した。[失敗ログ](full-boot-cache-failure.txt)。画像追加取得は禁止のため取得せず、失敗を成功扱いにしていない。

場面専用 [fixture](../../../remake/test/browser/fixtures/regular_service.html) は、本番のデータ／モジュール／CSSを読み、タイトル・マップ全体の先読みを起動しない。代替画像やゲームモジュールのmockは使わず、必要な既存素材は固定mainのGit blob SHAを照合したローカルキャッシュから表示した。専用8ケースのブラウザエラー・リソース失敗はゼロで、6枚の反応画面を目視した。

従って今回の成功は場面単位の検証であり、通常起動全体・タイトルからのゲーム再開・全14日通し・実機Safari・公開版QAの合格ではない。既存SAVE/LOAD全体スイートとbonds.mjsは今回実行していない。

## 取得量とGit履歴の復旧

[取得記録](acquisition.json)。承認後のテキスト本文は **4,068,267 bytes／182ファイル**、レスポンスヘッダは168,703 bytes。8.44MB上限内で、固定commitのHTTPテキストだけを取得し、すべてのblob SHAを検証した。TLS・要求側ヘッダなどの通信量は未測定。画像・音声・追加Git packの取得はゼロ。

前の限定fetchで発生した約2.75GiBの想定外pack増加は、原因・実通信量が未確定の既知の事故として保持する。今回の取得量に混ぜて隠さない。そのGit取得経路は再利用していない。

拒否原文は `main -> origin/main (non-fast-forward)` で、権限・安全審査による拒否ではなかった。既取得比較APIキャッシュから240件を元SHAと完全一致する本文へ再構成し、欠落239 commit objectsだけを通信なしで復元した。元ref・shallow・pack一覧は `/tmp/issue452-git-state-1792339539782426984` に保全。

全親参照を検証してからshallow境界を整合し、実Gitの祖先検査が成功、`old..new` が240件と一致した後に、期待旧SHA付きCASでorigin/mainを通常FF更新した。Git Safetyも成功。force・graft・replace・検査弱体化は使わず、packは不変。原作業ブランチを保持し、正規checkoutのworktreeを最新origin/mainから作成した。

## 記録と再実行

[8ケース結果](browser-results.json)／[操作計測](browser.txt)／[既存回帰とfixture入口の結果](related-regression.txt)。

| 回答 | PC | タッチ |
| --- | --- | --- |
| 注文を先に聞く | [原寸](pc-0.jpg) | [原寸](touch-0.jpg) |
| 水を出して少し待つ | [原寸](pc-1.jpg) | [原寸](touch-1.jpg) |
| 未回答 | [原寸](pc-legacy.jpg) | [原寸](touch-legacy.jpg) |

通常の素材がある環境では既存previewサーバーを起動して以下を実行する。今回のsparse環境では、足りない配信ファイルを追加取得せず既存Git objectからのみ配信するローカルサーバーを使用した。

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/regular_service_response.mjs
BASE_URL=http://127.0.0.1:8123/remake/test/browser/fixtures/regular_service.html READY_SELECTOR='[data-test="vn-fixture-ready"]' CASE_FILTER=six-scenes-branches-old-save-and-state-effects CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/issue508_theme.mjs
python3 tools/lint_dialogue.py ch1_main
python3 tools/tidy_dialogue_text.py --dry-run
python3 tools/check_agent_docs.py
```

NEXT: Draft PRで実headのCI・差分を確認する。A/Cは残件のまま。予約を保持し、マージ・公開・Issue終了はしない。
