# 表情差分の作り直し・追加・名称整理（#2058）

- 生成: OpenAI images/edits、モデル `gpt-image-2.5-sunburst`、quality high、透過背景、1回1人1表情（2026-10-31）。プロンプトは `generate.py`、原画は `raw/`
- 参照: 各キャラの採用済み `chr_<id>_normal.png` のみ
- 配置: `place.py`（透過で切り抜き、normal の人物の高さ・上端・中心に合わせて 896×1200 へ配置）
- 作り直し: maezono serious（別人・年上に見えた）、uranaishi smile（顔が影・ヘッドバンド/カード欠け）、mashiro sad、rin serious
- 名称整理: 旧 chr_mashiro_sad（あくび）→ chr_mashiro_yawn、旧 chr_rin_serious（驚き）→ chr_rin_shock
- サイズ揃え: pakki surprise を既存画像のまま normal の高さ・上端に再配置
- 追加: rei serious/smile/surprise、pakki excited、hajime smug/excited、naru excited、kumicho smug、rin smug
- 台詞: lover_events の ましろ「……充電中……」だけ yawn に変更。他の mashiro sad / rin serious は本来の悲しみ・真剣の意図なので新画像で表示
