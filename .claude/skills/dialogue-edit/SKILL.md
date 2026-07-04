---
name: dialogue-edit
description: 台詞・会話イベント・dialogue JSON（data/dialogue/*.json）・LIMEメッセージ・UI文言などゲーム内テキストを追加・編集するとき必ず使う。改行崩れ（吹き出し溢れ）・報酬キューの誤発火/取りこぼし・旧名/旧設定の混入・話者ID不一致の再発防止チェックリスト。Use when adding or editing any in-game dialogue, event text, or UI strings.
---

# 台詞・イベントテキスト編集チェックリスト

崩れの3大原因は「設定の二重管理」「データ側での改行」「地の文に埋めた報酬」
（CLAUDE.md「矛盾・改行崩れの再発防止ルール」参照）。書く前・書く時・書いた後で潰す。

## 書く前 — 正本だけを参照する

- 固有名詞・設定・呼称は**創作せず正本から写す**。迷ったら CLAUDE.md の正本表を引く。
  - キャラID・表示名・年齢: `data/characters.json`（`jq '.[] | select(.id=="xxx")'` で1件抽出）
  - 章プロット: `brand/story_and_structure.md`（必要な章だけ Grep→部分読み）
  - 大会名・レギュレーション・ステータス名: CLAUDE.md が正
- `speaker` は characters.json の `id` と完全一致（モブは lint_dialogue.py の
  `MOB_SPEAKERS` ホワイトリストのみ）。`face` は9種のみ:
  normal / smile / surprise / sad / serious / smug / wink / evil / excited
- ⚠️ `brand/brand`・`brand/chapter1（character）` 等の旧残骸や `web/js/data.js`（生成物）を
  設定の根拠として**読まない・引用しない**。
- 既存イベントに文体を合わせる: 周囲の台詞と同じ短さ・同じテンションで書く。
  一文を長く・装飾的にしない（改ページ割れの主因）。

## 書く時 — 5つの絶対ルール

1. **1台詞は全角48字以内**（24字×2行）。超えると自動改ページで文が途中で割れる。
   長い説明は台詞を分ける。半角は0.5字換算、`[b]` 等の装飾タグは0字。
2. **手動改行 `\n` を入れない**。改行はコード側 `autoWrap()` に一本化。
3. **報酬の言い回しは規定フレーズを一字一句厳守**（`parseTextCue()` が正規表現で発火する）:
   - `……【技術】と【センス】が上がった。` の形式。
   - 1〜2pt=「少し上がった」／3〜4pt=「上がった」／5pt〜=「大きく上がった」
   - 確実に付けたい報酬は地の文頼みにせず `type:"apply"` か metadata で明示する。
   - 逆に、報酬目的でない地の文にステ名＋「上がった」を偶然並べない（誤発火する）。
4. **全イベントに必ず報酬**（ステUP or アイテム。好感度が上がらないイベントでも）。
5. **日数・回数はハードコードしない**。残り日数は `{daysLeft}`（`interpolate()` 経由）。

文化・世界観の落とし穴（詳細は CLAUDE.md）:
チップ描写禁止／はじめはブロンドリーフのみ／蒸らしは0・3・5・8・10分制／
炭はトライアングル基本／「シガー」=シガーリーフシーシャ／
ましろの呼称は「ましろちゃん」／数値ステータスをUIや台詞に出さない（★と抽象語のみ）。

## 書いた後 — コミット前セルフチェック（必須・全部）

```bash
python3 tools/lint_dialogue.py <触ったファイル名の一部>   # ERROR=0 必須。WARNも新規では出さない
python3 -m json.tool data/dialogue/<触ったファイル> >/dev/null
python3 web/build_data.py && python3 web/build_standalone.py   # ビルドしないと web に反映されない
```

- 新規 JSON を追加した場合は `web/build_data.py` の読み込み一覧に登録しないとバンドルされない。
- 台詞以外のファイル（`lime_messages.json` 等）に同じ症状・同じ旧表現が残っていないか
  横断 grep する（owner-request スキル Step 4）。
- 表示確認が必要なら `web/tools/linebreak_editor.html`、通しは web-build-test スキルの対応表で。
