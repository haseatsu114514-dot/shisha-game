# 登場カットインのグラフィック絵柄（2026-10-31 試作）

目を髪で隠した、色数を絞った平面ポスター調の人物絵。設定「登場カットインの絵柄」で旧（立ち絵）へいつでも戻せる。

- `owner_originals/` オーナー作成の原画（黒背景）。合格: サメちゃん・あげは(v1は上が切れるため作り直し)・りん。パッキー・ひより・なる・スミさん・はじめは背景だけ塗り替えて使用。
- `portraits/` 生成した原画（切り抜き用のマゼンタ背景、ひよりのみ緑）。モデル gpt-image-2.5-sunburst。
  - 指示文: `portrait_prompt.txt`（BGCOLOR を背景色に置換）＋ `characters.tsv` の人物欄。画風見本はサメちゃん・あげは(v1)・りんの原画、人物見本は現行の normal 立ち絵。
  - 年齢・体型を厳守させる文、目元を「黒い帯」にしない文を入れる。お姉さんはみんとと別のポーズ・配色にする（正体を伏せる）。
- `backgrounds/` 背景の描き直し（mashiro / nagumo ほか初期の試作）。指示文 `background_prompt.txt`。
- `chatgpt-20261031/` オーナーが ChatGPT で作った作り直し分（人物10・背景22、#2144）。採用した案は `picks.json`。これで全24人の人物と背景がそろった。
- 切り抜き: `python3 key_background.py <原画> <出力.png> m|g`（m=マゼンタ, g=緑）。黒背景の原画は外周からつながる黒だけを抜く。
- 採用素材: `remake/img/ui/character_intros/graphic/<id>.webp`（1024×1024・透過）、`bg_<id>.webp`（1672×941）。一覧は `remake/js/vn/intro-graphic.js`。

SHISHA-9000 は正式normalの立ち絵を優先し、ゲームではこのフォルダ由来の専用人物絵に切り替えない。顔の参照元は `assets/sprites/characters/shisha_9000/chr_shisha_9000_normal.png`。独立したシアンと紫の二眼を維持し、目を髪で隠す共通指示は適用しない。既存の原画と配置記録は制作履歴として残す。

## 差し替え手順（ポーズ違いなど・Codex 向け）

1. 原画を用意する。正方形・人物は胸〜腰から上・**背景は人物に使わない単色（マゼンタ #FF00FF か鮮やかなピンク／緑）**。黒背景は髪や服と区別できないので不可。目は髪で隠す。画風の見本は `owner_originals/samechan.png`・`ageha_v1.png`・`rin.png`、指示文は `portrait_prompt.txt`。
2. リポジトリ直下で `python3 tools/intro_graphic_import.py <id> <原画.png>` を実行する（背景なら `--background`）。
   - 背景色は外周から自動で読み取って抜き、上の隙間が出ないよう切り出し、`remake/img/ui/character_intros/graphic/<id>.webp` を上書きする。
   - 原画・確認画像（緑の上に重ねたもの）・記録は `replacements/<日付>/` に保存される。「左／右の端で切れています」の警告が出たら、引いた構図で描き直す。
   - 先に見るだけなら `--dry-run`。
3. 人物を差し替えたら、`heads.json` のその人物の `[頭頂のy, 顎のy, 顔の中心のx]`（ゲーム用 webp 1024×1024 上の値。頭頂は髪の量・帽子・フードを除いた頭の上端）を測り直し、`python3 tools/intro_graphic_frames.py` を実行する。全員の頭がほぼ同じ大きさ（画面で約280px）になる配置が `intro-graphic.js` の `FRAME_OVERRIDES` に書き出される（2026-11-02 オーナー「みんな似たような拡大率で」）。手で直さない。パッキーは全身で見せるので対象外。
4. 確認: `node remake/test/intro_cutin.mjs`（`SHOTS=<フォルダ>` で全員の画面を保存）。新しいキャラを足すときは `PORTRAITS` にIDを足してから。
