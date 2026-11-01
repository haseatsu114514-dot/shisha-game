# Issue #1178 第2章の一人称・表記・時系列・設定整合チェック

> **失効注記（2026-10-31）**: 本書は廃止済みの `docs/setting_book/`（現 `docs/archive/setting_book/`、#2011で退避）を正本として判定している。あげはの「読者モデル」、REIの代表曲「イエス」「月光花」「嘘」を「旧設定」とした判定は**失効**。現行の正本は `data/characters.json` と `brand/`。本書の判定を根拠に台詞・データを直さないこと。

## 対象・確認範囲

- **スクリプト（13ファイル）**:
  - `remake/js/chapters/ch2.js`
  - `remake/js/chapters/ch2-city-data.js`
  - `remake/js/chapters/ch2-commute.js`
  - `remake/js/chapters/ch2-deliveries.js`
  - `remake/js/chapters/ch2-outings.js`
  - `remake/js/chapters/ch2-preparation.js`
  - `remake/js/chapters/ch2-preview.js`
  - `remake/js/chapters/ch2-progress.js`
  - `remake/js/chapters/ch2-purikura.js`
  - `remake/js/chapters/ch2-story.js`
  - `remake/js/chapters/ch2-story-data.js`
  - `remake/js/chapters/ch2-tournament.js`
  - `remake/js/chapters/ch2-tournament-state.js`
- **会話・関連データ（第2章で使用・参照されるもの）**:
  - 第2章固有会話: `data/dialogue/ch2_main.json`, `data/dialogue/ch2_city.json`, `data/dialogue/remake_ch2.json`, `data/dialogue/ch2_deliveries.json`, `data/dialogue/ch2_preparation.json`, `data/dialogue/ch2_ageha_story.json`, `data/dialogue/ch2_isolation.json`, `data/dialogue/ch2_choice_echoes.json`, `data/dialogue/ch2_tournament.json`, `data/dialogue/ch2_city_guests.json`, `data/dialogue/ch2_kumicho.json`, `data/dialogue/ch2_rei.json`, `data/chapter_previews/ch2.json`
  - 第2章で解放・共用される会話・データ: `data/dialogue/samechan.json`, `data/dialogue/cinema.json`, `data/dialogue/trpg_club.json`, `data/dialogue/trpg_ordinary.json`, `data/dialogue/trpg_shark.json`, `data/dialogue/trpg_table_talk.json`, `data/dialogue/tournament_craft.json`, `data/dialogue/confession.json`, `data/dialogue/lover_events.json`, `data/lime_messages.json`, `data/relationship_memories.json`, `remake/data/lover.json`, `remake/data/friends.json`, `remake/data/broadcast.json`, `remake/data/status_texts.json`
- **照合した正本**:
  - `docs/master_spec.md`
  - `docs/setting_book/01_story.md` 〜 `06_flavors_recipes.md`, `HANDOVER.md`
  - `brand/story_and_structure.md`, `brand/character_profiles.md`
  - `data/characters.json`, `data/story_routes.json`

---

## サマリー

| 観点 | 確実 | 要確認 | 備考 |
| --- | ---: | ---: | --- |
| 1. 一人称・呼称・口調（はじめ「俺」／ましろ「僕」ほか） | 6件 | 5件 | ましろは第2章本編に未登場（共有データ内もすべて「僕」で違反0件）。はじめの「自分」2件＋選択肢/LIME 2件、あげはの旧カナ表記、神崎の「小僧」呼称、REIの敬語揺れ、TRPG勧誘時のサメちゃん・つむぎの口調崩れを検出 |
| 2. 店名・メーカー名表記「アルファーヘブン」の揺れ | 0件 | 0件 | 該当なし（第2章範囲での出現0件・他店名の揺れもなし） |
| 3. 時系列・DAY番号・予定の矛盾 | 1件 | 1件 | 神崎2回目訪問の「昨日」固定表現、第2章LIME 4件の配信条件不発 |
| 4. `docs/master_spec.md`・`docs/setting_book/` との設定矛盾 | 3件 | 2件 | あげはの読者モデル旧設定LIME、REIのステージ演者描写・実在曲名ミックス、神崎の大会前「組長」「若衆」表記、フルネーム表示 |
| **合計** | **10件** | **8件** | **計18件** |

---

## 観点1: 一人称・呼称・口調チェック（はじめ「俺」・ましろ「僕」ほか）

- **ましろの一人称（「僕」）**:
  - 第2章の進行スクリプトおよび第2章専用会話データには `mashiro` は未登場（LIMEの噂話のみで本人台詞なし。第3章から登場）。
  - 共有データ（`remake/data/lover.json`, `data/dialogue/confession.json`, `data/dialogue/lover_events.json`）内の `mashiro` 台詞もすべて一人称「僕」で統一されており、違反は **0件**。
- **はじめの一人称（「俺」以外）および他キャラの一人称・呼称・口調揺れ**:

| ID | ファイル:行 | 抜粋 | 何が問題か | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-P-01 | `data/dialogue/ch2_rei.json:346` (`ch2_rei_second`) | `"speaker": "hajime"`<br>`"text": "あ、自分はそんなに詳しくなくて。その友達が好きだっただけで……"` | はじめの一人称は「俺」（`data/characters.json:30`, `docs/setting_book/02_characters.md:20`）。会話文で一人称として「自分」を使用している。 | `"あ、俺はそんなに詳しくなくて。その友達が好きだっただけで……"` | 確実 |
| CH2-P-02 | `data/dialogue/ch2_rei.json:376` (`ch2_rei_second`) | `"speaker": "hajime"`<br>`"text": "だから友達が、という話で、自分はそんなに……"` | CH2-P-01 と同じ。はじめの一人称「俺」が「自分」になっている。 | `"だから友達が、という話で、俺はそんなに……"` | 確実 |
| CH2-P-03 | `data/dialogue/ch2_preparation.json:42` (`remake_ch2_ageha_chat` / choices) | `"text": "自分も顔を見てみよう"` | はじめの選択肢文面で一人称相当の「自分も」を使用（再帰代名詞的とも読めるが、直後の分岐 `a` 72行目の内心や他の選択肢と比べ「俺も」に揃える余地あり）。 | `"俺も顔を見てみよう"`（または再帰表現として現状維持） | 要確認 |
| CH2-P-04 | `data/lime_messages.json:502` (`lime_ageha_day5` / replies) | `"text": "自分もまだ不安"` | あげはからの大会前LIMEに対するはじめの返信選択肢で、一人称として「自分」を使用している。 | `"俺もまだ不安"` | 要確認 |
| CH2-P-05 | `data/dialogue/ch2_isolation.json:333, 343` (`ch2_minto_warning`)<br>`data/chapter_previews/ch2.json:16` (`frames[5]`) | `333`: `"ただ……はじめくん自身が、ちょっとしんどそうに見えるの。わたしは、それがいちばん心配"`<br>`343`: `"何があっても、わたしはここにいるから。疲れたら、いつでも吸いに来な。ね？"`<br>`ch2.json:16`: `"何があっても、わたしはここにいるから。"` | みんとの一人称は営業時「みんと」／素「私」（漢字）（`docs/setting_book/02_characters.md:208`, `brand/character_profiles.md:200`）。第1章監査（`CH1-P-08`）と同様、素のトーンが混じる場面でひらがなの「わたし」になっている。 | 素の一人称に揃えるなら `"私は、それがいちばん心配"` / `"何があっても、私はここにいるから。……"`、営業時の店内に揃えるなら `"みんとは〜"`（演出意図としてひらがな「わたし」なら正本に許容表記を明記）。 | 要確認 |
| CH2-P-06 | `data/dialogue/ch2_city_guests.json:20` (`ch2_city_guest_ageha_first`) | `"speaker": "hajime"`<br>`"text": "アゲハさんも、ぺぱーみんとに？"` | あげはの表示名・はじめからの呼称は平仮名の「あげはさん」（`data/characters.json:450` `"display_name": "あげは"`, `docs/setting_book/02_characters.md:260`、同ファイル55行目も `"あげはが買い物袋を..."`）。ここだけ旧表記の片仮名「アゲハさん」が残っている。 | `"あげはさんも、ぺぱーみんとに？"` | 確実 |
| CH2-P-07 | `data/relationship_memories.json:121, 127, 133` (`ageha_today`, `ageha_words`, `ageha_roles`) | `121`: `"（アゲハの「今日の感じ」に、俺が来たことも入っていた）"`<br>`127`: `"（アゲハと話していると、感じていたことに言葉が追いつく）"`<br>`133`: `"（撮影のアゲハも、客の顔を見るアゲハも、同じ彼女だった）"` | 第2章の `remake_ch2_ageha_scout` / `remake_ch2_ageha_gyaru` / `remake_ch2_ageha_magazine` に対応する記憶エコー（`ch2_pre_tournament_realisation` の `type: "reflection"` で参照）。表記が片仮名「アゲハ」（呼び捨て）になっており、現行の「あげはさん」（または「あげは」）と不整合。 | `"アゲハ"` → `"あげはさん"`（または `"あげは"`）。 | 確実 |
| CH2-P-08 | `data/dialogue/confession.json:455, 465, 471, 505, 510, 570` (`confession_ageha`, `confession_ageha_accept`) | `455, 465`: `"てかさー、キミ。..."` / `"キミのこと、とりま独占したくなったわ。"`<br>`471`: `"はい、アゲハさんのものです"`<br>`505, 510, 570`: `"アゲハは..."` / `"えっ、ちょ、アゲハさん！？"` | 共通告白データ `confession_ageha` において、あげはの二人称が「ハジメっち」（`data/characters.json:455`）ではなく「キミ」（535・565行では「ハジメっち」と混在）になっており、名前表記も旧片仮名「アゲハ」「アゲハさん」のまま残っている。 | 455・465行の `"キミ"` → `"ハジメっち"`、471・505・510・570行の `"アゲハ"` → `"あげは"`。 | 確実 |
| CH2-P-09 | `data/dialogue/ch2_city_guests.json:195, 205` (`ch2_city_guest_rei_repeat`) および `150, 155, 190`・`data/dialogue/ch2_deliveries.json:130, 165, 205` | `195`: `"……また会いましたね。ここの席、落ち着くんで"`<br>`205`: `"ちょっと古い曲です。気になります？"`<br>`150, 155, 190` / `ch2_deliveries.json:130, 165, 205`: `"零さん"` | 1. REIの口調は極端に無口な短文・常体（`docs/setting_book/02_characters.md:303`）。直前の `ch2_city_guest_rei_first`（180行）でも常体なのに、再訪の `ch2_city_guest_rei_repeat` で突然敬語（です・ます調）を使っている。<br>2. 他ファイル（`ch2_city.json` 等）では呼称が「REIさん」なのに対し、この2ファイルのみ漢字の「零さん」と表記が揺れている。 | 195行: `"……また会ったな。ここの席、落ち着く"`<br>205行: `"……少し古い曲だ。気になる？"`<br>呼称も「REIさん」に統一するか要確認。 | 要確認 |
| CH2-P-10 | `data/dialogue/ch2_kumicho.json:32, 97, 201, 216, 266, 371, 417, 502, 540, 622` 他<br>`data/lime_messages.json:576` (`rumor_kumicho_cigarman`) | `ch2_kumicho.json:32`: `"……おう。なんじゃ小僧、珍しい顔だな。観光か"`<br>`lime_messages.json:576`: `"……おい、小僧"` | 神崎竜二のはじめに対する二人称は正本で「あんちゃん」（`data/characters.json:519`, `docs/setting_book/02_characters.md:290`）と定められており、`ch2_city.json` / `ch2_preparation.json` / `ch2_tournament.json` / `remake_ch2.json` ではすべて「あんちゃん」に統一されているが、`ch2_kumicho.json` と `lime_messages.json:576` では旧設定の「小僧」が残っている。 | `"小僧"` → `"あんちゃん"` に統一。 | 確実 |
| CH2-P-11 | `data/dialogue/trpg_club.json:87, 91, 97, 101` (`trpg_invite_member`) | `87, 91` (`samechan`): `"サメ映画みたいなTRPGもある？　なら入る！"` / `"仕事のない夜に呼んで。サメ役……じゃなくて、GMもやってみたい！"`<br>`97, 101` (`tsumugi`): `"……はじめがいるなら、やってみたい。"` / `"入る。制作の予定がない夜なら、呼んで。"` | 第2章の柚ヶ谷ボドゲカフェで解放されるTRPG部勧誘会話。<br>1. サメちゃんは一人称「わし」・語尾「〜じゃ／〜のじゃ」（`docs/setting_book/02_characters.md:273`）だが普通の現代口調になっている。<br>2. つむぎは二人称「はじめさん」・丁寧語「です・ます」調（`data/characters.json:412`, `tools/check_story_canon.py:38`）だが、「はじめ」呼び捨て・タメ口になっている（※`trpg_ordinary.json` / `trpg_shark.json` の卓内台詞も同様）。 | `samechan`: `"サメ映画みたいなTRPGもあるのか？ なら入るのじゃ！"` / `"仕事のない夜に呼ぶのじゃぞ。サメ役……ではなくて、GMもやってみたいのじゃ"`<br>`tsumugi`: `"……はじめさんがいるなら、やってみたいです"` / `"入ります。制作の予定がない夜なら、呼んでください"` | 確実 |

---

## 観点2: 店名・メーカー名表記「アルファーヘブン」の揺れ

- **該当なし（確認範囲）**:
  - 確認範囲: `remake/js/chapters/ch2*.js`（13ファイル）および第2章関連の `data/dialogue/*.json`、`data/chapter_previews/ch2.json`、`data/lime_messages.json`、`remake/data/*.json` 全件。
  - 上記ファイル群において「アルファーヘブン」および揺れ表記（「アルファヘブン」「アルファーヘヴン」「アルファヘヴン」等）の出現は **0件**（第2章で登場するメーカー名は主に「アフサール」）。
  - あわせて第2章の主要店名（`tonari` / `Chill Spot AGEHA` / `神崎煙草店` / `カフェ・アングラ` / `SHISHARK` / `KEMURIKUSA` / `EDEN` / `ぺぱーみんと` / `Dr.fookah` / `C.STATION`）も点検し、表記揺れがないことを確認した。

---

## 観点3: 時系列・DAY番号・予定の矛盾

| ID | ファイル:行 | 抜粋 | 何が問題か | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-T-01 | `data/dialogue/ch2_kumicho.json:196` (`ch2_kumicho_second`) | `"speaker": "hajime"`<br>`"text": "昨日のドラゴンフルーツ、ずっと頭に残ってて"` | 神崎煙草店への訪問は自由行動であり、初回訪問（`ch2_kumicho_first`）の翌日に2回目（`ch2_kumicho_second`）を訪れるとは限らない（数日後や大会後に訪れる場合もある）。第1章監査（`CH1-T-01`〜`03`）と同種の固定相対日時表現。 | `"この前のドラゴンフルーツ、ずっと頭に残ってて"` | 要確認 |
| CH2-T-02 | `data/lime_messages.json:365-401, 476-512, 568-609, 659-705` (`lime_ageha_day3`, `lime_ageha_day5`, `rumor_kumicho_cigarman`, `rumor_kemuri_experiments`) | `lime_ageha_day3`: `"trigger_day": 3`, `"trigger_condition": "lime_exchanged"`（`"chapter": 2` なし）<br>`lime_ageha_day5`: `"trigger_day": 5`, `"trigger_condition": "lime_exchanged"`（`"chapter": 2` なし）<br>`rumor_kumicho_cigarman` / `rumor_kemuri_experiments`: `"trigger_condition": "ch2_started"`, `"chapter": 2` | 1. `remake/js/daily/phone.js:203` の `const day = m.chapter ? chapterDay(state) : state.day;` により、`"chapter": 2` が無い `lime_ageha_day3` / `lime_ageha_day5` は通算日数 `state.day`（第2章は通算DAY 8または15から開始）で判定されるため、第2章のDAY 3 / DAY 5に届かない（`phone.js:191` で第1章は除外されるため実質不発）。<br>2. `rumor_kumicho_cigarman`（第2章DAY 6）と `rumor_kemuri_experiments`（第2章DAY 3）の `"trigger_condition": "ch2_started"` は `phone.js:188-209` の `eligible()` に分岐が無く、常に `false` となって届かない。 | `lime_ageha_day3` / `lime_ageha_day5` に `"chapter": 2` を付与（または同ファイル末尾の `lime_ageha_ch2_goodday` / `badday` に整理統合）。`ch2_started` は `phone.js` の `eligible()` で処理するか `"lime_exchanged"` に統一。 | 確実 |

---

## 観点4: `docs/master_spec.md`・`docs/setting_book/` との設定整合チェック

| ID | ファイル:行 | 抜粋 | 何が問題か | 修正案 | 確信度 |
| --- | --- | --- | --- | --- | --- |
| CH2-S-01 | `data/lime_messages.json:419, 439` (`lime_ageha_model_reveal`) | `419`: `"友達に頼まれてノリで応募したら受かっちゃってさ。読者モデルってやつ"`<br>`439`: `"ギャル系のストリート系ファッション誌！ 読者モデルだからプロのモデルとは違うけどね。"` | 正本（`docs/setting_book/02_characters.md:258`, `brand/character_profiles.md:249`）および第2章本編台本（`data/dialogue/ch2_ageha_story.json:103-113, 277` `remake_ch2_ageha_scout` / `remake_ch2_ageha_magazine`）では、あげはは「渋谷のセンター街で編集部にスカウトされて『GALA STREET』の専属モデルになり、現在はフリーのプロモデルとして活動している」設定。「友達に頼まれてノリで応募した読者モデル（プロとは違う）」という記述は旧設定の残骸であり、第2章で好感度Lv2に達すると実際に配信されるため本編と直接矛盾する。 | スカウト出身の元『GALA STREET』専属モデル（現在はフリーでファッションページやカフェ特集に出ている）設定に合わせて文面を改稿する。 | 確実 |
| CH2-S-02 | `data/dialogue/ch2_rei.json:564, 569` (`ch2_rei_third`)<br>`data/dialogue/ch2_rei.json:981-1036` (`ch2_rei_group_concert_prep`) | `564, 569`: `"でも、ステージで笑うのも、嘘じゃない"` / `"客席があると、言えることが増えるんだ"`<br>`1016, 1036`: `"（……ファンに一気に話しかけられてパニックになってる。これが素の反応か）"` / `"（……あの「月光花」を作る人が、ファンに「ありがとう」を言うだけでこんなに力がいるんだ）"` | 正本（`data/characters.json:293-294`, `docs/setting_book/02_characters.md:299`, `docs/setting_book/HANDOVER.md:36`）では「V系の音楽とファッションが本当に好きな一般の青年。ステージのスターやバンドのフロントマンではない」「バンドのフロントマン設定は廃止」と明記されている。`ch2_city.json:1040` では「小さいイベントで、たまに（店でギターを弾く）」と修正済みだが、`ch2_rei.json` にはステージと客席を持つバンドマン／ファンに囲まれる演者としての描写が残っている。 | 564〜569行目を店のカウンターや好きな音楽の話に改める（例: `"でも、この服と髪で店に立つのも、嘘じゃない"` / `"煙と曲があると、言えることが増えるんだ"`）。`ch2_rei_group_concert_prep` の「ファン」も「V系好きの常連客たち」に改める。 | 確実 |
| CH2-S-03 | `data/dialogue/ch2_rei.json:62, 261, 286, 306, 311, 396, 820, 986, 991, 1036` (`ch2_rei_first`, `ch2_rei_second`, `ch2_rei_fifth`, `ch2_rei_group_concert_prep`) | `"「イエス」という名のミックス"` / `"「月光花」"` / `"「嘘」っていう曲があって"` / `"今日の嘘、最高でした！"` | 正本（`data/characters.json:293, 297-313`, `docs/setting_book/02_characters.md:301`, `docs/setting_book/06_flavors_recipes.md:45-50`）では、REIのミックス名は実在曲名そのままではなくV系バンドへのオマージュ名（代表作: `嘘の薔薇`、`CASSIS MEMORIAL`、`DOLLS REQUIEM`、`FILTH IN AMBER`）に改訂されており、`ch2_city.json:566` でも「嘘の薔薇」が使われている。一方、`ch2_rei.json` には実在曲名そのままの旧ミックス名（「イエス」「月光花」「嘘」）が残っている。 | 正本の代表作名（「嘘の薔薇」「CASSIS MEMORIAL」「DOLLS REQUIEM」「FILTH IN AMBER」）に統一するか要確認。 | 要確認 |
| CH2-S-04 | `data/dialogue/ch2_kumicho.json:6, 182, 281, 296, 360, 376, 452, 457, 512, 524, 530, 555, 671, 673, 707`<br>`data/lime_messages.json:584` (`rumor_kumicho_cigarman`) | `ch2_kumicho.json:281`: `"組長が炭を載せる。だが、蒸らさない。"`<br>`lime_messages.json:584`: `"ウチの若衆がmukai行ったらしいんだが、そこで見たこともない煙にやられたって震えてやがる"` | 正本（`data/characters.json:520-521`, `docs/setting_book/02_characters.md:288`）では、神崎は普段ヤクザの組長であることを隠して「神崎煙草店」の店主として振る舞い、県大会の入場時（`ch2_tournament_entrance`）に初めて自ら組長と明かす設定。しかし大会前の訪問台本（`ch2_kumicho_first`〜`fourth`）の地の文で「組長」と書かれ、大会前DAY 6のLIME（`rumor_kumicho_cigarman`）でも自ら「ウチの若衆が」と組長設定を前提に話している（なお `ch2_city.json` や `ch2_preparation.json` では地の文もすべて「神崎さん」に統一済み）。 | `ch2_kumicho.json` の地の文の「組長」を「神崎さん」に統一し、`rumor_kumicho_cigarman` の「ウチの若衆が」を「馴染みの若い連中が」（または大会後解放）に改める。 | 確実 |
| CH2-S-05 | `data/characters.json:514` (`kumicho.display_name`)<br>`data/dialogue/ch2_kumicho.json:360` | `characters.json:514`: `"display_name": "神崎竜二"`<br>`ch2_kumicho.json:360`: `"神崎竜二の「0分立ち上げ」を教わった。"` | `docs/master_spec.md` §3 #8「通常の会話の中で、登場人物をフルネームで呼ばない。表示も原則として下の名前や通り名にする」に対し、神崎の `display_name` がフルネーム「神崎竜二」になっており、通常会話の名前欄でも常時フルネーム表示になる（第1章監査の上園文太郎 `CH1-S-03` と同様）。 | 名前欄表示を「神崎」とし、フルネームは初登場の名乗りや大会選手紹介時のみとするか、組長キャラの演出として現状維持とするか確認。 | 要確認 |

---

## 問題なし・指摘に含めなかったもの（確認済みメモ）

- **`ch2_deliveries.json:275`（`ch2_delivery_bar_first`）の `"speaker": "volk"` 表示**:
  - 台本上は `"speaker": "volk"` だが、`remake/js/core/data.js:228-236` の `displayName()` により `state.met.volk` が `false` の間は名前欄が自動的に `？？？` と表示されるため、`docs/master_spec.md` §3 #16（名乗るまで名前欄は「？？？」）に適合している。
- **第2章の好感度イベントと大会後の時系列分岐**:
  - `remake/js/chapters/ch2-preparation.js`（`remake_ch2_ageha_post_practice` 等）や `data/dialogue/ch2_ageha_story.json`（`remake_ch2_ageha_finale` 内の `_ch2_tournament_cleared` 条件分岐）では、大会前／大会後の時系列分岐が実装されており、「これから県大会」と逆行する矛盾はない。
- **第2章の14日間進行スケジュール（`ch2.js` / `ch2-progress.js` / `ch2-story-data.js`）**:
  - DAY 1（柚ヶ谷到着・下見）〜 DAY 7（県大会当日）〜 DAY 8〜13（大会後・孤立と再起の期間）〜 DAY 14（旅立ち）の進行および各朝の固定イベント・LIME通知に日付や曜日の矛盾はない。
