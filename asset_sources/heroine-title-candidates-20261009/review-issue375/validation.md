# 検証結果

- 基準main：`73cd85e0c2f40f18361a6174b9cb9c1064eaab56`。
- `./tools/check_git_safety.sh`：PASS。
- `ARTIFACT_DIR=/tmp/e375-browser node remake/test/title_arts.mjs`：boot-and-random／PC 1280×720／スマホ844×390 の3ケースPASS。全18枚のデコード、初回1枚のみ読込、連続同キャラ回避、メニューの領域内表示、localStorage/sessionStorage不変を確認。結果は [title-arts-results.json](title-arts-results.json)。
- 現行表示証跡：[PC](comparisons/current-title-pc.png)／[スマホ](comparisons/current-title-mobile.png)。新候補は本編に出していない。
- 原画・PNGデコード・SHA256照合：既存12点と新候補1点は1024×1536、正式18点のPNG/WebPハッシュ維持。新候補はRGBの不透明画像。
- `git diff HEAD -- assets data remake`：差分なし。既存候補12点のファイル名は実行時JS／JSONから未参照。実行時アセットの一括再生成なし。
- 目視：正式立ち絵との一覧比較、シーシャ7候補と修正案は原画でも確認。今回の植物除去を変更前後で確認。候補ごとの所見・実写未取得の限界はinventoryに記録。
- 未実施：新候補の本編登録・オーナー採用・新候補の実画面配置・外部実写の再取得を伴う精密モデル寸法検証。これらを完了扱いしない。
