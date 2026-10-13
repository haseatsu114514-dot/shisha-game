# #531 冒頭の調理・接客カット

[画面一覧](index.html)／[冒頭だけ再生](../../../remake/opening-preview.html)／[PR #532](https://github.com/haseatsu114514-dot/shisha-game/pull/532)

PC 1280×720 と横持ちタッチ 844×390で、実際の台本を通常送りして撮影。画像は本編と同じ演出・本文枠によるもの。撮影のために初登場カードは既読にしている。カードと進行・保存の確認は別途NEW GAMEから実施した。

| 炭の手元 | ボウル |
| --- | --- |
| ![炭を扱う手元](desktop-coal.png) | ![葉をほぐして詰める](desktop-bowl.png) |
| 常連の手元 | 退店後の席 |
| ![ホースの持ち手を置く](desktop-hose.png) | ![空いた席](desktop-empty.png) |

![ランプと薄い煙](desktop-lamps.png)

![横持ちスマホの本文と手元](touch-hose.png)

## 確認内容

- 専用ブラウザ5ケース：PCのEnter送り、スマホのタップ送り、全カットの順序と通常店内への復帰、本文枠・操作ボタンの収まり、SKIP、動きを減らす設定、中断と次会話のフック復元、画像デコード失敗時の代替表示、プレビュー再生／終了／再生し直しとAUTO送り、既存セーブ・手動スロット・sessionStorageの非干渉。
- `ch1_opening_resume.mjs` の `new-game-first-scene-save-replays-opening`：NEW GAME直後の保存→再読込→冒頭→必須接客→日常への到達と保存を確認。
- 対象台本lint ERROR 0。`ch1_main` WARN 6／`ch1_sumi` WARN 7／`ch1_bonds` WARN 0は変更前と同じ。整形dry-runは変更範囲外の既存oneesan 1行のみ。
- 本文組版6292テキスト、変更JSONの読込、JS構文、差分空白検査。分岐・選択肢・報酬と後続イベントは保持。素材目録は新規1枚の追加のみで、既存項目の脱落なし。
- mainの大会会場設定 PR #529 を統合。要望台帳の両方の記録を保持し、大会の行き先変更と冒頭の呼出変更を共存させた。

再実行:

```sh
python3 remake/tools/serve_preview.py --port 8123
node remake/test/browser/tonari_opening.mjs
TEST_CASES=new-game-first-scene-save-replays-opening node remake/test/browser/ch1_opening_resume.mjs
node remake/test/text_wrap.mjs
```

この環境では `CHROME_EXECUTABLE_PATH=/usr/bin/chromium` を使用。CIにも専用5ケースを登録。全章通しプレイや全ブラウザの保証はこの変更の検証範囲に含めない。
