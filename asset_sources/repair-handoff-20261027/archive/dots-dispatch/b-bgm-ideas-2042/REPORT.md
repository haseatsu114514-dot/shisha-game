# BGM案：まず必要な3曲、その後の上位10案

現行曲を置き換える提案ではなく、場面に足りない役割を埋める提案。最初は **審査待ち／大会結果／味覚不調の3曲** が有効。帰路・隣町は次段階、練習と私的会話は既存曲の再利用を先に比較し、第3–5章はrunner接続に合わせて制作する。10案を10新曲とは数えない。

## 確認範囲

既存Gitオブジェクトmain7c0ffe70から286ソース/台本、非legacy681場面を読取。Aのworkingtreeは読まず編集もなし。最新main ea189b6eのmanifest・audio resolver・章2story/プリクラ接続5fileを追加照合（117126B）。manifestには12音源登録。音源データは一切取得・再生せず、音色/BPMは制作提案であって既存曲の試聴評価ではない。全体のsource hashと呼出行は同folderのSOURCE-EVIDENCE/に保存。

## 現行音楽の役割

|役割|現行key/接続|提案|
|---|---|---|
|タイトル|title、scenes/title.js|維持。新タイトル曲は要らない|
|店・日常|tonari / kansetsu_shomei_to_black_coffee|場所/私的会話の使い分けを先に見直す|
|サメちゃん|sweets_or_sweets、metadata.bgm_on_speaker|既接続を活用。他人物へ一律流用しない|
|大会|bgm_tournament_edm/craft は実音源、wait/resultは合成fallback|不足2役割を優先制作|
|CONTINUE|bgm_continue_urgent.mp3|#850は履歴として再利用。keyだけで実音/decoder成功とはせず、新曲不足に数えない|
|TRPG・斧|bgm_trpg / bgm_axe|既存曲あり、新曲数へ加算しない|
|プリクラ|bgm_purikura / _b / _d の3曲から演出で選択し終了時復帰|963統合済み。さらに追加しない|
|地図/ライバル店|bgm_map/bgm_rival_shopのfallback定義のみ。今回明示caller確認なし|曲を作る前にhook設計を確定|

## 上位10案

### BGM01 票が開くまで（P1）

- 用途・ID：remake_judging_intro
- 接続状態：既存hookあり・専用実音源追加。chapters/ch1.js:468,546 / chapters/ch2-tournament.js:270,274
- 曲調：控えめなパルス、低いベース、時計を連想させる短い打音。盛り上がりを解決させず、台詞と数字を前に出す。テンポ目安 88–100。
- ループ・切替：60–90秒のシームレスループ。票の開示開始で1小節区切り、退出・LOADは既存owner契約で停止/復帰。
- 制作量：1曲。
- 既存との差：bgm_tournament_waitは呼出し済みだがmanifestにファイルなし、現状tension合成。craft/EDMの勢いと役割を分ける。

### BGM02 今日の一台、そのあと（P1）

- 用途・ID：remake_defeat_follow
- 接続状態：既存hookあり・専用実音源追加。chapters/ch1.js:560,651,695
- 曲調：フェルトピアノと柔らかいギター。勝敗の善悪を押し付けない安堵、敗北にも残る帰る場所。テンポ目安 68–78。
- ループ・切替：75–100秒。勝利は終止の短い尾、敗北は音数を落とす尾を同じ主題から。結果確定以前に祝勝へ切り替えない。
- 制作量：1曲＋同素材の短い終端2種（別曲扱いにしない）。
- 既存との差：bgm_result_emotionalは呼出し済みだがファイルなし、現状calm合成。通常カフェ曲と結果の余韻を分ける。

### BGM03 香りが遠い夜（P1）

- 用途・ID：ch2_slump_taste, remake_ch2_ageha_slump
- 接続状態：現行場面あり・新曲＋場面hook計画。chapters/ch2-story-data.js CH2_NIGHTS / chapters/ch2-story.js
- 曲調：低音を薄くしたアンビエント、息の長い鍵盤、曖昧な輪郭。恐怖音や過剰な悲劇には寄せない。テンポ目安 60–72／拍感弱め。
- ループ・切替：70–100秒。症状場面に入る時だけ短くフェードし、会話終了で元曲へ。家庭配合の数値評価は変えない。
- 制作量：1曲。
- 既存との差：現行scene metadataに専用bgm指定なし。聴感で症状を断定する演出ではなく、通常日常の音数との差を作る。

### BGM04 煙の匂いが抜ける帰り道（P2）

- 用途・ID：remake_homecoming_0, remake_homecoming_1, remake_homecoming_2, ch2_city_return
- 接続状態：現行場面あり・新曲＋場面hook計画。daily/calendar.js / chapters/ch2.js の帰路
- 曲調：夜のラウンジ、少数のエレピと遠いギター。今日の仕事を閉じる落ち着き。テンポ目安 76–88。
- ループ・切替：90秒、短い帰宅なら途中からでも自然。列車/雨/歩行SEの帯域を空ける。
- 制作量：1曲。将来の帰国・ending_daily_smokeでも再利用候補。
- 既存との差：昼のtonari/買物のblack_coffeeと夜の終わりを区別。章別に帰宅曲を増やさない。

### BGM05 隣町、三つの席（P2）

- 用途・ID：remake_ch2_kumicho_chat, remake_ch2_rei_chat, remake_ch2_ageha_chat
- 接続状態：現行場面あり・共通主題と小編成差分の案。chapters/ch2-preparation.js visitPreparationSpot
- 曲調：共通の短い街モチーフ。神崎は乾いた低弦、REIは控えめなクリーンギター、あげはは軽い鍵盤という音色差。テンポ目安 82–96。
- ループ・切替：各店入室/会話時に切替、帰りは前の街曲へ。初回・続編・再訪で同じ主題を使い、未知の素性や恋愛を音で先取りしない。
- 制作量：まず共通1曲。店別は同曲のステム差分、3新曲には数えない。
- 既存との差：bgm_rival_shopにはcalm fallback定義があるが、現行callerに専用keyの明示呼出しは確認できない。まず接続設計が必要。

### BGM06 手順に集中する時間（P2）

- 用途・ID：remake_rehearsal_intro, remake_rehearsal_great, remake_rehearsal_good, remake_rehearsal_rough
- 接続状態：既存曲再利用／新曲不要。chapters/ch1.js rehearsal と既存大会craft
- 曲調：まず既存bgm_tournament_craftを練習場面へ仮当てし、会話/工程SEと共存できるか聴取評価。テンポ目安 新たなBPM指定なし（既存曲の実測未実施）。
- ループ・切替：現行ループ素材を利用し、提供時に通常曲へ戻す。採用前は聴取比較のみ。
- 制作量：新曲0。必要が判明した場合だけ後日同曲の薄い編成版を検討。
- 既存との差：大会craftは実音源と接続が既にある。練習用という名目だけで別曲を増やさない。

### BGM07 店の声から、二人の声へ（P2）

- 用途・ID：tournament_date_tsumugi, tournament_date_minto, lover_samechan_lv1
- 接続状態：既存曲再利用／音楽hook計画。vn/engine.js sceneBgm/speakerBgm/会話終了時の復帰 / daily/date-scene.js
- 曲調：tonari/black_coffeeを場の曲としてまず維持。サメちゃんは既存sweets_or_sweetsを本人登場から使う現行方法を基準にする。テンポ目安 既存曲のため未実測。
- ループ・切替：会話開始で鳴らし直しすぎず、短いフェードと復帰を優先。全キャラ共通の恋愛曲を強制しない。
- 制作量：新曲0。今ある4日常系曲の使い分けを先に確認。
- 既存との差：一部samechan metadataは既接続。他人の私的会話に専用曲がないことだけで即新曲需要と断定しない。

### BGM08 少しだけ、林檎（P3／将来章）

- 用途・ID：ch3_abyss_recovery, ch3_rest_before_recovery, ch3_mashiro_recovery, ch3_home_customer
- 接続状態：将来第3章・新曲計画のみ。data/dialogue/ch3_main.json / ch3_double_apple.json、現行本編の章3runnerなし
- 曲調：少しずつ音が戻る小編成。英雄的な覚醒ではなく生活の呼吸、休む日にも成立する旋律。テンポ目安 66–80。
- ループ・切替：主題1曲から音数の少ない版と通常版。回復を一回の大サビで確定させない。
- 制作量：将来1曲＋同素材差分。
- 既存との差：章2の輪郭が遠い主題を再構成すると物語がつながる。現行プレイで鳴るとの主張はしない。

### BGM09 FESTAの表と、休む席（P3／将来章）

- 用途・ID：ch4_festa, ch4_stranger_first, ch4_tournament_start, ch4_two_tables
- 接続状態：将来第4章・新曲計画のみ。data/dialogue/ch4_main.json、現行本編の章4runnerなし
- 曲調：祝祭の打楽器と穏やかな撥弦。表の賑わいと人が休む席を同一主題の密度差で描く。テンポ目安 104–116（静かな版は拍感を抑える）。
- ループ・切替：市場/店は共通主題、大会では既存EDM/craftの再利用も比較。国別ステレオタイプの記号だけで作らない。
- 制作量：将来1曲＋静かなステム版。大会3相手分を別曲にしない。
- 既存との差：海外の場所感と接客の居場所を担い、現行大会曲の高揚だけに依存しない。

### BGM10 記録の外にも、席がある（P3／将来章）

- 用途・ID：ch5_unrecorded_day, ch5_copy_first_cup, ch5_relationship_before_second_cup, ch5_doctor_after_match, ch5_return_to_tonari
- 接続状態：将来第5章・新曲計画のみ。data/dialogue/ch5_main.json、現行本編の章5runnerなし
- 曲調：機械の一定パルスと人が触れる柔らかい楽器を両立。機械を悪役化せず、客への一台へ収束する。テンポ目安 84–96。
- ループ・切替：同条件二本勝負では共通基盤、休憩で薄くし再開。勝敗・同数は結果確定後にのみ分岐、帰店で既存tonariへ帰る。
- 制作量：将来1曲＋パートON/OFF。ラスボス曲とending曲を無理に追加しない。
- 既存との差：既存大会EDMの競争から、記録と日常を並べる音へ。未実装章の計画で採用未決定。

## 全体の場面別一覧

以下は台本file単位の俯瞰。全681 sceneIDごとの出典・参照・接続確度・音楽指定・提案IDはSCENE-MUSIC-MATRIX.jsonへ記録。loadedは接続/実再生の証明ではない。

|台本群|場面数|接続の扱い|音楽の整理|
|---|---:|---|---|
|axe_bar_discovery|2|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|axe_tutorial|7|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_adam|9|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_ageha|1|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_bonds|9|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_events|8|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_incognito|3|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_interval|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_main|10|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_minto|11|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_naru|10|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_rin|6|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_spots|35|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_sumi|10|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_tournament|17|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch1_tsumugi|9|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_ageha_story|7|夜story接続＋個別条件あり|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_choice_echoes|1|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_city|9|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_city_guests|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_isolation|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_kumicho|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_main|8|夜story接続＋個別条件あり|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_preparation|9|本編callback接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_rei|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch2_tournament|6|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_double_apple|6|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_main|18|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_mashiro|4|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_mukai|3|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_rivals|3|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_spots|5|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_tsumugi|1|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch3_volk|6|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_ageha_dubai|1|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_main|16|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_mashiro_dubai|2|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_minto_dubai|1|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_rin_dubai|1|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_spots|3|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_tsumugi_dubai|1|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch4_visitors|2|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|ch5_main|9|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|confession|21|起動DBロード／個別callerは別確認|専用metadata 3件。残りは継続曲/将来hookを検討|
|craft_inner_voice|30|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|dreams|8|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|ending|11|将来章・全章runner未接続|専用metadata 0件。残りは継続曲/将来hookを検討|
|hiyori|21|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|lover_events|30|起動DBロード／個別callerは別確認|専用metadata 5件。残りは継続曲/将来hookを検討|
|relationship_conflicts|18|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|remake_ch1|79|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|remake_ch2|4|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|samechan|10|起動DBロード／個別callerは別確認|専用metadata 10件。残りは継続曲/将来hookを検討|
|shop_event|1|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|tournament_craft|27|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|
|tournament_dates|7|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|trpg_ordinary|49|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|trpg_shark|49|章source参照/未確定をmatrixに分離|専用metadata 0件。残りは継続曲/将来hookを検討|
|venue_hours|17|起動DBロード／個別callerは別確認|専用metadata 0件。残りは継続曲/将来hookを検討|

## 制作順と受入

第1弾3曲、各60–100秒程度のループ。台詞を邪魔しない帯域・SEとの相性・継ぎ目・短い場面の途中離脱・通常曲への復帰を確認してから採用判断する。第2弾は帰路1曲と隣町共通1曲まで。将来章3曲は実装接続時に別判断。既存曲再利用2案は新曲0。

#850の既存TEST-RESULT.mdを参照し、現行resolverを最新audioで確認。旧外部URLを現行音源の取得/再生成功の根拠にしない。曲key/currentBgmの存在≠実際に聴こえる証明。

Suno操作・音源生成・採用・manifest/コード/SAVE編集なし。候補名は制作案で採用名称ではない。
