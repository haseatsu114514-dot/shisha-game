# Issue #1071 別モジュール照合

2026-10-28、Codex C。対象HEADは `ed8098a9b0469f508fcca61964a00eebc567f918`（開始時の `origin/main` と一致）、作業branchは `codex/c-1071-20261028`。以下の行番号はこのHEADの実ファイルで確認した。未マージPRの内容は判定へ混ぜていない。

対象は `daily/spots.js`、`daily/tonari.js`、`daily/bonds.js`、`vn/engine.js`、`core/data.js` と、その接続確認に必要な第1章台本・閾値・機材・友人データ。**変更は本READMEだけ。コード・データ・素材の変更、採用判断は行っていない。**

## 判断の前提

- [#1071 本文](https://github.com/haseatsu114514-dot/shisha-game/issues/1071)の5節の「こちらで避けたいこと」と、存在する「確認方法」（第1・2節）を読んだ。第3〜5節には独立した「確認方法」欄がないため、本文と末尾の具体策を照合条件にした。
- [ミューズ／agyの前回結果](https://github.com/haseatsu114514-dot/shisha-game/issues/1071#issuecomment-6455929527)は、`ch1.js` の確認と別モジュールの未確認を区別している。司令塔保管の全文レポートは今回参照しておらず、公開コメントと今回の実物確認を根拠にする。前回の「概ね満たしている」を章全体の検証済みとは扱わない。
- **SKIPの判定基準には後のオーナー決定を反映する。** [#1077の決定コメント](https://github.com/haseatsu114514-dot/shisha-game/issues/1077#issuecomment-6436323306)は「未読で停止するスキップ機能は不要。2周目からの解禁も行わず、初回から現在の全送りスキップを維持する」。#1071本文末尾の既読専用SKIP案より、この明示的な判断を優先する。
- 判定は指定範囲の実装・本文に対するもの。静的確認と、UIなどを代替したNode検査を、初見プレイヤー評価・実ブラウザ操作・通しプレイの証明へ広げない。競合レビューの再調査は行わず、不満の頻度や現行製品の欠陥を追加で断定しない。

## 5節の判定表

| 節／照合する条件 | 判定 | 確認できた根拠と限界 |
| --- | --- | --- |
| 1. 関係が育つ過程：ハート閾値、最古未読順、短い日常、仕事・創作との区別 | **一部** | `storyHeartReady()`、`visitChar()` に閾値と順序が実在。スミの修業は閾値対象外で、つむぎの締めくくりには応募の前提もある。短会話と個人的な質問の本文も存在する。ただし「信頼した根拠を初見の人が思い出せるか」は聞き取り未実施のため**判断不可**。詳細は第1節。 |
| 2. 配合が形だけにならない：通常バイトの同じ注文で二択に違う反応を返す | **満たしている（通常バイトの対象条件）** | `SHIFT_ORDERS` の4注文×2反応、`serveShiftOrder()` の選択indexによる呼出し、8本の本文を確認。8経路の制御検査も成功。#1071記載時の「提供描写が共通」から既に変わっている。初回提供・大会全体の再検証は今回の対象外。詳細は第2節。 |
| 3. 人物同士のつながり：グループ交流を保ち、同席者の判断を応答として見せる | **一部** | 常連同士・店員と客の交流は通常訪問列に接続。DAY9も三人の異なる目的を描くが、現行本文では方針が順に並び、三人相互の応答は不足している。該当箇所を扱う未マージPR #1169 と接続する。詳細は第3節。 |
| 4. 閲覧・操作：クリック可能なAUTO/SKIP/LOG、会話中設定、既存の停止境界 | **満たしている（対象UIと現採用方針）** | `buildDom()`、`kickAuto()`、`advance()`、`openLog()`、`openSettings()` が実在。選択肢・読込待ち・LOG／設定表示中の送りを制限する。全送りSKIPはオーナー採用どおり。端末別の使いやすさと制作時計・CONTINUE全体は**判断不可／今回未検証**。詳細は第4節。 |
| 5. 友情を恋愛の劣化報酬にしない：同じ贈り物・締めくくり・その後の交流 | **満たしている（第1章の対象6人）** | `BOND_FINALES`、`playFinale()`、`grantGift()` はルートで贈り物を減らさず、`settledFriend()`、`friendMessages()`、`playFriendHangout()` が継続交流を持つ。つむぎの友情本文でも絵・包み・次の来店が残る。他章の全結末や治療ルートは今回の判定に含めない。詳細は第5節。 |

## 1. ハート・最古未読・日常の過程

**実装面は満たしている。** 根拠は次のとおり。

- [stats.js:135–164](../../../remake/js/core/stats.js#L135-L164) の `AFFINITY_RANK_PTS` は `[0, 9, 20, 33, 48, 66]`。`affinityLevel()` はこの実ポイントで段階を求める（恋人は♥5）。[spots.js:123–143](../../../remake/js/daily/spots.js#L123-L143) の `storyHeartReady()` は通常列のindexを閾値へ対応させる。初対面index 0は0点、index 1〜5は♥1〜5。スミと恋人は通常列のハート制限から除外する。
- [affinity-stages.js:2–9](../../../remake/js/core/affinity-stages.js#L2-L9) の `VISIT_SEQ` に実在する固定順序を、[spots.js:291–330](../../../remake/js/daily/spots.js#L291-L330) の `visitChar()` が `state.story[charId]` の位置から1本選ぶ。ハート不足なら後の固有会話へ飛ばず、`repeatVisitDialogue()` の日常へ移る。♥MAXでも残った通常列を一括消化しない。
- 通常列以外には、施設の話の続き、みんとの正体判明、途中質問などの優先処理がある。したがって「訪問内の全会話が必ず1本」は不正確。**最古未読の通常段階会話は1訪問1本**で、その前後に別目的の短い会話・質問が入り得る。[spots.js:300–337](../../../remake/js/daily/spots.js#L300-L337)。
- 読了更新は `read()` の結果と同じstateの確認後。[spots.js:282–286](../../../remake/js/daily/spots.js#L282-L286)、同314–320行。好感度の数値だけでは `state.story` を進めない。`storySeen()`（同111–116行）は保存済み通常列の消化数を読む関数で、本文・ページ単位の閲覧履歴ではない。
- [spots.js:156–162](../../../remake/js/daily/spots.js#L156-L162) の `repeatVisitDialogue()` は訪問回数で短会話を回し、条件が合うと雨差分を選ぶ。本文例は [remake_ch1.json:45–78](../../../data/dialogue/remake_ch1.json#L45-L78) のスミと食事、[220–253](../../../data/dialogue/remake_ch1.json#L220-L253) のつむぎが襟の折れを教える場面。短い日常を新設する必要はない。
- [bonds.js:199–221](../../../remake/js/daily/bonds.js#L199-L221) の `storiesDone()`／`finaleDue()` は固有会話・質問の完了と♥5を別々に確認し、つむぎには第1章DAY11の応募完了を要求する（DAY12以降は旧保存向けフォールバック）。応募したことを恋愛選択や好感度そのものから推測しない。
- 個人的な関心を問う本文も実在する。[ch1_bonds.json:33–96](../../../data/dialogue/ch1_bonds.json#L33-L96) は「絵がなくても会いたい／描けない日も休んでよい」の実回答と反応を分ける。一方、[ch1_tsumugi.json:1833–1927](../../../data/dialogue/ch1_tsumugi.json#L1833-L1927) の下描きへの回答と制作の継続は、創作の過程を描く別の場面である。

**未確認と提案：** この構造が信頼の積み重ねとして伝わるかは、コードだけでは決められない。#1071第1節の確認方法どおり、初見の人に「何を覚えていて、なぜ踏み込んだと思ったか」を聞く。結果が弱い場合だけ #1074／#1076 の既存場面・実回答の回収へ戻す。日数・閾値・人数の一律変更、スミの修業の恋愛条件化は提案しない。

## 2. 通常バイト：4注文×2配合

[tonari.js:252–276](../../../remake/js/daily/tonari.js#L252-L276) の `SHIFT_ORDERS`／`serveShiftOrder()` を確認。`baitoShift()` は同111行でこの関数を呼ぶ。選ばれたindexは対応する `reactions[index]` の台本IDへ渡る。**味を物理計算して文を生成する仕組みではなく、既存の固定配合と反応の対応表**である。

| 注文ID | 選択された配合 | 台本IDと本文の開始行 | 確認できる違い |
| --- | --- | --- | --- |
| `citrus` | レモン9g＋ミント3g | `shift_flavor_citrus_lemon_mint`、[remake_ch1.json:1729](../../../data/dialogue/remake_ch1.json#L1729) | レモンと涼しい後味 |
| 同上 | オレンジ9g＋レモン3g | `shift_flavor_citrus_orange_lemon`、[1752](../../../data/dialogue/remake_ch1.json#L1752) | オレンジの香りと酸味 |
| `fruit_mint_free` | ブルーベリー9g＋ピーチ3g | `shift_flavor_fruit_blueberry_peach`、[1775](../../../data/dialogue/remake_ch1.json#L1775) | 桃の香りとミントなし |
| 同上 | グレープ8g＋オレンジ4g | `shift_flavor_fruit_grape_orange`、[1798](../../../data/dialogue/remake_ch1.json#L1798) | ぶどうとオレンジ |
| `sweet_round` | バニラ8g＋ココナッツ4g | `shift_flavor_sweet_vanilla_coconut`、[1821](../../../data/dialogue/remake_ch1.json#L1821) | バニラとココナッツ |
| 同上 | ピーチ8g＋バニラ4g | `shift_flavor_sweet_peach_vanilla`、[1844](../../../data/dialogue/remake_ch1.json#L1844) | 桃と菓子のような香り |
| `double_apple` | ダブルアップル10g＋ミント2g | `shift_flavor_double_apple_mint`、[1867](../../../data/dialogue/remake_ch1.json#L1867) | アニスと少しの清涼感 |
| 同上 | ダブルアップル12g | `shift_flavor_double_apple_solo`、[1890](../../../data/dialogue/remake_ch1.json#L1890) | アニスの香り。ミントを使ったとは言わない |

8本とも提供の地の文は共通だが、客の一言は左右で異なり、続けて短い動作がある。成立する二択の片方を失敗扱いにする分岐や恋愛値・追加罰は、この関数と8台本にはない。私物の葉や熟練度を増減する呼出しもない。給料・能力成長は既存の `baitoShift()`（[tonari.js:112–128](../../../remake/js/daily/tonari.js#L112-L128)）側にあり、反応の選択では変わらない。

`_shift_order_<章>:<日>` は反応再生後に立つ。同日再呼出しは早期returnし、取消・キャンセル結果・state切替では完了を書かない。ただし、給与・行動の確定、保存、シフト全体の中断復帰は `calendar` 等も含むため、ここだけで二重給与防止まで検証済みとは言えない。

**提案：** [#1073](https://github.com/haseatsu114514-dot/shisha-game/issues/1073) はCLOSEDで、今回のHEADでも8反応が接続済み。反応追加を重複実装しない。注文文「清涼感は少しだけ」に単体も含むことは、プレイヤーによっては分かりにくい可能性がある（**推測、要望違反の確定ではない**）。必要なら #1073 の元案どおり、少量／なしの両方が成立する注文文にする案を採用者へ渡す。編集中の #1171（`tonari.js`／`remake_ch1.json`）と調整し、今回は編集しない。[#1072](https://github.com/haseatsu114514-dot/shisha-game/issues/1072) の大会本文は前回照合の領域で、今回のバイト結果だけを理由に完了扱いへ変更しない。

## 3. グループ交流と、三人それぞれの目的

**既存の街の交流は満たしている／DAY9の相互の応答は満たしていない。**

- [affinity-stages.js:5–7](../../../remake/js/core/affinity-stages.js#L5-L7) は、なるの `ch1_naru_group_regulars`、アダムの `ch1_adam_group_soutoku`、みんとの `ch1_minto_group_regulars` を通常列へ含む。`visitChar()` から順に読める対象であり、データローダにあるだけの未接続原稿ではない。
- 本文は [ch1_naru.json:1293–1383](../../../data/dialogue/ch1_naru.json#L1293-L1383) の客からの前回ミックスへの質問、[ch1_adam.json:806–897](../../../data/dialogue/ch1_adam.json#L806-L897) の常連ごとの注文と店への理解、[ch1_minto.json:2012–2122](../../../data/dialogue/ch1_minto.json#L2012-L2122) の先客を優先して複数卓へ接客する場面。はじめが来る以前から続く客との関係が描かれている。
- [ch1_main.json:1589–1709](../../../data/dialogue/ch1_main.json#L1589-L1709) の `ch1_meet_rivals` は、なるの後味と試作ノート、アダムのダブルアップルと熱の再試作、みんとの審査員の四台目まで意識した見せ方を描く。全員が同じ助言をする本文ではない。接続は [ch1.js:305](../../../remake/js/chapters/ch1.js#L305) のDAY9 `nightScene("ch1_meet_rivals", ...)` で確認した。
- 一方、この範囲は三人が順に発言した後、なるがはじめへ話しかける構成。三人同士が相手の判断を受けて返す一往復はない。#1071末尾の具体策に照らすと、この部分は未充足である。

**接続先：** #1075手順4を扱う [PR #1169](https://github.com/haseatsu114514-dot/shisha-game/pull/1169) が確認時点でOPEN。タイトルも「方針の羅列を、同じ課題への相互のやり取りへ」。本報告はそのPRの本文差分や採用後の効果を検証したものではない。担当側でマージ後の三人の応答と各人の目的を確認する。別の改稿・施設・キャラを今回追加しない。

## 4. AUTO／SKIP／LOGと会話中設定

| 項目 | 判定 | 実在する関数・行番号と挙動 |
| --- | --- | --- |
| 画面上のボタン | 満たしている | [engine.js:61–97](../../../remake/js/vn/engine.js#L61-L97) `buildDom()` がAUTO／SKIP／LOG／用語／設定の `button` を作る。AUTO／SKIPには `aria-pressed` があり、ポインタで操作可能。Controlは追加のSKIP操作。 |
| 通常AUTOと全送り | 満たしている | [engine.js:100–138](../../../remake/js/vn/engine.js#L100-L138) `setAuto()`／`setSkip()` は相互排他、`kickAuto()` はSKIP時25ms。通常の選択肢を自動決定するのはテスト用turboだけ。未読停止は実装されていないが、#1077のオーナー決定どおりであり改修不足ではない。 |
| 準備待ち・選択肢・終了境界 | 満たしている | `kickAuto()` は `ready` と `waitingChoice` を確認。`advance()`（[322–330](../../../remake/js/vn/engine.js#L322-L330)）もガードする。`play()`（同225–231行）は素材待ち後にreadyを立てる。`finish()`（同317行）は通常終端でSKIPを解除し、`dialogueSequence()`（同53–56行）は一続きの処理の終端で解除する。 |
| LOG表示中の自動送り停止 | 満たしている | [engine.js:865–879](../../../remake/js/vn/engine.js#L865-L879) `openLog()` はタイマーを止め、直近120件を表示。`kickAuto()` はLOG表示中に進めず、閉じると再開する。記録配列は表示本文を同643–644行、選択を同858行で追加する。永続既読台帳やページ読了の証明ではない。 |
| タイトルへ戻らず会話中に設定 | 満たしている | [engine.js:892–911](../../../remake/js/vn/engine.js#L892-L911) `openSettings()` が `openConfig()` を直接開き、文字送りのタイマーを停止／復帰する。設定中は `vnModalOpen` でも自動送りを止める。`title.js` から関数をimportすることと、タイトル画面へ遷移することは別。 |
| 端末別の視認性・停止の分かりやすさ、制作中の時計、CONTINUE読書時間 | 判断不可 | 実ブラウザ・タッチ・音声出力は今回未確認。工程の時間管理とCONTINUEは対象5モジュールだけでは証明できず、前回照合を今回のUI確認で上書きしない。 |

**提案：** #1044 A10の「会話中に設定を開く入口」は既にあるので増設不要。繰り返し演出の短縮は未マージPR #1170 の別作業。工程・読書時間は #1044 A05／#355 の局所確認へ接続し、未読停止案 #1077 を再実装しない。初登場やCONTINUEの採用意匠の変更も提案しない。

## 5. 友情と恋愛の贈り物・その後

**第1章の6人について、友情で贈り物が減る処理はない。**

- [bonds.js:31–37](../../../remake/js/daily/bonds.js#L31-L37) の `BOND_FINALES` はスミ／なる／アダム／つむぎ／みんと／凛に各1個のgiftを持つ。スミ・なる・アダムには最後の恋愛質問がなく、友情の締めくくりも成立する。
- [bonds.js:71–104](../../../remake/js/daily/bonds.js#L71-L104) の `recordRomanceChoice()` は実回答を選択肢IDごとに一度記録し、友情の0も保存する。`romanceOpen()`／`romanceChosen()` はその回答と最終質問を参照する。好感度MAXだけで恋愛へ置き換えない。呼出し接続は [ch1.js:70–74](../../../remake/js/chapters/ch1.js#L70-L74) の `setupHooks()` で確認した。
- [bonds.js:229–275](../../../remake/js/daily/bonds.js#L229-L275) の `playFinale()` は本文を完了後、`lover`／`romance`／`friend` を記録し、**どのルートでも同じ `grantGift(def.gift)` を呼ぶ**。恋愛ルートだけの処理は後続の告白予約。`grantGift()` は所持済みなら再付与せず、機材と付属の葉を同じ定義から渡す。
- 機材の実体は [equipment.json:173–311](../../../data/equipment.json#L173-L311)。6人の `suyaki_*` が存在し、スミのカルダモン50g・つむぎのラベンダー50gもルート別ではなく機材の `gift` 定義に付く。
- [ch1_bonds.json:730–973](../../../data/dialogue/ch1_bonds.json#L730-L973) のつむぎの締めくくりは、恋愛／友情の分岐より前に絵と専用ボウルを見せる。友情側も包みを受け取り、翌日もいつもの席で描くと返す。友情で創作を失敗させる本文ではない。共通の `sense: 2` も分岐の後の共通列にある（同846–849行）。
- [bonds.js:312–357](../../../remake/js/daily/bonds.js#L312-L357) の `settledFriend()`／`friendMessages()` は、友情の締めくくりまたは告白で友達を選んだ相手に、連絡先・間隔・未読・予定条件を見て雑談や一服の候補を作る。候補生成は第1章の日常に限定される。`playFriendHangout()`（同365–385行）は会話と能力成長を持つ。本文の実体は [friends.json:3–105](../../../remake/data/friends.json#L3-L105) などにあり、候補生成だけの空実装ではない。phone側の実配送・日程は今回再検証していない。

**限界と提案：** 「未訪問の全人物が将来不幸にならない」「勝敗で治療が変わらない」は、全章の結末・治療処理の確認なしには判断不可。今回の贈り物確認だけで全ルートの幸福を保証しない。指定範囲では友情報酬を直す必要は見つからなかった。大会後に遅れて読む文面の回帰は #1044 A01 と交流の時系列ルールを維持する。なるの既存Node検査では大会前／同章大会後／後続章の分岐と贈り物の一度性を確認した。

## 台詞本文の読み込みを横断確認

[data.js:8](../../../remake/js/core/data.js#L8) の `ROOT = "../"`、同43–56行の `DIALOGUE_FILES`、`loadAll()`（同78–110行の取得、140–143行の登録）を確認した。`data/dialogue/ch1_main.json`、各人の第1章、`ch1_spots`、`remake_ch1`、`ch1_bonds` などの正本を読み、各 `dialogue_id` を `DB.dialogues` に入れる。バイト反応と友情の本文はこの経路で供給される。

`DB.baito` は [data.js:124](../../../remake/js/core/data.js#L124) で `baito_events.json` の使用カテゴリを抽出し、`customerEvent()`（[tonari.js:181–208](../../../remake/js/daily/tonari.js#L181-L208)）が選択結果の本文を動的会話へ変換する。友人の文面は `loadAll()` 内の `friends: "data/friends.json"` と同132行の代入によって `remake/data/friends.json` を読む。台詞がすべてJS内にある、または第1章ファイル名があるだけで全イベントが自動接続される、という理解は誤り。

`getJSON()`（同61–75行）はHTTP・JSON・通信失敗をファイル名つきで返し、本文受信を含む15秒タイムアウトを持つ。これは取得失敗の扱いであり、ゲーム中の読書時間制限ではない。

## 実施した確認と未実施

以下はすべてこのHEADの実ファイルで実行し、終了コード0。テスト・補助スクリプトのファイル追加はしていない。

| 確認方法 | 結果 | 証明する範囲 |
| --- | --- | --- |
| `node --experimental-vm-modules remake/test/affinity_stages.mjs` | **成功、53 PASS** | 本番のstate／stats／spots／bondsなどと代替VNによる閾値、最古未読、取消・欠落・例外・state切替、質問反応の再開など。実ブラウザ・実LOADではない。 |
| `node --experimental-vm-modules remake/test/data_loading.mjs` | **成功** | 本番ローダとローカル実JSONによる42ファイル、最大同時4取得、友情台本・友人データ、HTTP／通信／JSON失敗、応答前／本文受信中のタイムアウト。実ネットワークの遅延測定ではない。 |
| `node --experimental-vm-modules remake/test/naru_chapter_context.mjs` | **成功、5グループ** | 本番 `playFinale()` とVNの条件処理、大会前／大会後／後続章、贈り物一度性、cancel／throw／abort／state切替。実SAVE/LOADではない。 |
| 一時的な `node --input-type=module` のVM照合（標準入力、ファイル保存なし） | **成功、8選択＋境界** | 現行 `tonari.js` 末尾の `SHIFT_ORDERS`／`serveShiftOrder()` をそのまま評価。4注文を引くseedを探索し、modalで左右を返し、playで実台本IDの存在を照合。左右の客の本文が異なること、同日再呼出しの抑止、選択取消・反応cancel・state切替で未完、所持金／体力／私物葉／好感度等の不変を確認。modal・playは代替であり、給与保存や実操作の受入ではない。 |
| `nl -ba`／`rg`／JSON本文確認 | **成功** | 本文中の関数・台本ID・行番号、読み込み元、接続先を照合。コード・第1章データの差分なしも確認。 |

NodeのVM実験機能の警告は出たが検査は成功。失敗・timeout・cancelによる検査中断はなし（上表のcancelは意図した検査入力）。

**未実施：** ブラウザ、サーバ起動、初見聞き取り、実セーブでの中断復帰、全章・全結末、音源の実聴、競合の再プレイ／出典の再調査、進行中PRの実装受入。READMEのみの照合報告のため、全体CI・台詞lintは実行していない。元の「判断不可」のうち各モジュールの所在・処理・代表本文は解消できたが、プレイヤーの受け止め方まで検証済みにはしていない。

次の判断は、#1169採用後のDAY9の応答確認と、第1節の初見確認をオーナー・司令塔が選ぶこと。#1072／#1073の重複実装や、オーナーが不要とした#1077の再導入は不要。
