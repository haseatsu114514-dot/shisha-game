# 立ち絵シートの置き場（sheets_inbox）

ユーザー（オーナー）が生成した立ち絵シートをここにアップすると、
Claude が次のセッションで自動取り込みします。

## アップの手順（GitHub ウェブが一番確実）

1. GitHub でこのリポジトリを開く → 作業中ブランチに切り替え
2. `assets/sheets_inbox/` を開いて **Add file → Upload files**
3. ファイル名を **`sheet_{キャラid}.png`** にしてコミット
   - 例: `sheet_ageha.png` / `sheet_rin.png` / `sheet_rei.png`
   - キャラidは CLAUDE.md の「キャラクター ID 早見表」と一致させること

※ チャットに画像を貼っても**ファイルとしては届かない**ので、
　必ずこのフォルダへのアップロードで渡すこと（過去のロゴと同じ運用）。

## シートの仕様

- **横に5表情ならび・全身・単色背景**（青 / 緑 / マゼンタ どれでも可。クロマキーで自動透過）
- 表情の**並び順は自由**。取り込み時に `--names` で対応づける
  - 使える表情名: `normal / smile / surprise / sad / serious / smug / wink / evil / excited`（＋みんと私服用の `ura_*`）
- 等幅でなくてもOK（透過後の隙間で自動分割される）

## 取り込みコマンド（Claude 側の作業メモ）

```bash
# 例: あげは（並びが 普通・笑顔・むくれ・驚き・泣き の場合）
python3 tools/split_sheet.py assets/sheets_inbox/sheet_ageha.png \
  --char ageha --names normal,smile,serious,surprise,sad

python3 tools/make_face_icons.py      # 顔ドット絵アイコン再生成
python3 web/build_data.py && python3 web/build_standalone.py
```

取り込み後のチェックリスト:
- [ ] そのキャラを `web/js/engine.js` の `BG_FULL_PORTRAITS` から**外す**
      （切り抜き素材になったため。残すと小さくマスク表示されてしまう）
- [ ] テスト3本（playthrough / ch2 / screenshots）を回す
- [ ] 取り込み済みシートは `assets/sheets_inbox/` から削除（リポジトリ肥大防止）
