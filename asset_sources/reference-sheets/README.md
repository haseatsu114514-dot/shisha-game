# キャラ リファレンスシート

現行の立ち絵（`assets/sprites/characters/`）と `data/characters.json` から自動生成した一覧シート。新規の画像生成はしない。
顔アップ・表情は160pxの顔アイコンではなく、立ち絵から原寸で切り出す。

- 再生成: `python3 tools/make_reference_sheet.py`（全員）／`python3 tools/make_reference_sheet.py rin`（1人）
- 立ち絵を差し替えたら再生成する。デザインの要点・メモは `tools/make_reference_sheet.py` の `CHARS` に手書き
- 基調色はみんと以外が自動抽出（目安）。みんとだけ部位ごとに実測した色を使用
- 対象: minto（営業姿・私服）, adam, ageha, dr_kemuri, hajime, kafuka（サメちゃん）, maezono, mashiro, nagumo, naru, pakki, rin, sumi, tsumugi
