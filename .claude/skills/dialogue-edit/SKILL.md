---
name: dialogue-edit
description: 台詞・会話イベント・dialogue JSON（data/dialogue/*.json）・LIMEメッセージ・UI文言などゲーム内テキストを追加・編集するとき必ず使う。改行崩れ（吹き出し溢れ）・報酬キューの誤発火/取りこぼし・旧名/旧設定の混入・話者ID不一致の再発防止チェックリスト。Use when adding or editing any in-game dialogue, event text, or UI strings.
---

# 台詞・イベントテキスト編集チェックリスト

崩れの3大原因は「設定の二重管理」「データ側での改行」「地の文に埋めた報酬」
（docs/gameplay_agent_reference.md「矛盾・改行崩れの再発防止ルール」参照）。書く前・書く時・書いた後で潰す。
句読点（台詞末尾に「。」を付けない等）と改行・改ページの見た目の規範は **text-style スキルが正本**。
テキストを書いたら `python3 tools/tidy_dialogue_text.py --dry-run` も通すこと。

## 書く前 — 正本だけを参照する

- 固有名詞・設定・呼称は**創作せず正本から写す**。迷ったら docs/gameplay_agent_reference.md の正本表を引く。
  - キャラID・表示名・年齢: `data/characters.json`（`jq '.[] | select(.id=="xxx")'` で1件抽出）
  - 章プロット: `brand/story_and_structure.md`（必要な章だけ Grep→部分読み）
  - 大会名・レギュレーション・ステータス名: docs/gameplay_agent_reference.md が正
- `speaker` は characters.json の `id` と完全一致（モブは lint_dialogue.py の
  `MOB_SPEAKERS` ホワイトリストのみ）。`face` はそのキャラに実在する表情だけ
  （`ls assets/sprites/characters/<id>/` の `chr_<id>_<face>.png`。基本は normal / smile / surprise / sad / serious、
  キャラにより smug / wink / evil / excited / thinking / bow などの追加分がある。無い表情を指定しない）
- ⚠️ `brand/brand`・`brand/chapter1（character）` 等の旧残骸や生成物を
  設定の根拠として**読まない・引用しない**。
- 既存イベントに文体を合わせる: 周囲の台詞と同じ短さ・同じテンションで書く。
  一文を長く・装飾的にしない（改ページ割れの主因）。

## 書く時 — 5つの絶対ルール

1. **1台詞は全角48字以内**（24字×2行）。超えると自動改ページで文が途中で割れる。
   長い説明は台詞を分ける。半角は0.5字換算、`[b]` 等の装飾タグは0字。
   **選択肢は1行・全角26字以内**（会話の選択肢・バイトの対応・恋人の会話の optA/optB。2026-10-04 GUI22）。
   LIMEの返信ボタンは枠が狭く全角19字まで（誘いに乗る返事は「（行動を1回使う）」が付く）。
   `lint_dialogue.py` が26字超をERRORにし、`remake/test/choice_oneline.mjs` が実際の書体で測る。
2. **手動改行 `\n` を入れない**。改行はコード側 `autoWrap()` に一本化。一文を2つの吹き出しにまたがせない（心の声は各行を（）で閉じる）。
3. **報酬の言い回しは規定フレーズを一字一句厳守**（`parseTextCue()` が正規表現で発火する）:
   - `……【技術】と【センス】が上がった。` の形式。
   - 1〜2pt=「少し上がった」／3〜4pt=「上がった」／5〜7pt=「かなり上がった」／8pt〜=「大きく上がった」（N20の4段階）
   - 確実に付けたい報酬は地の文頼みにせず `type:"apply"` か metadata で明示する。
   - 逆に、報酬目的でない地の文にステ名＋「上がった」を偶然並べない（誤発火する）。
4. **リメイク版の能力報酬は、自由に選び実際に体力を使った行動だけ**。強制イベント・チュートリアル・無料会話・休養には付けない（2026-10-08 UX12/13、docs/gameplay_agent_reference.md）。能力の増加文は画面に出さず通知の `+Npt` と進化・恩恵で伝える。既存キューは互換データとして読み、好感度の文は保持する。
5. **日数・回数はハードコードしない**。残り日数は `{daysLeft}`（`interpolate()` 経由）。

文化・世界観の落とし穴（詳細は docs/gameplay_agent_reference.md、シーシャの工程・機材・用語の参照先一覧は docs/shisha_reference.md）:
水の役割は「煙を冷やす」だけ・有害物質は「諸説ある」で断定しない・爆煙はグリセリンと熱（K14）／HMD・タヌキッシュリッド・ハガルの表記／実在ブランド名を出さない／
チップ描写禁止／はじめはブロンドリーフのみ／蒸らしはキッチンタイマーで10秒単位の自由設定（基本5〜8分。2026-10-08改定）／
炭はトライアングル基本／「シガー」=シガーリーフシーシャ／
ましろの呼称は「ましろちゃん」／ステの今の強さ（0〜100）をUIや台詞に出さない（★とレーダー。能力アップ通知の `+Npt` は通知カードが自動で出すので台詞には書かない）。

## 書いた後 — コミット前セルフチェック（必須・全部）

```bash
python3 tools/lint_dialogue.py <触ったファイル名の一部>   # ERROR=0 必須。WARNも新規では出さない
python3 -m json.tool data/dialogue/<触ったファイル> >/dev/null
# 現行版はJSONを直接読むため、保存後にブラウザを再読み込みすれば反映
```

- 新規 JSON を追加した場合は `remake/js/core/data.js` の読み込み一覧に登録する。
- 台詞以外のファイル（`lime_messages.json` 等）に同じ症状・同じ旧表現が残っていないか
  横断 grep する（owner-request スキル Step 4）。
- 表示確認が必要なら `python3 tools/text_editor_server.py`、通しは web-build-test スキルの対応表で。
