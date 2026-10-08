---
name: web-build-test
description: 現行 remake/ と共有 data/ の変更後の検証手順。2026-10-07に旧web版を削除し、対象を現行版へ更新。
---

# 現行ブラウザ版の検証

`remake/` はESモジュールでJSONを直接読むため、旧版のバンドル生成・単一HTMLビルドは不要。
台詞を触ったら `python3 tools/lint_dialogue.py`（ERROR=0）と `python3 tools/tidy_dialogue_text.py --dry-run`。
画像を追加・差し替えた場合のみ `python3 remake/tools/build_manifest.py`（Pillow・numpy・scipy）。

```bash
python3 remake/tools/serve_preview.py --port 8123
node remake/test/<name>.mjs
```

Playwrightが必要。`BASE_URL`でURL、`CHROME_EXECUTABLE_PATH`でChromeを指定できるテストがある。
通しテストは `CHROME_BIN`。VMテストは `node --experimental-vm-modules` を付ける。
重いブラウザテストは直列で実行する。環境要因と本物の失敗を分け、失敗したまま完了扱いにしない。

| 変更 | 検証 |
|---|---|
| 第1章の台詞・大会・進行 | `playthrough.mjs`（敗北→再挑戦→優勝も含む） |
| 穴あけ・吸い出しのバランス | `foil_holes.mjs`・`stamina_condition.mjs`・`playthrough.mjs` |
| 任意練習・回復・弾幕操作 | `gameplay_polish.mjs` |
| HUD・通知・体力 | `ui_skin.mjs`・`stat_rewards.mjs`・`stamina_condition.mjs` |
| 選択肢の文字 | `choice_oneline.mjs` |
| キャラの初登場 | `intro_cutin.mjs` |
| 交流の記憶・絆 | `relationship_memories.mjs`・`bonds.mjs` |
| スロットの表示 | `reel_lifecycle.mjs`・`reel_visuals.mjs` |
| データ通信 | `data_loading.mjs` |

テスト用 `window.__remake`（vnTest / craftTest / dev）と `data-test` 属性を維持する。
タイミングゲームは共通 `countdown()` で3・2・1を挟む。
