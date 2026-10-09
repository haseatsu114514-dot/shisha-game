---
name: web-build-test
description: 現行 remake/ と共有 data/ の変更後の検証手順。2026-10-07に旧web版を削除し、対象を現行版へ更新。
---

# 現行ブラウザ版の検証

`remake/` はESモジュールでJSONを直接読むため、旧版のバンドル生成・単一HTMLビルドは不要。
台詞を触ったら `python3 tools/lint_dialogue.py`（ERROR=0）と `python3 tools/tidy_dialogue_text.py --dry-run`。
画像を追加・差し替えた場合のみ `python3 remake/tools/build_manifest.py`（Pillow・numpy・scipy）。

**2026-10-09 オーナー指示（TEST01）：検証は変更した該当箇所を基本にする。**
下の表はテストの候補であり、並んだものをすべて実行するチェックリストではない。
BGMは再生・切替・音量、表示は変更画面、ミニゲームは変更工程に必要な確認だけを選ぶ。
通しテストは全体の進行・セーブ互換への広い影響、局所確認で切り分けられない不具合、またはオーナーの明示依頼がある場合だけにする。
必要な理由を短く伝えてから実行し、同じ変更で確認済みなら追加変更・失敗・未解決の懸念なしに繰り返さない。複数チャットでの重複も避ける。

```bash
python3 remake/tools/serve_preview.py --port 8123
node remake/test/<name>.mjs
```

Playwrightが必要。`BASE_URL`でURL、`CHROME_EXECUTABLE_PATH`でChromeを指定できるテストがある。
通しテストは `CHROME_BIN`。VMテストは `node --experimental-vm-modules` を付ける。
重いブラウザテストは直列で実行する。環境要因と本物の失敗を分け、失敗したまま完了扱いにしない。

| 変更 | 検証 |
|---|---|
| BGMの追加・音量・切替 | 変更場面の再生確認。必要に応じ `bgm_gain.mjs`・`bgm_packaged.mjs`・`bgm_browser.mjs` |
| 第1章の台詞・大会・進行 | 変更場面の起動・遷移。全体進行の確認が必要な場合だけ `playthrough.mjs`（敗北→再挑戦→優勝） |
| 穴あけ・吸い出しのバランス | 変更工程と、必要に応じ `foil_holes.mjs`・`stamina_condition.mjs` |
| 任意練習・回復・弾幕操作 | `gameplay_polish.mjs` |
| 制作UI・見守る人物・キッチンタイマー・蒸らし温度・集中による吸い出し難易度 | 変更画面・工程。必要に応じ `craft_focus.mjs`・`steam_refresh.mjs`・`stamina_condition.mjs` |
| HUD・通知・体力 | `ui_skin.mjs`・`stat_rewards.mjs`・`stamina_condition.mjs` |
| 選択肢の文字 | `choice_oneline.mjs` |
| 台詞の組版（改行・改ページ）・`vn/text.js` | `text_wrap.mjs`（ブラウザ不要・全台詞を検査） |
| キャラの初登場 | `intro_cutin.mjs` |
| 交流の記憶・絆 | `relationship_memories.mjs`・`bonds.mjs` |
| スロットの表示 | `reel_lifecycle.mjs`・`reel_visuals.mjs` |
| データ通信 | `data_loading.mjs` |

テスト用 `window.__remake`（vnTest / craftTest / dev）と `data-test` 属性を維持する。
タイミングゲームは共通 `countdown()` で3・2・1を挟む。
