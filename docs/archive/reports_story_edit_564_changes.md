# #564 台詞修正の差分と継続範囲

> 履歴注記：本表は当時の台詞差分を保存したもの。博士の七三・水色シャツ・青チェックネクタイは撤回済み（#2190 P05の本人訂正）で、現行外見の根拠にしない。[現在の人物正本](../../brand/character_profiles.md)と採用済み立ち絵を参照する。

基準: `4e0d77858a2bbf037b0057a2a1d3e6cad6b17243`。前回の未コミット作業を継続し、既存の #615 / #660 の採用済み成果は維持する。Issue全体の完了報告ではない。
既存の全編棚卸しは [添削レポート](reports_story_review_564_20261016.md) を参照。以下は今回変更した29台本の再読・修正分で、未変更の章・UI・説明文を新たに読了扱いにしない。

## 時系列の照合（元1）

| 場面 | 現行の根拠 | 確定できる経過・季節 |
|---|---|---|
| 第1章・tonari | ch1_main: バイト歴3か月、remake/js/chapters/ch1.js: DAY14大会 | 勤務歴と章内日数のみ。暦年・季節は未確認 |
| 第2章・県大会 | remake/js/chapters/ch2.js: 県大会本戦DAY14 | 章内14日。第1章との間隔・暦年・季節は未確定 |
| 第3章・全国 | brand/story_and_structure.md の全国→世界日程、ch3_main | 正史の全国大会。第2章からの総経過・季節は未確定 |
| 第4章・世界 | ch4_main冒頭「全国大会から六週間後」、物語正本の日程 | 全国から六週間。暦年月・季節は未確定 |
| 第5章・研究室 | brand/story_and_structure.md: 世界後のSHISHA-9000戦 | 世界後の正史。間隔・季節は未確定 |

冒頭の「1年前」は上記から裏づけられないため「あの頃、tonariで。」へ変更。年数・季節を新たに設定せず回想へ戻す。coldopen.jsの暗転契機も同じ文へ追従。

## 在庫と保存（公開試遊2）

- 新規schema 19は個人在庫なしで開始し、店の道具・葉で冒頭のおさらいをする。既存の卓上台受取会話でダブルアップル1箱50gを一度だけ付与する。初期実在庫は従来50gだったため、総量を100gへ増やさない。
- 購入済み在庫には50gを加算。受取flagと在庫・台を同時保存し、消費後にロードしても再付与しない。旧schema 18以下は従来の初期支給を受取済みと扱い、現在の在庫を保持する。
- 旧セーブの台補完直後でも、現行schemaで葉が未受取なら取りこぼさない。会話中に別セーブへ切り替えた場合、そのセーブへ付与しない。
- statXpの形は変更していない。従来からschema 9未満では空辞書が全stat 0に正規化される。今回追加したテストの期待値のみを既存の移行仕様へ合わせた。
- 「シーシャ代は勉強代だ」は金銭の比喩。物品の台は既存ch1_sumi_home_rigで扱い、新場面を作らない。

## 保留・残作業

- S564-07は未着手。重要な動機・関係・結末の新規変更案も確定しない。
- 元29: 他担当境界のch1_naru / ch1_mintoは保留。今回の記号修正は台詞textに限定し、長音・ID・metadata・LIMEは対象外。
- 公開試遊4のスミ肩書はdata/characters.jsonを変更する他PR #742との境界があるため保留。人物正本もこのPRでは変更しない。
- 公開試遊13の温度計・蒸らしは #703 / マージ済みPR #821 のcraft実装に属するため、このPRでは未変更。craftコードを検証済みとは報告しない。
- 既存レポートBの未採用箇所（他担当の台本、baito_events、remake/data/lover等）、元33の描画処理全体、未確認UI・説明文、実機・全章通しは残る。下表にない旧指摘を一括完了扱いにしない。
- 店名 #805 / LIME / くじ演出 / 指定保留Issueは変更しない。「アルファーヘブン」の表記を保持。

## 表示検査の範囲

変更レコード280件を本編共通の組版で通常・モバイル・合成520px・本心併記の計1120描画検査。フォント未読込・はみ出し・ブラウザエラー0。
合成520pxだけで3件の分断警告（ch1_cold_open「シーシャ／プレイヤー」、ch1_rin_second「メンソール／バインダー」、ch1_tsumugi_fourth「観察／記録」）。画像を確認したが、専用の短文への意味改変や共通描画処理の変更は行わない。通常・モバイル条件の警告は0。これは共有組版ハーネスの検査で、全章の実機表示確認ではない。

## 台詞の変更前／変更後／理由／場所

場所はdialogue_idとJSON pointer。配列挿入がある場面では前後のpointerを併記。選択肢の削除・追加、portrait・分岐・在庫コードはGit差分も参照。

| 場所 | 変更前 | 変更後 | 理由 |
|---|---|---|---|
| data/dialogue/ch1_adam.json ch1_adam_first /dialogues/0/lines/23/text | 出されたシーシャを吸う。──重い。だが、嫌な重さじゃない。 | 出されたシーシャを吸う。重い。だが、嫌な重さじゃない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_first /dialogues/0/branches/self_study/0/text | あ、俺、tonariの蒸野と言います。勉強のために―― | あ、俺、tonariの蒸野と言います。勉強のために…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_first /dialogues/0/branches/dl_can/0/text | あ、俺、tonariの蒸野です。スミさんから、届け物を―― | あ、俺、tonariの蒸野です。スミさんから、届け物を…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_fourth /dialogues/3/lines/15/text | ……いい問いだ。俺にはもう１つ、極めし道がある。──ナイフ投げよ | ……いい問いだ。俺にはもう１つ、極めし道がある。ナイフ投げよ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_fourth /dialogues/3/lines/19/text | ──壁際に置かれた１個のリンゴに、ナイフが寸分違わず突き立っていた。 | 壁際に置かれた１個のリンゴに、ナイフが寸分違わず突き立っていた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_group_soutoku /dialogues/5/lines/5/text | ──総督。アダムは二つのタッパーを、それぞれの客の前に置いた。 | 総督。アダムは二つのタッパーを、それぞれの客の前に置いた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_outing_dagurikura /dialogues/6/lines/9/text | アームが下りる。──見事、一発で掴んだ。 | アームが下りる。見事、一発で掴んだ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_after_ch1 /dialogues/7/lines/3/text | 疲れはない。ただ、己の果実が最善を尽くせたかどうか──それだけを考えていた | 疲れはない。ただ、己の果実が最善を尽くせたかどうか、それだけを考えていた | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_adam.json ch1_adam_after_ch1_firstshop /dialogues/8/lines/9/text | お前の煙が、どこに向かうべきか──少し見えてくるかもしれない | お前の煙が、どこに向かうべきか、少し見えてくるかもしれない | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_ageha.json ch1_ageha_encounter /dialogues/0/lines/3/text | ガサッ──足元の段差に躓いて、紙袋の１つが腕からこぼれた。中身が歩道に散らばる。 | ガサッ、足元の段差に躓いて、紙袋の１つが腕からこぼれた。中身が歩道に散らばる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_ageha.json ch1_ageha_encounter /dialogues/0/lines/6/text | ──ふわり、と。甘い風が横を通り抜けた。 | ふわり、と。甘い風が横を通り抜けた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_ageha.json ch1_ageha_encounter /dialogues/0/lines/15/text | でも、笑い方がすごく自然で──なんだか、眩しかった。 | でも、笑い方がすごく自然で、なんだか、眩しかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_ageha.json ch1_ageha_encounter /dialogues/0/lines/21/text | もっと柔らかくて、じんわりとした── | もっと柔らかくて、じんわりとした…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_events.json ch1_rei_cameo /dialogues/6/lines/1/text | ドアベルが鳴った。──入ってきた瞬間、店の空気が少しだけ張り詰めた。 | ドアベルが鳴った。入ってきた瞬間、店の空気が少しだけ張り詰めた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_events.json ch1_rei_cameo /dialogues/6/lines/5/text | 「……一台。重くて、暗いやつ。──夜の底みたいな」 | 「……一台。重くて、暗いやつ。夜の底みたいな」 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_events.json ch1_rei_cameo /dialogues/6/lines/10/text | ──それから30分、一言も喋らなかった。 | それから30分、一言も喋らなかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_events.json ch1_rei_cameo /dialogues/6/lines/15/text | 「──ごちそうさまでした。おいしかったです」 | 「ごちそうさまでした。おいしかったです」 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_incognito.json ch1_reviewer_payoff /dialogues/2/lines/2/text | 見た？ 『tonari──路地裏の名店。若い作り手の一台が、店の空気ごとうまい』だって | 見た？ 『tonari、路地裏の名店。若い作り手の一台が、店の空気ごとうまい』だって | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_interval.json interval_day1_naru_lime /dialogues/2/lines/5/text | なら上等。俺はもっと突き詰めたのを作る。──お互い、次もな | なら上等。俺はもっと突き詰めたのを作る。お互い、次もな | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_interval.json interval_day3_sumi_call /dialogues/4/lines/4/text | 次は──県大会。同じ県内だが、会場エリアはここよりずっと大きい | 次は、県大会。同じ県内だが、会場エリアはここよりずっと大きい | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_interval.json interval_day3_sumi_call /dialogues/4/lines/14/text | 県大会──。この町のシーシャ屋で始まった物語が、一段大きなステージへ向かおうとしている。 | 県大会。この町のシーシャ屋で始まった物語が、一段大きなステージへ向かおうとしている。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_interval.json interval_day3_sumi_call /dialogues/4/lines/19/text | スミさんの目が、少しだけ柔らかくなった気がした。──県大会。会場エリア。 | スミさんの目が、少しだけ柔らかくなった気がした。県大会。会場エリア。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_interval.json interval_day5_eve /dialogues/5/lines/1/text | （明日からまた、新しい章が始まる。県大会に向けて──） | （明日からまた、新しい章が始まる。県大会に向けて……） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/lines/6/text | ──シーシャラウンジtonari。この街でシーシャを吸う人間なら、たいてい名前を知っている店。 | シーシャラウンジtonari。この街でシーシャを吸う人間なら、たいてい名前を知っている店。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/lines/20/text | （こういうの聞くとさ、つい思っちゃうんだよな。──いつか自分の店、持てたりして、って） | （こういうの聞くとさ、つい思っちゃうんだよな。いつか自分の店、持てたりして、って） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/lines/23/text | ──夕方の落ち着いた時間。片付けたテーブルが、少し広く見える。 | 夕方の落ち着いた時間。片付けたテーブルが、少し広く見える。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/1/text | スミさんがカウンターの下に手を伸ばし、ダブルアップルのパッケージを2つ取り出した。 | スミさんがカウンターの下から、練習用の道具を取り出した。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/2/text | 深い紅色のパッケージ。甘くてスパイシーな、この店で一番よく出るフレーバー。 | 使い込まれたトングとボウルが、カウンターに並ぶ。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/3/text | シーシャを覚えた人間が、最初に覚える味。 | いつもの仕事道具が、今日は少し違って見えた。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/4/text | これ使え。練習用だ。ダブルアップルとミントで基礎を叩き込む | 店の道具で、基礎をおさらいするぞ。葉も店のものを使え | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/6/text | 3ヶ月やった奴の基礎が見たいんだよ。あと、バイト代から引くからな | 3ヶ月やった奴の基礎が見たいんだよ。手順を一つずつ確かめろ | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/7/text | ……それ普通に買ってるのと同じじゃないですか | ……はい。じゃあ、いつもの手順を見てもらいます | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/accept/11/text | （──なんてね。でも、ちょっとだけ想像しちゃうんだよな） | （なんてね。でも、ちょっとだけ想像しちゃうんだよな） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hesitate/1/text | ──全員、お前より場数が上だ | 全員、お前より場数が上だ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hesitate/5/text | スミさんがカウンターの下に手を伸ばし、ダブルアップルのパッケージを2つ取り出した。 | スミさんがカウンターの下から、練習用の道具を取り出した。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hesitate/6/text | 深い紅色のパッケージ。シーシャを覚えた人間が、最初に覚える味。 | 使い込まれたトングとボウル。毎日、手にしている道具だ。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hesitate/7/text | 練習用だ。明日から閉店後に特訓する。逃げるなよ | 店の道具と葉で練習しろ。明日から閉店後に特訓だ。逃げるなよ | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hesitate/10/text | カウンターの灯りに、手の中のフレーバーのパッケージをかざしてみる。 | カウンターの灯りの下で、使い込まれた道具を見つめる。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/of_shop/3/text | 短い沈黙。何か余計なことを言った気がした。──でも、想像するのは自由だろう。 | 短い沈黙。何か余計なことを言った気がした。でも、想像するのは自由だろう。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hz_show/1/text | ──大会まであと{daysLeft}日。 | 大会まであと{daysLeft}日。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_opening /dialogues/0/branches/hz_unease/1/text | 不安の底に、ほんの少しだけ、負けたくない気持ちが沈んでいる。──大会まであと{daysLeft}日。 | 不安の底に、ほんの少しだけ、負けたくない気持ちが沈んでいる。大会まであと{daysLeft}日。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_salaryman_regular /dialogues/1/lines/13/text | その瞬間、ほんの少しだけ──肩の力が抜けたように見えた。 | その瞬間、ほんの少しだけ、肩の力が抜けたように見えた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_day5_sumi_story /dialogues/2/lines/5/text | スミさんがカウンターの奥──普段は絶対に触らせてもらえない棚に手を伸ばした。 | スミさんが、カウンターの奥の棚に手を伸ばした。普段は絶対に触らせてもらえない棚だ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_day5_sumi_story /dialogues/2/lines/9/text | その瓶を開ける時、スミさんの手が一瞬だけ──本当に一瞬だけ、震えた。 | その瓶を開ける時、スミさんの手が震えた。本当に、一瞬だけ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_day7_last_night /dialogues/3/branches/talk_sumi/3/text | だが今日は──作り終えると、黙ってホースをはじめの方に差し出した。 | だが今日は、作り終えると、黙ってホースをはじめの方に差し出した。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_day7_last_night /dialogues/3/branches/talk_sumi/14/text | ただな。勝ち負けは審査員が決めることだ | ただな。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_cold_open /dialogues/4/lines/0/text | ──ざわめき。乾いた熱気。砂と、香の匂い。 | ざわめき。乾いた熱気。砂と、香の匂い。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_cold_open /dialogues/4/lines/1/text | 「──決勝ッ！　世界の頂点を決める、最後の一台が……いま、提供されますッ！」 | 「決勝ッ！　世界の頂点を決める、最後の一台が……いま、提供されますッ！」 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_cold_open /dialogues/4/lines/5/text | その向こうに、誰かが立っている。──顔は、まだ見えない。 | その向こうに、誰かが立っている。顔は、まだ見えない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_cold_open /dialogues/4/lines/6/text | ──シーシャプレイヤーの話ってのは、いつだって一杯目から始まる。これは、その一杯目の話だ。 | シーシャプレイヤーの話ってのは、いつだって一杯目から始まる。これは、その一杯目の話だ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_cold_open /dialogues/4/lines/7/text | [imp]──1年前。[/imp] | [imp]あの頃、tonariで。[/imp] | 裏づけのない経過年数を設定しない（元1） |
| data/dialogue/ch1_main.json ch1_tutorial_oneesan /dialogues/5/lines/3/text | 悪い、俺は仕込みがある。──はじめ、頼めるか | 悪い、俺は仕込みがある。はじめ、頼めるか | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_tutorial_oneesan /dialogues/5/lines/8/text | それと、すみません。研修中の身なので、念のため年齢確認をさせてください | すみません、研修中の身なので、念のため年齢確認をさせてください | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_main.json ch1_tutorial_oneesan /dialogues/5/branches/op_talent/4/text | そうか。──で、その人はどんな顔で吸ってた？ | そうか。で、その人はどんな顔で吸ってた？ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_meet_rivals /dialogues/6/lines/2/text | 受付で名前を言うと、スタッフが控室へ通してくれた。──先客が、3人。 | 受付で名前を言うと、スタッフが控室へ通してくれた。先客が、3人。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_meet_rivals /dialogues/6/branches/mr_naru_known/0/text | よう、はじめ。硬えって。──こっちでも会うとはな | よう、はじめ。硬えって。こっちでも会うとはな | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_main.json ch1_salaryman_change /dialogues/7/lines/13/text | 帰り際、サラリーマンは一度だけ振り返って、小さく頭を下げた。──初めてのことだった。 | 帰り際、サラリーマンは一度だけ振り返って、小さく頭を下げた。初めてのことだった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/1/text | 1階は機材とフレーバーの物販に、申し訳程度の試飲席が2つ——卸会社の直営店だ。 | 1階は機材とフレーバーの物販に、申し訳程度の試飲席が2つ。卸会社の直営店だ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/3/text | ──ちょっと、そこの君。……うん、君。いい肺してそうだね | ちょっと、そこの君。……うん、君。いい肺してそうだね | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/10/text | 匂坂 凛。この店の上——2階で、海外メーカーの代理店部門をやってる。NIGHTSIDE……知らない？ | 匂坂 凛。この店の2階で、海外メーカーの代理店部門をやってる。NIGHTSIDE……知らない？ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/13/text | ねえ、君。ひとつ取引しない？──モルモットくん | ねえ、君。ひとつ取引しない？ ……モルモットくん | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/18/text | ──日本でまだ誰も吸ってない煙だよ、……気にならない？ | 日本でまだ誰も吸ってない煙だよ、……気にならない？ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/20/text | ──こういうのは、考えてる時間がいちばんもったいないの | こういうのは、考えてる時間がいちばんもったいないの | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/25/text | 凛でいいよ、モルモットくん。じゃ、契約成立。──ようこそ、夜の側へ | 凛でいいよ、モルモットくん。じゃ、契約成立。ようこそ、夜の側へ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/26/text | 薄暗いショールームで、気づけば得体の知れない契約書にサインしていた。完全に流された。 | 薄暗いショールームで、気づけば得体の知れない契約書にサインしていた。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_rin.json ch1_rin_first /dialogues/0/lines/27/text | ──でも不思議と、嫌な感じはしない。むしろ、ちょっとわくわくしている自分がいる。 | でも不思議と、嫌な感じはしない。むしろ、ちょっとわくわくしている自分がいる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_second /dialogues/1/lines/4/text | 吸う。──知らない香りだ。甘いのに、最後にすっと冷たい何かが通る。 | 吸う。知らない香りだ。甘いのに、最後にすっと冷たい何かが通る。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_second /dialogues/1/lines/16/text | ──こうして、凛さんとLIMEを交換した。 | こうして、凛さんとLIMEを交換した。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_second /dialogues/1/branches/r_sharp/0/text | ──へえ。それ、ベルガモットの裏のメンソールバインダー。気づく？ 普通 | へえ。それ、ベルガモットの裏のメンソールバインダー。気づく？ 普通 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_third /dialogues/2/lines/14/text | ……君、いい匂いがするね。煙と、炭と、ちょっとスパイス。──tonariの匂いだ | ……君、いい匂いがするね。煙と、炭と、ちょっとスパイス。tonariの匂いだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_rin.json ch1_rin_repeat_c /dialogues/5/lines/1/text | ——だから、ロットが違うと言ってるの。控えの書類と突き合わせて | だから、ロットが違うと言ってるの。控えの書類と突き合わせて | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_spots.json ch1_c_station_visit /dialogues/4/lines/7/text | 水色のシャツに青いチェックのネクタイ、チノパン——下だけサンダル。 | 水色のシャツに青いチェックのネクタイ、チノパンに、足元だけサンダル。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_spots.json ch1_c_station_visit /dialogues/4/lines/14/text | ——今回の評価軸ですが、私は例によってデータ収集を兼ねます | 今回の評価軸ですが、私は例によってデータ収集を兼ねます | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_spots.json ch1_c_station_visit /dialogues/4/lines/15/text | 各プレイヤーの『揺らぎ』の分布を記録したい | 同じ手順で、どこまで味を再現できるか。温度と配合を記録したい | 博士のデータ収集・再現性の研究へ整合（元31） |
| data/dialogue/ch1_spots.json cs_nagumo_glimpse /dialogues/9/lines/5/text | （『もう一口吸いたい』──あの人にそう思わせる煙って、どんな一台だ？） | （『もう一口吸いたい』あの人にそう思わせる煙って、どんな一台だ？） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_spots.json cs_kemuri_solo /dialogues/10/lines/1/text | チャコール博士──炭場創。審査員でもあり、研究者でもある変人。 | チャコール博士こと炭場創。審査員でもあり、研究者でもある変人。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_spots.json cafe_naru_break /dialogues/22/lines/0/text | 窓際の席になるがいた。目の前にはプリンとケーキ。 | 窓際の席になるがいた。開いたメニューで、プリンとケーキの写真を見比べている。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_spots.json cafe_naru_break /dialogues/22/lines/5/text | なるはようやくスプーンを取った。仕事の話はしないまま、休憩が終わった。 | 注文した菓子が届くと、なるはスプーンを取った。仕事の話はしないまま、休憩が終わった。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_sumi.json ch1_sumi_training /dialogues/3/lines/18/text | 炭が赤くなっていく光を見つめるスミさんの横顔に、ほんのわずかな──口角の動きがあった。 | 赤くなる炭を見つめながら、スミさんはほんのわずかに口角を動かした。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_final /dialogues/6/lines/17/text | （スミさんにも、まだ語れない何かがある。でも──いつか、聞かせてもらえるようになりたい） | （スミさんにも、まだ語れない何かがある。でも、いつか、聞かせてもらえるようになりたい） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_eve /dialogues/7/lines/5/text | スミさんが──客として、カウンターに座っている。 | スミさんが、客として、カウンターに座っている。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_eve /dialogues/7/lines/8/text | 棚からフレーバーを選ぶ。スミさんの好みは──分かっている。 | 棚からフレーバーを選ぶ。スミさんの好みは、分かっている。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_eve /dialogues/7/lines/11/text | ゴボゴボ──水面が穏やかに揺れた。煙がふわりと立ち上る。 | ゴボゴボ、水面が穏やかに揺れた。煙がふわりと立ち上る。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_eve /dialogues/7/lines/24/text | 師匠が、弟子のシーシャを吸っている。その光景だけで──もう、十分だった。 | 師匠が、弟子のシーシャを吸っている。その光景だけで、もう、十分だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_sumi.json ch1_sumi_home_rig /dialogues/8/lines/5/text | 一日の終わりに一服すると、その日の粗が見える。葉は自分で用意しろ | 一日の終わりに一服すると、その日の粗が見える | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch1_sumi.json ch1_sumi_home_rig /dialogues/8/branches/leaves_owned/0/text | （追加） | 葉は手持ちを使え。足りなくなったら、自分で用意しろ | 葉の受取時点を既存の台受取へ整合（公開試遊2） |
| data/dialogue/ch1_sumi.json ch1_sumi_home_rig /dialogues/8/branches/leaves_gift/0/text | （追加） | ダブルアップルも一箱やる。使い切ったら、自分で用意しろ | 葉の受取時点を既存の台受取へ整合（公開試遊2） |
| data/dialogue/ch1_tournament.json ch1_tournament_arrival /dialogues/0/lines/22/text | ──余裕に見せようとしているその仕草こそが、彼女の緊張を物語っていた。 | 余裕に見せようとしているその仕草こそが、彼女の緊張を物語っていた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_opening /dialogues/1/lines/13/text | まずは──大会を運営する「C.STATION」の生みの親、業界の鉄壁！ | まずは、大会を運営する「C.STATION」の生みの親、業界の鉄壁！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_opening /dialogues/1/lines/16/text | 相変わらず厳しィィィ！ さあ続きまして──！ データの鬼、チャコール博士こと炭場創さんッ！ | 相変わらず厳しィィィ！ さあ続きまして！ データの鬼、チャコール博士こと炭場創さんッ！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_opening /dialogues/1/lines/18/text | そしてゲスト審査員──！ シーシャはおいしいねえ、でおなじみ！ 上園文太郎さんッ！ | そしてゲスト審査員！ シーシャはおいしいねえ、でおなじみ！ 上園文太郎さんッ！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_opening /dialogues/1/lines/26/text | SMOKE CROWN CUP──[warn]開始ィィィッ！！[/warn] | SMOKE CROWN CUP、[warn]開始ィィィッ！！[/warn] | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_match /dialogues/2/lines/17/text | ──ここだけは、tonariと同じ香りがした。 | ここだけは、tonariと同じ香りがした。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_match /dialogues/2/lines/19/text | ──味は、悪くない。華やかさはない。個性も薄い。でも、崩れていない。 | 味は、悪くない。華やかさはない。個性も薄い。でも、崩れていない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_match /dialogues/2/lines/26/text | （3年分のノート、全部この一台に置いてきた。──出し切った） | （3年分のノート、全部この一台に置いてきた。出し切った） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_judging /dialogues/3/lines/4/text | 吸い込んで、吐いて、少し間を置いて──また吸い込んだ。2回目。 | 吸い込んで、吐いて、少し間を置いて、また吸い込んだ。2回目。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_judging /dialogues/3/lines/26/text | はじめに入った点は──ほとんどない。 | はじめに入った点は、ほとんどない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_judging /dialogues/3/lines/34/text | まだ持ち点を投入していない審査員がいますよッ！ 南雲審査員長──10点まるまる温存ッ！ | まだ持ち点を投入していない審査員がいますよッ！ 南雲審査員長、10点まるまる温存ッ！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_reveal /dialogues/4/lines/0/text | 最後の最後に動いた持ち点──それを見た会場が、どよめいた。 | 最後の最後に動いた持ち点、それを見た会場が、どよめいた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_reveal /dialogues/4/lines/7/text | （……勝った。──勝ったんだ、俺が！） | （……勝った。勝ったんだ、俺が！） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_reveal /dialogues/4/lines/9/text | なるの計算も、アダムの覚悟も、みんとの完璧も──全部、本気の一台だった。 | なるの計算も、アダムの覚悟も、みんとの完璧も、全部、本気の一台だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_reveal /dialogues/4/lines/13/text | ──気持ちいい。叫び出したいくらい、気持ちいい。 | 気持ちいい。叫び出したいくらい、気持ちいい。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_reveal /dialogues/4/lines/19/text | でも今は──この拍手と、あの小さな笑みだけで、胸がいっぱいだった。 | でも今は、この拍手と、あの小さな笑みだけで、胸がいっぱいだった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/1/text | ──負けた。完敗だ | 負けた。完敗だ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/6/text | ──おめでとう、はじめ。今日のお前の煙は、文句なしに美味かった | おめでとう、はじめ。今日のお前の煙は、文句なしに美味かった | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/9/text | 俺は別の街の大会から、もう１回登り直す。いつかまたお前と当たる。──その時は、俺が勝つ | 俺は別の街の大会から、もう１回登り直す。いつかまたお前と当たる。その時は、俺が勝つ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/14/text | そのとき、ロビーの空気が少し変わった。──南雲修二が、こちらへ歩いてくる。 | そのとき、ロビーの空気が少し変わった。南雲修二が、こちらへ歩いてくる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/16/text | ──鳴切くん。あの配合、自分で？ | 鳴切くん。あの配合、自分で？ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/21/text | なるが何か言うより先に、南雲はもう歩き出していた。──そして、はじめの前で止まる。 | なるが何か言うより先に、南雲はもう歩き出していた。そして、はじめの前で止まる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/30/text | ──宿題、もらっちまったな | 宿題、もらっちまったな | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/36/text | ──表彰式のあと、地元メディアの簡単なインタビューがあった。マイクを向けられる。 | 表彰式のあと、地元メディアの簡単なインタビューがあった。マイクを向けられる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/40/text | ──その夜。閉店後のtonari。 | その夜。閉店後のtonari。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/45/text | 祝いに、自分用の一台を作って吸った。──馬鹿みたいに、うまい。どの一服よりも濃い。 | 祝いに、自分用の一台を作って吸った。馬鹿みたいに、うまい。どの一服よりも濃い。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/59/text | ……最後の方だけ、ちょっとだけ──濁ってた | ……最後の方だけ、ちょっとだけ、濁ってた | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/lines/62/text | ドアベルが鳴って、彼女は夜に消えた。──濁ってた？ 優勝した日の煙が？ | ドアベルが鳴って、彼女は夜に消えた。濁ってた？ 優勝した日の煙が？ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/iv_pride/1/text | 記者が笑顔でメモを取る。カメラのフラッシュ。マイク。視線。──悪くない。 | 記者が笑顔でメモを取る。カメラのフラッシュ。マイク。視線。悪くない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/iv_pride/3/text | ──少し離れた場所で、なるがその答えを聞いていた。何も言わず、ただ静かに目を細めて。 | 少し離れた場所で、なるがその答えを聞いていた。何も言わず、ただ静かに目を細めて。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/iv_sumi/1/text | 記者が吹き出した。「ちゃっかりしてますね」──まあ、宣伝も実力のうちだ。多分。 | 記者が吹き出した。「ちゃっかりしてますね」、まあ、宣伝も実力のうちだ。多分。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/iv_sumi/3/text | ──数日後、tonariに「配信で見ました」という新規のお客さんが２人来た。 | 数日後、tonariに「配信で見ました」という新規のお客さんが２人来た。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/promise_kept/0/text | けど、約束は覚えてるよな。勝った方が作る。──それと、もう１つ | けど、約束は覚えてるよな。勝った方が作る。それと、もう１つ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/promise_new/0/text | 明日、うちで一服しようぜ。勝った方が作る──今決めた。それと、もう１つ | 明日、うちで一服しようぜ。勝った方が作る、今決めた。それと、もう１つ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_after /dialogues/5/branches/ta_tsumugi_named/0/text | そのとき、店の奥の席から小さな音がした。──つむぎだ。閉店までいつもの席にいたらしい。 | そのとき、店の奥の席から小さな音がした。つむぎだ。閉店までいつもの席にいたらしい。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_r2_end /dialogues/7/branches/recall_base/0/text | ──仕上げの吸い出しに入る前に、ふと、サラリーマンさんの顔が浮かんだ。 | 仕上げの吸い出しに入る前に、ふと、サラリーマンさんの顔が浮かんだ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_r2_end /dialogues/7/branches/recall_notes/0/text | ──仕上げの吸い出しに入る前に、ふと、いつもの常連さんの顔が浮かんだ。 | 仕上げの吸い出しに入る前に、ふと、いつもの常連さんの顔が浮かんだ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_defeat /dialogues/9/lines/2/text | ──蒸野はじめには、どの審査員からも、ほとんど点が入っていなかった。 | 蒸野はじめには、どの審査員からも、ほとんど点が入っていなかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tournament.json ch1_tournament_defeat /dialogues/9/lines/4/text | SMOKE CROWN CUP……優勝は──！ | SMOKE CROWN CUP……優勝は！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/lines/0/text | バイトの合間、ふと店内を見渡す。 | 一息ついて、店内を見渡す。 | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/lines/2/text | ──タブレットの画面に、大きな傷が走っているのが目に入った。画面を斜めに横切る、深い亀裂。 | タブレットの画面に、大きな傷が走っているのが目に入った。画面を斜めに横切る、深い亀裂。 | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/lines/7/text | つむぎのラベンダー、頼むぞ | 悪いが、つむぎのラベンダーを運んでくれ | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/lines/8/text | はい。作ってきます | はい。あっちの席に行くところでした | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/lines/11/text | 丁寧にラベンダーのボウルを詰めて、テーブルに運ぶ。 | スミさんが用意したラベンダーを、つむぎのテーブルに運ぶ。 | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_first /dialogues/0/branches/serve_call/3/text | ──まるで、画面を見られたくないように。 | まるで、画面を見られたくないように。 | 客入口でも自然な運搬と会話、つむぎ立ち絵へ整合 |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_second /dialogues/1/lines/8/text | ──煙。画面いっぱいに、シーシャの煙が描かれている。 | 煙。画面いっぱいに、シーシャの煙が描かれている。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fourth /dialogues/3/lines/8/text | 画面に並んでいたのは──膨大な量のメモとスケッチだった。 | 画面に並んでいたのは、膨大な量のメモとスケッチだった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fourth /dialogues/3/lines/13/text | ──全て、はじめのシーシャの観察記録だった。 | 全て、はじめのシーシャの観察記録だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fourth /dialogues/3/lines/29/text | つむぎの声は相変わらず小さい。でも、今日は──止まらなかった。 | つむぎの声は相変わらず小さい。でも、今日は、止まらなかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fourth /dialogues/3/lines/38/text | でも──その目が、ほんの少しだけ潤んでいた。 | でも、その目が、ほんの少しだけ潤んでいた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fourth /dialogues/3/branches/open_wait/1/text | ──先に沈黙を破ったのは、彼女の方だった。 | 先に沈黙を破ったのは、彼女の方だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fifth /dialogues/4/lines/17/text | つむぎが──笑った。 | つむぎが、笑った。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fifth /dialogues/4/branches/fifth_art_new/0/text | tonariの店内。カウンターの温かい照明。シーシャのボトルが並ぶ棚。そして──煙。 | tonariの店内。カウンターの温かい照明。シーシャのボトルが並ぶ棚。そして、煙。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fifth /dialogues/4/branches/fifth_art_new/4/text | カウンターに立って、お客さんにシーシャを出している──はじめの後ろ姿だった。 | カウンターに立って、お客さんにシーシャを出している、はじめの後ろ姿だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fifth /dialogues/4/branches/fifth_art_new/6/text | でも──不思議なことに、その傷が絵の一部になっていた。 | でも、不思議なことに、その傷が絵の一部になっていた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_fifth /dialogues/4/branches/fifth_art_new/14/text | 傷があるのに──いや、傷があるからこそ、煙が自然に流れてるように見えた | 傷があるのに、いや、傷があるからこそ、煙が自然に流れてるように見えた | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_smoke_color /dialogues/5/lines/5/text | ──と思ったら、つむぎはペンを置いた。 | と思ったら、つむぎはペンを置いた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_smoke_color /dialogues/5/lines/15/text | だから──濁らせちゃ、だめですよ | だから、濁らせちゃ、だめですよ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch1_tsumugi.json ch1_tsumugi_eve /dialogues/6/lines/13/text | はい。……そっちも、聞いてください | はい。結果が出たら、知らせます | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_ageha_story.json remake_ch2_ageha_slump /dialogues/6/lines/5/text | ──うん。ちゃんとおいしいじゃん | うん。ちゃんとおいしいじゃん | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_ageha_story.json remake_ch2_ageha_slump /dialogues/6/lines/10/text | 当たり前じゃん。でもさ── | 当たり前じゃん。でもさ…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_ageha_story.json remake_ch2_ageha_slump /dialogues/6/lines/16/text | ──けれど、舌の奥の遠さは、消えなかった。 | けれど、舌の奥の遠さは、消えなかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_city.json ch2_city_arrival /dialogues/0/branches/doctor_known/3/text | 君、今日は先に周りを見るんだね。いい揺らぎだ | 君、今日は先に周りを見るんだね。下見も、同じ手順を再現する準備だ | 博士のデータ収集・再現性の研究へ整合（元31） |
| data/dialogue/ch2_city.json ch2_city_arrival /dialogues/0/branches/doctor_known/4/text | 揺らぎって……道に迷ってるだけですよ | 準備って……道に迷ってるだけですよ | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_city.json ch2_city_arrival /dialogues/0/branches/doctor_known/5/text | そういう時の目も、面白いんだよ。じゃ、準備があるから | 場所や室温が違えば、同じ作り方でも味は変わる。じゃ、準備があるから | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_isolation.json ch2_naru_warm /dialogues/0/lines/0/text | 夜、ケムリクサに寄った。──ドアを開けた瞬間、なるさんが両手を上げた。 | 夜、ケムリクサに寄った。ドアを開けた瞬間、なるさんが両手を上げた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_isolation.json ch2_naru_warm /dialogues/0/lines/8/text | ──この頃はまだ、二人で笑っていた。 | この頃はまだ、二人で笑っていた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_isolation.json ch2_naru_confrontation /dialogues/1/lines/8/text | （追加） | なるさんが店を続ける話をしていた間、俺はスマホの採点表を見ていた。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_isolation.json ch2_naru_confrontation /dialogues/1/branches/push/0/text | ──勝ったのは、俺です | 勝ったのは、俺です | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_isolation.json ch2_minto_warning /dialogues/3/lines/1/text | ありがとうございます。本番も、絶対── | ありがとうございます。本番も、絶対…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_isolation.json ch2_minto_warning /dialogues/3/lines/9/text | ──突き放されなかったことが、なぜだか少しだけ、こたえた。 | 突き放されなかったことが、なぜだか少しだけ、こたえた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_first /dialogues/0/lines/4/text | （……目つきも声も、堅気じゃない。それに──腕、見えてる。インクが） | （……目つきも声も、堅気じゃない。それに、腕、見えてる。インクが） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_first /dialogues/0/lines/9/text | まあ座れ、一服してきな。──うちはドラゴンフルーツだ | まあ座れ、一服してきな。うちはドラゴンフルーツだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_first /dialogues/0/lines/17/text | フレーバーにも仁義がある。持って生まれた声を、殺さず引き出す──それだけだ | フレーバーにも仁義がある。持って生まれた声を、殺さず引き出す、それだけだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_second /dialogues/1/lines/9/text | 兄弟の盃、親子の盃。うちの業界じゃ、盃の重さで── | 兄弟の盃、親子の盃。うちの業界じゃ、盃の重さで…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_second /dialogues/1/lines/14/text | ただ──また来た時に、顔を覚えていたいだけだ | ただ、また来た時に、顔を覚えていたいだけだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_second /dialogues/1/lines/18/text | 組長が炭を載せる。──だが、蒸らさない。 | 組長が炭を載せる。だが、蒸らさない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_second /dialogues/1/lines/20/text | （え……蒸らさないのか？ 炭を載せて、すぐ吸って──） | （え……蒸らさないのか？ 炭を載せて、すぐ吸って……） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_second /dialogues/1/lines/31/text | ──神崎竜二の「0分立ち上げ」を教わった。これから、蒸らし時間に「0分」を選べる。 | 神崎竜二の「0分立ち上げ」を教わった。これから、蒸らし時間に「0分」を選べる。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_fourth /dialogues/3/lines/7/text | 回し飲みだ。──同じ一台に、口をつけて回す | 回し飲みだ。同じ一台に、口をつけて回す | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_after_ch2 /dialogues/4/lines/3/text | 大会でのお前の煙、しかと見せてもらった。──スジが通ってた | 大会でのお前の煙、しかと見せてもらった。スジが通ってた | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_after_ch2 /dialogues/4/lines/14/text | 困り事があったら言え。──カタギの範囲でな | 困り事があったら言え。カタギの範囲でな | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_kumicho.json ch2_kumicho_after_ch2_firstshop /dialogues/5/lines/7/text | （少し間を置いて）……嬉しいこと言うじゃねえか。一服してきな──うちのドラゴンフルーツだ | （少し間を置いて）……嬉しいこと言うじゃねえか。一服してきな、うちのドラゴンフルーツだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_abyss_baito /dialogues/0/lines/0/text | ────同じ夜。最後のお客さんを見送った。 | 同じ夜。最後のお客さんを見送った。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_abyss_baito /dialogues/0/lines/11/text | ────閉店後。店の裏口。 | 閉店後。店の裏口。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_slump_taste /dialogues/1/lines/0/text | ────tonari。閉店後。 | tonari。閉店後。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_slump_taste /dialogues/1/lines/2/text | ──味が、薄い。 | 味が、薄い。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_slump_taste /dialogues/1/lines/7/text | 吸ったけど、いつものはじめと変わらない。ちゃんと味する | 俺の舌には、ちゃんと味が来てる | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_main.json ch2_slump_taste /dialogues/1/lines/14/text | ──でも、舌の真ん中だけが、ぽっかり何も拾わない。 | でも、舌の真ん中だけが、ぽっかり何も拾わない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sofa_burn /dialogues/2/lines/0/text | ────夜。預けていたノートを取りに、閉店前のtonariへ寄った。 | 夜。預けていたノートを取りに、閉店前のtonariへ寄った。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sofa_burn /dialogues/2/lines/4/text | ──炭を、落とした。 | 炭を、落とした。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_lingering_smell /dialogues/5/lines/2/text | ────夜。閉店後のtonari。 | 夜。閉店後のtonari。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_lingering_smell /dialogues/5/lines/6/text | コーヒーの残り香。──その一番底に。 | コーヒーの残り香。その一番底に。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sumi_silence /dialogues/6/lines/0/text | ────夜。昼間預けた配合ノートを受け取りに、tonariへ戻った。 | 夜。昼間預けた配合ノートを受け取りに、tonariへ戻った。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sumi_silence /dialogues/6/lines/3/text | 声をかけようとして──足が、止まった。 | 声をかけようとして、足が、止まった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sumi_silence /dialogues/6/lines/8/text | ──言葉ってのはな、自分に効いたやつしか、人には出せねえんだ | 言葉ってのはな、自分に効いたやつしか、人には出せねえんだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_main.json ch2_sumi_silence /dialogues/6/lines/14/text | ──それ以上は、誰も何も言わなかった。 | それ以上は、誰も何も言わなかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_preparation.json remake_ch2_rei_repeat /dialogues/5/lines/1/text | この前の曲が気になって。もう少し、曲の話を聞いてみたいです | まだ一回しか聴けてなくて。でも、気になってます | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_preparation.json remake_ch2_rei_repeat /dialogues/5/lines/3/text | 次は、その曲の話もしてみたいです | 次は、もう少し聴いてから話しに来ます | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/14/text | 全部は知らないんですけど。その友達がV系好きで—— | 全部は知らないんですけど。その友達がV系好きで…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/17/text | あ、自分はそんなに詳しくなくて。その友達が好きだっただけで—— | あ、自分はそんなに詳しくなくて。その友達が好きだっただけで…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/23/text | だから友達が、という話で——自分はそんなに—— | だから友達が、という話で、自分はそんなに…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/28/text | 夜に咲いて朝には消える花のことで—— | 夜に咲いて朝には消える花のことで…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/29/text | 儚さと甘さが同時にあって——それをこのミックスで出したかった | 儚さと甘さが同時にあって、それをこのミックスで出したかった | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/30/text | ジャスミンをベースに、ブルーベリーで夜の深みを足して——スモーキーな感じと、 | ジャスミンをベースに、ブルーベリーで夜の深みを足して、スモーキーな感じと、 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_second /dialogues/1/lines/31/text | でも一瞬だけ甘くなる後味と—— | でも一瞬だけ甘くなる後味と…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_fifth /dialogues/4/lines/25/text | 別れる人に、また会えるってついてしまう——あの優しい嘘の感覚——それをシーシャで出したくて | 別れる人に、また会えるってついてしまう、あの優しい嘘の感覚、それをシーシャで出したくて | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_fifth /dialogues/4/lines/26/text | ダブルアップルとピーチをベースに——最初は温かくて甘い | ダブルアップルとピーチをベースに、最初は温かくて甘い | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_rei.json ch2_rei_fifth /dialogues/4/lines/28/text | あと少し燻した感じを足して、別れの重さも—— | あと少し燻した感じを足して、別れの重さも…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch2_tournament.json ch2_tournament_entrance /dialogues/1/lines/3/text | ──おう、そのとおり。俺はヤクザだ | おう、そのとおり。俺はヤクザだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/8/text | はい。──ダブルアップル。シンプルなやつ | はい。ダブルアップル。シンプルなやつ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/11/text | 林檎そのものの、味じゃない。アニスとリコリス──二つのスパイスで、林檎を再現した味。 | 林檎そのものの、味じゃない。アニスとリコリスという二つのスパイスで、林檎を再現した味。 | 博士のデータ収集・再現性の研究へ整合（元31） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/18/text | ──でも、林檎の輪郭が、どこにもない。 | でも、林檎の輪郭が、どこにもない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/19/text | （落ち着け。ダブルアップルだ。あの味だ。覚えてるだろ。毎日嗅いできた香りだろ──） | （落ち着け。ダブルアップルだ。あの味だ。覚えてるだろ。毎日嗅いできた香りだろ……） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/21/text | ──ここで「分からない」と言ったら、終わる気がした。県大会覇者が、ダブルアップルが分からない。 | ここで「分からない」と言ったら、終わる気がした。県大会覇者が、ダブルアップルが分からない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/27/text | ──これ、グレープ。ダブルアップル、一粒も入ってないよ | これ、グレープ。ダブルアップル、一粒も入ってないよ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_double_apple_incident /dialogues/1/lines/28/text | ──────。 | 言葉が出なかった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_taste_return /dialogues/4/lines/1/text | いつものように、ましろの一杯を吸う。──ふいに、舌の奥で、何かが灯った。 | いつものように、ましろの一杯を吸う。ふいに、舌の奥で、何かが灯った。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_taste_return /dialogues/4/lines/2/text | ──林檎だ | 林檎だ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_double_apple.json ch3_taste_return /dialogues/4/lines/6/text | ──おかえり | おかえり | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_mashiro.json ch3_mashiro_practice /dialogues/3/lines/0/text | ────mukai。閉店後。 | mukai。閉店後。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_mashiro.json ch3_mashiro_practice /dialogues/3/lines/5/text | 「もっと上手く」「もっと正確に」──東京のシーシャ店で感じた差を埋めようと、必死だった。 | 「もっと上手く」「もっと正確に」。東京のシーシャ店で感じた差を埋めようと、必死だった。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_volk.json ch3_volk_second /dialogues/1/lines/2/text | 前回、室温は22度だった。今日は──（壁の計器を一瞥して）25度。湿度も高い | 前回、室温は22度だった。今日は、（壁の計器を一瞥して）25度。湿度も高い | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_volk.json ch3_volk_third /dialogues/2/lines/12/text | お前の煙は、計算式で説明できない。だが──お前の煙を吸った客の顔が変わる | お前の煙は、計算式で説明できない。だが、お前の煙を吸った客の顔が変わる | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_volk.json ch3_volk_fourth /dialogues/3/lines/10/text | 軍では、精度が全てだった。ブレることは、失敗だった。だが── | 軍では、精度が全てだった。ブレることは、失敗だった。だが…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch3_volk.json ch3_volk_after_ch3 /dialogues/4/lines/5/text | 精度は完璧だった。だが──俺の煙は、お前の煙に対して『反応』しなかった | 精度は完璧だった。だが、俺の煙は、お前の煙に対して『反応』しなかった | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch4_main.json ch4_result /dialogues/9/lines/1/text | 勝者は──日本、蒸野はじめ！ | 勝者は、日本、蒸野はじめ！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/ch5_main.json ch5_relationship_before_second_cup /dialogues/4/lines/5/text | 二本目は、立ち上がりの香りを── | 二本目は、立ち上がりの香りを…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_minto /dialogues/0/lines/9/text | （この人の隣にいたい。……そう思っているのは、俺の方だ。なら、言うのは——俺からだ） | （この人の隣にいたい。……そう思っているのは、俺の方だ。なら、言うのは、俺からだ） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_tsumugi_reject /dialogues/5/lines/3/text | 俯いた横顔は、いつもと変わらない静かな表情だったけれど──。 | 俯いた横顔は、いつもと変わらない静かな表情だったけれど……。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_mashiro /dialogues/9/lines/2/text | でも──いつもと違って、何も喋らない。 | でも、いつもと違って、何も喋らない。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_mashiro_accept /dialogues/10/lines/18/text | まどろみの世界へと引きずり込まれていった── | まどろみの世界へと引きずり込まれていった…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_rin /dialogues/12/lines/8/text | （契約のためじゃなく、この人に会いに行ってた。それを、言葉にするなら——） | （契約のためじゃなく、この人に会いに行ってた。それを、言葉にするなら……） | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/confession.json confession_rin_accept /dialogues/13/lines/10/text | ふふ。──いいの。私の在庫で、いちばん手放さないやつだから | ふふ。いいの。私の在庫で、いちばん手放さないやつだから | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/dreams.json ch1_dream_early /dialogues/0/lines/2/text | すべての煙には最適解がある。感情なんて──ノイズだよ | 同じ条件、同じ手順で、同じ煙を。何度でも再現できるはずだよ | 博士のデータ収集・再現性の研究へ整合（元31） |
| data/dialogue/dreams.json ch2_dream_early /dialogues/2/lines/4/text | 振り返ると、ミントの香りが鼻を突く。強烈な清涼感。まるで何かを必死に消そうとしているような── | 振り返ると、ミントの香りが鼻を突く。強烈な清涼感。まるで何かを必死に消そうとしているような…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/dreams.json ch3_dream_early /dialogues/4/lines/3/text | ──俺の、大会の全試合データ。 | 俺の、大会の全試合データ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/dreams.json ch3_dream_early /dialogues/4/lines/4/text | ああ、君のデータは実に面白い。揺らぎが美しいんだ | ああ、君のデータは実に面白い。この煙を再現する条件を知りたいんだ | 博士のデータ収集・再現性の研究へ整合（元31） |
| data/dialogue/lover_events.json lover_rin_lv5 /dialogues/14/lines/2/text | 試香紙には、几帳面な字でこう書いてあった。──『Hajime』。 | 試香紙には、几帳面な字でこう書いてあった。『Hajime』。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_tutorial_offer /dialogues/0/lines/0/text | はじめ、あのお姉さんの一台を作るぞ。俺が横で見てる | はじめ、あのお姉さんの注文で、手順をおさらいするぞ | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_offer /dialogues/0/lines/1/text | 配合から提供まで、一つずつ手順を確かめよう | 俺が横で見てる。配合から提供まで、一つずつ確かめよう | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_offer /dialogues/0/lines/2/choices/0/text → /dialogues/0/lines/3/text | 一台作る | お願いします。いつもの手順を見直したいです | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_offer /dialogues/0/branches/practice/1/text | お願いします。最初から確認させてください | お願いします。いつもの手順を見直したいです | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_intro /dialogues/21/lines/0/text | おい、はじめ。大会に出るって決めたなら、一台の作り方を最初から仕込んでやる | まずは仕組みのおさらいだ。いつもの作業と照らして聞け | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_intro /dialogues/21/lines/1/text | 仕組みから確かめとくぞ。シーシャは、香り付きの葉を炭の熱で温める水たばこだ | シーシャは、香り付きの葉を炭の熱で温める水たばこだ | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_result /dialogues/22/lines/0/text | ──最後の一服を吐き出して、顔を上げる。カウンターの向こうで、スミさんが頷いた。 | 最後の一服を吐き出して、顔を上げる。カウンターの向こうで、スミさんが頷いた。 | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_result /dialogues/22/lines/1/text | ──それで一台だ。いまの全部、お前の手でやったんだぞ | それで一台だ。いまの全部、お前の手でやったんだぞ | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_result /dialogues/22/lines/4/text | それと、ひとつだけ覚えとけ。──技は盗め。ただし、誰から盗んだかは忘れるな | それと、ひとつだけ覚えとけ。技は盗め。ただし、誰から盗んだかは忘れるな | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_tutorial_burnt /dialogues/23/lines/0/text | ──ボウルの奥で、ぱちっと嫌な音がした。焦げた匂いが立ちのぼる。 | ボウルの奥で、ぱちっと嫌な音がした。焦げた匂いが立ちのぼる。 | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/remake_ch1.json remake_midcheck /dialogues/24/lines/1/text | ──ただし、寝ること。それも仕込みのうちだ | ただし、寝ること。それも仕込みのうちだ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_intro /dialogues/25/lines/2/text | それと、これだけは持っていけ。──見せるんじゃなくて、届けるんだよ | それと、これだけは持っていけ。見せるんじゃなくて、届けるんだよ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_great /dialogues/26/lines/0/text | ──通し、終了。スミさんに一服出す。長い沈黙。 | 通し、終了。スミさんに一服出す。長い沈黙。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_great /dialogues/26/lines/2/text | リハーサルの出来は、本番の落ち着きになる。──明日はよく食って、よく寝ろ | リハーサルの出来は、本番の落ち着きになる。明日はよく食って、よく寝ろ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_good /dialogues/27/lines/0/text | ──通し、終了。スミさんに一服出す。長い沈黙。 | 通し、終了。スミさんに一服出す。長い沈黙。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_good /dialogues/27/lines/2/text | リハーサルの出来は、本番の落ち着きになる。──明日はよく食って、よく寝ろ | リハーサルの出来は、本番の落ち着きになる。明日はよく食って、よく寝ろ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_rough /dialogues/28/lines/0/text | ──通し、終了。スミさんに一服出す。長い沈黙。 | 通し、終了。スミさんに一服出す。長い沈黙。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_rough /dialogues/28/lines/2/text | リハーサルの出来は、本番の落ち着きになる。──明日はよく食って、よく寝ろ | リハーサルの出来は、本番の落ち着きになる。明日はよく食って、よく寝ろ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_burnt /dialogues/29/lines/0/text | ──通しの最後、ボウルから焦げた匂いが立った。スミさんが黙って炭を外す。 | 通しの最後、ボウルから焦げた匂いが立った。スミさんが黙って炭を外す。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_rehearsal_burnt /dialogues/29/lines/3/text | ──今日はもう上がれ。よく食って、よく寝ろ | 今日はもう上がれ。よく食って、よく寝ろ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_sick_half /dialogues/34/lines/0/text | 朝。喉の奥が痛い。額に手を当てると、じんわり熱い。──風邪だ。 | 朝。喉の奥が痛い。額に手を当てると、じんわり熱い。風邪だ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_sick_full /dialogues/35/lines/0/text | 朝。喉の奥が痛い。額に手を当てると、じんわり熱い。──風邪だ。 | 朝。喉の奥が痛い。額に手を当てると、じんわり熱い。風邪だ。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_baito_end /dialogues/42/lines/0/text | ──シフト終了。片付けを済ませると、スミさんが今日のバイト代を封筒で手渡してくれた。 | シフト終了。片付けを済ませると、スミさんが今日のバイト代を封筒で手渡してくれた。 | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_day1_errand_shop /dialogues/43/lines/0/text | はじめ。お前の道具、まだ揃ってないだろ | はじめ。大会用の葉、まだ仕入れてないだろ | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/remake_ch1.json remake_day1_errand_shop /dialogues/43/lines/3/text | 今回のミントは店の仕入れだ。経費で払っておく | 今回のミントの代金は、店の経費だ | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/remake_ch1.json remake_day1_errand_shop /dialogues/43/lines/4/text | お前の財布から出す必要はない。受け取ってこい | お前は受け取ってくるだけでいい | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/remake_ch1.json remake_delivery_eden /dialogues/45/lines/0/text | おう、戻ったか。……悪いが、もうひとつ届け物を頼む | おう、戻ったか。もうひとつ、届け物を頼む | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/remake_ch1.json remake_delivery_eden /dialogues/45/lines/2/text | 練習用にもらったダブルアップルと同じ、深い紅色のラベル。ただ、色が少しくすんでいる。 | 店で見慣れたダブルアップルの、深い紅色のラベル。ただ、色が少しくすんでいる。 | 前後の応答・動作・既存設定の整合、重複解消 |
| data/dialogue/remake_ch1.json remake_round4_end /dialogues/67/lines/3/text | さっきまで隣で笑ってた人が、ですよ〜♪ 諦めなくたって終わる人はいる──それが大会！ ぷぷぷっ！ | さっきまで隣で笑ってた人が、ですよ〜♪ 諦めなくたって終わる人はいる、それが大会！ ぷぷぷっ！ | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/remake_ch1.json remake_tutorial_retry /dialogues/77/lines/0/text | ──吸い重ねるうち、葉の香りが薄くなってしまった。 | 吸い重ねるうち、葉の香りが薄くなってしまった。 | 新人の手順のおさらいへ接続、重複導入・一択メニュー解消（6/7） |
| data/dialogue/samechan.json samechan_first_encounter /dialogues/0/branches/shark_yes/0/text | おお！ スピルバーグを尊敬しておるのじゃ。見えそうで見えん、あの間がの……最初から話すと―― | おお！ スピルバーグを尊敬しておるのじゃ。見えそうで見えん、あの間がの……最初から話すと…… | 間・中断・強調を句読点または自然な文へ（元29） |
| data/dialogue/samechan.json samechan_shop_repeat_1 /dialogues/3/lines/2/text | スピルバーグのサメは、出ていない時もそこにおると思わせるじゃろう。あの―― | スピルバーグのサメは、出ていない時もそこにおると思わせるじゃろう。あの…… | 間・中断・強調を句読点または自然な文へ（元29） |
