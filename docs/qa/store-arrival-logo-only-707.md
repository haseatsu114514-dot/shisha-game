# 入店演出をロゴのみにする（#707部分対応 / #701 元28）

`core/store-arrival.js`で採用済みロゴの下へ付けていた`opts.area`の表示だけを除去。ロゴ・画像失敗時の店名fallback・入力保護・表示時間・SKIP/reduced-motionを保持する。地図や場所データからareaを削除しない。

`SHOTS=/workspace/work/707-arrival CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/store_logos.mjs`で既存18 UIケースがPASS、pageerror0。7店の地図からの実クリック→ロゴ→到着、店舗メニュー、昼夜/解禁、SKIP/読込失敗等の既存境界を確認した。tonari/EDEN等の実画面を目視し、場所説明がなく採用ロゴだけ出ることを確認。構文・diff・Git SafetyもPASS。実機Safariは未確認。

変更予定2ファイルは、調査した20 Open PRの実filesに重複なし。既存テスト本体・共有CSS・map.jsは編集しない。元27の人物「？」移動はPR#675の地図・看板変更に接するため、本PRに混ぜず#707へ残す。

本人がこの依頼に限る予約省略を明示許可。既存owner/台帳は変更しない。CI・レビュー・公開確認が終わる前に全体完了とは扱わない。
