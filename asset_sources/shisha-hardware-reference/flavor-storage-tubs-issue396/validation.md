# 検証

- 予約成功：run 38179756637、worker `codex-e-visual-20261011-01`。
- オーナー提供4JPEG：コピー後のSHA256が元ファイルと一致、デコード成功。無加工保存。
- 既存元候補・v1・v2：1024×1536、不透明RGB、デコード・SHA256照合成功。
- 本資料配下のMarkdown相対リンクは全件存在確認。`python3 tools/check_agent_docs.py` PASS（5 instruction files、links、shared rules、安全チェック）。
- `git diff --check`／`./tools/check_git_safety.sh` PASS。
- `git diff HEAD -- assets data remake`：差分なし。タイトル18枚・WebP・manifest・ゲーム炭数解放・価格・装備・セーブに変更なし。そのためブラウザ全体のテストは追加実行していない。既存コードのPC／スマホ・旧セーブは直前のIssue #374で確認済み。
- v2原寸と変更前後を目視。透明矩形容器・外した蓋・不揃いな湿った葉・棚の閉容器・植物除去を確認。顔・衣装の同一性とHMD・手の微差はオーナー選定待ち。
- 未実施：生成候補の承認・本編登録・WebP変換・本編配置QA・実機寸法の精密照合。写真参考の採用と画像採用を混同しない。
