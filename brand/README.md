# brand/ — 物語・人物の正本

ゲームの世界観・物語・人物設定の正本を置く。台詞を書く・設定を確認する前にここを読む。

| ファイル | 内容 | 併せて見るデータ |
|---|---|---|
| [story_and_structure.md](story_and_structure.md) | 作品の主題（空・縁起・分人）、舞台の街、第1〜5章の筋、大会と時系列、七人の関係と後日談 | `data/story_routes.json`（正式ヒロイン名簿・後半台本の再生順） |
| [character_profiles.md](character_profiles.md) | 人物の補足設定（年齢・外見・口調・呼称・審査員システム・恋愛描写の方針） | `data/characters.json`（基本情報の正本。サメちゃんは `data/dialogue/samechan.json` の `profile`） |

- 正式タイトルは **「水煙前線 -EN:CODE-」**。旧タイトル「煙の向こう側」「ケムリの向こう側」は使わない。
- 優先順位は、最新のオーナー指示 ＞ `docs/master_spec.md` / `docs/owner_requests.md` ＞ 本フォルダ（人物の基本情報は `data/characters.json` が現行正本）。旧設定資料集 `docs/archive/setting_book/`・`docs/archive/setting_reference.html` は2026-10-31に退避した履歴で、根拠にしない。
- 改稿前の台本は `data/dialogue/_legacy/` に隔離してあり、正史の根拠にしない。
- 矛盾の点検は `.claude/skills/canon-check`、台詞の追加・編集は `.claude/skills/dialogue-edit` を使う。
