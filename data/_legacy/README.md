# 未接続の旧データ（正本ではない）

Issue #1893 で `data/` 直下から退避したもの。`remake/js`・`remake/data/manifest.json`・`remake/test`・`tools` のどこからも読込・参照が無いことを確認済み。現行データとして接続・引用しない。

- tips.json: 旧仕様のTips（「ライバルの店はDay2から解放」等）。
- sheesha_posts.json: 旧SNS投稿データ。
- credits.json: スタッフロール用の仮データ（自己記述で「未接続」）。実クレジットは #517 の設計で作り直す。
- lime_events.json: minto/ageha/tsumugi/mashiro の旧恋人デート後LIME 4本のみ。現行の恋人イベントと表記・人物設定がずれる（#1668 で接続可否を判断する際の参考資料）。
