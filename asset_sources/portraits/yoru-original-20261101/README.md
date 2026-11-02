# 針間ヨル・通常立ち絵（2026-11-02 採用）

Issue #2199 #1。Codex（image_gen）が作った3案（`normal-candidate-v1.png`・`normal-source.png`＝v2・`normal-candidate-v3.png`、各 1086×1448 RGBA）から **v2** を採用。指示文は `generation-prompts.json`、Codex の寸法・SHA-256 は `IMAGE-MANIFEST.json`。

- 採用理由: 3案は顔・服・手指ともほぼ同じ。v2 は左右の端に触れず余白に余裕があり、表情が落ち着いている。手指（ヘッドフォンに触れる右手、ポケットの左手）と41歳らしい顔立ちを原寸で確認。
- 配布用 `assets/sprites/characters/yoru/chr_yoru_normal.png`（896×1200 透過、SHA-256 先頭 566129c4fbb55bf2）: 透過16未満を0、240以上を255にそろえ（人物の不透明部分が253前後でわずかに透けていたため）、人物領域を高さ1170（キャンバスの97.5%）へ縮小し、横は不透明部分の重心で中央、足元を下から12pxに置いた。描き足しはしていない。既存の新規人物（久世・マキ）と同じ置き方。
- 顔アイコン `assets/ui/face_icons/face_yoru.png` は `python3 tools/make_face_icons.py yoru`。目録は `python3 remake/tools/build_manifest.py --portraits-only yoru`。
- 表情差分（smile / serious / surprise / sad）は未着。台詞の smile は normal で代用される。
