# #1178 バイト・日常スポット会話の時系列・発火条件チェック報告書

## 概要
- 対象:
  - `data/baito_events.json`
  - `data/dialogue/ch1_spots.json`
  - `data/dialogue/ch3_spots.json`
  - `data/dialogue/ch3_activities.json`
  - `data/dialogue/ch2_deliveries.json`
  - `data/dialogue/ch3_deliveries.json`
  - `data/dialogue/ch3_visits.json`
  - それらの発火処理（`remake/js/daily/tonari.js`, `remake/js/daily/spots.js`, `remake/js/daily/spot-encounters.js`, `remake/js/chapters/ch2-deliveries.js`, `remake/js/chapters/ch3-deliveries.js`, `remake/js/chapters/ch3-activities.js`, `remake/js/core/tokyo-visits.js` 等）
- 目的: 日常パート・バイト・スポット会話の時系列、発火条件、前提面識、時間表現、二重伝達、シーシャ知識の正確性を調査・報告（報告のみ、コード修正なし）。

---

## 観点別指摘一覧

### 観点1: 各イベント・会話の章・日・条件が実際に発火しうるか（条件フラグを立てる場面があるか、章属性の付け漏れ、日数の範囲外、二度と出ない／何度も出る）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| C1-01 | `data/baito_events.json:206-236`, `400-429`, `651-679`, `681-709` | `"id": "baito_tsumugi_01"`, `"id": "baito_tsumugi_art"`, `"id": "baito_minto_romance"`, `"id": "baito_ageha_romance"`（いずれも `"category": "story"`） | `remake/js/core/data.js`（L57, L124）で `BAITO_CATEGORIES` が `["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]` の6種に限定されており、`category: "story"` のイベントは起動時フィルタで除外され `DB.baito` に読み込まれない。`tonari.js` に `baito_tsumugi_` 用の考慮コードがあるにもかかわらず、これら4イベントはゲーム内で永久に発火しないデッドデータとなっている。 | `baito_tsumugi_01` と `baito_tsumugi_art` は常連・雰囲気枠として `"category": "atmosphere"` や `"regular"` に変更するか、`BAITO_CATEGORIES` に `"story"` を追加する（※ただし `baito_minto_romance`, `baito_ageha_romance` はC2-01の通り別途時系列の整理が必要）。 | 確実 |
| C1-02 | `data/dialogue/ch3_spots.json:4-203` | `"dialogue_id": "ch3_tokyo_shisha"`, `"ch3_mukai_visit"`, `"ch3_tokyo_sightseeing"`, `"ch3_mukai_tetsuko"`, `"ch3_return"` | 第3章の実装コード（`remake/js/chapters/ch3.js`, `ch3-progress.js`, `ch3-activities.js` 等）から `ch3_spots.json` が一度もロードされておらず、全イベントが未接続のデッドデータとなっている。また各イベント末尾の選択肢ジャンプ先が空の `"next_id": "ch3_return"` になっており、旧版仕様の残骸となっている。 | 第3章の自由時間訪問イベントとして現行の `ch3-activities.js` やマップシステムに正式接続するか、不要であれば旧版の廃止データとして整理する。 | 確実 |
| C1-03 | `data/dialogue/ch1_spots.json:515, 690, 707, 717, 2002, 2012` | `"speaker": "staff_choizap"`（C.STATIONのスタッフ台詞） | C.STATION は大型シーシャチェーン店であり、ジム（チョイザップ）とは無関係。しかしスタッフの話者IDがすべて `"staff_choizap"` に設定されている。チョイザップ自体は本編で「無人ジム」と描写されており、ジムのスタッフIDがC.STATIONで接客しているのは不整合。また `characters.json` に定義がないため名前表示が英字のまま露出する恐れがある。 | C.STATIONのスタッフ話者IDを `"shop_clerk"` や `"customer"`、あるいは適切なモブ店員IDに変更する。 | 確実 |

---

### 観点2: まだ会っていない人物・まだ起きていない出来事・まだ解放されていない場所に触れていないか（面識・解放の前提）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| C2-01 | `data/baito_events.json:681-709` | `アゲハが来店した。いつも通り飄々とした態度でソファ席に座り、足を組む。\n「よっ、ハジメっち。今日も美味しいの作ってよねー。彼氏力の見せ所っしょ♡」` (`id: "baito_ageha_romance"`, `trigger_flag: "romance_ageha"`) | アゲハは第2章（柚ヶ谷）の主要人物であり、第1章ではDAY4以降の配達受け取り（`ch1_ageha_encounter`）で一度顔を合わせるのみ。第1章のtonariのバイトに「いつも通り常連として」ソファ席に来店し恋人会話をするのは、本編の時系列（第2章以降かつ告白成立後）と明確に矛盾する。 | 第1章専用のバイトイベントから除外するか、章属性 `"chapter": 2` 以降を指定して第1章では発火しないように制御する。 | 確実 |
| C2-02 | `data/baito_events.json:214, 223` | `つむぎ「……どうも」（小さい声）`、`つむぎ「…えっ…べ、別に……」` (`id: "baito_tsumugi_01"`) | `trigger_flag: "!ch1_tsumugi_regular"` はつむぎとの面識・常連化前（初対面）を想定した条件であり、本文でも「いつもの席に女の子が座っている」「この子の周りだけ、独特の静けさがある」と名前を知らない相手として描写されている。しかし選択肢結果の台詞ラベルで最初から「つむぎ」と名前が表示されており、MASTER_SPEC #1（初対面の相手は名乗るまで？？？）に反している。 | 話者ラベルを「女の子「……どうも」」または「？？？「……どうも」」に修正する。 | 確実 |

---

### 観点3: 「昨日」「この前」「明日の大会」などの時間表現が、発火する日と本編の出来事の順序に合うか

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| C3-01 | `data/dialogue/ch1_spots.json:717-720` | `南雲会長は、最後までじっくり見てから点を入れる方ですよ` (`cs_stage_setup` の `work_after` 分岐内) | `work_after` は大会終了後（`tournament_finished`）に再生されるブランチであるが、大会前（`work_before`）の事前助言と同じトーンで「点を入れる方ですよ」と話している。大会終了後であれば「今回の大会でも最後まで見てから点を入れておられましたね」などの振り返り表現が自然。 | 「今回の大会でも、南雲会長はじっくり見てから点を入れておられましたね」等、大会後の振り返り表現に改める。 | 要確認 |
| C3-02 | `data/dialogue/ch3_spots.json:121` | `バイトが終わり、mukaiの裏口から帰ろうとした時のこと。` (`ch3_mukai_tetsuko`) | 主人公は第3章の東京滞在中、mukaiで正式に「バイト」雇用されているわけではなく、スミさんの紹介による遠征・修行・手伝いの身である。また自由行動のスポット会話の導入として「バイトが終わり」と書かれているのは状況設定と齟齬がある。 | 「手伝いが終わり、mukaiの裏口から出た時のこと。」等に変更する。 | 要確認 |

---

### 観点4: 同じ情報を本編や別の会話と二重に伝えていないか

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| C4-01 | `data/dialogue/ch1_spots.json:532-535` | `staff_choizap「あ、ちなみに今回のレギュ、レモン2g以上必須なの知ってます？」` (`cs_staff_greeting`) | 本編では初日DAY1の買い出し・帰店時にスミさんからレモン課題（2g必須）について既に説明を受けて私物支給されている。C.STATIONスタッフが「知ってます？」と初見のように尋ね、主人公も「（ミントで差がつく……か。覚えておこう）」と初めて知ったように受け取れる表現になっており、情報の伝達が重複している。 | 「レモン2gの課題、もう準備してます？ 常連の間じゃミントの扱いで差がつくって話題ですよ」等、課題をすでに把握している前提の台詞に調整する。 | 要確認 |

---

### 観点5: シーシャの知識で、実際の作り方と違う断定をしていないか（水が有害物質を取るかは「諸説ある」扱い、断定は指摘対象）

該当なし（確認範囲：全7対象ファイル）

- 精査結果メモ:
  - `data/baito_events.json:282-283` (`baito_body_bad_01`): 「シーシャって体に悪いんでしょ？」という客の問いに対し、「ニコチンは入っています。無理せずどうぞ」「シーシャにもニコチンは入っていること。無理に吸う必要はなく、ゆっくり味わえば十分なことを簡単に説明する」と回答しており、「水が有害物質を除去する」「無害である」といった誤った断定は一切行われていない。
  - パッキングや熱管理（`baito_trouble_01` の詰めすぎ解消、`baito_trouble_04` のHMS蓋ずらしによる温度下げ、`cs_kemuri_solo` の火入れ時間0.5秒の差、`kannon_adam` のダブルアップルの風味維持など）も、実際のシーシャの器具・構造・抽出原理に即した適切な描写となっている。
