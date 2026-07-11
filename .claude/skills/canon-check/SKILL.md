---
name: canon-check
description: ストーリー矛盾・設定齟齬・旧名/旧設定の残存・呼称ブレの点検やレビューを頼まれたとき、または設定に関わる文章（新イベント・新キャラ・ドキュメント）を書く前に使う。正本の特定・読む範囲の限定・偽の矛盾の回避。Use when reviewing for story contradictions, checking canon consistency, or before writing anything that touches game lore/settings.
---

# 矛盾・正史チェック

## 原則: 読む範囲を先に決める（偽の矛盾とトークン浪費の防止）

必ず `docs/review_scope.md` の範囲に従う。要点:

- **読む**: `data/dialogue/**`・`data/*.json`・`brand/story_and_structure.md`・
  `brand/character_profiles.md`・（必要時のみ）`web/js/game.js`・`docs/master_spec.md`
- **読まない**: `web/js/data.js`（生成物）・`web/dist/**`（ビルド成果物）・
  `web/lib/**`（外部ライブラリ）・`assets/**`
- ⚠️ 正本に見えて**旧設定の残骸**であるファイルは根拠にしない。brand/docs 内に
  旧タイトル「煙の向こう側」等が残存することがある。**矛盾したら CLAUDE.md が正**。

## 自動チェックを先に走らせる

目視の前に機械で拾う。手で grep を書き始める前にまずこの2本:

```bash
python3 tools/lint_dialogue.py        # 台詞JSON: 旧名・未登録speaker・改行・報酬キュー
python3 tools/check_legacy_terms.py   # コード・設定文書全般の旧名残存（--fix で安全な置換）
python3 tools/check_char_consistency.py 2>/dev/null; python3 tools/check_speakers.py 2>/dev/null
```

## 事実ごとの「正本」

各事実の正本は **CLAUDE.md「設定の一元管理（Single Source of Truth）」の表**が定義する。
チェック時の判定手順:

1. 疑わしい記述を見つけたら、まずその事実の正本を表で特定する。
2. 正本と一致していれば矛盾ではない（二次資料側が古いだけ→二次資料を直すか「→参照」化）。
3. 正本同士が食い違う場合のみ本物の矛盾。**CLAUDE.md > characters.json/dialogue >
   brand/docs** の優先順で扱い、判断が設定変更を伴うならオーナーに確認する。

## 目視チェックの頻出観点

- **呼称ブレ**: 呼び方はキャラ関係の正本（characters.json＋character_profiles.md）に合わせる。
  既知の固定: はじめ→ましろは「ましろちゃん」。スミさんははじめを「はじめ」と呼ぶ。
- **時系列・日数**: 台詞に日数を直書きしていないか（`{daysLeft}` に一本化）。
  「来週」「明日」等の相対表現が14日制と矛盾しないか。
- **章レギュレーション・大会名**: CLAUDE.md「大会名・大会システム」節と照合。
- **ネタバレ管理**: ch1でみんと=お姉さんの正体を明かさない／「-EN:CODE-」の意味はch5まで
  説明しない／ch1優勝を「実力で勝った」と書かない、などの**開示タイミング**の違反を見る。
- **主人公の性格**: 「自信がない謙虚」（旧）も「直球でイキる」（過渡期）も NG。
  薄い夢のテルは1シーン1回・内心モノローグで。恋愛イベントでは薄さを出さない。

## 報告のフォーマット

見つけた矛盾は次の3点セットで報告する（修正まで頼まれていない場合は報告で止める）:

1. **現物**: どのファイルの何行目に何と書いてあるか
2. **正本**: どの正本の何と食い違うか
3. **修正先**: どちらを直すべきか（原則: 二次資料側。正本を直す提案はオーナー確認）

修正する場合は dialogue-edit / owner-request スキルのフローに乗せ、
最後に自動チェック2本を再実行して 0 件を確認する。
