# ストーリー・好感度イベントの矛盾とフラグ遷移 横断監査（#1061）

- 対象HEAD: `359d80d3a5d0531ffc0505c71f7784bbe0fdd797`（branch `claude/1061-story-audit-20261027`、origin/main 追従）
- 確認範囲: **静的読取（コード・台本JSON）＋限定テスト（`node tools/ci/run.mjs --kind quick` の一部、`remake/test/affinity_stages.mjs`・`remake/test/first_meeting_affinity.mjs` を単独実行）のみ**。実ブラウザ（Playwright）・実プレイは**未実施**。`remake/test/browser/bonds.mjs` 等のPlaywright依存テストはこの監査では動かしていない。
- 本Issueの方針どおり、台本の改稿・ロジック修正は行っていない。各指摘には最小修正案を記すが、実装は別PRに委ねる。
- 関連Issue #1081（実プレイ報告）のバッチCのうち C02〜C05 をIssue本文の指定どおり対象に含めた。『？』配置そのものの修正方針には踏み込まず、所見のみ記録する。

## 1. 実装範囲インベントリ（キャラ/章ごと）

`data/dialogue/*.json` と `remake/js/core/data.js` の `DIALOGUE_FILES` / 各章の遅延ロード（`ch2-city-data.js`, `ch2-story-data.js`, `ch3.js` の `FILES` マップ等）を突き合わせた結果。

| 分類 | 代表例 | 根拠 |
|---|---|---|
| 本編接続済み（起動時） | `ch1_main/tournament/sumi/naru/adam/minto/tsumugi/rin/ageha/spots/events/incognito`、`confession`、`lover_events`、`hiyori` 等 | `remake/js/core/data.js:44-56` |
| 本編接続済み（遅延ロード） | `ch2_tournament`（`ch2-tournament.js:135`）、`ch2_city*`/`remake_ch2`/`ch2_deliveries`（`ch2-city-data.js:40,47-49`）、`ch3_prologue/main/double_apple/mukai/deliveries/rivals/volk`（`ch3.js:19-28` の `FILES`）、`ch3_activities`（`ch3-activities.js:18`）、`ch3_visits`（`ch3-social.js:22`） | 各ファイル行番号 |
| 台本があるだけ（未接続） | `ch3_mashiro.json`、`ch3_tsumugi.json`（`ch3.js` の `FILES` に未登録）、`ch3_spots.json`、`ch1_interval.json`、`dreams.json`、`shop_event.json`、`relationship_conflicts.json`（ファイル内コメントで「本格的な話し合いはエンディング後のみ、未接続」と自己申告）、`tournament_dates.json`（同様に未接続と自己申告） | grep＋目視 |
| 将来章向け | `ch4_main.json` ほか `ch4_*_dubai.json`/`ch4_spots.json`/`ch4_visitors.json`、`ch5_main.json`（いずれもファイル内コメントで「本編接続は未実装」と明記） | 各ファイル冒頭コメント |
| 廃止済み | `data/dialogue/_legacy/*` 一式 | ディレクトリ名 |

**まとめ**: 現在プレイ可能な範囲は第1章・第2章が完全接続、第3章は `ch3.js` の `FILES` マップの範囲で接続済みだが `ch3_mashiro.json`・`ch3_tsumugi.json`（個別イベント）・`ch3_spots.json` は未接続のまま残っている（意図的な保留か実装漏れかは**要再確認**）。第4章・第5章は台本のみで本編進行からは未接続。

キャラ別の好感度段階数（`remake/js/core/affinity-stages.js` の `VISIT_SEQ` が正本）は、tsumugi/naru/adam/minto が6段階、rin は3段階のみ接続（台本上は repeat 系3種を含む6個あるが `VISIT_SEQ.rin` には3個しか載っていない＝**要再確認**、不具合か意図的な簡略化か未確定）。sumi は専用の特殊分岐ロジックのため個別の深掘りは本監査では行っていない（**要再確認**）。

## 2. 確定不具合

### 2-1. `ch3_kuze_first`（第3章・久世）: 配達で名乗り済みでも自主来店で初対面の自己紹介演出が再生される

- **対象HEAD**: `359d80d3`
- **ファイル/行**: `data/dialogue/ch3_rivals.json:4-238`（特に共通lines `13-221`）／比較対象として `data/dialogue/ch3_deliveries.json:30-80`（配達シーン）、呼び出し元 `remake/js/chapters/ch3-deliveries.js`
- **到達条件**: 第3章のMukaiアルバイト配達 `ch3_delivery_kuze` を完読（このとき `data/dialogue/ch3_deliveries.json:65-71` ``branches.new`` で「久世朔。大会の間、ここを借りてる」「蒸野はじめです。mukaiで働き始めました」と**すでに名乗り合っている**。配達完読で `_ch3_delivery_kuze` フラグも立つ、`remake/js/chapters/ch3-deliveries.js` 内で確認）。その後、第3章の自主来店イベント `ch3_kuze_first` に進む。
- **期待**: 同ファイル内の正しい実装例 `ch3_volk_first`（`data/dialogue/ch3_volk.json:12-15` と `:49-52` の2箇所で `_ch3_delivery_volk` フラグ分岐し、冒頭の名乗りだけでなく中盤の「認識」部分まで会話内容を配達済み/未配達で切り替えている）と同様に、配達済みなら自己紹介・初対面の驚きの演出を再生しない、または再会トーンの短い差し替えにするべき。
- **実際**: `ch3_kuze_first`（`ch3_rivals.json:4-11`）は `_ch3_delivery_kuze` で `delivery_known_open` / `delivery_new_open` の2分岐を用意しているが、分岐先（`ch3_rivals.json:224-237`）は「ましろへの前置き」1行だけで、直後に続く共通lines（`13-221`、計約200行）は両分岐で完全に同一。この共通部分で久世が「いらっしゃい。東京の煙を裏から動かす男、って聞いたことある？」「僕。噂を流したのも僕だけどね。がっかりした？」（`ch3_rivals.json:48-60`）と、配達時にすでに自己紹介済みであることを無視した初対面的なやり取りをそのまま行う。`condition_type: "met"` によるガードは一切使われていない。
- **影響**: 配達で名乗り合った久世に対し、数日後の自主来店で再び「何者だ」的な探り合いの初対面シーンを見せてしまい、面識の一貫性が崩れる。`docs/gameplay_agent_reference.md:389`「配達・偵察・強制の顔合わせ等で既に会っていれば…初対面の挨拶を繰り返さない」に反する。
- **最小修正案**: `ch3_volk_first` と同様に、共通lines内の自己紹介パート（`ch3_rivals.json:48-65` 相当）を `condition_type: "flag", flag: "_ch3_delivery_kuze"` で追加分岐し、`known` 側は「配達の時はありがとう、改めて」のような再会トーンの短い文面に差し替える。
- **分類**: 確定不具合（CONFIRMED）。Issue #1052（久世チョコ錯覚ミックス・紅茶設定交換）とは**別の症状**。#1052は「自主来店時のほうじ茶錯覚ミックスの発生タイミング」を扱い、本件は「自主来店冒頭の自己紹介演出の重複」を扱う。同じ `ch3_kuze_first` 付近を編集するため、#1052の実装者は本件も合わせて直すか、本件を別途小さいPRで先に直すか検討されたい（重複実装回避のため、本報告はコード修正をしていない）。

## 3. 再現未確認・要実機確認（確証はあるが実害は未確認、または構造的リスクのみ確認）

### 3-1. #1081 C05「第2章配達で顔合わせ済みでも『？』が残る」: 構造的脆弱性を確認、ただし現HEADでは矛盾は見つからず

- **ファイル/行**: `data/dialogue/ch2_city.json`（`ch2_city_ageha:182-231`、`ch2_city_kumicho:328-376`、`ch2_city_rei:481-526`、各ブロック中盤で `set_flag: "_met_ageha/_met_kumicho/_met_rei"`）／表示側 `remake/js/core/data.js:177-193`（`displayName()`、`ALWAYS_KNOWN` セットに ageha/kumicho/rei は含まれず `state.met[id]` が falsy だと `"？？？"`）／付与経路 `remake/js/vn/engine.js:344-350`（`/^_met_(.+)$/` で `markMet()` を実行）／保険経路 `remake/js/chapters/ch2-tournament.js:284,287`（大会DAY14の `entrance` で `markMet("ageha")` と `["kumicho","rei",...JUDGES]` を無条件一括実行）
- **現状の判定**: 現HEADのファイル内容では `ch2_city_*` 各ブロックの `set_flag` 行は3キャラとも存在し、配達→街イベント→配達会話という通常経路では矛盾は確認できなかった。
- **リスクとして指摘する点**: `met` 付与が**台詞ブロック中盤の `set_flag` 行**という、台詞編集（改行調整・行の追加削除）で容易に欠落しうる位置に依存している。かつ大会当日の一括 `markMet` が「保険」として効くため、もし `set_flag` 行が将来の編集で失われても、大会日まで症状が隠れて発覚が遅れる構造になっている。オーナー報告（#1081 C05）はこの一時的欠落が実際に起きていた可能性がある。
- **最小修正案（仕様判断含む）**: `met` 付与を台詞中の `set_flag` 依存から、配達完読イベント自体（`remake/js/chapters/ch2.js` の `visit()` 等、構造的に削除されにくい場所）に一本化することを検討。または台詞lintで「初対面/配達の `set_flag: _met_*` 行の存在」を機械チェックする。どちらも仕様判断が必要なため本監査では実装しない。

### 3-2. #1081 C04「未読LIME前提の強制イベント」: 主要3経路は対策済みだが全経路の網羅は未確認

- **ファイル/行**: `remake/js/daily/calendar.js:176-209`（`confirmLimeReminder()`）が通常移動（`calendar.js:468-470`）・店訪問（`calendar.js:557`）・終日休養（`calendar.js:578`）の3経路で未読/未返信の誘いを検出し確認モーダルを出す。自動承諾・自動既読化のコードは見当たらない。
- **未確認点**: 行動を消費しない経路（買い物・占い等、`calendar.js:461-462` のコメントで意図的に対象外と明記）は本監査では網羅確認していない。これらの経路から未読LIME前提の強制イベントに入れる余地がないか、要実機確認。

### 3-3. #1081 C02「LIME承諾後は閉じるまで移動を待つ」: 現HEADの静的読取では実装済み、オーナー報告との食い違いに注意

- **ファイル/行**: `remake/js/daily/phone.js:739-830`（`openLime()`）。誘いを承諾すると `state.pendingInvite` が立つのみ（`phone.js:660`）で移動処理は呼ばれない。実際の移動・BG切替（`beforeClose` コールバック、呼び出し元 `remake/js/daily/calendar.js:155-168`）は、プレイヤーが「スマホを閉じる」ボタン（`phone.js:786-790`）を押して `closed` Promise が解決した**後**（`phone.js:827-829`：`await closed;` の後に `beforeClose?.()`）に実行される。他のLIMEスレッドの確認・雑談返信は閉じるまで同一ウィンドウ内で継続できる。
- **所見**: コードを素直に読む限り、オーナーが#1081で報告した「誘いに乗っても即移動してしまう」症状は**現HEADでは再現しない実装**になっている。これは (a) すでに別経緯で修正済み、(b) オーナーがより古いビルドで体験した、(c) 本監査で読み落とした別経路が存在する、のいずれかの可能性がある。実プレイでの再確認を推奨する（本監査の範囲外）。

### 3-4. #1081 C03「約3日未返信への促し」: 未実装

- grep確認（`そろそろ|促し|reminder|nudge|elapsed|daysSince`等）で該当なし。近い機能の `needsResend`（`phone.js:32-34,672-674`）・`missedInvitationNote`（`remake/js/daily/invitations.js:45-46`）は「同日中の期限切れ/お断り」への固定文再送であり、複数日放置を検知する日数カウンタは存在しない。
- **分類**: 未実装（仕様自体も「3日は目安、閾値未確定」とIssue側が明記しているため、本監査では確定不具合ではなく「未実装の要望」として記録）。

## 4. 好感度（数値）と既読（段階イベント進行）の分離（#1050/#1051/#1058の境界保全確認）

既存PR #1050（通常好感度と既読の分離）／#1051（ひよりの短い日常会話優先）／#1058（初回完読の♥1保証）はmain反映済み。以下7点について現HEADで境界が保全されていることを確認した（quick テスト `affinity_stages.mjs` 全53件・`first_meeting_affinity.mjs` 全26件PASS、加えて下記は目視でも確認）。

1. **最古の未読から一訪問一段階**: `remake/js/daily/spots.js:291-320` の `visitChar` が `state.story[id]`（既読数）を元に `seq[idx]` のみ再生し、数値好感度が高くても複数段階を飛ばさない。
2. **閾値間は短い日常会話**: `storyHeartReady()`（`spots.js:131-135`）が必要pt未満なら段階分岐に入らず通い訪問（`spots.js:324-330`）に落ちる。
3. **LIMEだけの好感度上昇でも段階順を飛ばさない**: LIME経由の加点（`phone.js:556,677,693` の `gainAffinity(..., {source:"lime"})`）は `state.affinity` のみ操作し、`state.story` を書き換える処理はphone.js内に存在しない。
4. **初回完読時の最低♥1保証**: `spots.js:318-319` の `if (idx === 0) ensureAffinityLevel(charId, 1);`。`ensureAffinityLevel`（`remake/js/core/stats.js:176-190`）は `Math.max(prevPts, ...)` で既存値を下げない。同様の呼び出しが `samechan.js:96`・`hiyori.js:61`・`tsumugi-story.js:31` にも存在。
5. **高い値を下げない**: コードベース全体に `state.affinity` を減算・リセットする記述は見当たらない。
6. **同イベント/報酬の再付与防止**: `state.story[id]` のカウンタ自体がガード。質問イベントは `questionDoneKey`/`questionComplete`（`affinity-stages.js:12-16`）、ギフトは `grantGift`（`bonds.js:263-276`）が `state.owned` を確認。
7. **中断・例外・LOAD・再訪の境界**: `visitsInFlight` WeakMap（`spots.js`）による同時再入拒否、各 `await play(...)` 後の `state !== owner || signal?.aborted` チェック、`deferSave` による部分保存の防止を確認。

**分類**: 7点とも実装済み（CONFIRMED・問題なし）。疑わしい具体的バグは発見されなかった。

## 5. 分類まとめ

| 指摘 | 分類 | 状態 |
|---|---|---|
| `ch3_kuze_first` 自己紹介重複（2-1） | ストーリー矛盾・確定不具合 | 未対応（本報告で初出、重複Issueなし） |
| #1081 C05 構造的脆弱性（3-1） | 再現未確認／設計上のリスク | #1081 C05で追跡中、本報告は所見追加のみ |
| #1081 C04 全経路網羅（3-2） | 再現未確認 | #1081 C04で追跡中 |
| #1081 C02 食い違い（3-3） | 要実機再確認（静的には解決済みに見える） | #1081 C02で追跡中、実プレイでの再確認を推奨 |
| #1081 C03 促し機能（3-4） | 未実装（仕様要望） | #1081 C03で追跡中 |
| 好感度/既読分離7点（§4） | 確認済み・問題なし | #1050/#1051/#1058の境界は保全されている |
| 第3章 `ch3_mashiro.json`/`ch3_tsumugi.json` 未接続（§1） | 要再確認（意図的保留か実装漏れか不明） | 未分類 |
| rin の repeat系3段階が`VISIT_SEQ`未収載（§1） | 要再確認 | 未分類 |

## 6. 確認範囲の明記（混同防止）

- 実施: 静的読取（全対象ファイルをRead/Grepで直接確認）、限定quickテスト2本の単独実行（PASS）。
- 未実施: ブラウザ（Playwright）テスト全般、実プレイ、SAVE/LOADの実機検証、第4章以降（未接続のため対象外）。
- 本報告の「確定不具合」は static readingで再現条件・期待・実際の差分を直接確認できたもののみに限定した。断定を避けた項目は「再現未確認」「要実機確認」「要再確認」と明記した。
