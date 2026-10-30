# Issue #563 — 第2章3店の素材・個別交流 棚卸し

## 2026-10-26の現在地

確認main `4c6cbf232303b6f85ec0eccbe05828873d4ea909`。下の10月18日以前の不足表は履歴で、現在の不足と混同しない。

- 採用3会話・既存normal対応は#603/#693、神崎・REIの短い再訪は#957で統合済み。正常読了・中断時の精算と保存を維持し、同じ続編を作り直さない。
- 神崎は#962/#1011の53歳・白チェックのスーツ、5表情と顔アイコンが正式素材。REIは#1011の初期衣装リメイク＋不規則な深赤メッシュのnormalと顔アイコンを採用済み。#929のA/B/C選定待ちへ戻さない。REIの他表情はnormal代替のまま。
- 窓のない営業中の客席は人工照明を保つため、夜になっただけで暗くしない（`core/data.js` の夜色補正方針）。3店一括の夜差分は必須素材としない。
- 章末のあげはだけは「閉店後」という別の営業状態。#929 A2として同室の消灯差分を制作し、[原画・比較](../../asset_sources/ch2-closed-night-563-929/README.md)へ保存。通常の訪問へ広げない。
- 営業中の器具の追加配置・固定モデル・使用CGは未制作。機材とホースの実物参照、画像採否、場面の指定を伴う後続作業として残す。新しい設定・性能・報酬は追加していない。

## 2026-10-18の再棚卸し（当時の状態・履歴）

照合main: `7d63fbdc5ce75e57c3cca438476452b7238bd12e`。旧棚卸しは[PR #567](https://github.com/haseatsu114514-dot/shisha-game/pull/567)で保存・統合済み、採用3会話の接続は[PR #603](https://github.com/haseatsu114514-dot/shisha-game/pull/603)で統合済み（merge `4834e9eccb54d7aff466cac03bf784b5227e5735`）。直下の「後続Draftを準備」と、以下の基準main時点の不足・候補は履歴として読む。現在の接続を未実装・承認待ちへ戻さない。

| 対象 | 現行の既存／不足 | 候補・承認待ち・依存 |
| --- | --- | --- |
| 3店の昼夜・場面・営業時間 | MELTY PUFF／神崎煙草店／零-ZERO-のROOMSは各`bg_ch2_<id>_entry.webp`を継続。PREPARATION_SPOTSにopenSlotsはなく、openingStatusは昼夜とも許可。実時刻や無条件入店を意味しない | 夜専用室内・営業中器具の採用差分は未接続。夜背景は保留。店ごとの必要場面・照明・器具状態の候補は下記の旧棚卸しを参照し、採用済みへ昇格させない |
| 神崎smile／REI serious | 採用済みだが現行manifestの両者はnormalのみ。表情の指示と画像の実在・表示完了を区別 | 既存の採用原画は正規転送403により本環境に未取得。bytes・寸法・alpha・本人性・足元・実会話表示の検証が依存。取得障害は[素材記録](../../asset_sources/ch2-followups-issue563/README.md)と[直近引き継ぎ](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6251858868)を参照。採用を再承認待ちへ戻さない |
| 個別会話続編 | `remake_ch2_ageha_followup` 14行／`remake_ch2_kumicho_followup` 12行／`remake_ch2_rei_followup` 14行が存在。chat→followup（一度）へ接続済み。神崎／REIは以後repeat | あげははfollowup後に#626の店に通う回を選ぶ分岐も現行に存在するため、「3人とも直ちにrepeatだけ」と要約しない。既存の別会話を再実装しない。#564の全体添削は対象外 |
| 保存・報酬 | 新続編読了は`flags._ch2_followup_done`。旧訪問回数等から推定せず、正常終端とstate所有者一致後に費用・体力・読了を確定する現行コードを確認 | 過去のブラウザQAは[会話QA](../qa/ch2-followups/README.md)の実施範囲。今回の読取照合を新画像・ブラウザ通し・実機Safariの成功とは扱わない |

同worker `codex-563-20261015-01a13c35`を維持。今回もclaim `38697952277`／status `38698135764`の成功job実ログと、最新bot台帳のowner/run一致を読取確認。全13 Open PRの実変更パスに本資料との重複はない。#683は共有manifest・spot-hours等を変更中のため、その予定を現行mainの事実に混ぜず保持する。未push作業の有無は他環境について証明していない。

今回の変更は本資料の現状追補のみ。runtime・本編台詞・manifest・採用画像・`ch2-city-data.js`は読取のみ。画像生成・素材取得・マージ・公開・Issue終了・予約の再発行／解除／移管は行わない。#548のDAY14・章末、#564全体添削、ヴォルクの第2章登場・離別理由・味覚回復を追加しない。

## 2026-10-16の採用・接続追補（履歴）

同じworker `codex-563-20261015-01a13c35`で、採用済みの3会話を初回chat→followupを一度→既存repeatへ接続する後続Draftを準備。新読了は`flags._ch2_followup_done`で記録し、旧相談回数・総訪問・好感度・思い出から推定しない。費用・体力は続編の正常終端後に確定する。

あげは「感覚を言葉にする」、神崎「一度置いて見直す」、REI「曲の話なら言葉が増える」と、神崎smile／REI seriousは採用済み。以下の過去棚卸しにある「候補・承認待ち」はこの採用分について更新する。夜背景は後回し。

**画像組込みは未完**: Libraryの原画・比較は識別できたが、このクラウド環境から配信先へ接続すると`403 Forbidden`。正規helperによる取得と取得情報更新後の再試行がともに失敗した。画像bytes未取得のため、採用PNG/WebP・manifestは変更していない。新会話の神崎smile／REI seriousは現在normalへ代替されるので、会話テストの成功を画像完成としない。[採用ソース・障害・検証の記録](../../asset_sources/ch2-followups-issue563/README.md)を参照。

#564は本統合後の版から全体添削する編集順が指定された。今回の新3会話は#563が扱い、#564の全体添削・他会話の修正は行わない。以下は`507809c3`時点の棚卸しとして保持する。

検討基準: `507809c3685a76d0853a3ca3da8c4150fb4e9f8b`（2026-10-15 JSTの取得時点のmain）。[Issue #563](https://github.com/haseatsu114514-dot/shisha-game/issues/563) の検討資料であり、新しい設定・素材・接続の採用決定ではない。

## 範囲と状態の読み方

- **既存**: 基準mainに存在するもの。台本の存在と本編からの到達は分けて記す。
- **不足**: 対象の場面に使う専用素材・続編の接続がないもの。既存画像の品質不良という判定ではない。
- **候補**: 次工程で比較する方向。新規生成・台詞執筆・runtime変更は今回行わない。
- **承認待ち**: 必要な枚数・場面・設定・採否をオーナーが選ぶ段階。候補を承認済みとは扱わない。
- **依存**: 着手前に確認する正本・別担当・保存条件・素材QA。

変更対象はこの資料だけ。`remake/`、本編台詞、manifest、採用画像、`ch2-city-data.js`は読取のみ。[PR #562](https://github.com/haseatsu114514-dot/shisha-game/pull/562) はマージ済みで、[#548](https://github.com/haseatsu114514-dot/shisha-game/issues/548) のDAY14競技・章末・再挑戦は作り直さない。[#564](https://github.com/haseatsu114514-dot/shisha-game/issues/564) の全体添削を代行しない。ヴォルクの第2章登場、離別理由の開示、味覚回復を追加しない。旧ヴォルク素材・旧セーブは保存対象。

参照先の旧状態に注意: [ロードマップ](plans_post_chapter1_roadmap.md) と [日常QA](../qa/ch2-daily/README.md) のDAY14未接続は当時の記録。現在の接続は [大会QA](../qa/ch2-tournament/README.md) と現行コードで確認する。素材READMEに残る4店・展示の記述も、冒頭のヴォルク訂正と現行3店を優先する。

## 正本・現物の対応

| 確認する事実 | 読む場所 |
| --- | --- |
| ID・年齢・本人設定 | [characters.json](../../data/characters.json) のageha/kumicho/rei。内装の補足は [人物資料](../../brand/character_profiles.md) の各節 |
| 開示順・第2章の筋 | [物語正本](../../brand/story_and_structure.md) 第2章、[ゲーム参照資料](../gameplay_agent_reference.md) の大会規則・正本表 |
| 店・地図・室内の参照 | [ch2-city-data.js](../../remake/js/chapters/ch2-city-data.js) のMAP/STOPS/ROOMS、[初日](../../remake/js/chapters/ch2.js)、[日常](../../remake/js/chapters/ch2-preparation.js) |
| 昼夜と訪問可否 | [state.js](../../remake/js/core/state.js) のslot/timeOfDay、[spot-hours.js](../../remake/js/daily/spot-hours.js)、[calendar.js](../../remake/js/daily/calendar.js) |
| 内装原画・採用履歴 | [店内README](../../asset_sources/ch2-interiors/README.md)、[寸法・ハッシュ・実指示](../../asset_sources/ch2-interiors/metadata.json)、[C2P02/06/08/09](../owner_requests.md) |
| 表情の実在・表示代替 | [manifest](../../remake/data/manifest.json) のportraits（設定正本ではなく登録現物）、[portraitInfo](../../remake/js/core/data.js)、[初回normal制作記録](../../asset_sources/ch2-characters/README.md) |
| 現行会話／保存 | [ch2_preparation.json](../../data/dialogue/ch2_preparation.json)、ch2-preparation.js、[夜の予定](../../remake/js/chapters/ch2-story-data.js)、[章進行](../../remake/js/chapters/ch2-progress.js) |
| 素材と会話の手順 | [素材ルール](../asset_ai_guidance.md)、[canon-check](../../.claude/skills/canon-check/SKILL.md)、[立ち絵手順](../../.claude/skills/character-portrait-remaster/SKILL.md)、[台詞編集手順](../../.claude/skills/dialogue-edit/SKILL.md) |

## 昼夜・営業時間・現行背景

3店の`PREPARATION_SPOTS`には`openSlots`指定がなく、共通`openingStatus`は昼slot=0／夜slot=1とも許可する。案内は昼「仕込みや調整の話」、夜「常連が集まる時間」。これはゲームの行動枠の条件で、現実の開店・閉店時刻や24時間営業の確定ではない。料金・体力・同日訪問・固定予定等の制限は別にあり、「昼夜可」は無条件入店を意味しない。

| 店 | 昼・初日見学の既存 | 夜の日常の既存 | 不足／候補／承認待ち |
| --- | --- | --- | --- |
| MELTY PUFF / ageha | `assets/backgrounds/bg_ch2_ageha_entry.webp`。ピンク・豹柄・プリクラ機・デコ小物・白とピンクのクマ。初日は準備中の見学 | 同じentry画像で相談・再訪。夜の街から室内へ入っても専用夜絵に切り替わらない | 不足: 夜・営業中の専用差分。候補: 既存の家具・クマ配置と人物用余白を保ち、照明と使用卓だけ比較。必要場面・枚数・夜絵採否は承認待ち |
| 神崎煙草店 / kumicho | `assets/backgrounds/bg_ch2_kumicho_entry.webp`。濃い木壁・黒革ソファ・執務机・大理石床・神棚・肖像・金屏風・蛍光灯。旧畳案へ戻さない | 同じentry画像で相談・再訪。黒革の応接空間は継続 | 不足: 夜・営業中の専用差分。候補: 卓と手の作業が読める実用照明を維持し、使用卓の状態で差別化。暗くするための一律減光や素性確定の追加演出は採用しない。差分の必要性・構成は承認待ち |
| 零-ZERO- / rei | `assets/backgrounds/bg_ch2_rei_entry.webp`。黒／ワインレッド・薔薇格子・ベルベット・小舞台・CD・ギター・銀小物 | 同じentry画像で相談・再訪。曲やCDの会話が中心 | 不足: 夜・営業中の専用差分。候補: 既存CD・ギター・舞台を保ち、客席と器具を読める照明案を比較。実在バンドの画像・ロゴを追加しない。ライブ開催という新イベントは別承認 |

上記3背景は各1280×720。準備中で器具は画面外に置く制作方針であり、営業中器具の構造QA済み画像ではない。世界観を優先し、客席へタッパー・缶・葉を露出させない（不透明収納／バックヤード）。内装は人物設定・採用記録の要約で、今回の新しい画像目視合格判定ではない。

| 場面 | 既存／今回の判断 | 依存・優先候補 |
| --- | --- | --- |
| DAY1到着・顔合わせ・室内見学 | 本編地図はMAP.day。STATIONは昼画像。任意の3室見学は各entry。帰路はMAP.night | 既存の準備中画像を保持。初日を営業・喫煙実演へ変えない |
| DAY2〜13昼の店巡り | 地図は`timeOfDay()`のday、室内はentry。初回chat／再訪repeat | 営業中器具を描くか、相談用の準備中画を継続するかを場面ごとに決める |
| DAY2〜13夜の店巡り | 地図はnight、室内は同じentry。夜の地図は既存、夜の室内専用差分は不足 | 最初の比較対象の候補。3枚追加を自動決定せず、照明・器具状態の必要性を先に承認 |
| 独立試遊の昼夜切替 | 地図の昼夜比較。保存や日常営業条件の検証とは別 | 試遊の夜表示を、夜室内差分完成の根拠にしない |
| DAY13固定夜・DAY14以後 | DAY13前夜は夜の街、DAY14本戦は#548/#562の別導線 | 店内夜差分のために固定夜・競技・章末へ新しい場面を挿入しない |

地図は`assets/backgrounds/bg_widehanga_map_day.webp`／`bg_widehanga_map_night.webp`。夜差分でも地形・入口・ピン座標を維持する。旧台本の`bg_ageha_shop.png`・`bg_ryuji_shop.png`やREIの大会舞台指定は、現在のROOMSの代用品・夜素材候補へ自動昇格させない。

## 営業中の器具・店内演出

| 店 | 既存設定・保持点 | 不足 | 検討候補（未承認）／依存 |
| --- | --- | --- | --- |
| MELTY PUFF | ホワイト／レッドグミベアの好み。人物資料には専用台・専用ハガル。現行背景は器具を画面外へ | 営業中の台・ハガルの具体形状、卓の位置、使用／準備状態を示す採用差分 | クマやギャル小物と見分けられる小さな使用卓案。専用機材の型・色・台数は未確定で、味・性能・装備IDを新設しない |
| 神崎煙草店 | 炭と葉を扱う丁寧な手、整理された作業、ドラゴンフルーツ。事務所風の内装を保持 | 営業中の卓・トング・器具の実描写。店舗専用の固定機種は今回の照合範囲で未確認 | 整理された置き場と丁寧な扱いを見せる案。任侠小道具の増量より現行設定を優先。蒸らし0分は将来解放で、絵の追加をゲームでの解放条件にしない |
| 零-ZERO- | ローズ、フローラル系、音楽と接客。CD・ギターと使用器具を区別 | 営業中の卓、器具と舞台の距離、人物・ホースの経路。固定機種は今回の照合範囲で未確認 | 小舞台を背景のまま残す客席案。演奏・ライブ・新しいミックス採用は確定しない。音楽性だけを理由に他店と機材性能を変えない |

制作する場合の依存は [早見表](../../asset_sources/shisha-hardware-reference/drawing-sheet/README.md) と [実物写真索引](../../asset_sources/shisha-hardware-reference/README.md)。一枚ごとに「準備／制作工程／完成・喫煙」の状態、具体的な台とHMD、炭数、ホース、吸い口、人物・台の奥行きを決める。準備・展示ならホースを外せるが、使用中なら側面ポート→ホース→硬質ハンドルの接続が必要。完成・喫煙用CGはHMDと炭の収まり・掌との縮尺を確認し、工程画の直炭と混同しない。炭数は通常2〜3個を基本に器具の容量を優先する。

生成・採用は別工程。実際の写真と本人画像の参照、原画・実指示・変換の保存、構造の目視QA、人物／会話枠を重ねた確認、オーナー採用を経る。今回、写真の再取得・画像生成・構造目視QA・配信組込みは行っていない。機材の見た目の検討で`data/equipment.json`の装備・炭・採点・価格を変更しない。

## 神崎／REIの表情

| 対象 | 既存 | 不足と候補（未制作・未承認） | 依存 |
| --- | --- | --- | --- |
| 神崎 | manifestはnormalのみ。本人原画 `asset_sources/ch2-characters/kumicho/normal-source.png`、採用PNG `assets/sprites/characters/kumicho/chr_kumicho_normal.png` | serious: 手仕事を確かめる時。smile: 再訪を迎える時。surprise／sad: 必要場面を選べた時だけ追加検討。旧台本thirdはserious、fourthはsmugを要求するが、実在差分ではない | normalの顔・体格・髪・傷・衣装・刺青と丁寧な手を維持。威圧と熱さを追加の暴力・素性開示にしない。smugをsmileで代替するか専用にするかも採否待ち |
| REI | manifestはnormalのみ。本人原画 `asset_sources/ch2-characters/rei/normal-source.png`、採用PNG `assets/sprites/characters/rei/chr_rei_normal.png` | serious: 曲や作業への集中。smile: 小さな笑顔。surprise: 話を受け止める戸惑い。sadは必要場面が決まった時に検討。旧個別台本のserious指定は素材の存在証明ではない | 赤黒の非対称髪・刺青・衣装・内向的な仕草を本人normalへ合わせる。本名を表示する演出や派手な別人格を作らない |
| あげは（比較用） | normal/sad/serious/smile/surpriseの5種が登録済み。ch2_preparation内ではnormalを指定 | 追加一式の不足として数えない。既存差分を使う場面の検討と、新規制作を区別 | 正規の顔・年齢感・服装を保持。画風候補PR #539の存在は差し替え承認ではない |

`portraitInfo()`は未登録faceを近似表情、次にnormalへ解決する。神崎／REIでは近似先も未登録なのでnormalになる。これは表示代替であり、別表情の実装完了ではない。DAY14順位の頭部表示も既存normal利用の範囲。

次工程では必要場面とfaceキーを先に選び、[立ち絵手順](../../.claude/skills/character-portrait-remaster/SKILL.md) に従って本人原画と採用画風を参照し、顔比較・小さなポーズ差・共通縮尺・透過・足元を検品する。採用後にだけ配信PNG/WebP・manifest・顔表示との整合を確認する。ここでは別画風への変更も一括5表情生成も決めない。

## 個別会話の続き：既存台本と本編接続を分離

現行`loadPreparationDialogues()`は3人の`remake_ch2_<id>_chat`／`repeat`計6場面を読み込む。`visitPreparationSpot()`は`flags._ch2_talks[id]`がなければchat、以後はrepeatを選ぶ。2回目以降の固有続編・段階ローテーションは未接続。DAY2〜13の訪問先であり、JSONコメントの「DAY2〜3」は利用期限を実装した条件ではない。

| 人物 | 既存の本編初回→再訪 | 保存済みの再利用候補（データは既存／本編日常の接続は不足） | 新しい続きの候補・承認待ち |
| --- | --- | --- | --- |
| あげは | 席と客の表情・LIME交換→決めつけず話を聞く。`remake_ch2_ageha_chat`／`remake_ch2_ageha_repeat` | [ch2_ageha.json](../../data/dialogue/ch2_ageha.json) の`ch2_ageha_second`〜`fifth`、`group_gyarufriend`、`group_new_customer`、`outing_shisha`。firstは名乗り重複を要確認 | 客の反応を聞き返した後の小さな実践・感覚を言葉にする難しさを範囲候補にする。既存secondの主題と比較して新規執筆の重複を避ける。恋愛・病弱設定の開示・新しい関係段階は別承認 |
| 神崎 | 置き場所と丁寧な手→自分の卓で確かめる。`remake_ch2_kumicho_chat`／`remake_ch2_kumicho_repeat` | [ch2_kumicho.json](../../data/dialogue/ch2_kumicho.json) の`ch2_kumicho_second`〜`fourth`。firstは新しい顔合わせと照合。fourthには閉店後・盃／兄弟認定・素性への質問がある | 卓で試した結果を短く伝える段階を候補にする。既存の関係段階へ進める場合は必要読了・時間帯・素性の開示順を先に決める。訪問回数だけで兄弟認定や0分蒸らしを解放しない |
| REI | CDのおすすめと客の好み→曲の感想を待つ。`remake_ch2_rei_chat`／`remake_ch2_rei_repeat` | [ch2_rei.json](../../data/dialogue/ch2_rei.json) の`ch2_rei_second`〜`fifth`、`group_concert_prep`。firstの再名乗り・背景は要照合 | 聴いた曲の感想を持ち寄る、煙と曲の印象を比べる小さな続き。既存の笑顔の練習・「鎧」の告白へ進むかは段階案として承認待ち。ライブ同行は既存候補でも自動採用しない |

上記候補台本は`core/data.js`の起動用リストや現行準備6場面の選択対象に入っておらず、ファイルがあるだけで到達済みとはしない。あげはの`reverse_unfair`／`slump_visit`／`bad_vibes`等の本筋候補も、固定夜・大会の配置確認なしに訪問続編へ足さない。`after_ch2`／`after_ch2_firstshop`系は章末より後の候補で、本件のDAY2〜13交流へ混ぜない。

既存会話は古い背景参照・名乗り・親密さ・「美味しい」と感じる描写・報酬キューを持つ。第2章のスランプ時期、現在の既知／未面識と整合させる再評価が必要で、ファイル単位の無条件移植は不可。[思い出正本](../../data/relationship_memories.json) にある旧会話対応の記憶も、実際に該当場面を読まずに付与しない。全体の文体・口調添削は#564に残し、本資料では新しい台詞案を執筆しない。

### 続編を実装する場合の保存契約と未決定点

- 既存chat/repeatのID、読了、`flags._ch2_talks`、`state.visits`、`state.met`、`state.seen`、`state.story`、既存の関係・恋人・日付・所持品・思い出を保持する。会話回数のカウンタを別カウンタへ上書き移行しない。
- 既知の名乗り／初日見学は相談の読了と別。旧セーブで `_ch2_talks`が未定義、0、既に複数回の各場合を確認し、未読の新会話を読了扱いにしない。総訪問回数だけでは新しい関係段階を推定しない。
- 現行の訪問費用・体力・通常成長・初回10／再訪5の好感度処理は呼出側。既存候補の`apply`や地の文報酬を足して二重加算しない。あげはの連絡先フラグとcontactsへの登録は初回読了後の現行条件を守る。
- 取消・画像／台本欠落・途中LOAD・同日再訪・別の訪問順・昼夜・固定夜の前後を検証する。台本を最後まで読んだ後だけ段階を確定し、再読込で報酬や思い出を重複させない。
- 未決定: 各人の続編本数、既存台本を改稿するか小場面を新設するか、章内日／時間帯／必要読了、友情・恋愛の分岐点、思い出とLIMEの追加範囲。採否を決めるまでは新ID・フラグ・セーブschemaを予約しない。

## 依存・担当境界と次の判断

| 対象 | 現在の関係 | 次工程の開始条件 |
| --- | --- | --- |
| #548 / PR #562 | マージ済み。DAY14・章末は既存として参照 | 競技・離別場面・再挑戦の変更を含めない |
| #564 | Claude担当の全体添削。未着手の予定を実施済みにしない | 会話候補の採否後に対象IDを共有。並行する同じ台本の編集を避ける |
| PR #550 / #549 | ストーリー改稿・王冠構図はDraftの別案 | 新しい筋やモチーフを本資料で正史化しない。現在の正本を基準に再照合 |
| PR #539 | OVA画風の比較候補 | 神崎／REIの表情や店内背景への画風採用とは別判断 |
| PR #558 / #437 | ハンドル等の外観カタログ準備。design_only、runtime未導入 | 営業中の固定標準器具として組み込んだ扱いにしない |
| Open PR #566 / #557 / #481 | 回帰fixture／事前チェック／街歩きの別作業 | 取得時の全6Open PRの実変更パスにこの資料との重複なし。未push作業は見えないため、再開時も確認する |

判断順の提案: (1) 夜の店内で必要な場面・営業状態を店ごとに選ぶ → (2) 本人normalを維持した神崎／REIの必要表情を選ぶ → (3) 各人一段階分の続編について既存台本の再利用可否・開示順・保存条件を選ぶ。いずれも未承認の案であり、この順序での自動実装・画像生成は依頼していない。

## 作業・検証記録

WORKER: `codex-563-20261015-01a13c35` / ISSUE: #563 / BRANCH: `codex/563-ch2-inventory`。
[claim 38697952277](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38697952277) と [status 38698135764](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38698135764) はmain上のcompleted/success。実jobログのCLAIMED_ISSUE／CLAIM_VALIDATED_ISSUE、owner、RUNと [最新bot台帳](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6186741993) の一致を編集前に読み取り確認。予約の再発行・移管・解除はしていない。

基準mainでの事前検査: `lint_dialogue.py` ERROR 0 / 既存WARN 328、`check_legacy_terms.py` ERRORなし・既存WARN 1、`check_char_consistency.py` OK。`check_speakers.py`は終了1（4ファイルのsamechan未登録）。現行ローダはsamechanのprofileを別JSONから追加するため、単独検査の結果とruntime登録は区別する。この失敗を今回修正した／全検査成功とは扱わない。

この資料はコード・台本・素材を変更しないため、今回のブラウザ通し・昼夜画像目視QA・実機Safari・公開版QAは未実施。過去QAの成功を新しい素材・続編の成功へ流用しない。文書チェック・リンク・参照現物の確認結果と最終head、Draft PR、残作業はPR／Issue引き継ぎへ記す。マージ・公開・Issue終了・予約解除は行わない。
