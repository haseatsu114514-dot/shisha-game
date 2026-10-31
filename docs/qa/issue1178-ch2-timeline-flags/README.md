# Issue #1178 第2章の時系列・フラグ・正本設定・シーシャ知識方針チェック報告書

> **失効注記（2026-10-31）**: 本書は廃止済みの `docs/setting_book/`（現 `docs/archive/setting_book/`、#2011で退避）を正本として判定している。あげはの「読者モデル」、REIの代表曲「イエス」「月光花」「嘘」を「旧設定」とした判定は**失効**。現行の正本は `data/characters.json` と `brand/`。本書の判定を根拠に台詞・データを直さないこと。

## 概要

- **対象タスク**: Issue #1178 第2章の時系列・フラグ・正本設定・シーシャ知識方針チェック（報告のみ、コード修正なし）
- **作業ブランチ**: `agy/1178-ch2-timeline-flags-20261028`
- **対象ファイル**:
  - `data/dialogue/ch2_*.json`（`ch2_main.json`, `ch2_city.json`, `ch2_deliveries.json`, `ch2_preparation.json`, `ch2_ageha_story.json`, `ch2_isolation.json`, `ch2_choice_echoes.json`, `ch2_tournament.json`, `ch2_city_guests.json`, `ch2_kumicho.json`, `ch2_rei.json`）
  - `data/dialogue/remake_ch2.json`
  - `remake/js/chapters/ch2*.js`（`ch2.js`, `ch2-city-data.js`, `ch2-commute.js`, `ch2-deliveries.js`, `ch2-outings.js`, `ch2-preparation.js`, `ch2-preview.js`, `ch2-progress.js`, `ch2-purikura.js`, `ch2-story.js`, `ch2-story-data.js`, `ch2-tournament.js`, `ch2-tournament-state.js`）
  - `data/lime_messages.json`（第2章関連メッセージ）
- **照合正本**:
  - `docs/master_spec.md`
  - `docs/setting_book/01_story.md` 〜 `06_flavors_recipes.md`, `docs/setting_book/HANDOVER.md`
  - `brand/story_and_structure.md`, `brand/character_profiles.md`
  - `data/characters.json`
- **前提条件**:
  - 第2章の一人称・表記は `docs/qa/issue1178-ch2-pronoun-notation/README.md` で調査済みのため対象外。
  - 神崎（kumicho）の台詞は別作業で口調を全面的に直すため、口調には触れず事実・時系列のみを点検。

---

## サマリー

| 観点 | 確実 | 要確認 | 合計 | 備考 |
| --- | ---: | ---: | ---: | --- |
| 1. 時系列・日数・予定の矛盾 | 2件 | 0件 | 2件 | 神崎2回目訪問の「昨日」固定表現、第2章LIME 2件の日数判定不発 |
| 2. 好感度・フラグ・既読管理と台詞の整合 | 1件 | 1件 | 2件 | 噂LIME 2件の判定条件不発、初対面分岐の面識フラグ付与漏れ |
| 3. 正本設定（master_spec / setting_book）との矛盾 | 3件 | 2件 | 5件 | あげはの読者モデル旧設定（台本＋LIME）、REIのバンドマン・ステージ演者描写、REIの実在曲名ミックス、神崎の大会前「組長」地の文・若衆発言、神崎のフルネーム表示 |
| 4. シーシャ知識の記述方針（有害物質・実店舗運用・疑似精密数字） | 1件 | 0件 | 1件 | 疑似精密数字「炭が一ミリもズレない」の断定描写（有害物質・実店舗運用は違反0件） |
| **合計** | **7件** | **3件** | **10件** | |

---

## 観点1: 時系列・日数・予定の矛盾

DAY 番号、「昨日」「明日」などの相対表現、予定の重複を点検した。

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-TF-01 | `data/dialogue/ch2_kumicho.json:196` (`ch2_kumicho_second`) | `"speaker": "hajime"`<br>`"text": "昨日のドラゴンフルーツ、ずっと頭に残ってて"` | 神崎煙草店への訪問はプレイヤーの自由行動（DAY 2以降に任意で訪問）であり、初回訪問（`ch2_kumicho_first`）の翌日に2回目（`ch2_kumicho_second`）を訪れるとは限らない（数日後や大会後に訪れる場合もある）。「昨日」と固定すると訪問タイミングによって時系列が矛盾する。 | `"この前のドラゴンフルーツ、ずっと頭に残ってて"` など日時に依存しない相対表現に変更する。 | 確実 |
| CH2-TF-02 | `data/lime_messages.json:365-401, 476-512` (`lime_ageha_day3`, `lime_ageha_day5`) | `lime_ageha_day3`: `"trigger_day": 3`, `"trigger_condition": "lime_exchanged"`（`"chapter": 2` なし）<br>`lime_ageha_day5`: `"trigger_day": 5`, `"trigger_condition": "lime_exchanged"`（`"chapter": 2` なし） | `remake/js/daily/phone.js:203` の `const day = m.chapter ? chapterDay(state) : state.day;` により、`"chapter": 2` が指定されていないため通算日数 `state.day`（第2章開始時は通算DAY 15または8）で判定される。第2章のDAY 3やDAY 5に届くことはなく、また第1章では `phone.js:191` であげはが除外されるため、この2件は永久に受信できない。 | `"chapter": 2` を付与するか、すでに同ファイル1248行以降にある第2章専用の `lime_ageha_ch2_goodday`（DAY 4） / `lime_ageha_ch2_badday`（DAY 7）に整理統合する。 | 確実 |

---

## 観点2: 好感度・フラグ・既読管理と台詞の整合

条件なしで既読前提の台詞、未会話の相手を知っている台詞、フラグ不発などを点検した。

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-TF-03 | `data/lime_messages.json:568-609, 659-705` (`rumor_kumicho_cigarman`, `rumor_kemuri_experiments`) | `rumor_kumicho_cigarman`: `"trigger_condition": "ch2_started"`, `"trigger_day": 6`, `"chapter": 2`<br>`rumor_kemuri_experiments`: `"trigger_condition": "ch2_started"`, `"trigger_day": 3`, `"chapter": 2` | `remake/js/daily/phone.js:188-209` の `eligible()` に `ch2_started` を処理する分岐が存在しない（`tournament_day`, `hiyori_tonari`, `story_count`, `lime_exchanged`, `affinity_level`, `flag` のみ）。このため常に `false` と判定され、第2章の噂LIME（DAY 6の神崎からのシガーマンの噂、DAY 3のなるからのチャコール博士の実験の噂）が配信されない。 | `phone.js` の `eligible()` に `cond === "ch2_started"` （`state.chapter >= 2`）の判定を追加するか、`trigger_condition` を `"lime_exchanged"` や `"flag"`（`_ch2_preparation_started`）に変更する。 | 確実 |
| CH2-TF-04 | `data/dialogue/ch2_kumicho.json:109-177` (`ch2_kumicho_first`)<br>`data/dialogue/ch2_rei.json:191-250` (`ch2_rei_first`) | `ch2_kumicho_first` の `first_meeting` 分岐内<br>`ch2_rei_first` の `first_meeting` 分岐内 | `ch2_city.json`（`ch2_city_kumicho`, `ch2_city_rei`）では初対面時に `set_flag` で `_met_kumicho` / `_met_rei` を設定しているが、`ch2_kumicho.json` / `ch2_rei.json` 内の `first_meeting` 分岐では `set_flag` が記述されていない。単体でこの会話を通過した場合に面識フラグが立たない恐れがある（現行の `remake/js/chapters/ch2-preparation.js` では事前に `ch2_city_${id}` を呼ぶため実害は抑えられているが、台本データとしての整合性が欠けている）。 | `first_meeting` 分岐内に `{"type": "set_flag", "flag": "_met_kumicho"}` / `{"type": "set_flag", "flag": "_met_rei"}` を明示的に追加する。 | 要確認 |

---

## 観点3: docs/master_spec.md・docs/setting_book/ の正本設定との矛盾

正本設定（ストーリー・キャラクター・世界観・大会規則）との整合性を点検した。

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-TF-05 | `data/lime_messages.json:419, 439` (`lime_ageha_model_reveal`)<br>`data/dialogue/ch2_ageha_story.json:526, 587` (`remake_ch2_ageha_magazine`) | `lime_messages.json:419`: `"友達に頼まれてノリで応募したら受かっちゃってさ。読者モデルってやつ"`<br>`lime_messages.json:439`: `"ギャル系のストリート系ファッション誌！ 読者モデルだからプロのモデルとは違うけどね。"`<br>`ch2_ageha_story.json:526`: `"あの、読モのあげはちゃんですよね？"`<br>`ch2_ageha_story.json:587`: `"職人として見てほしいから。雑誌に載ったのも、ノリだったし"` | 正本（`docs/setting_book/02_characters.md:258`, `brand/character_profiles.md:249`）では、あげはは「渋谷センター街でスカウトされ、『GALA STREET』の専属モデルとして活躍、現在はフリーのプロモデルとして活動中」が正本設定。「友達に頼まれてノリで応募した読者モデル（プロとは違う）」という旧設定の記述が `lime_messages.json` だけでなく、本編台本 `ch2_ageha_story.json`（客からの「読モのあげはちゃん」呼び、本人の「雑誌に載ったのも、ノリだったし」）にも残っている。 | 渋谷でスカウトされて元『GALA STREET』専属モデル・現在フリーで活動中という正本設定に整合させる。客の台詞は「あの、モデルのあげはちゃんですよね？」に、本人の台詞は「雑誌に出たのもスカウトだったし」等に改める。 | 確実 |
| CH2-TF-06 | `data/dialogue/ch2_rei.json:564, 569` (`ch2_rei_third`)<br>`data/dialogue/ch2_rei.json:981-1036` (`ch2_rei_group_concert_prep`) | `564, 569`: `"でも、ステージで笑うのも、嘘じゃない"` / `"客席があると、言えることが増えるんだ"`<br>`1016, 1036`: `"（……ファンに一気に話しかけられてパニックになってる。これが素の反応か）"` / `"（……あの「月光花」を作る人が、ファンに「ありがとう」を言うだけでこんなに力がいるんだ）"` | 正本（`data/characters.json:293-294`, `docs/setting_book/02_characters.md:198`, `docs/setting_book/HANDOVER.md:36`）では、「V系の音楽とファッションが本当に好きな一般の青年。ステージのスターやバンドのフロントマンではない」「バンドのフロントマン設定は廃止」と明記されている。`ch2_city.json:1040` では「小さいイベントで、たまに（店でギターを弾く）」と修正済みだが、`ch2_rei.json` にはステージと客席を持つバンドマン／ファンに囲まれる演者としての描写が残っている。 | 564〜569行目を店のカウンターや好きな音楽の話に改め（例: `"でも、この服と髪で店に立つのも、嘘じゃない"` / `"煙と曲があると、言えることが増えるんだ"`）、`ch2_rei_group_concert_prep` の「ファン」も「V系好きの常連客たち」に改める。 | 確実 |
| CH2-TF-07 | `data/dialogue/ch2_rei.json:62, 261, 286, 306, 311, 396, 820, 986, 991, 1036` (`ch2_rei_first`, `ch2_rei_second`, `ch2_rei_fifth`, `ch2_rei_group_concert_prep`) | `"「イエス」という名のミックス"` / `"「月光花」"` / `"「嘘」っていう曲があって"` / `"今日の嘘、最高でした！"` | 正本（`data/characters.json:293, 297-313`, `docs/setting_book/06_flavors_recipes.md:45-50`）では、REIのミックス名は実在曲名そのものではなくV系名曲へのオマージュ名（代表作: `嘘の薔薇`、`CASSIS MEMORIAL`、`DOLLS REQUIEM`、`FILTH IN AMBER`）に改訂されており、`ch2_city.json:566` でも「嘘の薔薇」が使われている。一方、`ch2_rei.json` には実在曲名そのままの旧ミックス名（「イエス」「月光花」「嘘」）が残っている。 | 正本の代表作名（「嘘の薔薇」「CASSIS MEMORIAL」「DOLLS REQUIEM」「FILTH IN AMBER」）に統一するか要確認（二次資料 `docs/setting_book/02_characters.md:199` に旧名が残っているため整合確認が必要）。 | 要確認 |
| CH2-TF-08 | `data/dialogue/ch2_kumicho.json:6, 182, 281, 296, 360, 376, 452, 457, 512, 524, 530, 555, 671, 673, 707`<br>`data/lime_messages.json:584` (`rumor_kumicho_cigarman`) | `ch2_kumicho.json:281`: `"組長が炭を載せる。だが、蒸らさない。"`<br>`lime_messages.json:584`: `"ウチの若衆がmukai行ったらしいんだが、そこで見たこともない煙にやられたって震えてやがる"` | 正本（`data/characters.json:520-521`, `docs/setting_book/01_story.md:72`, `docs/setting_book/02_characters.md:188`）では、神崎竜二は普段は極道の組長であることを隠して「神崎煙草店」の店主として振る舞い、県大会の入場時（`ch2_tournament_entrance:103`）に初めて自ら組長と明かす設定。しかし `ch2_kumicho.json` の大会前訪問台本（`ch2_kumicho_first`〜`fourth`）の地の文で常時「組長」と書かれており、また大会前（DAY 6）に届く想定のLIME（`rumor_kumicho_cigarman`）でも自ら「ウチの若衆が」と極道であることをはじめに隠していない（なお `ch2_city.json` や `ch2_preparation.json` では地の文はすべて「神崎さん」に統一されている）。 | `ch2_kumicho.json` の地の文の「組長」を「神崎さん」に統一し、`rumor_kumicho_cigarman` の「ウチの若衆が」を「馴染みの若い連中が」などに改める（または大会後配信にする）。 | 確実 |
| CH2-TF-09 | `data/characters.json:514` (`kumicho.display_name`)<br>`data/dialogue/ch2_kumicho.json:360` | `characters.json:514`: `"display_name": "神崎竜二"`<br>`ch2_kumicho.json:360`: `"神崎竜二の「0分立ち上げ」を教わった。"` | `docs/master_spec.md` §3 #8「通常の会話の中で、登場人物をフルネームで呼ばない。表示も原則として下の名前や通り名にする」に対し、神崎の `display_name` がフルネーム「神崎竜二」になっており、通常会話の名前欄でも常時フルネーム表示になる。 | 名前欄表示を「神崎」とし、フルネームは初登場の名乗りや大会選手紹介時のみとするか、組長キャラの演出として現状維持とするか確認。 | 要確認 |

---

## 観点4: シーシャ知識の記述方針

有害物質（水による除去等は「諸説ある」）、実店舗の運用（チップ描写なし等）、疑似精密な数字（0.5秒・1ミリなどの断定）を点検した。

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-TF-10 | `data/dialogue/ch2_kumicho.json:29-30` (`ch2_kumicho_first`) | `"speaker": "", "face": "", "text": "大きな手。でも動作は繊細で、トングを扱う精度が異常に高い。炭が一ミリもズレない。"` | 「疑似精密な数字（0.5秒・1ミリなど）を断定していないか」という開発方針に対し、「炭が一ミリもズレない」という表現は疑似精密な数字（1ミリ）を断定した描写に該当する。 | `"大きな手。でも動作は繊細で、トングを扱う精度が異常に高い。炭を置く位置に、一切の迷いがない。"` や `"狙った位置から、わずかもブレない。"` など、数字に頼らない職人芸の描写に改める。 | 確実 |

### 観点4における正常・適合確認（指摘0件の項目）

- **有害物質・ボトルの水の役割**:
  - **該当なし（確認範囲: 第2章の全dialogueファイル、第2章スクリプト、LIMEメッセージ）**
  - 正本方針（`docs/setting_book/02_characters.md:157` / #1113 / #1128）では「ボトルの水は煙を冷やして吸いやすくするだけであり、有害物質（ニコチン・タール等）の除去・無害化は諸説あるとして断定しない」と定められている。
  - 第2章の全対象ファイルにおいて、ボトルの水がニコチンや有害物質を除去・軽減するという誤った俗説の断定記述は **0件** であり、方針に適合している。
- **実店舗の運用・シーシャ文化規範**:
  - **該当なし（確認範囲: 第2章の全dialogueファイル、第2章スクリプト、LIMEメッセージ）**
  - 日本の店舗運用に反する「客が現金でチップを置く」等の描写は **0件**。
  - ダブルアップルを「果実の林檎味」「林檎飴」「果汁感」などと誤認する描写はなく、スパイス（アニス・リコリス）としての深みや香りの描写にとどまっており正史に適合。
  - 神崎の「0分立ち上げ」も正本（`docs/master_spec.md`, `docs/setting_book/01_story.md:67`, `02_characters.md:190`）で公認された高等技術として適切に描写されている。

---

## 司令塔への検証依頼コマンド

本セッションはターミナルコマンド不可の実行条件のため、以下の検証テストは未実施です。司令塔にて後日実施をお願いします。

```bash
# 台詞データのlint確認（構文エラーや未定義話者などの検出）
python3 tools/lint_dialogue.py

# 第2章のストーリー・コンテキストおよび進行回帰テスト
node remake/test/story_context.mjs

# 第2章のブラウザ通しテスト（必要に応じて）
tools/browser-sem.sh node remake/test/browser/ch2_flow.mjs
```
