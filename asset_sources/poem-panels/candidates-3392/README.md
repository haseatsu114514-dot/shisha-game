# 巻頭ポエムのコマ絵の候補（新しい詩 R1-2・R2-7・R3-6・R4-6 に合わせたもの・#3392）

Codex が #3392 の依頼文で、第1〜4章の7コマを計12回生成した候補一式（第5章の2本はチャコール博士・SHISHA-9000 の扱いの確認待ちで未生成）。原画は無加工。

## オーナーの決定（2026-11-12）

| 章 | 決定 | 使った原画 | 本編の絵 |
|---|---|---|---|
| 第1章 | **B2「開店前の三つ」2回目を採用** | `raw/poem_ch1_r1_2b-attempt2.png` | `remake/img/ui/poems/poem_ch1.webp`（1424×356・4:1） |
| 第2章 | **「壁一枚」を採用** | `raw/poem_ch2_r2_7-attempt1.png` | `remake/img/ui/poems/poem_ch2.webp`（1424×356・4:1） |
| 第3章 | **今の絵のまま**（候補は使わない） | — | 変更なし |
| 第4章 | **B1「窓の海」1回目を採用** | `raw/poem_ch4_r4_6b-attempt1.png` | `remake/img/ui/poems/poem_ch4.webp`（1424×319・4.46:1） |
| 第5章 | 候補なし（保留） | — | 変更なし |

本編の絵は `python3 tools/poem_panel_cut.py cut <原画> --id poem_chN --out-dir remake/img/ui/poems` で枠の中を切り出した。第1章・第2章は枠が縦に伸びていたので、ツールが上下を中央で少し切って 4:1 にそろえた。

## 使わなかった候補と理由

- 第1章 A「待ち合わせ」（2回とも）: シーシャ台の作りがおかしい（HMD の下のハガルと脚が読めず、皿に直置きに見える）。`docs/shisha_reference.md` §4 の生成後チェックで不合格。
- 第1章 B1「開店前の三つ」1回目: 炭が4個（指定は3個）。
- 第3章 A1「空けた席」1回目: 缶を持つ手が客側に見えている（依頼と違う）。A2・B はオーナーが今の絵を選んだので使わない。
- 第4章 A「海と一台」・B2・B3「窓の海」: オーナーが B1 を選んだ。B3 は帽子とケースが枠に接して切れる。

## Codex の「厳密には未達」について

枠の外の紙色のムラと枠の数px〜約100pxのずれは、正式ツールが枠の中だけを切り出して比率を整えるので本編には出ない。比率・幅・容量は `python3 tools/poem_panel_cut.py check` と `remake/test/chapter_poems.mjs` で確かめた。

## 中身

| 場所 | 中身 |
|---|---|
| `raw/` | 無加工の原画12枚（1536×1024）。SHA-256 は `ORIGINAL-SHA256SUMS.txt`・`INDEX.json` |
| `source-prompts/` | オーナーが指定した依頼文（7本） |
| `generation-prompts/` | 実際に入力した全文（12本） |
| `qa/` | Codex の検品（`QA-details.md`・計測・参照の照合）、正式ツールで切り出した見本（`cut-previews/`）、章ごとの比較（`poem_chN_choices.jpg`） |
| `codex-handoff.md` | Codex の引き継ぎメモ（原文のまま） |
