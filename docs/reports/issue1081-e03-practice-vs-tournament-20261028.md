# Issue #1081 E03 練習／本番での工程・UI差異調査レポート

- 作成日: 2026-10-28
- 対象Issue: #1081 E03「練習／本番で工程・UIを揃える」
- 対象ブランチ: `agy/1081-e03-practice-diff-20261028`
- 調査対象ファイル:
  - `remake/js/craft/session.js`
  - `remake/js/craft/steps.js`
  - `remake/js/craft/practice.js`
  - `remake/js/craft/water-view.js`
  - `remake/js/craft/timer.js`
  - `remake/js/craft/heat.js`
  - `remake/js/craft/steam.js`
  - `remake/js/craft/pull.js`
  - `remake/js/craft/holes.js`
  - `remake/js/craft/thermometer.js`
  - `remake/js/chapters/ch1.js`
  - `remake/js/chapters/ch2-tournament.js`
  - `remake/js/chapters/ch3-tournament.js`
  - `remake/js/chapters/first-brew.js`
  - `remake/js/daily/home-shisha.js`
  - `docs/master_spec.md` / `docs/owner_requests.md` / `docs/gameplay_agent_reference.md`

---

## 1. モード別 工程・UI 対応表

### 1-1. 呼ばれる工程の比較表

凡例: `○` = 呼出あり / `×` = 呼出なし / `△` = 条件付きまたは簡略化 / `—` = 対象外

| モード / 場面 | 呼出箇所（ファイル:行） | 機材<br>(setup) | 水入れ<br>(water) | 配合<br>(mix) | パッキング<br>(pack) | 穴あけ<br>(holes) | 炭配置<br>(place) | 炭焼き<br>(heat) | 蒸らし時間<br>(timer) | 蒸らし弾幕<br>(dodge) | 吸い出し<br>(pull) | 提供<br>(serve) | 調整<br>(care) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **自主練（ドリル）** | [session.js:449-470](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L449-L470) | × | × | × | × | △※1 | × | △※1 | × | △※1 | △※1 | × | × |
| **tonari 練習**<br>（まかない練習・日常通し） | [practice.js:21-70](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/practice.js#L21-L70)<br>[calendar.js:550-554](file:///home/box/repos/worktrees/slot-h1/remake/js/daily/calendar.js#L550-L554) | ○ | ○ | ○ | ○ | ○※2 | ○ | ○ | ○ | ○ | ○ | ○ | ○ (2回) |
| **家シーシャ** | [home-shisha.js:242-272](file:///home/box/repos/worktrees/slot-h1/remake/js/daily/home-shisha.js#L242-L272) | × | × | ○ (modal) | × | × | × | × | × | × | × | × | × |
| **第1章大会** | [ch1.js:537-600](file:///home/box/repos/worktrees/slot-h1/remake/js/chapters/ch1.js#L537-L600) | ○ | **× (欠落)** | ○ | ○ | ○※2 | ○ | ○ | ○ | ○ | ○ | ○ | ○ (2回) |
| **第2章大会** | [ch2-tournament.js:37-40, 297-325](file:///home/box/repos/worktrees/slot-h1/remake/js/chapters/ch2-tournament.js#L37-L40) | ○ | ○ | ○ | ○ | ○※2 | ○ | ○ | ○ | ○ | ○ | ○ | ○ (2回) |
| **第3章全国大会** | [ch3-tournament.js:35-38, 280-325](file:///home/box/repos/worktrees/slot-h1/remake/js/chapters/ch3-tournament.js#L35-L38) | ○ | ○ | ○ | ○ | ○※2 | ○ | ○ | ○ | ○ | ○ | ○ | ○ (2回) |
| **初回制作：チュートリアル** | [ch1.js:239-272](file:///home/box/repos/worktrees/slot-h1/remake/js/chapters/ch1.js#L239-L272) | × | × | ○ | ○ | ○※2 | ○ | ○ | ○ | ○ | ○ | ○ | × |
| **初回制作：初客提供** | [first-brew.js:53-83](file:///home/box/repos/worktrees/slot-h1/remake/js/chapters/first-brew.js#L53-L83) | × | × | ○ | × | × | × | × | × | × | × | × | × |

- ※1: 自主練ドリルは 4 種類（holes, heat, steam, pull）から 1 つを選んで単体反復する。
- ※2: ロートス HMD 装備でアルミなしを選択した場合は穴あけをスキップ（[holes.js:81-86](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/holes.js#L81-L86)）。

---

### 1-2. 表示される UI 要素の比較表

各工程・各モードにおける主要 UI（温度の虹ゲージ、フレーバーの持ちゲージ、？ヘルプ、工程ヘッダー）の挙動：

| UI 要素 | 画面 / 工程での出方 | モードごとの差異 | 根拠（ファイル:行） |
|---|---|---|---|
| **温度の虹ゲージ**<br>(1) 配合時プレビュー<br>`mix-temperature-preview` | 配合画面（`stepMix`）右端に縦型温度計を表示し、合成された適温帯（緑）および中央の最適温帯（虹）をプレビュー。 | **初回チュートリアルのみ非表示**（`hidden: cs.mode === "tutorial"`）。<br>練習・各章大会・自主練では表示。 | [steps.js:253](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/steps.js#L253)<br>[thermometer.js:56](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/thermometer.js#L56) |
| **温度の虹ゲージ**<br>(2) 温度計内 `thermo-optimal`<br>（最適温帯の虹色） | 蒸らし時間設定、蒸らし弾幕、吸い出し、調整工程で表示される温度計内に中央の最適温帯（虹色）を表示。<br>機材・水入れ・パッキング・穴あけ・炭焼きでは温度計自体が出ない。 | 全モード共通の仕様として、**`expressionWeight >= 0.999`（AFレモン・AFミント等の味の変化する葉を単体で使用）のときは `optimal.hidden = true` となり虹色ゲージが隠れる**（帯全体が緑の「おいしく作れる範囲」になる）。 | [thermometer.js:75-78](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/thermometer.js#L75-L78)<br>[master_spec.md:7](file:///home/box/repos/worktrees/slot-h1/docs/master_spec.md#L7) |
| **フレーバーの持ちゲージ**<br>（赤い葉5枚アイコン） | **吸い出し（`pull`）と調整（`care`）の工程でのみ表示**（情報欄または左風景フッターにドッキング）。<br>機材〜蒸らし工程では常に非表示。 | 全モード共通。吸い出し・調整工程が存在するモード（tonari練習、第1〜3章大会、初回チュートリアル、自主練pull）の pull/care 時に出現。 | [session.js:271](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L271)<br>[session.js:297-312](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L297-L312)<br>[pull.js:207](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/pull.js#L207) |
| **？ヘルプ**<br>（`bench-ui` の guide） | `hintText` または `lesson`（チュートリアル用解説）が存在する場合に画面右上に「？」ボタンを表示。<br>機材、水入れ、配合、パッキング、穴あけ、炭配置、炭焼き、蒸らし弾幕、吸い出し、調整で表示。提供時は非表示。 | **蒸らし時間設定（`timer.js`）のみ、通常モードで `hintText` が空文字 `""` のため非表示**。<br>チュートリアル時のみ `lessonStep: "timer"` により表示。<br>また、チュートリアル時は工程開始時に「？」が自動展開して一時停止する。 | [session.js:252-256](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L252-L256)<br>[session.js:191-243](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L191-L243)<br>[timer.js:12](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/timer.js#L12) |
| **工程ヘッダー**<br>（`bench-top` / `progress`） | `openBench` に渡された `steps` 配列に基づき、工程インジケーター（丸アイコン列）と現在の工程名、モード名を表示。 | **全モードで `CRAFT_STEPS` に `water`（水入れ）が含まれていない**。<br>`stepWater` は `stepPanel("setup", "水入れ")` としてSETUPの枠内で実行される。<br>初回チュートリアルは setup なし、初回初提供は配合のみ、自主練は1工程のみ表示。家シーシャは作業台不使用。 | [practice.js:19](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/practice.js#L19)<br>[session.js:136-150](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/session.js#L136-L150)<br>[water-view.js:153-156](file:///home/box/repos/worktrees/slot-h1/remake/js/craft/water-view.js#L153-L156) |

---

## 2. 差異の分析と分類

各モード間で差がある箇所を「意図的（仕様書やコメントに根拠あり）」「不明」「揃えるべき候補」に分類・照合します。

### 差分 1: 第1章大会に「水入れ（stepWater）」が存在しない
- **現状**:
  - tonari 練習（`practice.js:37`）、第2章大会（`ch2-tournament.js:37`）、第3章全国大会（`ch3-tournament.js:35`）には `stepWater` が組み込まれている。
  - しかし第1章大会（`ch1.js:546-548`）は `stepSetup` の次に直接 `stepMix` を呼び出しており、水入れ工程が抜けている。
- **分類**: **【揃えるべき候補】**
- **根拠**:
  - Issue #1081 本文に「本番に水入れがない場合等を一覧化して統一」と明記されている通り、第2章・第3章の `setupWithWater` に対し第1章大会だけが古い直列呼び出しのまま残されている。第1章大会にも `stepWater` を挟むべき。

### 差分 2: 蒸らし時間設定（`timer.js`）で通常モード時に「？」ヘルプが消える
- **現状**:
  - `timer.js:12` で `stepPanel("steam", "蒸らし", "", { brief: "", lessonStep: "timer" })` と呼び出されている。
  - 第3引数の `hintText` が空文字 `""` であるため、通常モード（練習、大会など）では `b.guide.root.hidden = !hintText && !lesson;`（`session.js:253`）により `hidden = true` となり「？」ボタンが非表示になる。
  - チュートリアルモード（`cs.mode === "tutorial"`）の時だけ `lesson` が存在するため表示される。
- **分類**: **【揃えるべき候補】**
- **根拠**:
  - 機材、水入れ、配合、パッキング、穴あけ、炭配置、炭焼き、蒸らし弾幕、吸い出し、調整など、他のほぼすべての工程には通常モード向けの `hintText` が用意されており、「？」ボタンで操作方法を確認できる。タイマー設定画面だけがヒント文未設定により消えているため、UIの統一性を欠いている。

### 差分 3: 水入れ（`water`）が工程ヘッダー（`CRAFT_STEPS`）の丸アイコンに存在しない
- **現状**:
  - `practice.js:19` の `CRAFT_STEPS` は `["setup", "SETUP"]`, `["mix", "MIX"]`... となっており、`water` は含まれない。
  - `water-view.js:153-156` では `stepPanel("setup", "水入れ", ...)` として呼び出され、見出しは「水入れ」になるが、上部ヘッダーの丸アイコン進捗は「SETUP」のまま進行する。
- **分類**: **【意図的】**（ただしヘッダー拡張の検討候補）
- **根拠**:
  - `water-view.js:153` のコードコメントに明記：「水はSETUP内の準備。既存の番号付き工程と進捗表示を保つ。」
  - 当初の番号付き6大工程（パッキング、炭焼き、蒸らし、吸い出し、調整1、調整2など）の進捗インジケーター設計を崩さないために、あえて SETUP 内のサブステップとして収めている。

### 差分 4: 初回制作（チュートリアル / `ch1.js:tutorial`）での工程省略
- **現状**:
  - 機材選択（setup）と水入れ（water）が省略され、配合（mix）から開始。また提供後の調整（care）も行わない。
- **分類**: **【意図的】**
- **根拠**:
  - 初回の一台作りは未経験者向けのレッスンであり（`docs/master_spec.md:237-272`、`steps.js:38` `LESSON.setup: "道具は相棒だ。今日のは店の基本セットでいい"`）、機材選択や水入れなどの前提作業を省いて「味を決める配合」からスミさんの手本とともに学ばせる設計。
  - また、調整（care）は提供後の一台を長く維持する技術であり、第1章DAY7の実践練習（`ch1.js:415`）や `runCarePractice` で段階的に導入されるストーリー構造となっている。

### 差分 5: 初回チュートリアル配合画面で温度帯プレビューが非表示
- **現状**:
  - `steps.js:253`（`hidden: cs.mode === "tutorial"`）および `thermometer.js:56` により、チュートリアルでは配合画面右端の縦型温度計プレビューが隠される。練習や大会では表示される。
- **分類**: **【意図的】**
- **根拠**:
  - `thermometer.js:55-56` のコメント「初回も時間設定から実温度計を表示。配合中のプレビューは引き続き隠す。」に明記。初回配合時に温度帯という高度なパラメータを見せて混乱させないための配慮。

### 差分 6: 単体フレーバー（`thermal_expression`）で最適温（虹ゲージ）が消える現象
- **現状**:
  - レモンやミント単体など `expressionWeight >= 0.999` の配合を作った場合、温度計内の `thermo-optimal`（虹色の最適温帯）が非表示（`optimal.hidden = true`）になり、緑の「おいしく作れる範囲」全体が適温となる。
  - 一方、ダブルアップルや多種混合配合では中央に虹色の最適温帯が表示される。
- **分類**: **【意図的】**（仕様通りだがプレイヤーに誤解されやすい箇所）
- **根拠**:
  - `docs/master_spec.md:7`:「適温帯内の低め・中央・高めで味が変わり、対応葉だけの配合では帯全体を同じ温度品質100とする。中央だけを虹で称賛しない」
  - `thermometer.js:15-17`: `bandDescription` で「緑がおいしく作れる範囲。低めと高めで香りが変わる」と「緑が適温の目安、中央の虹色が合わせやすい範囲」を出し分け。
  - 「練習でダブルアップルを吸った時は虹が出たのに、第1章大会で課題のレモンを使ったら虹が出なくなった」というユーザー体験は、バグではなくこの「表情対応葉」の仕様に起因している。

### 差分 7: 自主練（ドリル）に「水入れ」ドリルが存在しない
- **現状**:
  - `session.js:46-51` の `DRILLS` は holes, heat, steam, pull の 4 種のみ。
- **分類**: **【意図的】**（現状の仕様）
- **根拠**:
  - 自主練メニューは「本番のミニゲームを単体で回す」（`session.js:45`）ものであり、能力成長ステータス（technique, sense, guts, insight）と紐づいている。水入れは後から追加された準備ギミックのため自主練対象外。

### 差分 8: 家シーシャ（`runHomeShisha`）が作業台画面を通らない
- **現状**:
  - モーダルダイアログで配合を決めるだけで、機材・水入れ・パッキング・ミニゲーム等の工程は一切通らず会話で終了する。
- **分類**: **【意図的】**
- **根拠**:
  - `docs/master_spec.md:29` および `home-shisha.js:3-6`：「寝る前の一服...昼と夜に行動したうえでの“ちょい足し”で、行動の枠は使わない...自分の葉を12g決めたら、あとは短い場面が進む」。テンポ良く熟練度を育成するための簡易シーケンス。

---

## 3. 揃える場合の最小修正案（各1行）

コード修正を行う場合の最小変更案を各1行で記述します（本作業では実装は行いません）。

1. **第1章大会への水入れ追加**:
   - `remake/js/chapters/ch1.js:546` の `await stepSetup(cs);` 直後に `await stepWater(cs);` を挿入する（または ch2/ch3 と同様に `setupWithWater` 関数を定義して統一）。
2. **蒸らし時間設定画面（`timer.js`）での「？」ヘルプ表示統一**:
   - `remake/js/craft/timer.js:12` の `stepPanel` 呼出第3引数を `""` から `"分・秒ボタンで蒸らし時間を設定し、スタートで開始する"` に変更する。
3. **（検討）工程ヘッダーに水入れアイコンを独立表示する場合**:
   - `remake/js/craft/practice.js:19` の `CRAFT_STEPS` に `["water", "WATER"]` を追加し、`remake/js/craft/water-view.js:154` の `stepPanel("setup", ...)` を `stepPanel("water", ...)` に変更する。
4. **（検討）初回チュートリアルでも配合時温度帯プレビューを表示する場合**:
   - `remake/js/craft/steps.js:253` の `hidden: cs.mode === "tutorial"` および `remake/js/craft/thermometer.js:56` のチュートリアル非表示条件を解除する。

---

## 4. 司令塔向け推奨検証コマンド

本セッションでは最優先指示に従いコマンド実行を行っていません。司令塔が確認する際の推奨テストコマンドを列挙します。

- **TEST: 未実施（コマンド不可）**
- **推奨テストコマンド**:
  1. `node tools/ci/run.mjs --kind quick` （全ユニットテスト・リンタの通過確認）
  2. `node remake/test/browser/ch1_tournament.mjs` （第1章大会の進行・制作UIの確認）
  3. `node remake/test/browser/ch2_tournament.mjs` （第2章大会の水入れ・工程進行の確認）
  4. `node remake/test/browser/craft_practice.mjs` （フル練習・ドリルの工程確認）
