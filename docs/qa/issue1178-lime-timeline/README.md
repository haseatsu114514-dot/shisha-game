# #1178 LIME メッセージ全体の時系列・発火条件チェック

## 判定と対象時点

- 2026-10-28、Antigravity（ブランチ: `agy/1178-lime-timeline-20261028`）。
- Issue #1178「LIME メッセージ全体の時系列・発火条件チェック（報告のみ、コード修正なし）」に基づく調査報告。
- 先行QA（第1章台詞: `docs/qa/issue1178-ch1-timeline-flags`、第2章台詞: `docs/qa/issue1178-ch2-timeline-flags`）に続き、今回は `data/lime_messages.json` 全40件を横断して4観点（発火可能性・交換順序・時系列表現・重複伝達）を精査した。
- 変更はこのREADMEファイル1本のみ。**メッセージデータ・台詞・実装ファイルは一切修正していない。**
- ターミナル/シェルコマンド（`run_command` 等）は使用せず、ファイル閲覧ツールによる静的解析・全件精査を実施した。

## 確認範囲

### 対象ファイル

1. **メッセージデータ**:
   - `data/lime_messages.json`（全40件）
2. **スクリプト・ロジック**:
   - `remake/js/daily/phone.js`（朝のメッセージ抽出 `morningMessages`、発火可否 `eligible`、アカウント判定）
   - `remake/js/daily/calendar.js`（日常パート進行、約束実行、フラグ付与）
   - `remake/js/daily/spots.js`（連絡先判定 `hasContact`、`LIME_EXCHANGE`）
   - `remake/js/daily/bonds.js`（交友の締めくくり誘い `bondInvites`）
   - `remake/js/daily/tsumugi-schedule.js`（つむぎ日程・汎用雑談 `tsumugiMessages`）
   - `remake/js/chapters/ch1.js`（第1章日常・固定イベント）
   - `remake/js/chapters/ch2.js` / `ch2-preparation.js` / `ch2-story-data.js`（第2章日常・あげは日程・固定イベント）
   - `remake/js/core/chapter-clock.js`（章内日数 `chapterDay`）
3. **会話・シナリオJSON**:
   - `data/dialogue/ch1_events.json`
   - `data/dialogue/ch1_naru.json`
   - `data/dialogue/ch1_adam.json`
   - `data/dialogue/ch1_minto.json`
   - `data/dialogue/ch1_rin.json`
   - `data/dialogue/ch1_tsumugi.json`
   - `data/dialogue/ch2_preparation.json`
4. **設定資料**:
   - `docs/master_spec.md`
   - `brand/story_and_structure.md`
   - `brand/character_profiles.md`
   - `data/characters.json`

---

## 指摘一覧表

| ID | 観点 | 対象ID | ファイル:行 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|---|
| L01 | 1. 発火条件 | `rumor_kumicho_cigarman` | `data/lime_messages.json:568` | `"trigger_condition": "ch2_started"` が指定されているが、`remake/js/daily/phone.js` の `eligible()` に `ch2_started` の判定ロジックが存在せず常に `false` となり発火不能。また組長との連絡先連携（`hasContact`）の条件も未整備。 | `eligible()` で章開始条件をサポートするか、`"trigger_condition": "flag"`（`trigger_flag: "_ch2_preparation_started"` 等）へ変更。組長との連絡先交換手段も整理する。 | 確実 |
| L02 | 1. 発火条件 | `rumor_nagumo_cigarman` | `data/lime_messages.json:611` | `"trigger_condition": "ch3_started"` が指定されているが、`eligible()` に判定ロジックが存在せず発火不能。また南雲会長の `hasContact` 条件も未整備。 | 第3章実装時に `eligible()` で章開始条件をサポートするか、フラグ判定へ改める。 | 確実 |
| L03 | 1. 発火条件 | `rumor_kemuri_experiments` | `data/lime_messages.json:659` | `"trigger_condition": "ch2_started"` が指定されているが、`eligible()` に判定ロジックが存在せず発火しない。なるとは第1章で連絡先交換済みで `trigger_day: 3` があるため、第2章 DAY 3 朝に届く想定。 | `"trigger_condition": "lime_exchanged"`（かつ `"chapter": 2`、`"trigger_day": 3`）に修正する。 | 確実 |
| L04 | 1. 発火条件 | `rumor_ageha_mashiro` | `data/lime_messages.json:742` | `"trigger_condition": "ch3_started"` が指定されているが、`eligible()` に判定ロジックが存在せず発火不能。 | 第3章実装時に `eligible()` で章開始条件をサポートするか、フラグ判定へ改める。 | 確実 |
| L05 | 1. 発火条件 | `encourage_ageha` | `data/lime_messages.json:514` | `"trigger_condition": "tournament_day"` だが、`phone.js:30` の `HEROINES_ENCOURAGE = ["tsumugi", "minto", "rin"]` に `"ageha"` が含まれていないため `eligible()` で常に除外され、大会当日に絶対に発火しない。 | `phone.js` の `HEROINES_ENCOURAGE` に `"ageha"` を追加するか、第2章の大会当日応援メッセージ判定を整理する。 | 確実 |
| L06 | 1. 章属性漏れ | `lime_ageha_day3`<br>`lime_ageha_model_reveal`<br>`lime_outing_ageha_1`<br>`lime_ageha_day5`<br>`encourage_ageha` | `data/lime_messages.json:365, 403, 445, 476, 514` | 第2章のライバルであるあげはの初期メッセージ群に `"chapter": 2` の明示がない（同ファイル1218行〜のメッセージにはあり）。第1章ではコード側の個別除外で抑止されているが、データ定義として不整合。 | 各メッセージ定義に `"chapter": 2` を明示追加する。 | 確実 |
| L07 | 3. 時系列・順序<br>4. 重複・二重伝達 | `lime_ageha_day5` | `data/lime_messages.json:476` | ①現行第2章は14日制（DAY 14大会）なのに DAY 5 で「あと少しで大会じゃん」と旧7日制の文面が残る。<br>②あげはの手の不調は本編（`ch2-story-data.js`）で **DAY 7 以降** に発覚するのに、DAY 5 で「今日ちょっと手が重い」と先行ネタバレしている。<br>③DAY 7 の `lime_ageha_ch2_badday` と不調の話題が二重に伝わる。 | `lime_ageha_day5` は旧仕様データとして削除するか、不調発覚後（DAY 11等）に移動して文面を調整する。 | 確実 |
| L08 | 4. 重複・競合 | `lime_ageha_day3`<br>`lime_ch2_ageha_after_visit` | `data/lime_messages.json:365, 1218` | あげはの初回来店（DAY 2以降）後、翌朝に `lime_ageha_day3`（LIME交換雑談）と `lime_ch2_ageha_after_visit`（初回来店お礼）が同時に発火可能となる。朝1通制限により前者が優先され、正規の第2章来店お礼が押し出される。 | 旧仕様の `lime_ageha_day3` を整理し、初回来店後は `lime_ch2_ageha_after_visit` が届くように一本化する。 | 確実 |
| L09 | 1. 章属性漏れ | 第1章専用メッセージ群（計24件） | `data/lime_messages.json:4, 33, 60, 118, 145, 203, 257, 295, 333, 349, 534, 707, 786, 824, 853, 882, 910, 944, 982, 1020, 1058, 1140, 1168, 1196` | 一部の第1章メッセージ（`lime_minto_first_holiday` 等）には明示的に `"chapter": 1` があるが、大半の第1章メッセージに属性がなく、未読のまま次章へ進んだ場合に誤発火する潜在リスクがある。 | 第1章固有のメッセージに明示的に `"chapter": 1` を付与する。 | 要確認 |
| L10 | 3. 時系列・順序 | `lime_naru_day6` | `data/lime_messages.json:257` | 14日制の DAY 6（大会まであと8日の中盤）で「もうすぐ大会だな」「俺は仕上がってる。あとは当日、どう出すかだけ」と述べており、その4日後の DAY 10（`lime_naru_day10`：「この時期にやることは2つだけだ。基礎の反復と寝ること」）と比べると、仕上がり具合の緊張感が逆転している。 | 文面を中盤向け（「折り返しだな」等）に調整するか、trigger_day を大会終盤に見直す。 | 要確認 |
| L11 | 4. 重複・競合 | `lime_rin_report`<br>`lime_fookah_promo_1` | `data/lime_messages.json:944, 1140` | DAY 3 に凛の試香モニター（`ch1_rin_second`）を終えた場合、DAY 4 朝にモニター結果報告と入荷告知の双方が発火条件を満たす。同一相手朝1通制限で後者が翌日へ回り、枠の埋まり具合によっては入荷告知が失効（`day - trigger_day <= 1`）するリスクがある。 | プロモ告知と物語アフタートークの配信枠の整理、またはプロモ有効期限の緩和。 | 要確認 |

---

## 観点別の精査結果詳細

### 観点1：各メッセージの chapter・trigger_day・trigger_condition が、実際にその日・その章で発火しうるか

- **判定**: 指摘7件（L01, L02, L03, L04, L05, L06 は確実、L09 は要確認）。
- **確認内容**:
  - `remake/js/daily/phone.js` の `eligible(m)` がサポートしている条件は以下の6種のみ：
    1. `"tournament_day"`（ただし `HEROINES_ENCOURAGE = ["tsumugi", "minto", "rin"]` に限定）
    2. `"hiyori_tonari"`
    3. `"story_count"`
    4. `"lime_exchanged"`（`m.trigger_day <= day && day - m.trigger_day <= 1`）
    5. `"affinity_level"`
    6. `"flag"`（`state.flags[m.trigger_flag]`）
  - これ以外の `trigger_condition`（`"ch2_started"`, `"ch3_started"`）が指定されているメッセージ（L01〜L04）は、`eligible()` で `return false;` に落ちるため**絶対に配信されないデッドメッセージ**となっている。
  - `encourage_ageha` は大会当日条件だが、`HEROINES_ENCOURAGE` に `"ageha"` が入っていないため大会当日に除外される（L05）。
  - あげはの初期メッセージ（L06）および第1章メッセージ（L09）における `chapter` 属性の欠落リスクを確認。

### 観点2：送り主がその時点で主人公と LIME を交換済みか（交換前に届く矛盾）

- **判定**: **該当なし（全40件確認済み）**。
- **確認内容**:
  - `remake/js/daily/spots.js` の `hasContact(id)` は `state.contacts.includes(id)` または `_lime_contact_${id}` または `storyCount >= LIME_EXCHANGE[id]` で判定される。
  - 各キャラの連絡先交換タイミングを全シナリオJSONと照合：
    - **なる**: `ch1_naru_first`（初回来店）の `early_lime_exchange` で `_lime_contact_naru` 取得。DAY 3メッセージ（`lime_naru_day3`）より前に交換可能。
    - **みんと**: `ch1_minto_first`（初回来店）で案内カードから `_lime_contact_minto` 取得。DAY 4メッセージ（`lime_minto_day4`）より前に交換可能。
    - **アダム**: `ch1_adam_third` で `_lime_contact_adam` 取得。最短でDAY 2夜に交換可能。未交換時は `hasContact` で抑止され、交換前に届くことはない。
    - **つむぎ**: DAY 1の `playTsumugiStory(1)` で取材と同時に連絡先交換。DAY 8メッセージより前に交換済み。
    - **凛**: `ch1_rin_second`（試香モニター）で `_lime_contact_rin` 取得。DAY 4メッセージより前に交換可能。未交換時は抑止。
    - **あげは**: 第2章初回来店（`ch2-preparation.js:113`）で `_lime_contact_ageha` 取得。
  - いずれのキャラも「未交換の状態でメッセージが届いてしまう」時系列矛盾は存在しない。

### 観点3：文面の「昨日」「明日」「この前の〜」が、発火日と本編の出来事の順序に合うか

- **判定**: 指摘2件（L07 は確実、L10 は要確認）。
- **確認内容**:
  - `lime_after_outing_*`（お出かけ後のアフタートーク）は、お出かけ完了フラグ（`_outing_done_*`）を受けて翌朝以降に届くため、「この前は〜」の文面と一致。
  - `lime_rin_report` の「昨日のB-7」は、前日の試香モニター（`ch1_rin_second`）完了フラグ `_ev_rin_monitor` を受けて翌朝に届くため整合。
  - `rumor_minto_late_night` の「昨日は、少しゆっくり準備できたよ」は、前夜の閉店間際イベント（`ch1_minto_phantom_smell`）のフラグ `_minto_phantom_shared` を受けて翌朝に届くため整合。
  - 一方、`lime_ageha_day5`（L07）は、旧7日制の「あと少しで大会じゃん」という日数矛盾に加え、本編でDAY 7以降に起きる「手の不調」をDAY 5で先取りして語っており、明確な時系列順序の逆転が発生している。
  - また、`lime_naru_day6`（L10）は14日制の中盤（DAY 6）で「あとは当日どう出すかだけ」と語り、終盤のDAY 10での台詞と緊張感が逆転している。

### 観点4：同じ日に同じ相手から重複して届く、または本編の会話と同じ情報を二重に伝えるもの

- **判定**: 指摘3件（L07, L08 は確実、L11 は要確認）。
- **確認内容**:
  - `phone.js` の `senders.add(m.sender)` により、システム上は同一朝に同一人物から複数通のLIMEが同時に受信箱へ入ることは防止されている。
  - しかし、あげはの初回来店後（L08）において、旧メッセージ `lime_ageha_day3` と新メッセージ `lime_ch2_ageha_after_visit` が同日朝に候補となり、配列順によって新シナリオの台詞が押し出される競合が生じている。
  - さらに、`lime_ageha_day5` と `lime_ageha_ch2_badday`（L07）により、手の不調に関する情報が数日を置いて二重に伝えられている。
  - 凛の個別イベント後（L11）において、ストーリー報告とショップ入荷告知が重なった際に告知が失効する競合懸念を検出。

---

## 調査の結論と推奨アクション

1. **`ch2_started` / `ch3_started` などの未対応トリガーの解消（最優先）**:
   `rumor_kumicho_cigarman`, `rumor_nagumo_cigarman`, `rumor_kemuri_experiments`, `rumor_ageha_mashiro` の4件は現在完全に発火不能。`phone.js` 側の判定追加、または既存の `flag` 条件への移行が必要。
2. **あげは関連LIME（第2章）の統合・整理**:
   旧仕様（7日間制大会）の残滓である `lime_ageha_day3`, `lime_ageha_day5`, `encourage_ageha` が、現行の14日制ストーリー（`lime_ch2_ageha_after_visit`, `lime_ageha_ch2_goodday`, `lime_ageha_ch2_badday`）と競合・矛盾を起こしている。不要な旧メッセージの削除または現行ストーリーへの適合修正が推奨される。
3. **`HEROINES_ENCOURAGE` へのあげは追加**:
   大会当日の応援メッセージをあげはからも受信できるよう、判定配列を見直す。
