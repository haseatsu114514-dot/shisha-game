# #1178 第3章の会話・ストーリー整合性チェック

## 判定と対象時点

- 2026-10-28、Codex C。参照HEAD: `ecacdb07ac92c97978aa890e75ae1c3f78186059`（開始時の `origin/main` と一致）、branch: `codex/c-1178-ch3-20261028`。
- [Issue #1178](https://github.com/haseatsu114514-dot/shisha-game/issues/1178) の本文・コメントを `gh issue view 1178 --json title,body,comments` で確認した。第1章の[報告形式](../issue1178-ch1-pronoun-notation/README.md)を踏襲した、修正判断前の報告。変更はこのREADMEだけ。ゲーム本体・データ・設定資料は編集していない。
- **指摘は9項目（確実5／要確認4）**。同じ問題の複数行は1項目にまとめた。第3章の実表示候補、設定資料側の食い違い、未接続原稿・共通データの候補を区別する。9件の実機不具合を再現したという意味ではない。
- **はじめの一人称「俺」以外、ましろの「僕」以外、アルファーヘブンの表記揺れは、下記確認範囲で該当なし**。はじめを「僕」に戻す提案はない。
- 確信度の「確実」は本文・正本・接続順の直接比較で食い違いを確認できるもの。「要確認」は例外の採否、正本同士の整理、実店舗の出典・演出としての扱いに判断が要るもの。機械的な一括置換はしない。
- `docs/setting_book/README.md:6–7` と `HANDOVER.md:14` は資料集を二次資料とし、食い違う場合は正本を優先するとしている。資料集との差を理由に、現在の台詞を古い記述へ戻すことは勧めない。
- **PR #1166 の未マージ差分は対象外**。チョコレート指定課題・追加のほうじ茶ミックスは調査・評価していない。同PRが触るファイルも、本報告では上記HEADの既存本文だけを読んだ。第2章の点検・編集、保留Issue #768 / #736 / #563 / #489 / #627 / #471 の検討には踏み込まない。

## 確認範囲

JSは `remake/js/chapters/ch3*.js` の13本。直書きの台詞・地の文・カードのDAY/昼夜・予定・表示名と、台本を読む箇所を確認した。

- `ch3.js`、`ch3-progress.js`、`ch3-wayfinding.js`
- `ch3-deliveries.js`、`ch3-map.js`、`ch3-map-model.js`
- `ch3-activities.js`、`ch3-activity-progress.js`、`ch3-social.js`
- `ch3-tournament.js`、`ch3-tournament-state.js`
- `ch3-aftermath.js`、`ch3-aftermath-progress.js`

依頼にある `remake/data/` を検索した上で、実台詞の参照先もたどった。`remake/js/chapters/ch2-city-data.js:29` の `readDialogues()` は `../data/dialogue/${name}.json` を読むため、第3章の主台本はリポジトリ直下の `data/dialogue/` にある。`remake/js/core/data.js:92–95` は別途 `remake/data/` の恋人・友人・実況データを読む。

主要JSONは以下の12本、**71シーン・830表示文字列フィールド**。全シーンの `lines`、`branches`、`choices` を再帰的に読み、`text / inner / title / label / name / description` を抽出した。これはシーン到達数・不具合件数ではない。

| `data/dialogue/` 以下のファイル | シーン数 | 表示文字列フィールド数 | 現行第3章での扱い |
|---|---:|---:|---|
| `ch3_activities.json` | 2 | 8 | 東京のジム昼夜 |
| `ch3_deliveries.json` | 5 | 29 | DAY2の配達・顔合わせ |
| `ch3_double_apple.json` | 7 | 99 | 到着・事件・休息・回復。`ch3_minto_small_lies` は現行runnerのロード対象外 |
| `ch3_main.json` | 20 | 268 | 導入・なるへの電話・大会・後日談・作戦会議 |
| `ch3_mashiro.json` | 4 | 37 | 任意交流の原稿。現行runnerへの接続は確認できず |
| `ch3_mukai.json` | 3 | 17 | `ch3_mukai_intro` を使用。噂・大会後の2場面はロード対象外 |
| `ch3_prologue.json` | 3 | 28 | 幼少期・久世の調査・列車 |
| `ch3_rivals.json` | 5 | 115 | 久世の初来店・mukai来店・助言、スティーブを使用。エミル体験会はロード対象外 |
| `ch3_spots.json` | 5 | 32 | 任意スポット等の原稿。現行runnerへの接続は確認できず |
| `ch3_tsumugi.json` | 1 | 15 | 東京での任意交流原稿。現行runnerへの接続は確認できず |
| `ch3_visits.json` | 10 | 45 | 地元の恋人5人の東京合流・散歩 |
| `ch3_volk.json` | 6 | 137 | `ch3_volk_first` を使用。2〜4回目・大会後の原稿はロード対象外 |

補助確認したデータ・参照先は次のとおり。共通データの全章監査をしたとは扱わない。

| ファイル | 確認した部分・用途 |
|---|---|
| `remake/data/lover.json` | `mashiro` の誘い・断り・朝・記念日・大会当日・デートと、プレイヤー返信。一人称と呼称。S05はこの共通原稿の候補 |
| `remake/data/broadcast.json` | `chapter3.rivalComments / rivalFeed` の10文。その他の共通実況は対象語の機械検索のみ |
| `remake/data/friends.json` | 東京・ましろ・章3指定の有無を検索。`mashiro` 固有データはなし。他キャラの全章分は精査対象外 |
| `data/dialogue/tournament_craft.json` | `craft/tournament-story-data.js` が第3章で選べる25シーン・34台詞。`opening_3 / waiting_3` と共通工程、第3章のエミル差分を確認 |
| `data/tokyo_visits.json` | 旅程とLIMEの文面、二日前予約・二日滞在・合流と散歩の前提 |
| `data/story_routes.json` | 第3章本筋の順序と任意原稿の区別。実行順の正は章runnerと明記されている |
| `remake/js/core/{chapter-clock,tokyo-clock,tokyo-visits}.js` | 通算日と章内DAY、自由時間、東京・帰郷の判定。予定を実機で総当たりしたわけではない |
| `remake/js/daily/romance.js:222–240` | 共通デート原稿の利用元。第3章runnerからましろの通常デートを開始する導線は確認できず |

照合先は `docs/master_spec.md`、`docs/setting_book/{README,01_story,02_characters,03_world_shops,04_glossary,05_tournament,06_flavors_recipes,HANDOVER}.md`、その正本である `brand/{story_and_structure,character_profiles}.md`、`data/{characters,flavors}.json`。交流・面識の判断には `docs/gameplay_agent_reference.md:383–391` も参照した。

## 指摘一覧

位置は上記HEADのリポジトリ相対パス・行番号。資料側に問題がある候補も、その方向を明記する。

### 時系列・DAY・予定（2項目）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| T01 | `data/dialogue/ch3_main.json:150,155` / `ch3_abyss_recovery`、`remake/js/chapters/ch3-progress.js:19,31–33` | 「**夕方には**、もう少し食べられた」「**明日は**、俺も一台作ってみたいです」 | 新規開始の `routeVersion: 2` は回復をDAY11昼に配置し、その直後にDAY11昼の `ch3_kuze_advice` へ進む。場面内で夕方まで進み翌日の試作を望んだ後、同日昼の煙幕で試作する（`ch3_rivals.json:426`）。夕方→昼の巻き戻りがあり、「明日」の予告とも噛み合わない。旧行程では回復がDAY6なので、同じ矛盾とは扱わない | DAY11昼の行程を保つなら「夕方には」を昼までの描写にし、「明日」は「このあと／もう一度」等、その日の試作へつながる文に整える候補。翌日の約束を残すなら場面配置の判断が必要。今回は変更しない | **確実**（新行程と本文の差） |
| T02 | `docs/setting_book/01_story.md:85,92–94`、対照 `remake/js/chapters/ch3-progress.js:11–13,28,31–32` | 「嘘と回復の手順（**DAY7〜DAY13**）」の直下でグレープをダブルアップルと偽る事件を説明 | 現行の事件はDAY3夜、休息DAY4昼、一杯DAY4夜、仕事DAY5夜、味の輪郭DAY10夜、翌日の揺れDAY11昼。資料の見出しでは事件までDAY7以降に見える。`brand/story_and_structure.md:72` の現行日程とも異なる。ゲーム側のDAYを動かす根拠にはならない | 資料側で事件・初期の生活をDAY3〜5へ、回復をDAY10〜11へ整理する。旧セーブ用のDAY5〜6回復は、新規行程と混ぜず必要なら別記する | **確実**（資料側の日程不一致） |

### master_spec・設定資料・呼称（5項目）

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| S01 | `data/dialogue/ch3_prologue.json:30`、`ch3_rivals.json:41,233,240`、`ch3_main.json:576,860` | 「公式ハイライト。**蒸野はじめ**」「配達で会った**久世朔**」「優勝、**蒸野はじめ**！」等 | 自己紹介ではない表示本文6フィールドにフルネーム7出現（:576は2人）。`docs/master_spec.md:254–258` は通常会話・選択肢等のフルネーム表示を禁止し、自己紹介・設定資料のみを許す。ポスター・一覧・大会MCを例外にするかは明記なし。第1章報告N02と同種 | 原則に合わせるなら、はじめ／久世など短い呼び名へ。大会MC・作中資料を例外にする場合は先に適用範囲を整理する。配達や到着時の本人の名乗り（`ch3_deliveries.json:65,70,123,176`、`ch3_double_apple.json:23`）は正しいので含めない | **要確認**（字面は確実、例外判断が必要） |
| S02 | `data/dialogue/ch3_rivals.json:100,371`、対照 `docs/setting_book/01_story.md:89,102`、`02_characters.md:206,210`、`05_tournament.md:75`、`06_flavors_recipes.md:40` | 台本「柑橘と**アールグレイ**」／資料「フローズンシトラス＋**ブラックティー**」 | 紅茶の具体銘柄が一致しない。`brand/character_profiles.md:193` はアフサール アールグレイで台本を支持する一方、`brand/story_and_structure.md:99` は久世＝ブラックティーとし、正本側にも差が残る。`data/flavors.json:2075–2108` ではブラックティーとアールグレイは別ID・別銘柄。単なる別名として扱えない | 正本内の意図を確認し、具体銘柄をそろえてから資料集を追随させる。台本だけをブラックティーへ置換しない。#1166の追加ミックスとは別の、現行HEADにある不一致 | **要確認**（正本同士にも差） |
| S03 | `data/dialogue/ch3_prologue.json:8–16`、対照 `docs/setting_book/01_story.md:97`、`02_characters.md:118,209` | 台本「**少年は、描いたばかりのレモンケーキ**を膝にのせて、お茶を一口飲んだ」／資料「**ましろがお菓子、自分〔久世〕がお茶の絵**を描いた」 | 描いた人物と絵の内容が逆。台本は久世が菓子の絵をお茶に見立てて笑われ、ましろが異なる味のまま隣にいる。`brand/character_profiles.md:185` の回想設定・`ch3_main.json:900–905,990–995` の回収も台本側と一致する | 資料側を「久世が描いた菓子の絵と飲んでいたお茶、ましろの『僕にはお茶。でも好き』」へそろえる。ましろが菓子を描く新しい出来事を台本へ足さない | **確実**（資料側の人物・行動不一致） |
| S04 | `docs/setting_book/01_story.md:91`、対照 `data/dialogue/ch3_volk.json:130–145`、`data/dialogue/ch3_main.json:675`、`data/flavors.json:294–304` | 資料「新発売の**ダークリーフ**『ナイトサイド ブラストミント』」／現行商品 `"leaf": "blond"` | 資料が葉種を誤っている。台本のはじめもヴォルクのブラストミントを試喫するが、現行商品はブロンドなので「はじめがダークを吸った」という違反ではない。資料を根拠に商品データをダークへ変えると、主人公はブロンドのみという方針と衝突する | 資料側の「ダークリーフ」を「ブロンドリーフ」または葉種を断定しない銘柄紹介に直す候補。現行の `leaf` と試喫場面は保つ | **確実**（資料側の葉種不一致） |
| S05 | **補助範囲・現行第3章の導線未確認**: `remake/data/lover.json:1014,1019` / `dates.mashiro.optA / optB` | 「**ましろの**好きな重い煙も」「煙より、**ましろと**過ごす時間が好きだ」 | はじめが実際に伝える引用内の呼称が呼び捨て。`docs/setting_book/02_characters.md:114` と `docs/gameplay_agent_reference.md:363–365` ははじめ→ましろを「ましろちゃん」で統一する。地の文の「ましろ」（同:1012）はこの問題に含めない。通常デートの共通原稿で、現在の第3章runnerからの再生は確認できない | 引用内を「ましろちゃんの」「ましろちゃんと」にする候補。共通原稿の修正判断として引き継ぎ、現行第3章の再現バグとは分ける | **確実**（原稿の呼称差。導線は未確認） |

### シーシャ知識・出典（2項目）

水・有害物質については**該当なし（主対象12JSON・第3章JS13本・上記補助文面を確認）**。「水が有害物質を除く」「ニコチンがなくなる」等の断定は検出しなかった。「諸説ある」を付ける必要がある説明自体がない。飲み水・お茶の提供と、ボトルの水の作用は区別した。これは作品内方針への適合確認であり、「諸説ある」を医学的な結論として検証したものではない。

| ID | ファイル:行 | 抜粋 | 問題 | 修正案 | 確信度 |
|---|---|---|---|---|---|
| K01 | **現行runnerでは未接続・既報**: `data/dialogue/ch3_volk.json:337,347` / `ch3_volk_second` | 「前回、室温は22度だった。今日は……25度」「**3度違えば、最適な炭量は変わる**。今日は少し下げる」 | 環境を見て調整する一般的な実践と、「3度」の差から最適炭量を決める断定は別。下記R1/R3は環境や吸われ方による調整、R2は機材に応じた炭の選定を説明するが、この数値則を裏付けない。既に `docs/reports/issue1107-c-items-candidates-20261028.md:231–258` のC9で判断候補として報告済み。新規の不具合や解決済みとは数えない | #1107の既報へ合流する。数値を残すならヴォルク個人の記録・今回の条件に限定する根拠を確認。代案も、実証していない「湿度でミントが必ず変わる」等の別の断定へ置換しない | **要確認**（数値の出典・演出判断。既報） |
| K02 | `data/dialogue/ch3_rivals.json:510–520,540` / `ch3_steve_low_heat`、参照元 `brand/character_profiles.md:199–203`、`data/flavors.json:1898` | 「レモンとライム、**最初と二口目で違う**」「**熱を急ぐと、後のライムが消える**」 | マウンテンミストの柑橘系という設定は正本と一致する。一方、決まった順番で香りが出て、急加熱で後半のライムだけが消えるという具体的な因果について、今回読んだ正本・台本に検証出典は見つからない。参考商品の販売者説明R4はレモン／ライム系を支持するが、同じ時間順・加熱則を説明していない。創作銘柄なので実在商品と同一とも断定できない | 香りの順序・熱の影響を実店舗等の複数の出典で確かめる。根拠が整わなければ、スティーブが今回の一台で感じたこと・目指す味・失敗経験として範囲を限定する候補。新しい技法や加熱則を作らない | **要確認**（設定との一致と実在性は別） |

出典の補助照合（2026-10-28、ページ本文のみ。画像・動画・大容量ファイルの取得なし）:

- **R1**: 実店舗・香楽 現_UtuTu「[気候が変われば味も変わる？シーシャと環境の不思議な関係](https://shisha-kagura.jp/ututu/archives/1934)」。環境に応じた炭の調整例はある。3℃差の数値則を実証する資料としては使わない。
- **R2**: メーカーHOOKY「[Hooky Steel User Guide v3.00](https://www.hooky-shisha.com/document/userguide-steel.pdf)」英語のCHARCOAL節（冊子p.15）。炭の適切な個数・寸法はHMDメーカーの推奨に従うとしている。室温だけから一律に決める根拠にはならない。
- **R3**: 実店舗・けむりちゅーどく「[炭の調整に関して](https://kemuchu-akb.com/blogs/shisha/charcoal)」。吸い方による炭の消耗差や、スタッフによる調整を説明。個別のミント・ライムの温度特性の裏付けにはしない。
- **R4**: 販売者Hookah.com「[Trifecta Shisha Tobacco Mountain Fog](https://hookah.com/p/trifecta-mountain-fog-shisha-tobacco-hc)」。元ネタ候補のレモン・ライム系という特徴を確認する範囲で使用。作中銘柄の全特性を現実へ置き換える資料ではない。

## 該当なし・指摘に含めなかったもの

- **(1) 一人称: 該当なし（主対象71シーン・830フィールド、第3章JS13本、補助の大会25シーン、ましろの共通恋人文面・返信）**。はじめの「俺」、ましろの「僕」を確認した。選択肢・話者なしの内心も検索し、久世の「僕」や幼少期の少女＝ましろの「僕」を誤りとして数えていない。一人称が省略された文へ無理に補う提案もない。
- **(2) アルファーヘブン: 該当なし（主対象12JSON・第3章JS13本、`remake/data/{lover,broadcast,friends}.json` の対象語検索）**。主対象の台詞にはメーカー日本語名の直書き自体がなかった。フレーバーIDから読む表示名は `data/flavors.json` の正しい「アルファーヘブン」を確認したが、全店舗・全画面を再生確認した意味ではない。
- **大会の基本形**: 全国本戦ははじめ・久世・スティーブ・ヴォルクの四人同時一試合。審査員は南雲・博士・エミル。大会前夜DAY13→本戦DAY14、優勝夜DAY14→mukai/なるへの報告DAY15→帰郷/つむぎDAY16→あげはDAY17という配置を確認。後日談が14日を越えること自体は矛盾扱いしない。#1166の未マージ課題変更との比較はしていない。
- **なる**: 先にDAY7の地域大会、DAY13夜の代表決定大会前夜、DAY14の別会場の勝利、DAY15の報告と進む。第3章全国本戦の四人には入っていない。電話は全国優勝前に接続され、呼び捨てはDAY15の本人の了承後。地域大会から代表決定大会への進行を、本戦内の多段戦や敗者復活と混同しない。
- **面識・既読**: 配達と自主来店を分ける分岐、つむぎの公募会話の既読分岐を確認。`ch3-deliveries.js` の読了フラグ、久世・ヴォルク台本の配達済み/面識分岐を読んだ。好感度だけを根拠に未読の公募の約束を断定する形にはなっていない。未接続の任意交流原稿は、現在到達できる進行バグと断定しない。
- **予定**: 東京訪問は受諾した合流・散歩枠を読み、本文も「約束した自由時間」としている。新旧行程で本筋と同じ昼夜を使う既存予約の扱い等は実機未検証であり、予定競合が全分岐で存在しないとは保証しない。
- **回復とテーマ**: グレープで試す過ちと謝罪、受診・休息・食事・仕事を続ける回復、翌日の揺れは現行正本と一致。ましろが魂や「本来の人格」を認証する説明、利き煙特訓で治癒するとする断定は見つからない。ダブルアップルのアニス・リコリスという作中設定も一致する。病状・治療の医学的評価は対象外。
- **スミの肩書き**: 第3章台本に「はじめの師匠」を否定する直書きはない。共通の `data/characters.json:56` にある「表舞台を降りた名人」は第1章報告X01の既報であり、今回の9項目には重複計上しない。

## 確認方法・再確認用コマンド

機械検索の候補を、その前後・話者・条件・ローダー・進行表と照合した。`rg` の一致なし（終了値1）は検査失敗と区別した。

```bash
gh issue view 1178 --json title,body,comments
gh pr list --state open --limit 100 --json number,title,files
rg --files remake/js/chapters remake/data docs/setting_book
rg -n 'readDialogues|ch3_|data/' remake/js/chapters/ch3*.js remake/js/chapters/ch2-city-data.js remake/js/core/data.js
rg -n '俺|オレ|おれ|僕|ぼく|ボク|私|わたし|あたし|うち|我|余|ミー' data/dialogue/ch3*.json remake/js/chapters/ch3*.js
rg -n 'アルファ|アルフア|ヘブン|ヘヴン|Al.?Fakher|Alpha' data/dialogue/ch3*.json remake/js/chapters/ch3*.js remake/data/{lover,broadcast,friends}.json
rg -n 'DAY|day:|slot:|翌日|明日|昨日|夕方|大会後|tournament_finished' remake/js/chapters/ch3*.js data/dialogue/ch3*.json
rg -n '諸説|有害|ニコチン|タール|濾過|ろ過|無害|水が|水で|グリセリン' data/dialogue/ch3*.json remake/js/chapters/ch3*.js remake/data/{lover,broadcast,friends}.json
rg -n 'アールグレイ|ブラックティー|ブラストミント|マウンテンミスト|幼少|お茶の絵' brand/{story_and_structure,character_profiles}.md docs/setting_book/ data/flavors.json
```

主要JSONの集計・話者別の一人称候補の抽出はPython標準ライブラリで行った。再確認用の抽出条件:

```python
import collections, json, pathlib, re
pronouns = re.compile('俺|オレ|おれ|僕|ぼく|ボク|私|わたし|あたし|アタシ|わし|ワシ|余|我|うち|ウチ|ミー')
def walk(value, rows, scene='', speaker='', path=''):
    if isinstance(value, dict):
        scene = value.get('dialogue_id', scene)
        speaker = value.get('speaker', speaker)
        for key, child in value.items():
            location = path + '.' + key
            if isinstance(child, str) and key in ('text', 'inner', 'title', 'label', 'name', 'description'):
                rows.append((scene, location, speaker, child))
            elif isinstance(child, (dict, list)):
                walk(child, rows, scene, speaker, location)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            walk(child, rows, scene, speaker, f'{path}[{i}]')
totals = collections.Counter()
for file in sorted(pathlib.Path('data/dialogue').glob('ch3*.json')):
    data = json.loads(file.read_text())
    rows = []
    walk(data, rows)
    print(file, len(data['dialogues']), len(rows))
    totals.update(files=1, scenes=len(data['dialogues']), fields=len(rows))
    for row in rows:
        if row[2] in ('hajime', 'mashiro') and pronouns.search(row[3]):
            print('PRONOUN', *row, sep='\t')
print(dict(totals))
```

この抽出に加え、話者なしの本文・選択肢・文字列配列を読み、引用中の話者を確認した。単語の一部や他人の引用を誤った一人称に数えていない。

## 検証・残る判断・保存

- 実施: 指定の `AGENTS.md` / `docs/tools/pr_change_preflight.md` / 共通ログを読了。Git root・必要ディレクトリ・`project.godot` 不在・開始時の差分なしを確認。Git Safetyは成功、hooksは `.githooks`、canonicalRootはworktreeの親checkoutと一致。設定変更・追加clone/worktreeは行っていない。
- 実施: Issue本文と開いているPRの実変更ファイルを確認。編集先READMEに重複なし。第2章・編集禁止ファイルに変更なし。
- 実施: 主要12JSON・補助JSONの構文読み取り、全主要表示文の前後・話者・条件・章内日程の照合、日英の小規模な出典確認、READMEの行参照と空白差分の確認。
- 未実施: ゲームのnode回帰テスト、ブラウザ再生・スクリーンショット、CI。文書だけの調査のためサーバーは起動していない。全予約・全SAVE/LOAD分岐の動作保証はしない。
- 次の判断: T01の同日内の時間表現、S01のフルネーム例外、S02の紅茶銘柄を整理する。T02/S03/S04は資料側の追随候補、S05は未接続の共通原稿、K01は#1107既報、K02は出典と演出の確認として引き継ぐ。いずれも本文修正は別途判断する。
- 保存状態: `git add --sparse docs/qa/issue1178-ch3-pronoun-notation/README.md` はGit管理領域の `index.lock` 作成時に `Read-only file system` で失敗。stageは失敗、commitは未実施。権限変更・別経路の回避はせず、このREADMEを未追跡ファイルとして作業ツリーに残した。終了時に追跡ファイル・indexの差分なし、上流に対する未push commitなしを確認した。調査中に `origin/main` は先へ進んだが、本報告の参照HEADは冒頭の値に固定し、取り込みはしていない。
- push・PR作成・Issueコメントは今回の指示により行わない。commitメッセージ案: `docs: audit chapter 3 story consistency for #1178`。
