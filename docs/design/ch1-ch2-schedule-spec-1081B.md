# 第1章〜第2章 日程・バイト・解放 仕様書（#1081 B01〜B08）

- Issue: #1081 B節（第1章の日程・バイト・スポット解放を一括再設計）。進め方「2. Bで日程表・勤務夜・配達・贈呈・規則・大会前夜を一枚にして合意できる仕様へ。C/D/J05/J07へつなぐ」に対応する設計資料。
- 作成: 2026-10-28 / 担当: 構成・UI設計（Claude Opus）
- 位置づけ: **本書は設計のみ**。コード・台詞JSONは変更しない。日程の組み替え・救済金額・贈与/貸与・解放日などオーナー未決の論点を確定させず、現行挙動（ファイル:行）と提案・影響範囲・要判断を一枚に並べ、実装PR（Sol/high 等）の着手資料とする。
- 前提にする既存成果（本書では再設計しない）:
  - **B09**（買物チュートリアルでレモンを一覧上部へ）は実装済み。`remake/js/daily/shop.js:312` の `if (firstErrand) items.sort(...)` で、頼まれた葉（初回おつかい時）を先頭へ並べ替える。
  - **B10**（買物先の小アイコンと「仕入れご苦労さん」等の削除）は実装済みとして扱う。
  - **C01/C02/C05・D04〜D08・J05・J07** は PR 済み（main と未マージ #1119）。本書は日程面で接続だけ確認する。#1119 は第2章の日送りを第1章と同じ「帰宅→就寝→翌朝」に統一（J07）。
- 関連資料: 必須制作の棚卸しと置換設計は [docs/reports/naru_battle_1089_design_20261027.md](../reports/naru_battle_1089_design_20261027.md)（#1089）。工程・調整は #1081 E節。家シーシャ・贈呈・体力は #1081 D節。

---

## 0. 結論（先に要点）

- **B の核心は「DAY2 の再設計」**。現行の DAY2 は〈朝の一括受注 → C.STATION 無料登録（規則提示）→ 昼：みんと配達 → 夜：アダム配達 → tonari へ報告 → 夜イベント（常連さん）→ 帰宅前にスミさんが卓上台を譲る〉で、**バイト（シフト）が入らず、配達が昼・夜の2枠を占有**している（`remake/js/daily/calendar.js:84-126`、`:300-412`）。
- B01 の希望〈C.STATION エントリー → tonari でバイト → 帰りにみんと/アダム配達 → 戻ってスミさんから「いいものやる」〉を成立させるには、**配達を「行動枠を消費する独立訪問」から「バイト上がりの帰路にまとめて回る無料ステップ」へ寄せる**のが中心判断（→ §3 B01、要オーナー判断）。1日は昼（slot0）・夜（slot1）の2行動 + 夜の固定イベントで構成される（`calendar.js:113-125`、`openMenu` の `state.slot >= 1 ? "夜" : "昼"` = `calendar.js:226`）。
- **勤務夜（B03）**: 現行はバイトが「昼でも夜でも選べる自由行動」で、夜に自由行動したあと更にバイト先へ行ける導線がある。勤務日を特定して「その日はバイト固定・夜に別予定を入れない」に寄せる。全日一律の夜固定にはしない（→ §3 B03）。
- **tonari のメニュー（B04/B05）**: 独立の「まかないで練習」を廃し「シフトに入る」に統合、まかないはシフト中限定（`remake/js/daily/tonari.js:38-46`）。シフト上がりの「スミさんと話す」は選択式をやめ必ず流す（`tonari.js:212-235`）。
- **斧投げの解放（B06）**: 現行、路上占い（`fortune`）と斧投げ（ひより `axe_reveal`）は別経路だが体感で前後して解放される。斧投げの解放を **バイト終わりのスミさん会話（B05 で必ず流れる会話）起点**にし、占いの解放（つむぎの噂・雨繰越）は温存する（→ §3 B06）。
- **規則提示（B07）**: 現行は DAY2 登録時に一度（`calendar.js:306-308`）＋大会当日に口頭 recap（`remake/js/chapters/ch1.js:494-500`）＋MENU 常設（`calendar.js:244`）。エントリー時の1回提示を正とし、重複説明を減らす。
- **大会前夜の買い足し（B08）**: 現行、必須フレーバー（レモン）不足の救済は **大会当日の朝**（`ch1.js:473-476`）。これを **前日夜（DAY13）に「買い足しに行こう」案内**へ前倒しし、金欠時はスミさんの救済へ。当日朝は最終セーフティネットとして残す（→ §3 B08）。
- **最大の要オーナー判断**: (1) DAY2 で配達を無料ステップ化してよいか（行動枠と報酬 `DELIVERY_PAY` の扱い）、(2) 勤務固定にする具体的な日、(3) B08 救済の金額・贈与か貸与か・代償、(4) 斧投げ解放を「スミ会話で露出」だけにするか「ひよりルートの前提短縮」まで行うか。→ §5。

---

## 1. 現行の第1章 日程表（DAY1〜DAY14・一枚）

`remake/js/chapters/ch1.js` の `NIGHT_EVENTS`（`:267-290`）と `remake/js/daily/calendar.js` の `runDaily`（`:53-126`）を上から追った、現在の公開挙動。1日 = 朝（DAYカード・LIME 通知）→ 昼 slot0 → 夜 slot1 → 夜の固定イベント → 帰宅 → 翌朝。TOURNAMENT_DAY = 14（`remake/js/core/rules.js:2`）。

| DAY | 朝 | 昼（slot0） | 夜（slot1） | 夜の固定イベント | 勤務・配達・贈呈・規則（根拠） |
|---|---|---|---|---|---|
| 1 | 開幕（コールドオープン→章タイトル→tonari開店→つむぎ取材・連絡先交換、一台チュートリアル） | おつかい①：Dr.fookah でレモン仕入れ（経費・贈られる） | おつかい②：KEMURIKUSA 偵察（なる、行動1回＋交通費）→ 退勤帰宅 | なし | `day1Errands`（`calendar.js:259-298`）。`remake_lemon_gift` でレモン支給。偵察後 `slot=2` で終了 |
| 2 | DAYカード・LIME。tonari で2軒分の配達を一括受注（`briefDeliveryBatch`） | みんと配達（PEPPERMINT、`remake_delivery_minto`） | アダム配達（EDEN、`remake_delivery_eden`）→ tonari へ報告 | 常連さんの話（`ch1_salaryman_regular`、schedule=regular） | 無料の大会登録＋**規則提示**（`registerTournament` `:300-312`／`_ch1_rules_read`）。配達手当 `DELIVERY_PAY=2000`（`:328`）。帰宅前に**スミさんが卓上台＋ダブルアップル50g を譲る**（`giveEarlyHomeRig`＝`ch1.js:202`→`home-rig.js:giveSumiRig`、`RIG_SCENE="ch1_sumi_home_rig"`） |
| 3 | DAYカード・LIME | 自由行動 | 自由行動 | 基礎の確認（`_ev_first_practice`、`earlyPractice`、deadline6） | つむぎの途中の絵→通し練習（調整なし、`runFullPractice{adjustments:false}`、`ch1.js:364`） |
| 4 | 〃 | 自由行動 | 自由行動 | なし | バイト上がりに `ch1_ageha_encounter`（`tonari.js:132-138`）。アゲハ初遭遇は day≥4 |
| 5 | 〃 | 自由行動 | 自由行動 | スミさんの話（`ch1_day5_sumi_story`、regular） | — |
| 6 | 〃 | 自由行動 | 自由行動 | なし | 覆面客（上園）cameo はバイト n≥4・day≥6（`tonari.js:103-107`） |
| 7 | 〃 | 自由行動 | 自由行動 | 中間準備（`_ev_midcheck`、`midPreparation`、deadline12） | intro→**レモン仕入れ**（`prepareFlavorStock` `ch1.js:392`）→調整練習→講評→**スミさんが卓上台を譲る**（未受領セーブのフォールバック `giveSumiRig` `ch1.js:411`） |
| 8 | 〃 | 自由行動 | 自由行動 | なし | — |
| 9 | 〃 | 自由行動 | 自由行動 | 出場者説明会（`_ev_meet_rivals`、C.STATION） | `ch1_meet_rivals`。ライバル全員の**正式紹介**（面識の確定点） |
| 10 | 〃 | 自由行動 | 自由行動 | 常連さんの変化（`_ev_salaryman_change`、prereq `_ev_salaryman`） | DAY2 の常連さんの続き |
| 11 | 〃 | 自由行動 | 自由行動 | つむぎの応募（`_ev_tsumugi_sketch`） | — |
| 12 | 〃 | 自由行動 | 自由行動 | なし | — |
| 13 | 〃 | 自由行動 | 自由行動 | 大会前夜（`_ev_rehearsal`、`lastNight`） | つむぎの絵→過ごし方の選択（`ch1_day7_last_night`）。practice=本番通し＋2調整リハ（`rehearsal` `ch1.js:415`、冒頭で `prepareFlavorStock`）／drill／sleep_early（全回復） |
| 14 | DAYカード・応援LIME | 大会本番（4ラウンド：組み立て→提供→調整×2） | — | — | **規則 recap**（`ch1_tournament_rule_recap` `ch1.js:494-500`）。レモン<12なら**当日朝の救済**（`remake_flavor_rescue`＋`addFlavorStock` `ch1.js:473-476`）。優勝賞金 `PRIZE=30000` |

補足:
- 「自由行動」は slot0/slot1 の2枠で任意のスポットへ。tonari を選ぶと `tonariMenu`（`tonari.js:25-50`）で「お客さんとして一服／まかないで練習／シフトに入る／（条件付き）ひよりと斧投げ」。
- 夜の固定イベントは `schedule:"regular"`／`"preparation"` が延期可能（休養・約束で後日へ）。`preparation` は `deadline` を過ぎると休養・約束より先に救済実行（`night-events.js:49-66`）。
- バイトのシフト上がりに `afterShiftMenu`（`tonari.js:212-228`）で「スミさんと話す／（条件付き）特訓・授業／まっすぐ上がる」。

---

## 2. 現行の第2章 日程（概要・PR済み前提）

第2章は駅・街移動モデル（`station-travel.js`・`ch2.js`）で、第1章の slot 制とは別UI。本書は B の接続点だけ確認する。

- **配達（J05・C05）**: スミさんから3軒の配達を受注（`remake_ch2_delivery_offer`）→ 各店で「配達」を選ぶと店内へ入り店主と会話（`ch2.js:209-231`、PR済み）。「店内を覗く」は廃止、配達完読で面識・名前表示を確定（C05）。
- **規則提示（B07 の第2章版）**: 会場 C.STATION で一度だけ提示（`ch2.js:218-221`、`_ch2_rules_read`）＋MENU 常設（`ch2.js:375-381`）。第1章と同じ「エントリー/会場確認で1回」の方針で揃っている。
- **日送り（J07、PR #1119）**: 「翌日へ」ボタンを廃し、第1章と同じ帰宅→就寝→翌朝へ統一。`remake/js/daily/calendar.js` と `remake/js/chapters/ch2.js` の差分（#1119）を前提にする。本書の第1章日程変更は #1119 とファイル衝突しうる（`calendar.js`）ため、**実装時は #1119 マージ後の HEAD から分岐**する（→ §4）。

第2章に B01〜B08 相当（勤務夜・まかない統合・斧解放）は直接は無い。斧投げ・路上占いの解放条件は第1章・第2章共通（`spots.js:237-238`、`axe-bar-discovery.js`）なので、B06 の変更は第2章の表示にも波及する。

---

## 3. B01〜B08 個別設計（提案・影響範囲・要オーナー判断）

### B01 DAY2 の流れを「エントリー→バイト→帰りに配達→スミの贈呈」へ

- **現行**: §1 DAY2 の通り。配達が昼・夜の2枠を占有し、バイトは入らない。登録は無料・枠を使わない（`calendar.js:300-312`）。配達は `dueDelivery`/`deliver`（`calendar.js:369-412`）で1件ごとに `state.slot++`。帰宅前にスミさんが卓上台を譲る（`giveEarlyHomeRig`）。
- **提案**:
  1. DAY2 朝〜昼: C.STATION で**プライベート**のエントリー（現状どおり無料・枠消費なし）。その流れで規則提示（B07）。
  2. 昼: tonari で**バイト1回**（`doBaito`）。B04/B05 の統合後メニューを使う。
  3. バイト上がりの**帰路**にみんと・アダムへ配達をまとめて回す。配達を「独立の行動枠消費」から「バイト後の無料ステップ」へ寄せ、現行の `briefDeliveryBatch`→`deliver`→`reportDeliveryBatch` を**帰宅フェーズの連続演出**に組み替える。
  4. 帰宅直前にスミさんが「いいものやる」と卓上台を譲る（`ch1_sumi_home_rig`）。会話順を「配達の報告→贈呈」に。
- **影響範囲（変更が要るファイル）**: `remake/js/daily/calendar.js`（DAY2 分岐 `:84-126`・配達群 `:314-412`・`endDay` `:716-783`）、`remake/js/chapters/ch1.js`（`beforeHomecoming`/`dailyPart` `:198-204`）。台詞は `remake_delivery_*`・`remake_delivery_report`・`ch1_sumi_home_rig`（**#1103/#1110 と重なるため編集禁止**→ §4 TODO）。
- **要オーナー判断**:
  - 配達を無料ステップ化した場合、**配達手当 `DELIVERY_PAY=2000`×2** をバイト代に上乗せしたまま維持するか、見直すか。
  - バイト（slot 消費）＋配達2件を1日に収めると枠が足りない。配達を「枠を使わない帰路イベント」にする前提でよいか（本書の推奨）。
  - DAY2 を「勤務固定日」（B03）にするか。本書は **DAY2 を勤務固定の初日にする**案を推奨。

### B02 夜のサラリーマン等の流れを昼へ

- **現行**: DAY2 夜の固定イベントが常連さん（サラリーマン）の話（`NIGHT_EVENTS[2]="ch1_salaryman_regular"`、schedule=regular）。続編が DAY10「常連さんの変化」（`_ev_salaryman_change`、prereq `_ev_salaryman`）。schedule=regular なので延期可能。
- **提案**: この常連さんアークを**昼の tonari 来店（接客・まかない/バイト中の客）側へ寄せる**。ただし「全会社員場面を機械的に昼へ」はしない（Issue 指示）。移動対象は **`ch1_salaryman_regular`／`ch1_salaryman_change` の2件に限定**し、DAY10 の続編が DAY2 の初回を前提にする因果（prereq）を保ったまま時間帯だけ移す。
- **影響範囲**: `remake/js/chapters/ch1.js`（`NIGHT_EVENTS[2]`・`[10]` `:268,:277`）、昼側の接客フック（`remake/js/daily/tonari.js` の `customerEvent`/`baito` 経路、または新規の昼イベント枠）。`data/dialogue/ch1_incognito.json`・常連系台詞は **Copilot 並行作業範囲（編集禁止）**→ §4。
- **要オーナー判断**: 常連さんを「バイト中の接客」に混ぜるか、「昼に tonari 来店したとき」の固定会話にするか。DAY2 をバイト固定にするなら、バイト中の接客として自然に出せる（B01 と相乗）。

### B03 勤務夜の導線を整理（夜の自由行動後に更にバイトへ行かせない）

- **現行**: バイト（`sub==="baito"`）は tonari を選んだ自由行動として slot0 でも slot1 でも実行できる（`calendar.js:528-551`）。夜（slot1）に別スポットで自由行動したあと、まだ枠が残れば tonari のバイトへ行ける導線がある。`fixedNightVisitBlock`（`night-events.js:69-86`）は固定イベントの tonari 回だけをブロックし、通常のバイト自体は制限しない。
- **提案**: **特定の勤務日**（B01 の DAY2、必要なら DAY4/DAY6 など覆面客 cameo の仕込み日）を「勤務固定日」とし、その日は最初からバイトに入る動線（夜に別予定を差し込めない）。全日一律の夜固定にはしない。勤務固定日は `fixedNightVisitBlock` と同様の仕組みで「この日は夜に別の予定を入れられない」を表現する。
- **影響範囲**: `remake/js/daily/calendar.js`（`takeAction`/`performSpotAction` `:427-604`）、`remake/js/daily/night-events.js`（固定/勤務の判定 `:69-92`）。
- **要オーナー判断**: 勤務固定にする具体的な日（DAY2 のみか、cameo 仕込み日も含むか）。固定日は「夜に別予定不可」をどの強さで示すか（選べないのか、警告止まりか）。

### B04 「まかないで練習」を廃し「シフトに入る」に統合

- **現行**: `tonariMenu`（`tonari.js:38-46`）に「まかないで練習」（`practice`）と「シフトに入る（バイト）」（`baito`）が独立。practice は `performSpotAction` 内で `runFullPractice{staffPractice:true}`＋熟練度育成＋体力消費（`calendar.js:545-550`）。baito は `doBaito`（`tonari.js:78-129`）。それぞれ別に行動枠・体力・材料・報酬を消費/付与する。
- **提案**: メニューから独立「まかないで練習」を**削除**し、**まかない練習はシフト中の一工程**として `baitoShift`（`tonari.js:82-129`）の中に組み込む。旧 practice の行動コスト・体力・材料・報酬を**二重に消費/付与しない**（シフトの消費に一本化）。
- **影響範囲**: `remake/js/daily/tonari.js`（`tonariMenu` `:25-50`、`baitoShift` `:82-129`）、`remake/js/daily/calendar.js`（`performSpotAction` の `sub==="practice"` 分岐 `:545-550`）。熟練度育成の文言は `remake_staff_practice`。
- **要オーナー判断**: まかない練習をシフトの**必須工程**にするか、シフト中の任意選択にするか。熟練度の付与量（現行 practice は専用の育成）をシフトに移したときの倍率。

### B05 シフト上がりの「スミさんと話す」を必ず流れる会話へ

- **現行**: `afterShiftMenu`（`tonari.js:212-228`）が「スミさんと話す／（条件付き）特訓・授業／まっすぐ上がる」の選択式。「まっすぐ上がる」でスミ会話を飛ばせる。スミ会話は `visitChar("sumi")`（固有会話 or 「落ち着いた一台を分けてもらう」）。
- **提案**: シフト上がりは**スミさんとの会話を必ず1回流す**（選択式をやめる）。特訓・授業（`canStudyAttack`/`canStudyCubeCoals`）は会話の後に任意で続けられる形へ。旧・任意会話を**二重再生しない**（既に当日読んだ会話を再生しない既読管理）。
- **影響範囲**: `remake/js/daily/tonari.js`（`afterShiftMenu` `:212-228`、`afterShift` `:230-235`）。
- **要オーナー判断**: 必ず流す会話は「`visitChar("sumi")` の固有会話がある日はそれ、無ければ定型の一言」で足りるか。B06 の斧投げ解放台詞をこの会話に接ぐ前提（→ B06）。

### B06 路上占いと斧投げの解放を分離（斧はシフト上がりのスミ会話から）

- **現行の2経路**（別々だが体感で前後して解放される）:
  - **路上占い（`fortune`）**: `isUnlocked`（`spots.js:237`）= 第1〜2章 ∧ `fortuneRumorHeard`（つむぎの噂 `hearFortuneRumor` を客席で完読、`tonari.js:66`・`fortune-rumor.js`）∧ `fortuneOpenOn`（週2日・雨なら晴れへ繰越、`fortune-schedule.js:13-18`）。
  - **斧投げ（ひより `axe_reveal`）**: tonari メニューの「ひよりと斧投げへ」（`tonari.js:43`）は `hiyoriAxeReady()`＝`hiyoriEventStatus("axe_reveal")==="ready"`（`hiyori-route.js:24-41`）。`axe_reveal` の前提は長い連鎖 `meeting→sumi_message→relay→cracks→tonari_return→tonari_followup→tonari_afterwork→axe_reveal`（`data/dialogue/hiyori.json:86-91`、minAffinity3・slot1・cost3000）。別に「斧バー」スポット（`axe_bar`）は `axeBarDiscovered`（噂完読、`core/axe-bar-discovery.js`）で解放。
- **提案**: 斧投げの**露出起点をバイト終わりのスミさん会話（B05 で必ず流れる会話）**に移す。具体的には、シフト上がりのスミ会話の中で「斧投げに誘われた／場所を教わった」ことを示す解放フラグ（例 `_axe_throw_unlocked`）を立て、tonari メニューの「ひよりと斧投げへ」はこのフラグ＋既存のひより前提で出す。**路上占い側（つむぎの噂・雨繰越）は一切変更しない**（Issue 明記）。これにより「占いと斧が同じ瞬間に一緒に出る」体感を解消する。
- **影響範囲**: `remake/js/daily/tonari.js`（`afterShift`/メニュー `:212-235`・`:38-46`）、`remake/js/daily/hiyori-axe.js`（解放判定 `hiyoriAxeReady`）、`remake/js/core/hiyori-route.js`／`data/dialogue/hiyori.json`（前提の調整をする場合）。**hiyori 系台詞・立ち絵は #1117 等の並行作業と重なる可能性**→ §4 で TODO。
- **要オーナー判断**:
  - 斧投げ解放を「スミ会話で露出フラグを立てるだけ（ひよりルート前提は現状維持）」にするか、「ひよりルートの前提連鎖を短縮して DAY 的に早める」まで行うか。**本書は前者（露出フラグのみ）を推奨**（ひよりの正式ルート・好感度設計を壊さないため）。
  - 解放を接ぐスミ会話の日（初回バイトの上がり＝DAY2 か、好感度条件を満たした最初のシフトか）。

### B07 大会規則の提示タイミングの見直し

- **現行**: (1) DAY2 のエントリー直後に1回（`registerTournament` `calendar.js:306-308`、`_ch1_rules_read`）、(2) 大会当日の壇上で口頭 recap（`ch1_tournament_rule_recap` `ch1.js:494-500`）、(3) MENU「大会の規則」で常設閲覧（`calendar.js:244`→`rule-sheet.js:29`）。規則本文は `ruleSheetPanel`（課題・材料・一台の進行）。
- **提案**: **エントリー時の1回提示を正**とし、以降は MENU 常設で参照。大会当日の壇上 recap は「情報の初出」ではなく**演出上の確認**に留め、重複説明を減らす（課題フレーバーと材料の持込/支給だけ短く）。DAY7 の仕入れ（`prepareFlavorStock`）・B08 の前夜案内の前に規則が既読である導線を保証する。
- **影響範囲**: `remake/js/chapters/ch1.js`（`:494-500` の recap 文面）、`remake/js/daily/calendar.js`（`:306-308`）。`remake/js/scenes/rule-sheet.js` は変更不要の見込み。
- **要オーナー判断**: 壇上 recap を残すか・削るか・短縮するか。エントリーを見送った旧セーブ（`registerTournament` が走らない経路）での規則初出をどこで保証するか。

### B08 大会前夜の買い足し案内と金欠救済

- **現行**: 必須フレーバー（第1章＝レモン）不足の救済は**大会当日の朝**（`ch1.js:473-476`）。`flavorStock("lemon")>=12` でなければ `remake_flavor_rescue` を見せ、`addFlavorStock("lemon", 12-現在値)` でスミさんが「一回分」を補填（強制購入はしない）。仕入れ自体は DAY7 中間準備（`prepareFlavorStock` `ch1.js:392`）と DAY13 リハ（`ch1.js:420`）で可能。
- **提案**: **前日夜（DAY13）**に、必須フレーバーが不足していれば「買い足しに行こう」を案内（`prepareFlavorStock` の呼び出しを前夜イベントの早い段階に置く／不足時のみ発火）。**金欠で買えない場合はスミさんに頼る救済**（支給 or 貸与）へ分岐。当日朝の救済（`ch1.js:473-476`）は**最終セーフティネットとして残す**（前夜に休養・中断した救済漏れを拾う）。買物不能・時間切れで本番に入れない状態を作らない。
- **影響範囲**: `remake/js/chapters/ch1.js`（`lastNight`/`rehearsal` `:292-441`、当日朝救済 `:473-476`）、`remake/js/daily/preparation.js`（`prepareFlavorStock` `:12-43`）。台詞 `remake_flavor_rescue`・前夜案内の新規文面。
- **要オーナー判断**:
  - 救済の**金額**（何箱分＝何g・何円相当か。現行は不足分を 12g まで補填）。
  - **贈与か貸与か**（貸与なら返済の仕組み／代償の有無）。
  - 前夜に案内しても買わなかった（金はあるが見送った）場合、当日朝救済を発火させるか・させないか。

---

## 4. 横断の状態設計・検証計画・衝突回避

### 状態（フラグ・SAVE境界）の方針
- 日程の組み替えでも、既存の確定境界を流用し**時間・報酬の二重計上を作らない**。配達は `_delivery_<char>_done`／`_delivery_report_done`（`calendar.js:330-412`）、登録は `_c_station_registered`／`_ch1_rules_read`、贈呈は `_sumi_double_apple_received`・`owned` の `home_rig_set`（`home-rig.js`）、前夜は `_ev_last_night`／`_ch1_eve`、救済は `_prep_lemon_expensed`／当日 `addFlavorStock`。
- 新フラグは最小限に（例 B06 の `_axe_throw_unlocked`、B03 の勤務固定日判定）。`doneKeys`/`prerequisites`（`night-events.js`）の既存仕組みに乗せ、延期・休養・LOAD後も必須会話が落ちない／二重再生しないことを保つ。
- **D02 との整合（要注意）**: 現行の DAY2 贈呈 `giveSumiRig` は卓上台に加え**ダブルアップル50g を支給**する（`home-rig.js:38-44`）。D02 は「ダブルアップル50g はスミさんからもらわない」。B01 で DAY2 の贈呈演出を触る実装PRは、**D02 の担当PRと贈与内容の整合を取る**（本書の範囲外・要連携）。

### 検証計画（実装PR側で行う。本書は Markdown のみでテスト不要）
- 勤務前後／夜予定／配達前後／大会前夜で実 SAVE・LOAD、途中中断、所持金不足、初訪問済みを検証（Issue 受入条件）。
- 関連ブラウザテスト候補（登録は実装PRが `tools/ci/suites.json` へ。**本書では登録しない**）: 既存 `remake/test/browser/` の第1章日常・配達・大会前夜系。限定実行はラッパー経由（`/home/box/repos/logs/browser-sem.sh` + `serve_preview.py --port 8199`）。
- Node 限定テスト: 配達・前夜・救済の状態遷移を対象にした `remake/test/*.mjs`（実装時に特定）。

### 衝突回避（2026-10-28 時点、本書作成者が守ったこと）
- 本書は **`docs/design/ch1-ch2-schedule-spec-1081B.md` の新規1本のみ**。コード・台詞・`tools/ci/suites.json` は変更していない。
- 実装PRは **#1119（`calendar.js`・`ch2.js`）マージ後の最新 HEAD から分岐**する（J07 と `calendar.js` が重なるため）。
- B01/B02/B05/B06 の実装は、以下の並行作業・未マージPRとファイルが重なるので、**それらのマージ後に着手**するか、担当と調整する:
  - `remake/js/chapters/ch1.js`（#1110）、`remake/js/daily/home-shisha.js`（#1116）、`remake/js/daily/home-rig.js`・`pull.js`・`craft.css`（Codex C）、`remake/js/daily/phone.js`（#1120）、`data/dialogue/ch1_naru.json`・`ch1_minto.json`（#1117）・`ch1_adam.json`（#1103）、`data/dialogue/ch1_incognito.json`・`ch1_interval.json`（Copilot）。

---

## 5. オーナーに決めてもらう点（まとめ）

1. **DAY2 の配達**: バイト上がりの「帰路の無料ステップ」に寄せてよいか。`DELIVERY_PAY` の扱い（維持/見直し）。
2. **勤務固定日**: DAY2 のみか、cameo 仕込み日（DAY4/DAY6 など）も含むか。固定の強さ（選べない/警告）。
3. **まかない練習（B04）**: シフトの必須工程か任意工程か。熟練度付与量。
4. **斧投げ解放（B06）**: スミ会話で露出フラグのみ（推奨）か、ひよりルート前提の短縮まで行うか。解放を接ぐシフトの日。
5. **大会前夜救済（B08）**: 金額（何g/何円）・贈与か貸与か・代償。前夜に見送った場合の当日朝救済の発火可否。
6. **規則提示（B07）**: 壇上 recap を残す/短縮/削除。エントリー見送り時の規則初出保証。
7. **常連さんアーク（B02）**: 昼のバイト接客に混ぜるか、昼来店の固定会話にするか。
8. **D02 整合**: DAY2 贈呈からダブルアップル50g を外す実装はどのPR（B01 か D02）で行うか。
