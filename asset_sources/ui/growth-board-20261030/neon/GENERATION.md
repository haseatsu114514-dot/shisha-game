# GB03 第1段 素材6点の生成記録（2026-10-31・Grok Bot）

- 指示書: `../neon_lounge_brief.md` 5.2（プロンプトは「共通スタイル指針」＋「盤の共通」＋各 n/6 を改変なしで連結）
- 生成: OpenAI Images API `images/edits`・モデル **`gpt-image-2.5-sunburst`**・quality high（2026-10-31 に全6点を作り直し。初版は gpt-image-1.5）。参照画像は指示書どおり `mockup_assets.jpg` と該当の `mockup_*.jpg`
- 透過素材（3〜6）は `background=transparent` で生成。シートは API の都合で 1536×1024（パネル枠は 1024×1024）のキャンバスに横並びで出し、`slice_assets.py` で切り出して指示書の寸法に縮小した
- 切り出しは管の光が隣とつながるため、列の判定を不透明度 90 以上で行う
- 1（盤の地）・2（画面の背景）は1回目が NG（1: 紋と枠線を描いた／2: 手とシーシャ台を描いた）のため、「図形を描かない」「手・人物・台を描かない」の一文を足して作り直した。1回目は保存していない
- `screen_backdrop` は 1536×1024 原画を 2560×1440 に拡大＋上下切り（原寸生成ではない）
- `frame_lesson` は中の暗いガラスが残ったため、中央の暗い画素だけ透過に抜いた（顔アイコンを下に敷くため）
- 原画: `board_glass.png`・`screen_backdrop.png`・`raw_*.png`／整形後: `board_glass_1520x976.png`・`screen_backdrop_2560x1440.png`・`hub_*.png`・`*_sheet.png`・`panel_frame.png`／確認: `contact_sheet.png`
- ゲーム用 WebP: `remake/img/ui/growth_board/`（15ファイル・合計 約 530KB）。まだどこからも参照していない（組み込みは第2段・オーナー確認後）
