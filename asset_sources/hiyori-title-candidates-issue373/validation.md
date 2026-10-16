# ひより3枚の正式接続：検証記録

- 承認：2026-10-12、オーナー回答「3案すべて採用して本編登録・マージ」。アゲハは「比較資料として保存し、選定を保留」。
- 制作元main `134b1a5a327cf25ddab94b6ab4ed18d604735bbf`。3PNGは候補と正式保存先でSHA256一致。表示WebPのハッシュは `candidates.json`。
- `python3 remake/tools/build_manifest.py --title-only`：7人21枚。既存18PNG/WebPのハッシュ全件一致、その他のmanifest項目は同一。`generated`／`titleArts`の3項目／`webp`の3項目だけ更新。全体の立ち絵アンカーを再計測していない。
- `ARTIFACT_DIR=/tmp/e373-adopted-title node remake/test/title_arts.mjs`：3ケースPASS。初回1枚のみ読込、実抽選でひよりを選ぶ、24回の自然な抽選でも連続同キャラを避ける、全21画像PC1280×720／スマホ844×390でデコード・表示、メニュー収容、localStorage／sessionStorage不変。
- `ARTIFACT_DIR=/tmp/e373-adopted-save node remake/test/browser/save_load.mjs`：6ケースPASS。全スロット、旧形式の自動／手動移行、壊れたJSON、PC／タッチUI、縦持ちからの回転。従来の装備・好感度・所持金を維持。
- `python3 tools/check_active_json.py`：64点PASS。`python3 tools/check_agent_docs.py`、`node --check remake/test/title_arts.mjs`、`git diff --check`、Git Safety PASS。
- 本編抽選のJS／セーブ／装備／価格／能力は変更なし。修正待ち凛02・ひより窓際v1・アゲハ修正5案を登録していない。
- 初期仮表示はPNGを直接指定してmanifest不変を確認したもの。採用後の結果とは区別して `qa/results.json` と `qa/adopted-*.json` に保持。
- 最終head CIと公開版の確認はマージ前後にIssueへ記録する。公開サイトの権限・公開範囲を変更しない。
