# Claude Code 回復後の発注順｜水煙前線 -EN:CODE-
**1件だけなら「01 制作の初見監修」。2件できるなら「02 はじめの勝因」まで。** 制作UIを今すぐ置き換える依頼ではない。桜井式の現行PRを初見で触り、実際に迷ったところだけ返してもらう。02はレイアウト採否を待たず、採点も変えずに物語を強くできる。

|いつ|渡す番号|期待する持ち帰り|
|---|---|---|
|11/20の第1枠|**01** [#3924](https://github.com/haseatsu114514-dot/shisha-game/issues/3924) → **02** [#3916](https://github.com/haseatsu114514-dot/shisha-game/issues/3916)|修正済みを除く操作上の難所3件以内／勝ち方ごとの「決め手の一言」|
|まだ余裕があれば|**03** [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) 項目7|大会前・審査切替・発表前に、何を見せ、何を言わないかを章別に|
|独立で並行できる調査|**07** [#3909](https://github.com/haseatsu114514-dot/shisha-game/issues/3909)、**09** [#3915](https://github.com/haseatsu114514-dot/shisha-game/issues/3915)、短ければ**13** [#3785](https://github.com/haseatsu114514-dot/shisha-game/issues/3785)|点数を動かさない味の設計／バイトの遊びの比較／TRPGの役替えの一言|
|次の週を使うなら|**05** 難しさ→**06** 章の一周量→該当する **10・11・12**|調整が必要な箇所と「直さない」箇所を現行の経路で切り分ける|
|採否が出てから|**23** 勝因台詞を反映、または **21** 採用された配合画面だけ|小さく遊べる差分と、同じ入力で結果が変わらない証拠|

01が45〜75分、02が60〜90分、03が45〜80分の作業見積もり。2時間なら01と02の途中まででもよい。**全23件を一括で貼らず、1件＝1依頼**。11/20 13:00（日本時間）、次が11/27、12/1までというのは[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884)に記録された予定で、こちらでClaudeの残量や回復を実測したものではない。時間は作業の目安で、利用枠の保証ではない。

**止めたまま:** 背景の作り直しは[Museへの引き継ぎ](https://github.com/haseatsu114514-dot/shisha-game/issues/3884#issuecomment-7015414163)で停止。五卓は研究のみ。新・制作／途中順位／優勝のA/Bは未選定。旧4系統の監査から採用されたのは大会結果だけで、別の画面や新しいモック全体の採用を意味しない。斧の右レーンは選び直さない。はじめの全面再生成とTRPG本棚をClaudeへ二重発注しない。

## この計画が見た範囲
2026年11月20日 02:29 JST（11月19日 17:29 UTC）基準のスナップショット。開始時 [main c4b08049](https://github.com/haseatsu114514-dot/shisha-game/commit/c4b0804952c7bd2a95366e8389a2bdd8bdf62ea0) のopen Issue 50件／PR 15件から、最終集計 [main 37d5b2ff](https://github.com/haseatsu114514-dot/shisha-game/commit/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4) の **49件／13件** まで確認。途中で [#3930](https://github.com/haseatsu114514-dot/shisha-game/pull/3930)（第3章・猫のラテ）と [#3931](https://github.com/haseatsu114514-dot/shisha-game/pull/3931)（第4章・遅い買い出しの日の電話）がマージされた。[この間のmainの差分](https://github.com/haseatsu114514-dot/shisha-game/compare/c4b0804952c7bd2a95366e8389a2bdd8bdf62ea0...37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4)はラテの台本、それにドバイの進行・テスト・開発資料。[#3794](https://github.com/haseatsu114514-dot/shisha-game/issues/3794) はclosedだが [#3936](https://github.com/haseatsu114514-dot/shisha-game/pull/3936) はopenなので別々に扱った。全件の振り分けと各PRのHEADは末尾。PRのReadyは「非Draft」であって、現時点のCI合格・オーナー採用・マージ済みを意味しない。

- 正本は[AGENTS.md](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/AGENTS.md)、[現行資料ガイド](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/docs/current_documentation_guide.md)、[採用仕様](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/docs/master_spec.md)、[オーナー台帳（RLS）](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/docs/owner_requests.md)、[シナリオ・ゲーム開発資料](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/docs/gameplay_agent_reference.md)、[人物と物語](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/brand/story_and_structure.md)、[実行・検査の入口](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/remake/README.md)。旧版 `web/`／Godotは対象外。新しいオーナー判断が古い親Issueより優先。既に廃止したIssue予約や新たな進捗台帳は作らない。
- 見た実装は、会話と各章の進行、日常・tonari、制作の味プロフィールと採点、章別の大会、成長盤の状態、DJ／TRPG、最終章とスタッフロール。素材・BGM・公開・広報は担当境界を調べた。**全ファイルを読んだ／全章を今回実機で通したという意味ではない**。下の動作確認条件は、Claudeが引き受けた時の完了条件であり、今回の実測値ではない。
- [#3926](https://github.com/haseatsu114514-dot/shisha-game/pull/3926) のNoto Sans JP、[#3929](https://github.com/haseatsu114514-dot/shisha-game/pull/3929) の [画面設計](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/.claude/skills/game-ui-frontend/SKILL.md) と [実プレイ確認](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/.claude/skills/game-playtest/SKILL.md) はmainにある。再導入しない。[現行look](https://github.com/haseatsu114514-dot/shisha-game/blob/37d5b2ffb0acf8dacd56ca2068d83a49cb4fdef4/remake/js/core/look.js)の通常既定は `classic`。過去の `neo` の画面・計測を現行の既定に置き換えない。図やUIを論じる時は旧資料より、版・同一セーブ・同じ場面と入力を優先する。
- 役割：Claudeは台詞の因果・初見評価・複数仕様の取捨選択。使えるなら、**Opus**を01〜07・09のうち判断が難しいもの、**Sonnet**を13・17・19の短めの点検へ。いずれも任意の目安で、モデル／努力設定や残量はユーザーの画面を優先する。既に答えの決まったCSS・再現テスト・性能修正はCodex、採用済み素材の制作・Suno運用は指定の画像／音楽担当に残す。

### 依存・ぶつかりやすい仕事
1. **書き込みなしで独立**：01（操作）、02（勝因の台詞）、03（幕間）、07（味の設計）、09（働きたい理由）、13（卓の導入）。このうち01・02・03が本命。調査は並行可だが、Claudeの枠は最優先から。新UIの選定は前提にしない。
2. **同じ素材を見るが結論は別々**：02は「なぜ勝った」、03は発表前、04は結果の情報順。結果画面を3件とも描き直さない。05は難度、07は好みの意味。06は章間比較、10・11・12はその章だけの判断。先の短い結果を次に貼って二重調査を減らす。
3. **必要な条件がある**：11は#3931が着地したので、電話以外に限定すれば開始可。21は配合モック版の明示と#3923との調整後。22は正規レーン素材＋聴ける実機。23は02の台詞と出し所採用後。未採用・データ欠けは「できた」にしない。
4. **切るなら先に切る**：14・15・18・19・20は完成後に回せる。余った時間に新しいゲーム・新曲・全体デザインを起こすより、05・06・12で「初見で最後まで」の穴を潰す。

## コピペ依頼文 23本
番号を一つ選び、コード枠の中だけを送れる。01〜20と22は調査・企画・確認まで、21・23だけが明示採用後の実装候補。ソースの記述、PR説明にある過去の検証、今回実際に触れた事実を分けること。

|番号|やること|着手目安|作業時間の目安|
|---|---|---|---|
|01|制作の初見テスト：説明を閉じても次の手が分かるか|今すぐ・最優先|45–75分|
|02|はじめの優勝に、プレイヤーが見た理由を一つ返す|今すぐ・最優先|60–90分|
|03|大会の幕間を四章別に演出する：新しい台詞を増やす前に|今すぐ|45–80分|
|04|結果発表を「勝者→決め手→自分の次の一手」に整える|今すぐ／03と別稿|40–65分|
|05|難しさの正体を、操作・説明・資源・採点に分ける|今すぐ|60–100分|
|06|章の台詞量：「不足○万字」ではなく一周の読後感を測る|今すぐ|45–75分|
|07|配合ゲージを客の好みへ返す：点数を動かさない設計審査|今すぐ|45–80分|
|08|序盤の強制制作を、必要な復習と重複に分ける|中盤・読み取りは今可|40–70分|
|09|tonariで働きたくなる理由：既存案を見ない独立案から比較|研究限定・今すぐ|45–70分|
|10|第2章：あげはとなるの葛藤は、町の選び方で消えないか|今すぐ|40–65分|
|11|第4章の夜：電話を救った後、記者会見・色紙まで強制すべきか|着地確認済み／比較限定|35–60分|
|12|第5章：最初の3手と、エンディングまでの引き返す時刻|今すぐ／実操作中心|50–90分|
|13|TRPG入門：GMと客役の切替を、最初の会話で分からせる|今すぐ・小品|25–45分|
|14|サイが立ちはだかる最後のTRPGを、まず遊べる短編の形に|今すぐ・余力|45–80分|
|15|上級を越えたくなる理由：種を二重配布しないミニゲーム設計|企画のみ|45–75分|
|16|DJ：次曲の一拍と失敗からの復帰を、本物のSETで確かめる|後半・検証専用|45–75分|
|17|待ち時間を「待たされる時間」にしない店の台詞|後半・文章比較|30–50分|
|18|段階会話を揃える前に、キャラ固有で残す意味を決める|余力・設計|40–65分|
|19|会話の特殊演出：もっと増やすのでなく、1周の強い瞬間を残す|余力・採否資料|30–50分|
|20|タイトル絵の本人性とトリミング：方向を決めるだけ|余力・画像生成なし|30–50分|
|21|採用モック決定後の最初の実装：配合だけで見切る|選定後のみ・実装候補|60–120分|
|22|斧投げの最後の実機確認：既に閉じた監修を開き直さない|条件付き・実機待ち|15–35分|
|23|台詞案の採用後：勝因の一言を大会結果に接続する|採用後のみ・実装候補|45–90分|

### 01　制作の初見テスト：説明を閉じても次の手が分かるか
今すぐ・最優先｜45–75分｜[#3924](https://github.com/haseatsu114514-dot/shisha-game/issues/3924) [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3815](https://github.com/haseatsu114514-dot/shisha-game/issues/3815) [#3816](https://github.com/haseatsu114514-dot/shisha-game/issues/3816)

**なぜ今／前提：** 第1波は既存PR #3923。断面・穴配置・炭と現在工程、採点履歴の？への移動までDraftに実装済み（main反映を意味しない）。新しい全体モックのA/Bは未採用。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：制作の初見テスト：説明を閉じても次の手が分かるか。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3924（関連：#3884・#3815・#3816）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：PR #3923 の変更ファイル、remake/js/craft/steps.js、remake/test/browser/craft_progress.mjs。
依頼：mainと#3923の最新HEADを同じ状態で比較し、説明を閉じた初見で「今／次／なぜ選ぶ」が分かる境界を探す。配合→詰め、穴の型→開始、炭の配置→焼き、蒸らし時間→操作を優先。9g＋3g、長い銘柄、未習得の鍵を含める。
提出・合否：1280×720・844×390・740×320。詰めの断面、外周／中周、炭3／4、＋と決定を実入力。一枚に「指が止まる場所／理由／最小修正」を書き、重大順3件以内。既に直った点は合格に。新モックの採否・配点・進行・別PRの改修はしない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 02　はじめの優勝に、プレイヤーが見た理由を一つ返す
今すぐ・最優先｜60–90分｜[#3916](https://github.com/haseatsu114514-dot/shisha-game/issues/3916) [#3558](https://github.com/haseatsu114514-dot/shisha-game/issues/3558) [#1072](https://github.com/haseatsu114514-dot/shisha-game/issues/1072)

**なぜ今／前提：** 第1章は実票で競う。固定主人公勝利ではない。提供やライバルの動的反応は#1072で既にあり、足りないのは比較した工程と結果の橋渡し。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：はじめの優勝に、プレイヤーが見た理由を一つ返す。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3916（関連：#3558・#1072）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/craft/ch1-votes.js、remake/js/craft/result.js、remake/js/chapters/ch1.js、data/dialogue/ch1_tournament.json。
依頼：DAY14自然入口のv2／桜井v3を正とし、旧v1を分ける。先行維持、最後の1点で順位変化、最後の票は他人だが総合で勝利、同点処理、惜敗、旧記録で根拠なしを見比べる。審査員名は千須豪。実際の一台の工程で誰との差が付いたか、パッキー／ライバル／二口目の誰に言わせるか決める。
照合：桜井式v3は `voteAttempt.views`／`picks`（必要なら `attacks`）の実記録を使い、従来v2では未保存の回別評価や投票先を断定しない。千須豪の最後の1点が勝者を変えたかは、`beforeLast` を票に使い、コピーした `finalVotes.sui[lastPoint]` から1点を引いた状態を、同じ品質値の `ch1Standings` で再集計して公式結果の1位と比べる。カットインの暫定順位や1点差では判定しない。勝因は結果発表後に置き、採点・保存は変更しない。
提出・合否：「入力例→実際の票・比較→出す台詞1～2行→出してはいけない理由」の表、採用推し1案と削る固定文。DAY13未練習で練習の成果を語らない。二口目の私的な連想と勝因を分ける。最後の1点＝常に逆転・10点一括・採点変更・必勝化は禁止。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 03　大会の幕間を四章別に演出する：新しい台詞を増やす前に
今すぐ｜45–80分｜[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3060](https://github.com/haseatsu114514-dot/shisha-game/issues/3060) [#2031](https://github.com/haseatsu114514-dot/shisha-game/issues/2031)

**なぜ今／前提：** 項目7。掛け合いは既設（#3060完了）。第2章は支給苺と四人の心の声、第3章は読了と票確定の境界、第4章には吸い心地を聞く選択がある。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：大会の幕間を四章別に演出する：新しい台詞を増やす前に。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3884（関連：#3060・#2031）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：data/dialogue/tournament_craft.json、remake/js/craft/tournament-story.js、remake/js/chapters/ch2-tournament.js・ch3-tournament.js・ch4-tournament.js。
依頼：既存の章別キャプチャと試合前／提供／ラウンド間／結果直前の台本を読んで、章ごとに一つ「前の手が終わった」「次を待ちたい」が伝わる瞬間を選ぶ。足りなければ該当区間だけ本編で再生し、画／一言／既存音／無音／次の入力を一列の絵コンテにする。
提出・合否：第1～4章は章別4行と1区間の前後3カット。第5章は一対一、二台×同じ40人の挙手なので別枠。自動、スキップ、減動作で台詞読了前に票が動かないかを区別。#3916の勝因台詞や新規音源・背景は担当しない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 04　結果発表を「勝者→決め手→自分の次の一手」に整える
今すぐ／03と別稿｜40–65分｜[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3558](https://github.com/haseatsu114514-dot/shisha-game/issues/3558) [#3916](https://github.com/haseatsu114514-dot/shisha-game/issues/3916)

**なぜ今／前提：** 以前の4系統監査から採用対象になったのは大会結果。第1章勝利見出しは金グラデと暗い文字影の組合せ。第2～4章は結果部品／審査の意味が別で、第5章に順位表はない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：結果発表を「勝者→決め手→自分の次の一手」に整える。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3884（関連：#3558・#3916）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/craft/result.js、remake/js/craft/tournament-graphics.js、remake/js/chapters/tournament-standings.js、各章のtournament-state。
依頼：既存の実画面と最新の結果画面で、順位を告げる順番、選手の名前、4人の内訳、次の練習の見え方を比較。既に検証したCHAMPIONだけの影除去は再発明せず基準にする。新A/Bを採用済みとはしない。採点や物語の原稿ではなく画面と音の段取りをまとめる。
提出・合否：PC・844×390で勝利／敗退／僅差を最大3例。無音でも分かる→既存SEで何が加わるか。表彰／再挑戦を隠さない。選手名、票の根拠、短縮される内訳の読み方を1枚で示す。全章にCHAMPIONや汎用の順位表を押し付けず、「変えない」章も明記。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 05　難しさの正体を、操作・説明・資源・採点に分ける
今すぐ｜60–100分｜[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3551](https://github.com/haseatsu114514-dot/shisha-game/issues/3551) [#3558](https://github.com/haseatsu114514-dot/shisha-game/issues/3558) [#3918](https://github.com/haseatsu114514-dot/shisha-game/issues/3918)

**なぜ今／前提：** 制作の桜井版統一#3901は反映済み。通常制作の操作、各章の採点、初回レッスンの補助は別物。#3918や性能報告の1回のプレイは勝率の根拠ではない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：難しさの正体を、操作・説明・資源・採点に分ける。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3884（関連：#3551・#3558・#3918）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/craft/score.js、remake/js/chapters/retry-assist.js、各章のtournament-state、remake/js/core/ngplus-difficulty.js。
依頼：初周で自然に入手できる道具・所持・体力を基準に、Ch1とCh2または3の同じ工程を比較する。説明の誤読、指の動作、処理待ち、資源不足、審査の差を別列に。固定入力を一か所だけ変え比較し、実際の難しさと説明不足を切り分ける。
提出・合否：通常・立て直し・失敗の3例。難度を変えず表示で解ける案、調整候補、反証条件と追加検証を各1つ。デバッグ自動成功やヘッドレスfpsから勝率／実機感触を推定しない。閾値、賞金、救済、周回補正は一切変更しない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 06　章の台詞量：「不足○万字」ではなく一周の読後感を測る
今すぐ｜45–75分｜[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3097](https://github.com/haseatsu114514-dot/shisha-game/issues/3097) [#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020) [#3726](https://github.com/haseatsu114514-dot/shisha-game/issues/3726)

**なぜ今／前提：** tools/chapter_volume.pyは分岐の両側・再訪を含む字数。共通LIME、コードの選択等は別。RLS03は2～4章が対象で、第5章を1章の長さにする意図はない。Grok等の既存増補と第3章#3930・第4章#3931の合流もある。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：章の台詞量：「不足○万字」ではなく一周の読後感を測る。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3884（関連：#3097・#2020・#3726）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：tools/chapter_volume.py、docs/spec/chapter_parity_audit.md、data/dialogue/、各章の既読条件／日常入口。
依頼：最新SHAで既存ツールを一度走らせ、既存集計との差を出す。Ch2～4から必須ルートと任意交流を1例ずつ抜き、現実に同じ周で読む分／排他／再訪を分離。読み時間は仮定を明記。既に台詞があっても入口を発見できない問題を、台詞不足へ数えない。
提出・合否：表「章・総量・一周で届く例・人物の判断と後の返答・足す／入口だけ直す／不要」。章ごと1場面以下の編集候補、足さない理由も付ける。全ファイルの水増しや代行執筆、進行中のmukai・ドバイの追加を繰り返さない。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 07　配合ゲージを客の好みへ返す：点数を動かさない設計審査
今すぐ｜45–80分｜[#3909](https://github.com/haseatsu114514-dot/shisha-game/issues/3909) [#3069](https://github.com/haseatsu114514-dot/shisha-game/issues/3069)

**なぜ今／前提：** flavor-profile.jsは甘い印象／清涼感／煙の量を加熱・配合から表現。表示値と品質採点の責務は別。AFミント等の承認済み例はあるが、残りの数値は一括承認されていない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：配合ゲージを客の好みへ返す：点数を動かさない設計審査。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3909（関連：#3069）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/craft/flavor-profile.js、mix-taste.js、score.js、ch1-votes.js、data/flavors.json、data/baito_events.json。
依頼：同一配合と温度で甘い希望／さっぱり希望／指定なしを比較。①一般注文の講評のみ、②大会で理由表示だけ、③将来限定的な加点を比較する。予想→提供後の実際のプロフィール→既存の評価→提案の差の順で例示。黄金比・NG・煙・熱・好みを二重加点しない。
提出・合否：単品、複数、比率の境界、熱が足りない、旧セーブで記録なしの例題。甘さ最大一択を作らない採否基準と未決の上限・対象を出す。#791の配合確定時の即時加点を復活させない。採点・係数・flavors.jsonの書換え／プレイ結果確定は禁止。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 08　序盤の強制制作を、必要な復習と重複に分ける
中盤・読み取りは今可｜40–70分｜[#3819](https://github.com/haseatsu114514-dot/shisha-game/issues/3819) [#3918](https://github.com/haseatsu114514-dot/shisha-game/issues/3918) [#3821](https://github.com/haseatsu114514-dot/shisha-game/issues/3821)

**なぜ今／前提：** アダム配達の優先は#3839で対応。#3920・#3932・#3933は初回反応、パッキー、LIME、買い出し・EXP等の進行中レーン。登録順やシフト繰越と「3日続く体感」は別。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：序盤の強制制作を、必要な復習と重複に分ける。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3819（関連：#3918・#3821）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/chapters/ch1.js、remake/js/chapters/first-brew.js、remake/js/daily/calendar.js、data/dialogue/ch1_main.json。
依頼：初見のDAY1～3に「誰の依頼で何のために何台作るか」を自然経路で並べる。任意練習を除き、登録→配達→夜シフトの台詞と行動の理由を確認。詰めや熱管理を初めて学ぶ工程は消さず、同じ説明を二度やるところだけ短縮／次回任意化する案を比べる。
提出・合否：通常順・寄り道・夜の中断LOADの時系列を各1行。動かすと失われる依頼、既読、給料・在庫・EXP・一日の枠を明示。既存PRの差分が反映済みならそれを基準とし、登録／シフト順の実装や新しい強制イベントは入れない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 09　tonariで働きたくなる理由：既存案を見ない独立案から比較
研究限定・今すぐ｜45–70分｜[#3915](https://github.com/haseatsu114514-dot/shisha-game/issues/3915) [#3921](https://github.com/haseatsu114514-dot/shisha-game/pull/3921)

**なぜ今／前提：** 五卓営業は未採用で停止中。通常注文・前回の回収・まかない・珍客はすでにある。別資料「Tonari・5卓バイト企画仕様書.md」「Tonari・画面と店舗写真の参照集.pdf」がある。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：tonariで働きたくなる理由：既存案を見ない独立案から比較。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3915（関連：#3921）。
まず最新mainのSHA・AGENTS.md・同じ箇所のopen PRの有無だけ記録。#3915の他案・資料の中身は自案を書くまで開かない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/daily/tonari.js、data/baito_events.json、#3915内の五卓調査・黒板案、Draft #3921は参照だけ。
依頼：まず本編の一勤務と翌日の返りだけを読んで、交流の代わりに今日出勤したくなる理由を1案、自分の言葉で先に作る。その後で#3915の黒板／五卓・時間の約束を読み、3案の「初回の30秒／二回目の違い／仕事が残った証拠／退屈や義務化の危険」を比較する。
提出・合否：勝ち案を断定せず、1夜の紙上プロトタイプと、採用しない案の良い要素を1つ。日当増、強制シフト、連勤報酬で勝たせない。#3921の再開・branch切替編集・素材生成・図面公開・issue書込みは不可。写真資料がなければ不足と書き、見た扱いにしない。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 10　第2章：あげはとなるの葛藤は、町の選び方で消えないか
今すぐ｜40–65分｜[#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020) [#3097](https://github.com/haseatsu114514-dot/shisha-game/issues/3097)

**なぜ今／前提：** 苺の試作→県大会での短い回収は#3922で反映済み。第2章は試煙会・翌日の一台・なるの返答に因果がある。会話数より、固定夜・期限救済と任意訪問の重なりが論点。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：第2章：あげはとなるの葛藤は、町の選び方で消えないか。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/2020（関連：#3097）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/chapters/ch2-story.js、ch2-outings.js、ch2-strawberry-trial.js、ch2-tournament.js、data/dialogue/ch2_tournament.json。
依頼：地元優先と隣町優先で一日の枠を合わせ、あげは／なる自身が何を選んで何を失うか、後から見える言動に線を引く。本人に会っていないのに既知として語る、救済で順番が逆転する、町に行く理由が消える箇所に限定。
提出・合否：2ルート×「初見・試煙後・大会後」で読めた行IDを引用。弱い場合だけ既存入口の案1つと2～4行の見本。#3922の苺台詞を再執筆せず、好感度・日付・投票に手を入れない。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 11　第4章の夜：電話を救った後、記者会見・色紙まで強制すべきか
着地確認済み／比較限定｜35–60分｜[#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020) [#3931](https://github.com/haseatsu114514-dot/shisha-game/pull/3931)

**なぜ今／前提：** 既存調査では夜6話の後半3話を逃す経路がある。#3931はマージ済み。DAY12の買い出し後のスミさんの電話だけを救い、会見・色紙は従来のまま。調査があるだけで残り2話を自動必須化する理由はない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：第4章の夜：電話を救った後、記者会見・色紙まで強制すべきか。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/2020（関連：#3931）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/chapters/ch4-dubai-daily.js、ch4-progress.js、remake/test/browser/ch4_dubai_daily.mjs、#3931の差分。
依頼：#3931の反映を確認してから、店仕事・買い出しを先回りした人としない人のDAY13直前を比較。電話の二重発生ではなく、記者会見・色紙が抜けると「誰とここに来たか」が失われるかを判断。既存の空き枠で任意回収、読まなくても成立、何もしないを比べる。
提出・合否：6場面の既読と回収条件、各ルートの損得を表へ。採るなら1場面だけ、正規入口とテスト条件を示す。#3931や寄せ書き新規画像／選別をやり直さず、台本も進行も変更しない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 12　第5章：最初の3手と、エンディングまでの引き返す時刻
今すぐ／実操作中心｜50–90分｜[#3436](https://github.com/haseatsu114514-dot/shisha-game/issues/3436) [#3726](https://github.com/haseatsu114514-dot/shisha-game/issues/3726) [#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020) [#3917](https://github.com/haseatsu114514-dot/shisha-game/pull/3917)

**なぜ今／前提：** #3917が日程未定の表示と読めるtonari固有場面の印を追加済み。即博士連絡は正規ルート。目的は増量ではなく、自由に遊んで終われるか。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：第5章：最初の3手と、エンディングまでの引き返す時刻。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3436（関連：#3726・#2020・#3917）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/chapters/ch5-daily.js、ch5-progress.js、remake/js/scenes/staff-roll.js、remake/test/browser/staff_roll.mjs。
依頼：博士にすぐ連絡する／最初にtonariへ行く／別の店・遠征を選ぶの3経路で、最初の3手と日程の決まり方を記録。代表1ルートはエンディング→スタッフロール→終了後の行き先まで実操作。二台を審査する40人の挙手と、他章の大会の得票を区別。
提出・合否：SAVE/LOAD・戻る・AUTOのどれが通るか、操作で確認／fixtureのみ／未確認の3区分。止まる所にだけ文案・再現を1件。#3917の！をもう一度足さない。スタッフロール通過を実機Safari確認と混同しない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 13　TRPG入門：GMと客役の切替を、最初の会話で分からせる
今すぐ・小品｜25–45分｜[#3785](https://github.com/haseatsu114514-dot/shisha-game/issues/3785) [#3890](https://github.com/haseatsu114514-dot/shisha-game/pull/3890) [#3893](https://github.com/haseatsu114514-dot/shisha-game/pull/3893)

**なぜ今／前提：** 「閉店後の港町」は#3893で先行。GM/PL/PCの定義は既にあり、サイが語り手から客役へ移る瞬間が入口の残件。#3900は本棚再生と保存の別担当。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：TRPG入門：GMと客役の切替を、最初の会話で分からせる。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3785（関連：#3890・#3893）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：data/dialogue/trpg_tutorial.json、data/trpg_catalog.json、remake/js/trpg/trial.js、remake/test/browser/trpg_main.mjs。
依頼：入門の最初の会話を手動で送り、誰が演じて誰に答えるかを読み違えそうな箇所を1か所選ぶ。定義の追加ではなく、サイが客役に切り替わる一言を2案出し、前後3発言と一緒に示す。港町の同じ導入が既に直った分は触らない。
提出・合否：初見に「自分の役・相手の役・今返すこと」を言えるかを受入条件にする。判定の数字、喫茶店本棚、旧セーブ、#3900のcampaign/view/shelf-help、共有UIに変更しない。実装に進む場合も選定された1ファイル・1場面だけ、wrap／台詞lint／対象テスト。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 14　サイが立ちはだかる最後のTRPGを、まず遊べる短編の形に
今すぐ・余力｜45–80分｜[#3788](https://github.com/haseatsu114514-dot/shisha-game/issues/3788) [#3787](https://github.com/haseatsu114514-dot/shisha-game/issues/3787) [#3779](https://github.com/haseatsu114514-dot/shisha-game/issues/3779)

**なぜ今／前提：** #3788は企画先行。サイ本人を急に悪役にする話ではなく、自分のシナリオを用意する動機と卓での立場が必要。判定確率や本棚再生は別案件。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：サイが立ちはだかる最後のTRPGを、まず遊べる短編の形に。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3788（関連：#3787・#3779）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：data/characters.json のsai、brand/character_profiles.md、data/trpg_catalog.json、data/dialogue/trpg_*.json。
依頼：サイがGMのまま相手役も演じる／物語のボス役を引き受ける等、既存設定に矛盾しない2案。冒頭の誘い、卓で一人が決める選択、中盤で異なる人が生きる判断、終幕のサイの一言を具体的に。討伐が目的の汎用戦闘にせず、シーシャ店の仲間が卓を囲む意味を残す。
提出・合否：1枚のピッチ×2＋推し案の実演6～10発言。解放と報酬は#3779／現行の部活経験値を読むだけで仮置き。シナリオ新規登録・数値・顔絵・本棚・実装・PRはまだ行わない。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 15　上級を越えたくなる理由：種を二重配布しないミニゲーム設計
企画のみ｜45–75分｜[#3779](https://github.com/haseatsu114514-dot/shisha-game/issues/3779) [#3790](https://github.com/haseatsu114514-dot/shisha-game/issues/3790) [#1801](https://github.com/haseatsu114514-dot/shisha-game/issues/1801)

**なぜ今／前提：** すでにラクダは入門／標準／上級、斧には裏ボス、DJにはSETがある。全ゲームを0から4コースにする話ではない。既得火種や旧セーブへの影響が未決。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：上級を越えたくなる理由：種を二重配布しないミニゲーム設計。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3779（関連：#3790・#1801）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/minigames/camel-race-model.js、axe-challenges.js、desert-ride-model.js、dj.js、remake/js/core/growth-board.js。
依頼：既存コース、解放条件、報酬を書く実コードとキーをゲーム別に読む。前三段と裏の軸を「上手さ・繰返し・別の遊び」に分け、ラクダとDJを対照例にする。てつこやTRPGを無理に上級コースにしない例外案も出す。
提出・合否：ゲーム別「現行の一回目／既得の火種／達成フラグ／次回／引継ぎ」表。旧セーブ移行は再配布なし・損なし・未決の選択肢を比較。得点・新規報酬・#3900・#3936・盤UIを変更しない。質問は決定に必要な最大2件。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 16　DJ：次曲の一拍と失敗からの復帰を、本物のSETで確かめる
後半・検証専用｜45–75分｜[#2456](https://github.com/haseatsu114514-dot/shisha-game/issues/2456) [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884)

**なぜ今／前提：** 既に試聴・QUANTIZE・リトライの設計レビューあり。既存のテストは結果を手動送信する区間があり、実際のつなぎ→結果通知→保存の役に立つ証拠は別。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：DJ：次曲の一拍と失敗からの復帰を、本物のSETで確かめる。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/2456（関連：#3884）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/previews/dj/app.mjs・model.mjs、remake/js/minigames/dj.js、remake/test/browser/dj_club.mjs、#2456の最新コメント。
依頼：既存設計案の書き直しではなく、SET1を本編入口から、選曲→IN→実フェーダー→採点→終了→本編帰還→読み直しまで試す。次に一回だけ中断復帰または最後のつなぎ放置を試し、音が無い時にプレイヤーに何を知らせているかを記録。
提出・合否：実入力と直接結果送信を別記。音を再生できなければ未聴とし、DOM／再生要求から音質を推定しない。試聴・無音・曲のブレイクを区別し、希望に合う曲があるかだけ見る。FX・楽曲追加・判定緩和・救済・Suno接続はしない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 17　待ち時間を「待たされる時間」にしない店の台詞
後半・文章比較｜30–50分｜[#3811](https://github.com/haseatsu114514-dot/shisha-game/issues/3811) [#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020)

**なぜ今／前提：** 店への提供は約20分という設定。3か月目の大会向け復習や箱・物販の修正と、待ち時間を描く仕事は別。5＋7件の用語洗い出しを繰り返さない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：待ち時間を「待たされる時間」にしない店の台詞。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3811（関連：#2020）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：data/dialogue/の実訪問台本、remake/js/daily/tonari.js、data/baito_events.json、#3811の最新コメント。
依頼：通常営業の来店→注文→提供を、初来店／再来店／大会練習の3例だけ読む。実時間を引き延ばさず、会話・布巾やグラスの小動作・場面のつなぎで待つ時間が過ぎたと分かる書き方を候補2場面に。元の客や話者の個性を守る。
提出・合否：各場面に行ID、現行、置換の1～3行、次の原文につながる理由。当てはまらない即提供（既に用意済み等）も1例。時間消費・台本量の一括増・画像・実際の喫煙推奨・待ちタイマーの導入は不可。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 18　段階会話を揃える前に、キャラ固有で残す意味を決める
余力・設計｜40–65分｜[#2035](https://github.com/haseatsu114514-dot/shisha-game/issues/2035) [#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020)

**なぜ今／前提：** 共通化の既存棚卸しでLIME置き場所等には統一済み／対象消滅がある。あげは・ひより・サメちゃん・第2章の残方式は進行や人物の例外を含む。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：段階会話を揃える前に、キャラ固有で残す意味を決める。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/2035（関連：#2020）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：docs/spec/chapter_parity_audit.md、remake/js/daily/bonds.js、romance.js、samechan-date.js、data/dialogue/と#2035直近の4区分。
依頼：コードの統合から始めず、ひよりの条件、サメちゃんの専用誘いなど二例で「正しく違う」所と、重複書きで不具合を招く所を分ける。既読フラグ、未面識、大会後に遅れて読む、恋人／親友を追う。
提出・合否：現行→共通化した場合の同値条件→統合せず残す例外→最小回帰fixtureの表。一人一候補まで。ID改名、既存セーブ変換、全章runDaily化やLIME移設のやり直し、コードの一括リファクタは禁止。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 19　会話の特殊演出：もっと増やすのでなく、1周の強い瞬間を残す
余力・採否資料｜30–50分｜[#3417](https://github.com/haseatsu114514-dot/shisha-game/issues/3417) [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884)

**なぜ今／前提：** Grokの設計ドラフトがあり、2～5章への初回展開は既にmain。新型の制作が先ではない。分岐を両側足した「密度」をプレイ1周の密度と混同しない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：会話の特殊演出：もっと増やすのでなく、1周の強い瞬間を残す。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3417（関連：#3884）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：data/dialogue/、remake/conversation-effects-demo.html、remake/js/vn/engine.js、#3417の最新コメント。
依頼：既存案を読む。Ch2～4から実際に同じ周回で通るひと続きの場面を2本選び、強調、間、SE、カットインが重なる行を拾う。今強すぎる1か所を減らす案／現状維持を比べ、企画中のささやき等を入れるのは代替の根拠がある場合だけ。
提出・合否：2場面の読む順と強い1行。自動・既読スキップ・動き軽減で意味が消えないか。新DSL／カットイン全増設・一斉装飾・#3884幕間原稿と同じ行の編集はしない。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 20　タイトル絵の本人性とトリミング：方向を決めるだけ
余力・画像生成なし｜30–50分｜[#3492](https://github.com/haseatsu114514-dot/shisha-game/issues/3492) [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884)

**なぜ今／前提：** 採用済み公式KVとキャラ別のタイトル絵がある。タイトルの起動速度#3552は閉じている。#3802ははじめ全面再生成の別担当。背景の作り直しも停止中。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：タイトル絵の本人性とトリミング：方向を決めるだけ。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3492（関連：#3884）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/scenes/title-art.js、remake/js/core/title-art-unlock.js、remake/js/scenes/title.js、#3492の採用済み構図。
依頼：採用済みのあげは／スミの2枚だけを、ゲームの実クロップ＋横持ちで比較。顔/目線、人物らしさ、ロゴと被写体の分離、夜の明暗を見て、「全員で揃える2点」と「人物によって変える2点」を言語化する。
提出・合否：PC／844の同じ2人の実画面に短評。素材が無いときは代替生成しない。採用済みKVを覆さず、はじめの旧立ち絵を正本にしない。量産、画像生成、LFS登録、背景再開、速度計測やタイトル選定変更をしない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 21　採用モック決定後の最初の実装：配合だけで見切る
選定後のみ・実装候補｜60–120分｜[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) [#3924](https://github.com/haseatsu114514-dot/shisha-game/issues/3924) [#3923](https://github.com/haseatsu114514-dot/shisha-game/pull/3923)

**なぜ今／前提：** 04の大会結果の採用範囲は制作UIへ流用できない。配合／途中順位／優勝の新モックは判定が別。#3923と同じファイルを動かすなら先に統合方針が要る。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：採用モック決定後の最初の実装：配合だけで見切る。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3884（関連：#3924・#3923）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：選定画像の版、#3923の該当工程、remake/css/craft-stage.css、remake/js/craft/steps.js、remake/test/browser/craft_progress.mjs。
依頼：この依頼は「配合のこの画像を正本に実装」とオーナーが特定した後だけ開始。既存素材1ステップで形・余白・主従・長名・disabled/focusを合わせる。まず画像の採用範囲と現行差分を2行で確認し、他の工程は触らない。
提出・合否：0g／定量12g／在庫不足／長い名前／横向き復帰／キーボード。PC・844・740でbefore/afterと同じ入力→同じ結果、関連テスト。正本未指定・素材の正規経路なし・同一箇所を別担当が編集中ならパッチを作らず止まる。既存PRへ無断上書き、merge・公開なし。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：採用済みの指定だけを対象に、小さな差分・関連テスト・変更前後を返す。別担当のPRへ上書き、merge・公開・外部AI起動は禁止。
```


### 22　斧投げの最後の実機確認：既に閉じた監修を開き直さない
条件付き・実機待ち｜15–35分｜[#3925](https://github.com/haseatsu114514-dot/shisha-game/issues/3925) [#3894](https://github.com/haseatsu114514-dot/shisha-game/pull/3894) [#3908](https://github.com/haseatsu114514-dot/shisha-game/pull/3908)

**なぜ今／前提：** 監修Issue #3925は完了で閉鎖。右の木枠レーンは採用済み。Draftの旧背景と採用済み原画は別。新レーンの正規LFS登録、音の最終確認／実機入力は別の到達条件。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：斧投げの最後の実機確認：既に閉じた監修を開き直さない。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3925（関連：#3894・#3908）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：#3894の最新HEAD・R7の採用コメント、remake/js/minigames/axe-pull-input.js、axe-rules.js、remake/test/browser/axe_tap_pull.mjs。
依頼：#3908の統合状態・#3894最新・採用済みレーンの正規収録・聞ける端末／iPhone実機を先に確認。未達なら必要物一行のみ。満たしたら、右下から上へ弾く案内→青の宣言→単発命中 vs 目標初達成→通常／外れを、同じ画角で比較する最終チェックを一度だけ。
提出・合否：740×320相当と実機、ミュート／減動作、7/8点と加算・切替・再宣言の既存規則。素材不足なのに承認、音声イベントから聴感推測、LFS迂回、採用済みレーンの選び直し、新SFX発注・#3925再開・コード改変は禁止。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：今回は結果をこの会話に返すだけ。コード・素材・仕様の保存や変更、Issue投稿、PR作成・merge・公開、外部AIの起動は禁止。
```


### 23　台詞案の採用後：勝因の一言を大会結果に接続する
採用後のみ・実装候補｜45–90分｜[#3916](https://github.com/haseatsu114514-dot/shisha-game/issues/3916) [#1072](https://github.com/haseatsu114514-dot/shisha-game/issues/1072) [#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884)

**なぜ今／前提：** 02を企画で終わらせないための後続。同順位でも準備や競合との比較が違えば理由も違う。勝者・票・章進行に一切手を入れない。

```text
水煙前線 -EN:CODE-（haseatsu114514-dot/shisha-game）：台詞案の採用後：勝因の一言を大会結果に接続する。
対象：https://github.com/haseatsu114514-dot/shisha-game/issues/3916（関連：#1072・#3884）。
最初に最新mainのSHA・AGENTS.md・関連Issueの最新判断・同じファイルのopen PRを確認。既に解消済みなら根拠を返して重ねない。 フルclone・素材/LFSの一括取得はしない。
入口：remake/js/craft/ch1-votes.js、remake/js/craft/result.js、remake/js/chapters/ch1.js、data/dialogue/ch1_tournament.json。
依頼：#3916の案のうちオーナーが選んだ台詞と出し所の指定がある時だけ着手。既存の試合記録から確定できる理由を1つだけ選び、既存の結果演出へつなぐ。根拠が欠ける旧セーブは誤った理由を言わない。選定がない時は案を勝手に選ばず終了。
勝因の照合は02の基準を引き継ぐ。公式の同点処理が決め手になるケースを一つ入れ、カットインの順位と混同しない。
提出・合否：同じ試合記録の前後で勝者・票・加点・再挑戦・章進行が変わらないこと。勝ち／負け／根拠欠落の旧記録を各1、可能なら別版も1例。台詞リンタ・関連する局所テスト、台詞が出るタイミングの比較。mock未選定部分のUIや#3909の点数は変更しない。 画面は指定のない限り通常起動のlookを記録。自動テスト／実画面／実機／未確認を区別。
範囲：採用済みの指定だけを対象に、小さな差分・関連テスト・変更前後を返す。別担当のPRへ上書き、merge・公開・外部AI起動は禁止。
```

## 今回Claudeに渡さないもの
- **背景**：元のリリース表の「Claudeで背景様式」より新しい停止指示を優先。公開済み・本編反映済みと見なさない。再開はMuseへの引き継ぎから。
- **#3925 斧監修**：Issue閉鎖済み。[R7レビュー](https://github.com/haseatsu114514-dot/shisha-game/issues/3925#issuecomment-7014720904)は右の木枠・狙い・加点表示の確認記録。未登録素材・SFXを流用で埋めない。22は条件が揃った後の最終検品で、新しい監修をやり直す仕事ではない。
- **#3513・#3552・#3653・#3500**：会話の話者色の局所化[#3903](https://github.com/haseatsu114514-dot/shisha-game/pull/3903)は部分対処で#3513はまだopen。タイトルの起動[#3552](https://github.com/haseatsu114514-dot/shisha-game/issues/3552)は[#3886](https://github.com/haseatsu114514-dot/shisha-game/pull/3886)対応でclosed。電車と雨は別、#3500は一部実行済み。広い「ゲームを軽くして」を新たに渡さない。
- **美術・音楽**：#3802主人公、#3759水着、#3622スタンプ、#3888楽曲原稿、#2209調達は勝手に着手しない。#3888は51キュー・153案の原稿であって、同数の音源が完成・本編採用されたという意味ではない。旧はじめの立ち絵を新しい判断の正本にしない。
- **オーナーが決めること**：新A/Bの採用箇所、採点変更の有無、公開形態・価格、現物のSFXやiPhoneでの遊び心地。素材なし／実機なしを推測で合格にしない。

## 付録A　open PR 全13件：誰の作業を避けるか
更新は日本時間。HEADは調査時に個別に再取得。代表ファイルは競合を見る入口の例で、全差分ではない。

|PR・件名|状態／HEAD／更新|代表ファイル|取り扱い|
|---|---|---|---|
|[#3894](https://github.com/haseatsu114514-dot/shisha-game/pull/3894) 斧投げのレーンと狙い・得点表示を整理|Draft · `272c32fd` · 11/20 01:07|`axe-aim.css`、`audio.js`|右レーン採用。正規素材・実機待ち22以外は既存担当。|
|[#3900](https://github.com/haseatsu114514-dot/shisha-game/pull/3900) TRPGの過去プレイを本棚で再生できるようにする|Draft · `92e80ab8` · 11/20 02:16|`state.js`、`campaign-view.js`|Sol Medium。本棚の過去プレイは任意。13・14は本棚を変更しない。|
|[#3908](https://github.com/haseatsu114514-dot/shisha-game/pull/3908) 斧投げ：狙い始めの同期レイアウトを解消|非Draft · `0b8d5cc5` · 11/20 02:16|`axe-throw.css`、`axe.js`|Codex側の狙い始め性能。#3894とaxe.js周辺で衝突し得る。|
|[#3913](https://github.com/haseatsu114514-dot/shisha-game/pull/3913) 初日の地図に店内が残る不具合と横持ちスマホの表示を修正|非Draft · `6a2ea1c6` · 11/20 01:57|`daily.css`、`phone-density.css`|初日マップと横持ち。別実装なし。|
|[#3920](https://github.com/haseatsu114514-dot/shisha-game/pull/3920) 第1章：初回提供・パッキー説明・買い出しの案内を修正|非Draft · `8be9affc` · 11/20 01:10|`ch1_main.json`、`first-brew.js`|初回提供・パッキー・買い出し。08は改修せず読むだけ。|
|[#3921](https://github.com/haseatsu114514-dot/shisha-game/pull/3921) 第1章 tonari：ソファのある五卓で営業ミニゲーム（比較案）|Draft · `154cc308` · 11/20 00:43|`tonari-floor.css`、`state.js`|五卓プロトタイプ停止。09でも編集・進行・マージをしない。|
|[#3923](https://github.com/haseatsu114514-dot/shisha-game/pull/3923) 桜井式の制作UI：工程帯の重複をなくし、図で詰め方・穴・炭を選ぶ|Draft · `b48cd65c` · 11/20 01:07|`craft-header.css`、`craft-route.css`|Sol Ultraの桜井実装。01の比較対象で、新規PR・上書き禁止。|
|[#3927](https://github.com/haseatsu114514-dot/shisha-game/pull/3927) 育成盤のスマホ表示を拡大（#3121）|非Draft · `efa5d506` · 11/20 00:40|`daily.css`、`growth-board-screen.js`|Museの盤。成長盤のスマホ対応を二重に作らない。|
|[#3932](https://github.com/haseatsu114514-dot/shisha-game/pull/3932) 第1章：炭焼き・穴あけの結果と初日のLIME案内を明確にする|Draft · `3eef8701` · 11/20 02:00|`common.js`、`heat.js`|初回炭焼・穴あけ・LIME。検査や状態更新を待ち別実装しない。|
|[#3933](https://github.com/haseatsu114514-dot/shisha-game/pull/3933) 第1章：買い出しを案内し、偵察・配達の経験値と体力ゲージを連動|Draft · `487eba9d` · 11/20 02:11|`growth.js`、`calendar.js`|控えめな買い出し案内・EXP・体力。旧強調や別設計を復活させない。|
|[#3934](https://github.com/haseatsu114514-dot/shisha-game/pull/3934) 電車の切り替え: 車両の移動を合成層に分けて軽くする（#3653）|Draft · `6d425791` · 11/20 02:02|`train.js`|電車の性能。雨や全体設計まで別に同時発注しない。|
|[#3935](https://github.com/haseatsu114514-dot/shisha-game/pull/3935) #3814 ショップ商品を大きくし、熟練度を星5つと箱絵で表示する案|Draft · `0574f2bc` · 11/20 01:55|`look-neo.css`、`shop.css`|採用は熟練度のみ。店舗UIの全面案・その他変更は採用とみなさない。|
|[#3936](https://github.com/haseatsu114514-dot/shisha-game/pull/3936) てつこ: 置けない組み合わせを禁止し、浮きを直す（#3794）|非Draft · `6a96bf9f` · 11/20 02:07|`tetsuko-time.css`、`tetsuko-art.js`|てつこの家具・浮き。関連Issue #3794は閉鎖済、PR自体は別途追跡。|

## 付録B　open Issue 全49件：ラベルより新しい判断を優先
Issue番号順。ラベルはGitHubの当該Issueから取得（「なし」は返却されたラベルが空）。更新は日本時間。締切順でも全件の再着手指示でもない。

|Issue・件名|ラベル／更新|今回の振り分け|
|---|---|---|
|[#1357](https://github.com/haseatsu114514-dot/shisha-game/issues/1357) [チュートリアル改善] デモ動画＋解説＋矢印誘導で操作を分かりやすくする（umbrella）|ai:claude, ai:codex, effort:high, ai:either · 11/10 13:34|説明文だけは候補01・08。#3816の新しい動画廃止指示が該当する所では旧umbrellaを優先しない。|
|[#1801](https://github.com/haseatsu114514-dot/shisha-game/issues/1801) [盤・第二弾] 引き継ぎ: 心得の盤の残りの実装（効き目・スキル・授業の場面・チュートリアル・公開）|ai:claude, ai:codex, effort:high · 11/10 14:25|盤の実装・公開を一括発注しない。火種の仕様だけ15、横持ちは#3927。|
|[#2020](https://github.com/haseatsu114514-dot/shisha-game/issues/2020) [親・章の統一] 第1章を基準に第2〜5章とキャラの作り込みを揃える|ai:claude, ai:codex, effort:high · 11/20 01:16|06・10・11・12・18。3章の猫は#3930で反映済み、4章電話も#3931で反映済み。|
|[#2035](https://github.com/haseatsu114514-dot/shisha-game/issues/2035) [実装の統一] 段階会話・LIME連絡先・LIMEの置き場所と画面・質問フラグ・恋人処理・章画面の部品が章やキャラごとに別の書き方|ai:claude, ai:codex, effort:high · 11/19 22:51|18。共通化で消してはいけない章・キャラ差から判断。|
|[#2209](https://github.com/haseatsu114514-dot/shisha-game/issues/2209) [素材・音] 第4・5章・エンディング・スタッフロールのBGM（Suno。プロンプトは docs/prompts/bgm_suno_prompts.md）|effort:medium, ai:either · 11/05 04:00|既存の音源台帳・#3888とMuseへ。Sunoへの送信・新規生成はしない。|
|[#2456](https://github.com/haseatsu114514-dot/shisha-game/issues/2456) [設計案・実装保留] DJ改修：自動ヘッドホン試聴・選曲・甘いQUANTIZE・無音時の局所リトライ（FXなし）|ai:claude · 11/04 14:10|16。既存の設計紙を作り直さず、本物のSETだけ検証。|
|[#3069](https://github.com/haseatsu114514-dot/shisha-game/issues/3069) フレーバーステータス案（実際の使用感リサーチ）|なし · 11/12 06:43|07に必要な承認済み例のみ。全銘柄の数値を推定しない。|
|[#3097](https://github.com/haseatsu114514-dot/shisha-game/issues/3097) [ボリューム均し] 章ごとの台詞ボリュームを第1章並みに揃える|なし · 11/18 01:07|06・10。既存Grok増補の後。字数だけで水増ししない。|
|[#3121](https://github.com/haseatsu114514-dot/shisha-game/issues/3121) [P2・盤UI] 横持ちスマホ規格でも本文約8px・通常マス24px、全体表示では15pxになる|なし · 11/19 19:57|#3927と重複。Claudeはマス座標・盤UIの別PRを作らない。|
|[#3198](https://github.com/haseatsu114514-dot/shisha-game/issues/3198) [テストプレイ残件] 未修正・作業中・要検証・明示保留を整理（11/10 main照合）|なし · 11/18 11:59|過去テストの集約親。新しい残りは個別Issue、章5のみ12。|
|[#3199](https://github.com/haseatsu114514-dot/shisha-game/issues/3199) 【提案】TRPGの全面見直し案：スマホの文字・UIのわかりやすさ・システム（オーナー判断待ち）|なし · 11/15 06:39|TRPG全面改修は保留。13〜14で操作設計を巻き取らない。|
|[#3203](https://github.com/haseatsu114514-dot/shisha-game/issues/3203) [見た目調査・実プレイ未完] 画面遷移の残像と表示の不連続を確認する|なし · 11/18 10:15|残像・表示断絶は現行版・実機で再現できた個所だけ性能担当へ。新デザインでは解けない。|
|[#3288](https://github.com/haseatsu114514-dot/shisha-game/issues/3288) [まとめ・画像] Codex の上位プランが終わる前にまとめて作る画像（2026-11-11 棚卸し）|ai:codex · 11/13 13:29|画像担当の棚卸し・採否。背景停止と#3802の既存ルートを守る。|
|[#3417](https://github.com/haseatsu114514-dot/shisha-game/issues/3417) [企画・配置計画] 会話演出を第2〜5章へ広げる: くどくならない密度の約束と章ごとの新顔（#2828・#2990 の続き、#2666 延長）|なし · 11/18 10:30|19。既存の設計に対する同一路線の密度判定だけ。|
|[#3436](https://github.com/haseatsu114514-dot/shisha-game/issues/3436) [完成まで] 完成の線と、そこまでの残り（2026-11-12 オーナー決定）|なし · 11/18 08:00|12・05を完成線（横画面で最後まで）に直接結び付ける。|
|[#3492](https://github.com/haseatsu114514-dot/shisha-game/issues/3492) [素材・Codex] タイトルアート画風統一・高品質化とサイズ最適化の進め方|なし · 11/12 13:09|20は方向・切り抜きだけ。画像量産は別担当。|
|[#3500](https://github.com/haseatsu114514-dot/shisha-game/issues/3500) [構想・性能] ゲーム全体の快適化：暗転・軽い場面での先読み、描画負荷・メモリ管理の段階的改善|なし · 11/13 14:54|性能設計親。既に個別施策あり。再度全体最適化を発注せず、Codexの未測定区間へ。|
|[#3513](https://github.com/haseatsu114514-dot/shisha-game/issues/3513) [テストプレイ・性能] 新版の会話画面は立ち絵が出ると、静止でもフレームが落ち、行送りで長い処理が連発する（旧版は軽い）|bug · 11/19 21:10|open。#3903は限定修正。neoの過去値を既定classic全体の不具合とも完治とも扱わない。|
|[#3551](https://github.com/haseatsu114514-dot/shisha-game/issues/3551) [テストプレイ・性能] 第1章で実測した「処理が重い画面」まとめ（制作の蒸らし・吸い出し・穴あけ／くじ／スロット／一台勝負／煙の見本／大会）|enhancement · 11/20 00:54|05の補助証拠。操作に失敗することと遅延を分け、計測や修正は性能担当へ。|
|[#3557](https://github.com/haseatsu114514-dot/shisha-game/issues/3557) [テストプレイ・一台勝負] 吹き出しが遊び方シートに重なる／葉カードの名前が容量バッジで欠ける／スマホ横で文字6.5〜9px・押せる部品が小さい|bug · 11/20 00:46|一台勝負の局所重なり・欠けはCodex。01の桜井作業台と混ぜない。|
|[#3558](https://github.com/haseatsu114514-dot/shisha-game/issues/3558) [テストプレイ・第1章大会] 大会中の細かい点（MENU/保存が出ない／LOADごとに挑戦回数が増える／弾幕コメントが操作ラベルに重なる／phoneで文字が極小 ほか）|bug · 11/19 13:41|02・04・05の既知の境界。過去版のmenu・load・画面を同じ現行症状と決めない。|
|[#3618](https://github.com/haseatsu114514-dot/shisha-game/issues/3618) [画像・Codex復活後] 手順を飛ばした画像の追認または作り直し（CDX05: #3460／#3445・#3473）|なし · 11/18 19:54|生成済み画像の追認または再制作は素材担当／オーナー判断。|
|[#3620](https://github.com/haseatsu114514-dot/shisha-game/issues/3620) [画像・Codex復活後] 大会会場の背景（第2〜5章）— 選別または作り直し|なし · 11/14 12:04|会場背景は停止中の背景企画と競合。既存の採用／差替を推測しない。|
|[#3622](https://github.com/haseatsu114514-dot/shisha-game/issues/3622) スタンプ追加: スタンプ未所持のキャラクターへ展開（Gemini経路）|なし · 11/20 00:57|Gemini経路のスタンプ担当。Claudeの希少枠は使わない。|
|[#3653](https://github.com/haseatsu114514-dot/shisha-game/issues/3653) モーショングラフィックスの重さ調査・軽量化（電車など、全般）|なし · 11/20 01:57|電車#3934／雨は分離済みのCodex担当。統合前に同じ測定・実装を重ねない。|
|[#3726](https://github.com/haseatsu114514-dot/shisha-game/issues/3726) [リリースまで] 残りのやること一覧（2026-11-17 時点。#3436 完成の線＋公開の準備）|なし · 11/20 00:52|公開準備の親。05・06・12・20の判定基準。公開や新規契約は対象外。|
|[#3759](https://github.com/haseatsu114514-dot/shisha-game/issues/3759) 【水着立ち絵】キャラ別の水着へ作り直し（ビキニ・海パン中心／競泳寄り廃止）|なし · 11/19 21:35|水着立ち絵は素材制作・本人性の既存担当。Claudeで再生成しない。|
|[#3779](https://github.com/haseatsu114514-dot/shisha-game/issues/3779) [企画] ミニゲーム全般: 初級・中級・上級＋裏コース制と、火種の付け方|なし · 11/18 19:17|15。上級・裏と報酬の設計だけ。実装・ポイント変更は別。|
|[#3785](https://github.com/haseatsu114514-dot/shisha-game/issues/3785) [テストプレイ] TRPG: ストーリーと設定の説明をもっと丁寧に|なし · 11/20 00:46|13。既存の導入・実プレイ済み箇所を除き、最初の役替えに限定。|
|[#3788](https://github.com/haseatsu114514-dot/shisha-game/issues/3788) [企画] TRPG: サイが用意したラスボスシナリオ（サイが立ちはだかる）|なし · 11/18 19:18|14。ボスシナリオの試作台本。戦闘追加・本棚再生と別。|
|[#3790](https://github.com/haseatsu114514-dot/shisha-game/issues/3790) [まとめ] ミニゲーム改善（2026-11-18 実プレイFB）— ゲーム別の一覧と着手順|なし · 11/18 19:18|個別の15・16へ。全ミニゲームのやり直し依頼にはしない。|
|[#3802](https://github.com/haseatsu114514-dot/shisha-game/issues/3802) はじめのネックレス・旧デザイン残存の精査（CG・カットイン等）|なし · 11/19 14:05|主人公の全面再生成はSol Ultraが担当。旧絵は対照用でも正本にしない。|
|[#3811](https://github.com/haseatsu114514-dot/shisha-game/issues/3811) シナリオ設定の整合性と時間経過描写の修正（すみさんの指導理由・250g箱・tonari物販・提供待ち描写）|なし · 11/19 22:55|17。待ち台詞だけを切り出し、既存の用語・表記修正を再発注しない。|
|[#3812](https://github.com/haseatsu114514-dot/shisha-game/issues/3812) ロード完了通知・スマホ向け操作表記・タイトルコール／カットインSE・1章冒頭ズーム演出の改善|なし · 11/18 20:24|既存の演出・UI改修の追跡。細かな表記・SE差替はCodex側。|
|[#3813](https://github.com/haseatsu114514-dot/shisha-game/issues/3813) 共通UI・ゲージ・閉店演出配置・日付全半角のレイアウト修正|なし · 11/18 20:24|共通ゲージ・日付など既定の小修正はCodex／Muse。|
|[#3814](https://github.com/haseatsu114514-dot/shisha-game/issues/3814) マップ画面（GUIDE・アイコン影）・ショップ一覧・熟練度5段階表示のUI改善|なし · 11/18 20:25|#3913・#3935の担当へ。後者の採用は熟練度のみ。|
|[#3815](https://github.com/haseatsu114514-dot/shisha-game/issues/3815) シーシャ作り（チュートリアル）の表示ズレ・文字飛び出し・ボタン視認性修正（#3795 関連・桜井式で治っている部分は対象外）|なし · 11/20 00:55|01の既存修正除外表。個々のCSS修正は先に#3923と照合。|
|[#3816](https://github.com/haseatsu114514-dot/shisha-game/issues/3816) シーシャ作り（チュートリアル）のゲージ表示・お手本動画廃止・用語変更・ランク上昇仕様の修正（#3795 関連・桜井式で治っている部分は対象外）|なし · 11/20 00:55|01・08。実装済みを除く。課題のうち用語・熟練度は別系統。|
|[#3818](https://github.com/haseatsu114514-dot/shisha-game/issues/3818) 部屋・店舗でのシーシャ台画像の表示制御修正（開始時の台・卓上台の反映・Cステーションの合成廃止）|なし · 11/18 20:25|部屋や台の画像の反映は既存素材・表示担当。全体リデザイン不要。|
|[#3819](https://github.com/haseatsu114514-dot/shisha-game/issues/3819) 1章のCステーション登録〜配達・シフト導線の修正と、アダム配達の進行バグ、強制シーシャ作りの頻度調整|なし · 11/20 00:46|08。既存のアダム配達修正と強制制作の頻度を切り分ける。|
|[#3820](https://github.com/haseatsu114514-dot/shisha-game/issues/3820) 3日目の観音堂強制イベント・火種チュートリアル追加と、観音堂の盤専用化・昼夜背景の修正（#3779 関連）|なし · 11/18 20:25|3日目の観音堂と火種を15の境界と照合。既決の導線を作り直さない。|
|[#3821](https://github.com/haseatsu114514-dot/shisha-game/issues/3821) 買い出しチュートリアルのガイド追加、偵察・配達への経験値付与、盤連動の体力上限ロジック|なし · 11/18 20:25|#3933が案内・経験値・体力に対応。08で効果を見るだけ。|
|[#3884](https://github.com/haseatsu114514-dot/shisha-game/issues/3884) リリース準備計画： 背景統一／作りパートUI／難易度・台詞量／ミニゲーム仕上げ／タイトルアート／Suno量産|なし · 11/20 01:36|01〜06・16・19〜21。項目2は最新停止、項目6はMuse、項目7は03・04。|
|[#3888](https://github.com/haseatsu114514-dot/shisha-game/issues/3888) [リリース準備 #3884・項目6] 全編BGM設計とSuno量産原稿（51キュー・153案）|なし · 11/20 00:49|51キュー・153案の原稿が存在。Muse/Suno担当。Claudeへ同じ量産表を頼まない。|
|[#3909](https://github.com/haseatsu114514-dot/shisha-game/issues/3909) [企画・Claude向け] 配合ゲージの「甘い印象」などを客・審査員の好みに応じた加点へ|なし · 11/19 22:39|07。好みの設計だけ。配合即加点・採点変更なし。|
|[#3915](https://github.com/haseatsu114514-dot/shisha-game/issues/3915) [企画・Claude比較待ち] 交友と競合しても選びたくなるバイト：店に仕事の跡が残る|なし · 11/20 01:10|09。五卓案は資料、実装停止。独立案を先に書いて比較。|
|[#3916](https://github.com/haseatsu114514-dot/shisha-game/issues/3916) [Claude向け・第1章大会] はじめが勝てた理由を、プレイヤーが見た一台で伝える|なし · 11/19 23:02|02→採用後23。はじめが実際に勝った理由をプレイヤーが見た一台から。|
|[#3918](https://github.com/haseatsu114514-dot/shisha-game/issues/3918) [実プレイFB・第1章] 初回制作とDAY1–2の導線／DAY14大会と章遷移の確認|なし · 11/20 00:02|05・08。直近の初日・大会実プレイを重ねず、版と経路を突合。|
|[#3924](https://github.com/haseatsu114514-dot/shisha-game/issues/3924) [Claude監修] 桜井式の制作UI：工程・アイコン・横持ちの読みやすさ|なし · 11/20 01:07|01。第1波で直ったものを除いてClaudeが監修。次の全面改修ではない。|

**今回は調査と依頼文の準備だけ。** Claude／Museへの送信、リポジトリ更新、Issue・PRの作成／コメント・マージ、素材生成・外部公開は行っていない。
