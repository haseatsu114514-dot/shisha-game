# #1178 第3章の時系列・フラグ・正本設定・シーシャ知識方針チェック

## 判定と対象時点

- 2026-10-28、Antigravity（ブランチ: `agy/1178-ch3-timeline-flags-20261028`、作業ディレクトリ: `/home/box/repos/worktrees/slot-h1`）。
- [Issue #1178](https://github.com/haseatsu114514-dot/shisha-game/issues/1178) に基づく、第3章の会話・ストーリー・設定の監査報告。一人称および表記揺れ（アルファーヘブン等）は先行の [issue1178-ch3-pronoun-notation/README.md](../issue1178-ch3-pronoun-notation/README.md) で調査済みのため対象外。神崎（kumicho）の口調は別作業で対応するため対象外。
- オーナー決定（10/28）「第3章大会の課題はドバジ チョコレート（通常）4g以上、大会中は課題フレーバーを無制限支給に変更予定（実装中）」を踏まえ、支給量に関する記述は指摘から除外した。
- 本セッションでは一切のコード修正を行わず、本報告ドキュメントのみを新規作成した。ゲーム本体・データ・設定資料は変更していない。
- **指摘は計12項目（確実7／要確認5）**。水・有害物質の断定記述については**該当なし（0件）**を確認した。

## 確認範囲

1. **第3章主台本・関連対話データ（13ファイル）**:
   - `data/dialogue/ch3_activities.json`
   - `data/dialogue/ch3_deliveries.json`
   - `data/dialogue/ch3_double_apple.json`
   - `data/dialogue/ch3_main.json`
   - `data/dialogue/ch3_mashiro.json`
   - `data/dialogue/ch3_mukai.json`
   - `data/dialogue/ch3_prologue.json`
   - `data/dialogue/ch3_rivals.json`
   - `data/dialogue/ch3_spots.json`
   - `data/dialogue/ch3_tsumugi.json`
   - `data/dialogue/ch3_visits.json`
   - `data/dialogue/ch3_volk.json`
   - `data/dialogue/remake_ch2.json`
2. **第3章章進行・ランナーJS（13ファイル）**:
   - `remake/js/chapters/ch3.js`
   - `remake/js/chapters/ch3-progress.js`
   - `remake/js/chapters/ch3-wayfinding.js`
   - `remake/js/chapters/ch3-deliveries.js`
   - `remake/js/chapters/ch3-map.js`
   - `remake/js/chapters/ch3-map-model.js`
   - `remake/js/chapters/ch3-activities.js`
   - `remake/js/chapters/ch3-activity-progress.js`
   - `remake/js/chapters/ch3-social.js`
   - `remake/js/chapters/ch3-tournament.js`
   - `remake/js/chapters/ch3-tournament-state.js`
   - `remake/js/chapters/ch3-aftermath.js`
   - `remake/js/chapters/ch3-aftermath-progress.js`
3. **メッセージデータ**:
   - `data/lime_messages.json`（全1,316行、特に第3章トリガーおよび噂メッセージ）
4. **補助・正本設定資料**:
   - `docs/master_spec.md`
   - `docs/setting_book/`（`01_story.md`, `02_characters.md`, `03_world_shops.md`, `04_glossary.md`, `05_tournament.md`, `06_flavors_recipes.md`）
   - `brand/story_and_structure.md`
   - `brand/character_profiles.md`
   - `docs/gameplay_agent_reference.md`
   - `data/flavors.json`
   - `remake/data/lover.json`
   - `data/dialogue/tournament_craft.json`

---

## 指摘一覧

### 1. 時系列・日数・予定の矛盾（3項目：確実3）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| T01 | `remake/js/chapters/ch3-progress.js:19,31–33`、`data/dialogue/ch3_main.json:165,170`、`data/dialogue/ch3_rivals.json:486` | 「夕方には、もう少し食べられた」「明日は、俺も一台作ってみたいです」／行程配列 | 新規開始（`routeVersion: 2`）では `ch3_abyss_recovery`（mukai）と `ch3_kuze_advice`（煙幕）が同じ DAY11 昼（slot 0）に連続配置されている。場面内で夕方まで経過し「明日は〜」と翌日の試作を予告した直後に、同日昼の煙幕で試作を行っており、同一スロットの重複・時間の巻き戻り（夕方→昼）・予告との齟齬が生じている。 | `ch3-progress.js` の行程で場面の日程配置を整理する（例: `ch3_taste_return` を DAY9夜、`ch3_abyss_recovery` を DAY10昼とする、または DAY11内の場面進行を昼・夜で分ける）。本文側の表現も「夕方には」を昼までの描写とし、「明日は」を「このあと／もう一度」等に調整する。 | **確実** |
| T02 | `docs/setting_book/01_story.md:85,92–94`、対照 `remake/js/chapters/ch3-progress.js:10–15,27–32` | 「嘘と回復の手順（**DAY7〜DAY13**）」直下にグレープ事件を説明 | ゲーム本編では事件は DAY3夜、休息DAY4昼、今日の一杯DAY4夜、仕事DAY5夜、味覚回復DAY10夜。資料見出しの「DAY7〜DAY13」では事件までDAY7以降に見え、本編行程および正本 `brand/story_and_structure.md:72` の日程（DAY3試し、DAY4作れない日、DAY5仕事）と乖離している。 | 資料側で事件・初期生活を DAY3〜5、回復の積み重ねを DAY5〜11 に整理する。旧セーブ用のDAY5〜6回復日程は別記するか整理する。 | **確実** |
| T03 | `data/lime_messages.json:611–657,741–784` | 南雲「君はmukaiという店に行ったことがあるかね」、あげは「裏渋にヤバい人いるって。ムカイさんとこに出没するらしい」 | はじめは第3章DAY1から裏渋のmukaiに滞在して働いており、DAY2朝には店主からシガーマンの噂を聞き（`ch3_mukai_intro`）、DAY3夜にはましろと事件を経験している。DAY4に南雲から「mukaiに行ったことがあるか」、DAY6にあげはから「裏渋のムカイさんとこに出没する」と届くのは、滞在状況・時系列と矛盾している。 | 第2章（東京遠征前の地元滞在期）で東京の噂として届くように trigger 条件（`chapter: 2` 等）を変更するか、第3章に残すならはじめが既にmukaiに滞在している前提の文面に改める。 | **確実** |

---

### 2. 好感度・フラグ・既読管理と台詞の整合（2項目：確実1／要確認1）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| F01 | `data/lime_messages.json:769` (`rumor_ageha_mashiro`) | 「会えたら、その煙を見てみたい」 | はじめはDAY1からましろと一緒に勤務しており、DAY3にはましろが作った煙を実際に吸っている。既に日常的に会い、煙を吸っている相手について、あげはからの噂に対して「会えたら、その煙を見てみたい」と答えるのは既読・面識フラグ管理上破綻している。 | LIMEメッセージ自体の発火時期を第2章へ移行するか、第3章用とする場合は「毎日一緒に働いていますが、まだその煙の正体は分かりません」等の既読整合の取れた返信選択肢に修正する。 | **確実** |
| F02 | `data/dialogue/ch3_volk.json:421,519,641,719,811`、`data/dialogue/ch3_mashiro.json:211`、`data/dialogue/ch3_spots.json:24,68,102,186` | 「……【技術】と【センス】が少し上がった。」「……【根性】と【魅力】が上がった。」等 | `brand/story_and_structure.md:91–93` では「能力値は上げない」「熟練度の付与は味の学習を明示した会話に限り、必須イベントの読了だけで親密度を上げない」と規定されている。未接続原稿とはいえ、旧仕様のステータス上昇演出が残存しており、将来 runner に接続する際にそのまま再生されると現行の成長システム（フレーバー熟練度のみ成長）と矛盾する。 | 未接続原稿を runner へ接続する際にステータス上昇演出・オブジェクト（`growth_stats` や地の文）を削除し、必要であれば `flavor_lesson` 経由のフレーバー熟練度付与へ置き換える。 | **要確認** |

---

### 3. docs/master_spec.md・docs/setting_book/ の正本設定との矛盾（4項目：確実3／要確認1）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| S01 | `data/dialogue/ch3_rivals.json:100,170,431`、対照 `docs/setting_book/01_story.md:89,102`、`02_characters.md:206,210`、`05_tournament.md:75`、`06_flavors_recipes.md:40` | 台本「柑橘と**アールグレイ**」／資料「フローズンシトラス＋**ブラックティー**」 | 久世の扱う紅茶銘柄が台本では「アールグレイ」、資料集では「ブラックティー」となっており不一致。正本側でも `brand/character_profiles.md:193`（アールグレイ支持）と `brand/story_and_structure.md:99`（ブラックティー支持）で分かれている。`data/flavors.json` では両者は別ID・別銘柄。 | 正本側で統一設定を確定し、台本または設定資料集の記述を揃える（機械的な一括置換はしない）。 | **要確認** |
| S02 | `data/dialogue/ch3_prologue.json:8–16`、対照 `docs/setting_book/01_story.md:97`、`02_characters.md:118,209` | 台本「少年は、描いたばかりのレモンケーキを膝にのせて……」／資料「ましろがお菓子、自分〔久世〕がお茶の絵を描いた」 | 描いた人物と絵の内容が逆転している。台本は久世が菓子の絵を描き、ましろが「僕にはお茶。でも好き」と寄り添った。`brand/character_profiles.md:185` や大会結果台詞（`ch3_main.json:995`）も台本側を支持している。 | 資料側の記述を「久世がお菓子の絵を描き、ましろがお茶の絵／お茶を飲んでいた」形に修正する。 | **確実** |
| S03 | `docs/setting_book/01_story.md:91`、対照 `data/flavors.json:294–304`、`data/dialogue/ch3_volk.json:130` | 資料「新発売の**ダークリーフ**『ナイトサイド ブラストミント』」／現行商品 `"leaf": "blond"` | 資料が葉種を誤っている。商品データではブロンドリーフであり、はじめも試喫しているため、資料に合わせてダークリーフ化すると「主人公はブロンドのみ」という方針と衝突する。 | 資料側の「ダークリーフ」を「ブロンドリーフ」または葉種を限定しない記述に改める。 | **確実** |
| S04 | `remake/data/lover.json:1014,1019`（`dates.mashiro.optA / optB`） | 「**ましろの**好きな重い煙も」「煙より、**ましろと**過ごす時間が好きだ」 | `docs/master_spec.md:254–258`、`docs/setting_book/02_characters.md:114`、`docs/gameplay_agent_reference.md:363–365` ではじめからましろへの呼称は「ましろちゃん」と定められているが、はじめの発話引用内で呼び捨てになっている（共通デート原稿）。 | 引用内を「ましろちゃんの」「ましろちゃんと」に修正する。 | **確実** |

---

### 4. シーシャ知識の記述方針（3項目：要確認3 ＋ 有害物質方針適合：該当なし）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| K01 | `data/dialogue/ch3_volk.json:337,347` (`ch3_volk_second`) | 「前回、室温は22度だった。今日は……25度」「**3度違えば、最適な炭量は変わる**。今日は少し下げる」 | 環境変化で炭を調整する実践と、「3度の差」から最適炭量を決める断定は別。固定的な数値則としての裏付けに乏しく、疑似精密な数値断定に抵触する可能性がある（Issue #1107 既報候補）。 | ヴォルク個人の経験則・流派としての発言である旨を補足するか、「気温が上がれば熱の回りが変わる」等、固定数値への過度な断定を和らげる表現への調整を検討する。 | **要確認** |
| K02 | `data/dialogue/ch3_rivals.json:570–580` (`ch3_steve_low_heat`) | 「マウンテンミスト。レモンとライム、最初と二口目で違うだろ」「**熱を急ぐと、後のライムが消える**。だから少し待つ」 | 熱の順序で特定柑橘が消えるという具体的な因果について、正本や一般的な調合知見に出典が見当たらない。スティーブ独自の体感・失敗経験としての台詞か、シーシャ知識としての断定かの境界が曖昧。 | 「俺の作り方だと〜」「前はそれでライムを飛ばした」等、スティーブ個人の試行錯誤や癖としての語りに限定する表現に整える。 | **要確認** |
| K03 | `data/dialogue/ch3_rivals.json:561` (`ch3_steve_low_heat`) | 「スティーブの大きな指が、炭を**数ミリずつ**外へずらす。」 | 炭を外側へずらして火力を弱めること自体は実務どおりだが、「数ミリずつ」というミリ単位の疑似精密表現が地の文で用いられている。 | 「炭を少しずつ外へずらす」「わずかに外へずらす」など、ミリ単位の数値を避けた自然な動作描写にする。 | **要確認** |

#### 水・有害物質に関する記述方針の適合確認
- **該当なし（確認範囲: 第3章主台本12ファイル、remake_ch2.json、ch3*.js全13本、lime_messages.json）**:
  「水が有害物質を濾過する」「ニコチンがなくなる」「無害化される」等の誤った記述・断定は一切検出されなかった。作中に登場する「水」はチェイサー（飲み水）、お茶、または仕込み工程（`stepWater`）に限られており、有害物質については「諸説ある」とし、ボトルの水は冷却作用に留める従来方針に完全に適合している。

---

## 指摘件数まとめ

- **時系列・日数・予定の矛盾**: 3件（確実3）
- **好感度・フラグ・既読管理と台詞の整合**: 2件（確実1／要確認1）
- **正本設定との矛盾**: 4件（確実3／要確認1）
- **シーシャ知識方針（疑似精密な数字）**: 3件（要確認3）
  - ※水・有害物質の断定記述: **該当なし（0件）**
- **総合計: 12件（確実7件／要確認5件）**
