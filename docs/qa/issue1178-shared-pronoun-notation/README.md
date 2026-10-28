# #1178 章共通データの一人称・表記チェック

## 判定と対象時点

- 2026-10-28、Antigravity。作業ディレクトリ: `/home/box/repos/worktrees/slot-b1`、branch: `agy/1178-shared-pronoun-20261028`。
- [Issue #1178](https://github.com/haseatsu114514-dot/shisha-game/issues/1178) に基づく「章をまたぐ共通データの一人称・表記チェック（報告のみ、コード修正なし）」の調査報告。
- 第1章分（`docs/qa/issue1178-ch1-pronoun-notation/README.md`）の形式を踏襲し、章専用ファイル（`ch1_*`・`ch2_*`・`ch3_*`・`remake_ch*`）を除く章共通ファイルを対象に精査した。
- 本作業では**台詞・設定・実装ファイルへの変更は一切行わず、本報告ドキュメントのみを作成**している。
- 確信度は「確実＝正本・設定資料・リント基準と明確に矛盾」「要確認＝文脈・演出解釈や他資料との照合判断が必要」に分類した。

### 観点別サマリー

1. **はじめの一人称「俺」、ましろの一人称「僕」**:
   - はじめの一人称「俺」: **該当なし（全件「俺」で正常統一）**。「僕／ぼく／ボク」への戻り・揺れは検出されず。
   - ましろの一人称「僕」: **該当なし（全件「僕」で正常統一）**。他の一人称への逸脱は検出されず。
2. **「アルファーヘブン」表記の揺れ**:
   - **該当なし（確認範囲）**。「アルファヘブン」「アルファーヘヴン」「アルファヘヴン」等の誤表記は検出されず。
3. **キャラ表示名・呼称の旧表記**:
   - **計5件の指摘候補（確実2件、要確認3件）**を記録。
     - カタカナ旧表記「アゲハ」（現行正本「あげは」）が `confession.json` 内に4箇所（確実）。
     - つむぎのはじめに対する呼称異常（呼び捨て「はじめ」かつ断定調）が `trpg_club.json` 内に1箇所（確実）。
     - 凛のはじめに対する呼称揺れ（「はじめくん」）が `confession.json`・`lover_events.json` に各1箇所（要確認）。
     - はじめのあげはに対する呼称（LIME返信選択肢での呼び捨て「あげは」）が `lime_messages.json` に1箇所（要確認）。
     - サメちゃんの口調崩れ（本体の老人語「わし/〜じゃ」の喪失）が `trpg_club.json` に1箇所（要確認）。
   - その他、ひよりの内心における「私/あたし」や、つむぎの一人称「私/わたし」の漢字・平仮名表記差など、第1章報告と同様の参考事項を整理した。

---

## 確認範囲

章専用ファイル（`ch1_*`, `ch2_*`, `ch3_*`, `remake_ch*`）を除外した、以下の章横断・章共通データファイル計18本（約12,700行）を精査した。

| ファイルパス | 行数 | 主な内容・確認範囲 |
|---|---:|---|
| `data/dialogue/confession.json` | 1,332 | 各ヒロイン（つむぎ・みんと・凛・あげは・ひより・ましろ・サメちゃん）への告白・成立・保留会話 |
| `data/dialogue/lover_events.json` | 2,038 | 恋人成立後のLv1〜Lv5親愛イベント会話全件 |
| `data/dialogue/samechan.json` | 1,355 | サメちゃんショップ・交流・好感度イベント会話全件 |
| `data/dialogue/cinema.json` | 215 | 映画館（名画座）での映画鑑賞・デートイベント |
| `data/dialogue/trpg_club.json` | 185 | TRPG同好会結成・勧誘会話 |
| `data/dialogue/trpg_ordinary.json` | 1,650 | 日常系TRPGシナリオセッション会話全編 |
| `data/dialogue/trpg_shark.json` | 1,564 | サメ映画TRPGシナリオセッション会話全編 |
| `data/dialogue/trpg_table_talk.json` | 245 | TRPG卓前後の雑談・休憩会話 |
| `data/dialogue/craft_inner_voice.json` | 125 | 調合・シーシャ制作中のはじめの内心・思考（全30シーン） |
| `data/dialogue/tournament_craft.json` | 479 | 大会用調合・試行錯誤会話全編 |
| `data/dialogue/venue_hours.json` | 259 | 各拠点・店舗の営業時間内外メッセージ |
| `data/dialogue/hiyori.json` | 1,714 | ひより交流・好感度・共通イベント会話全編 |
| `data/dialogue/axe_bar_discovery.json` | 57 | アックスバー発見・噂会話 |
| `data/dialogue/axe_tutorial.json` | 190 | アックススローイングチュートリアル（マキ会話） |
| `data/dialogue/axe_versus.json` | 99 | アックススローイング対戦（ひより戦会話） |
| `remake/data/lover.json` | 1,060 | リメイク版恋人デートスポット・会話・LIME・試合日メッセージ |
| `remake/data/friends.json` | 658 | リメイク版友人関係（友情エンド・非恋人）のLIME・お誘い・ hangouts 会話 |
| `data/lime_messages.json` | 1,316 | 全章共通LIMEメッセージ・返信選択肢・噂メッセージ全件 |

### 照合先正本・資料
- `data/characters.json`（マスターキャラクター定義・ID・表示名・口調ルール）
- `brand/character_profiles.md`（キャラクター公式プロファイル）
- `docs/setting_book/02_characters.md`（一人称・呼称対照表）
- `docs/setting_book/04_glossary.md`（用語集・固有名詞）
- `tools/check_story_canon.py` / `tools/check_mashiro_address.py` / `tools/lint_dialogue.py`（正本検査ルール）

---

## 指摘一覧

| ID | ファイル:行 / シーンキー | 現状抜粋 | 何が問題か（根拠） | 修正案 | 確信度 |
|---|---|---|---|---|---|
| C01 | `data/dialogue/confession.json:471` / `confession_ageha.choices[0].text` | `はい、アゲハさんのものです` | キャラ表示名がカタカナ「アゲハ」になっている。正本 `data/characters.json:626` および `02_characters.md:23` では平仮名「あげは」。`check_story_canon.py:73` でも旧表記として検出対象。 | `はい、あげはさんのものです` | **確実** |
| C02 | `data/dialogue/confession.json:505, 570` / `confession_ageha` (lines[1], lines[8]) | lines[1]: `アゲハは満面の笑みを浮かべたかと思うと…`<br>lines[8]: `アゲハは俺の胸にすり寄るように顔を埋め…` | 地の文におけるキャラ名がカタカナ「アゲハ」になっている。正本表記は平仮名「あげは」。 | lines[1]: `あげはは満面の笑みを…`<br>lines[8]: `あげはは俺の胸に…` | **確実** |
| C03 | `data/dialogue/confession.json:510` / `confession_ageha.lines[3].text` | はじめ「`えっ、ちょ、アゲハさん！？`」 | はじめの台詞内で「アゲハさん」とカタカナになっている。正本表記は「あげはさん」。 | `えっ、ちょ、あげはさん！？` | **確実** |
| C04 | `data/dialogue/trpg_club.json:97` / `trpg_club_joining.lines[19].text` | つむぎ「`……はじめがいるなら、やってみたい。`」 | ①つむぎのはじめに対する呼称は正本 `02_characters.md:13, 65` および `check_story_canon.py:65` で厳格に「はじめさん」と規定されており、呼び捨て（「はじめ」）は明確な逸脱。<br>②文末も「……やってみたい。」と断定調になっており、つむぎの基本敬体（「……やってみたいです」）と不整合。 | `……はじめさんがいるなら、やってみたいです。` | **確実** |
| C05 | `data/dialogue/confession.json:975` / `confession_rin_accept.lines[27].text`<br>`data/dialogue/lover_events.json:983` / `lover_rin_lv2.lines[5].text` | lines[27]: 凛「`……ありがと、はじめくん。これから、よろしくね`」<br>lines[5]: 凛「`はじめくん。今日の試喫、つき合ってくれる？`」 | 凛のはじめに対する呼称は `02_characters.md:15` で「蒸野くん / はじめ」と規定されている。「はじめくん」はみんとの呼称であり、凛の台詞としては揺れまたは他キャラとの混同の可能性が高い。<br>※同 `lover_events.json` の他の恋人イベント（lv1:964, lv3:1049, lv5:1175）では正しく「はじめ」と呼んでいる。 | 恋人関係成立後の親密な呼び方として「はじめ」に統一するか検討。<br>`confession.json:975`: `……ありがと、はじめ。これから、よろしくね`<br>`lover_events.json:983`: `はじめ。今日の試喫、つき合ってくれる？` | **要確認** |
| C06 | `data/lime_messages.json:774` / `rumor_ageha_mashiro.replies[1].text` | はじめの返信選択肢: `あげはの煙も好きだよ` | `02_characters.md:13` ではじめのあげはへの呼称は「あげはさん」。選択肢の短縮表現の可能性もあるが、呼び捨て（「あげは」）になっている。 | `あげはさんの煙も好きだよ` | **要確認** |
| C07 | `data/dialogue/trpg_club.json:86, 91` / `trpg_club_joining.lines[8, 13].text` | lines[8]: サメちゃん「`サメ映画みたいなTRPGもある？ なら入る！`」<br>lines[13]: サメちゃん「`呼んで。やってみたい！`」 | サメちゃん（本体）の口調は `02_characters.md:27` および `data/characters.json:871` で一人称「わし」、語尾「〜じゃ」「〜のじゃ」と定義されている。この2行のみ老人語・ロールプレイ口調が完全に抜け落ち、現代っ子のような口調になっている（TRPGに興奮した演出か口調漏れか）。 | 演出意図を確認の上、キャラ口調に合わせるなら修正案を検討:<br>lines[8]: `サメ映画のようなTRPGもあるのかの？ なら入るのじゃ！`<br>lines[13]: `呼ぶがよい。やってみたいのじゃ！` | **要確認** |

---

## 観点別集計・確認結果

### 観点1: はじめの一人称「俺」、ましろの一人称「僕」
- **はじめの一人称**:
  - 全対象ファイル（`craft_inner_voice.json` 30シーン、`tournament_craft.json`、`confession.json`、`lover_events.json`、`samechan.json`、`trpg_*.json`、`lover.json`、`lime_messages.json` 等）において、はじめの発話・内心・選択肢の一人称は**すべて「俺」**で統一されている。
  - 旧仕様の「僕」や「ぼく／ボク」への戻りは**0件（該当なし）**。
- **ましろの一人称**:
  - `confession.json:633`、`lover_events.json:1383, 1403, 1457, 1467, 1487, 1526, 1546, 1610, 1635`、`remake/data/lover.json:389, 563, 778, 1006, 1010, 1015, 1020, 1025` において、ましろの一人称は**すべて「僕」**で統一されている。
  - 「俺」「私」「ボク」等の逸脱は**0件（該当なし）**。

### 観点2: 「アルファーヘブン」表記の揺れ
- **調査結果**: **該当なし（確認範囲 0件）**
- 「アルファヘブン」「アルファーヘヴン」「アルファヘヴン」等の表記揺れは対象全18ファイルにおいて検出されなかった。
- なお、`data/lime_messages.json:1152, 1176` に登場する『AF グレープ』『AF ローズ』は、Dr.fookah の仕入れ情報における英字略称（Al Fakher / Alpha Heaven 共通の業界通称）であり、誤表記ではない。

### 観点3: キャラ表示名・呼称の旧表記照合
- **調査結果**: **計7箇所（確実4箇所、要確認3箇所）**
  - **確実**:
    - `confession.json` のアゲハ表記（計4箇所: C01〜C03）
    - `trpg_club.json` のつむぎのはじめ呼び捨て（C04）
  - **要確認**:
    - `confession.json` および `lover_events.json` の凛「はじめくん」呼び（C05）
    - `lime_messages.json` のはじめ「あげは」呼び捨て選択肢（C06）
    - `trpg_club.json` のサメちゃん口調崩れ（C07）

---

## 参考事項（表記差・他章報告との整合）

以下の事項は、不具合と断定せず第1章報告（`docs/qa/issue1178-ch1-pronoun-notation/README.md`）の基準と揃えて参考記録とする。

1. **ひよりの内心（inner）における「私」と「あたし」**:
   - `docs/setting_book/02_characters.md:19, 137` では、ひよりは 表「私」/ 心の声「あたし」と規定されている。
   - 今回の共通データ内では、以下の箇所で心の声（`inner`）に「私」が使用されている:
     - `data/dialogue/hiyori.json:240` (`hiyori_preview_gap.lines[4].inner`): `"私の総務窓口"`
     - `data/dialogue/hiyori.json:1586` (`hiyori_bond_question.branches.romance[0].inner`): `"うれしい。今の、ちゃんと私に言ってくれたんだよね"`
     - `remake/data/lover.json:980` (`dates.hiyori.arrive.inner`): `"五分前集合を三十分前に達成。好きすぎだろ私"`
     - `remake/data/lover.json:990` (`dates.hiyori.optA.inner`): `"桃にもキャラ設定を足すな私"`
   - 正本 `data/characters.json:1006` の `speech_rules` では inner の一人称まで固定指定していないため、文脈判断（「あたし」への統一要否）を要する。

2. **つむぎの一人称表記（「私」と「わたし」の混在）**:
   - `data/characters.json:411` および資料集では「私」と定義。
   - 以下の箇所で平仮名「わたし」が使用されている（第1章報告の P04 補助範囲と同種）:
     - `data/dialogue/confession.json:322`
     - `data/dialogue/lover_events.json:99, 150, 170, 221, 292, 314`
     - `data/lime_messages.json:928`
     - `remake/data/lover.json:636`
   - 柔らかさの演出として意図的に平仮名が選ばれている可能性があるため、一括置換は推奨せず現状維持またはディレクション判断とする。

3. **みんとの一人称（「私」と「わたし」）**:
   - `data/lime_messages.json:344` (`encourage_minto`): `"優勝したら、お祝いの一台はわたしに任せて。"`
   - 通常の私生活・裏の顔では漢字「私」が基本（第1章報告 N03 参照）。個人LIMEでの平仮名表記。

---

## 問題なし・指摘に含めなかったもの

- **はじめの台詞・地の文・選択肢**: 全18ファイルで徹底して「俺」が使われており、ブレは一切ない。
- **ましろの台詞**: 告白・恋人イベント・デートシナリオすべてで徹底して「僕」が使われており、ブレは一切ない。
- **スミ・なるの一人称**: 「俺」で統一されている。
- **あげはの一人称**: 「うち」で統一されている。
- **凛の一人称**: 「私」で統一されている。
- **サメちゃんの一人称**: `samechan.json` および `lover.json` では本体「わし」、腹話術「余」で正しく書き分けられている。
- **店舗名・主要固有名詞**: `tonari`, `Dr.fookah`, `KEMURIKUSA`, `EDEN`, `PEPPERMINT` などの英字・片仮名表記は設定資料集と一致。
- **キャラクター表示名**: `data/characters.json` の主要キャストID（sumi, naru, adam, tsumugi, minto, rin, ageha, hiyori, mashiro, samechan, kumicho, nagumo, dr_kemuri 等）は正本通り解決されている。
