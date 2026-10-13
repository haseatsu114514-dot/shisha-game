# 第2章・本編DAY1の接続とセーブ QA

Issue [#514](https://github.com/haseatsu114514-dot/shisha-game/issues/514) / PR [#524](https://github.com/haseatsu114514-dot/shisha-game/pull/524) / 2026-10-13 JST。

第1章クリア画面の「第2章の初日へ」から、章題→tonariで出発→隣町到着→県大会ホールを確認・任意順の店巡り→地元への帰路→tonariの夜→初日終了まで接続した。独立試遊と街・人物・内装・台本を共有する。本編は通常の保存枠を更新するが、独立試遊は保存へ書き込まない。

## 再現

```sh
python3 remake/tools/serve_preview.py --port 8123
# http://127.0.0.1:8123/remake/
node remake/test/ch2_progress.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_main.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_preview.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch1_preview.mjs
```

ブラウザテストはfresh contextで専用の第1章クリア保存を用意し、実際の本編ボタン、地図、MENU、手動保存枠、タイトルのLOAD、ロード後の起動を操作する。初日の通しはVN高速送りを使い、時間制の章題は本物の演出を通す。新規ゲームから第1章14日間を遊び直すテストとは分ける。

## 結果

main `0614327`（schema15のTRPG部活・採用済みOVA予告）まで通常merge後、本編9ケース、独立試遊10ケース、第1章予告9ケースがPASS。[本編の結果](browser-results.json)。coreの日付と境界検査、データ読込35ファイル／最大同時4、日常整合性、追加台詞lint、571場面の台詞接続、指示資料・構文・diffもPASS。既存の `shuraba_mashiro` 重複ID警告1件は維持。

| 本編ケース | 確認 |
| --- | --- |
| chapter-clear-to-city-preserves-progress | 本編のクリアボタンから到着。第2章DAY1／あと13日、会場確認前の帰路無効、所持品・関係・交流の保持。地図の案内パネルがピンを覆わない |
| touch-visits-rooms-and-first-day-ending | 実タップで5地点を任意順、4室を見学、帰路→tonari→初日終了。ロードして日付や完了を重複進行しない |
| autosave-resumes-partial-city-without-replaying-opening | REIだけ訪問・見学したオート保存をタイトルLOADから再開。出発・到着を重複再生せず、未訪問の店を既読にしない |
| manual-save-caption-and-loading-earlier-city-point | 地図で手動1へ保存、初日終了後にその枠をロード。表示は「第2章・DAY1」、保存した訪問地点へ戻り、他の枠と設定を保つ |
| failed-data-load-keeps-chapter-one-clear-and-retries | 不正台本では章を変えず、オート保存の第1章クリアを保持。再読込後に一度だけ第2章へ進む |
| actual-name-knowledge-prevents-duplicate-meetings | `met`は既知、`_met_*`旗は無い保存でも博士・REIの再名乗りを避ける |
| unknown-doctor-introduces-himself-and-is-saved | 未面識の博士が名乗り、面識を読了後の保存へ残す |
| reload-during-room-does-not-complete-unread-room | 室内の会話中に実際に再読込。挨拶の読了は維持し、未読の室内を完走扱いにしない |
| legacy-cleared-save-can-enter-day-one | schema13の旧第1章クリアを本番のLOADから読み、資産を保持して第2章へ進める。未読TRPGの取得を推測しない |

金銭・体力・能力と端数・装備・フレーバーのグラム在庫・好感度と端数・恋人と絆・付き合い始めた日・デート日・交流の記憶・話の進行・連絡先・LIME受信箱・常連ノート・レシピ・記念品・くじ・スロット・TRPGを保持した。主な自動保存ケースでは、手動3枠と設定の内容も一致。無料の導入会話で成長・賞金・在庫消費を与えない。

経過日は第1章の14から15へ進め、`flags._ch2_day1.startDay` を基点に「第2章・DAY1」を表示する。記念日の基点や交流の日時は巻き戻さない。第2章追加で状態のroot schemaは変更せず、既存の可変flags領域で進行を保存する。章切替は `chapter === 1 && phase === cleared` の一度だけ。第2章保存は第1章のカレンダー／大会へ再入場させない。

## 実画面

- [第1章クリア・次章へのボタン](chapter1-clear.png)
- [本編の隣町DAY1](city-day1.png)
- [タッチ・初日の終了](touch-first-day-complete.png)

担当が画像を目視した。初期の地図では長い案内がMELTY PUFFのピンの下端へ重なったため、本編だけパネル幅を広げて高さを抑え、重なりも検査した。クリア見出しの登場アニメーションが終わる前の画像は撮り直した。人物と4室の詳細は [独立試遊の実画面](../ch2-preview/README.md)。

## 未完と範囲

DAY2以降の自由行動・地元往復と行動消費・日常のLIME、孤立アーク、営業中の器具、DAY14の競技・再挑戦・東京移行は未接続。初日終了から未制作の日程へ進めず、保存とMENUを使える状態で止める。県大会の出場者ははじめ・あげは・神崎・REI。ヴォルクは展示の先行登場。県大会ホールはC.STATION店舗と同じビルの貸イベントホールで、店舗を展示会場と呼ばない。

物理スマホ・Safari・ブラウザの実BFcache採用は未検証。独立試遊の履歴イベント検査はハンドラの検査として扱う。本編の室内中断は実際のページ再読込を使う。
