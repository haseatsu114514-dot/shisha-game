# shisha-game — CLAUDE.md

Godot 4 製シーシャ屋アドベンチャー＆シミュレーションゲーム。
プレイヤーはシーシャバイト青年「蒸野 始（むしの はじめ）」として、地元大会→県大会→全国大会→世界大会を目指す。

---

## Git Safety

If this machine uses a canonical checkout path, store it in local Git
config with:
`git config --local shisha.canonicalRoot "$(pwd -P)"`

Do not work from `sheesha_battle`, `シーシャバトル-(4.2)`,
`.codex_tmp/...`, or any other duplicate checkout. Those paths must be
treated as stale until the user explicitly replaces the canonical path
and updates the local config.

Before any code edit or Git operation:

- verify the repo root with `git rev-parse --show-toplevel`
- confirm that the same directory contains `project.godot`
- run `./tools/check_git_safety.sh`
- if `git config --get core.hooksPath` is not `.githooks`, run
  `./tools/enable_git_hooks.sh`
- if `git config --local --get shisha.canonicalRoot` is set, confirm
  that it matches the repo root

If any check fails, stop. Do not create branches, do not commit, do not
push, and do not try to merge unrelated histories.

### Hard rules

- branch from `origin/main`
- use pull requests instead of direct pushes to `main`
- do not use `git push --force` on shared branches
- do not use `--allow-unrelated-histories`
- do not change the default branch to a feature branch as a workaround

If `git merge-base HEAD origin/main` fails, the branch is not safe for a
normal PR. Stop and fix the Git layout first.

---

## ブラウザ版（web/）

第1章・第2章はHTML/JS版が `web/` にあり、**ブラウザ版がメインの開発トラック**。
ブラウザ版の作業前に必ず `docs/web_version_plan.md`
（開発方針・ロードマップ・次回タスク・引き継ぎ）を読むこと。
開発ブランチ: `claude/great-galileo-omzoob`
（mainに未マージの場合はチェックアウトして続きを行う。
旧ブランチ `claude/hopeful-ride-5rg3zg` はマージ済み）
ゲームの正式タイトルは **「水煙前線 -EN:CODE-」**。
本作は一人称視点で、主人公はじめの立ち絵は基本表示しない。

### Godot版は削除済み（web/ が唯一の正史・2026-06-15）

Godot版（`scripts/*.gd` / `scenes/` / `*.tscn` / `*.import` / `*.uid` / `project.godot`）は
**リポジトリから削除済み**（オーナー指定・2026-06-15）。web と二重実装で約34,000行あり、
旧設定・偽の矛盾・トークン浪費の温床だったため整理した。**ブラウザ版（`web/`）＋ `data/*.json` ＋ `brand/` が唯一の正史**。

- バランス・大会フロー・UI文言・ロジックの変更は **`web/` と `data/` だけ** に入れる。
- 台詞・キャラ・フレーバー等の `data/*.json` と `assets/`（立ち絵・背景・音声）は**残置**（web が使用）。
- テストは web ヘッドレス（本ファイル下部の全7本）だけ緑にすればよい。
- 復活が必要になったら git 履歴（削除コミット以前）から取り出せる。手で同期し直すのではなく、完成した `web/` ＋ `data/*.json` を仕様として**作り直す**前提。
- AI で矛盾・改行・セリフを点検する際の**対象範囲は `docs/review_scope.md`** を参照（ビルド成果物・旧brandファイルを除外し、偽の矛盾とトークン浪費を防ぐ）。

---

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `data/characters.json` | 全キャラクターのマスタデータ（ID・設定・ステータス） |
| `data/dialogue/` | 会話データ JSON（ch1_main.json, ch1_tournament.json 等） |
| `data/flavors.json` | フレーバーデータ |
| `data/equipment.json` | 機材データ |
| `data/baito_events.json` | バイトイベントデータ |
| `brand/story_and_structure.md` | 全章ストーリー構成（読む場合は必要な章のみ） |
| `brand/character_profiles.md` | キャラクター設定詳細（要部分読み取り） |
| `web/js/game.js` | ブラウザ版ゲーム本体（状態管理・大会・報酬・UI） |
| `web/js/engine.js` | 会話エンジン（改行 autoWrap・表示名・タイプ表示） |
| `web/build_data.py` | `data/*.json` → `web/js/data.js` バンドル生成 |
| `tools/lint_dialogue.py` | 台詞リンタ（禁止語・話者ID・改行・報酬キュー検査） |
| `tools/` | dialogue_editor.py 等の開発支援スクリプト |

---

## 主人公

- **ID**: `hajime`
- **フルネーム**: 蒸野 始（むしの はじめ）
- **テーマ**: 「素直さ」＝他人の良さに素直に気づける力。それは嫉妬にもなるが、吸収と継承の源でもある。
- **性格アーク（2026-06-10改定）**: 序盤は**一見感じのいい普通の青年**。よく観察すると「自分の店を持ちたい」という薄い夢（店名・内装は語れるが「なんで」に詰まる）や、tonariの看板に寄りかかる得意げさが**垣間見える**。カーズ／TOD2カイル型だが、直球のイキリにはしない。**1シーン1テル**・テルは内心モノローグで・違和感は周囲の反応で可視化（書き方ガイドは `brand/story_and_structure.md` 参照）。上位大会で勝ち続けた果てに**味覚を失い・仲間に見放され**（テイルズオブジアビス型）、ch3でましろだけに救われて素直さが本物になる。
- ⚠️ 恋愛・交友イベントでは薄さを出さない（好感度を壊さない）。出すのは夢・大会・承認が絡む場面のみ。
- 主人公のテーマは上記に統一。旧テーマ語は列挙せず、見つけたら最新テーマへ言い換える。
- ⚠️ 「自信がない・謙虚な主人公」（旧設定）も「直球で調子に乗る主人公」（過渡期案）も使わない。

---

## ゲームデータの重要な仕様

### ステータス（5種類のみ）

`技術` / `センス` / `根性` / `魅力` / `洞察`

- 表示名は上記5種類のみ。近い意味の別名や旧名は作らない。
- 初期値は全て10（均等スタート）。**章ごとのソフトキャップ**で伸びを抑え（ch1≈48/ch2≈66/ch3≈82/ch4≈96/ch5=100。`statSoftCap()`）、第5章で頑張れば全て100（★5）＝完全攻略を狙える。ch1で上限に張り付かない（#42）。スロット大当たりでも章途中でカンストしにくいよう、各章の上限は少し余裕を持たせている

### ステータス表示ルール

- **数値は絶対にプレイヤーに見せない**（内部値0〜100は非公開）
- メニュー・サマリーでは **★1〜5** で表示（★★★☆☆ のようなビジュアル）
- 上昇通知は**抽象表現のみ**:
  - 1〜2ポイント → 「少し上がった」
  - 3〜4ポイント → 「上がった」
  - 5ポイント以上 → 「大きく上がった」
- セリフ内の表記例: `……【技術】と【センス】が上がった。`

### イベント報酬ルール

- **全てのイベント・行動に何かしらの報酬を必ず付ける**
- 好感度が上がらないイベントでも「ステータスUP」または「アイテム付与」を行う
- アイテムがもらえる場合はステータスを上げなくてもよい
- ステータス育成で攻略難易度が劇的に変わらないようにする（「そこそこ有利」程度）
- 育て方で失敗して詰む事態は発生させない設計

### 大会名・大会システム

- 第1章の地元大会: **SMOKE CROWN CUP**
- ❌ 「第12回 地方シーシャバトル」「地方予選」は旧名・NG表現
- 各大会は **4人一斉対決形式**。1位のみが次の大会へ進出。**2位以下はその場で敗退＝GAME OVER（敗者復活戦は廃止・2026-06-13）**
- **審査員持ち点投入制**: 各審査員は持ち点10を好きなタイミングで投入（戻せない）。南雲は最後まで温存し「もう一口吸いたい一台」に一括投入する流儀。ch1は craft 基準未達だと南雲票が動かず普通に敗北、基準超えで最終逆転（実装済み）
- **章ごとの課題フレーバー（レギュレーション）**: ch1=ミント2g以上／ch2=ストロベリー（県特産・高難度）／ch3=自由（ましろと作戦会議3択）／ch4=自由＋日本アピール（スミさんと作戦会議3択）／ch4=和風（和素材で日本をアピール。DA要素は無し）／ch5=ダブルアップル単体（配合自由度ゼロの技術勝負・ch3事件の贖罪の最終回収）。詳細は brand/story_and_structure.md の表
- C.STATIONが正式名称（❌「シーシャ・ステーション」「シーシャステーション」は旧表記）

### シーシャ屋の文化・共通ルール

以下はゲーム全体を通じて守るべきシーシャの文化的ルール:

- **ミントの好み**: ミントが苦手な客もいる。ただし**毎回口頭で確認はしない**（不自然なため）。苦手な客は注文時に自分から「ミント抜きで」と言う、常連は好みを店が覚えている、という形で描く。
- **蒸らし時間**: ゲーム内では **0/3/5/8/10分の選択制**。基本は5〜8分。0分（吸いながら立ち上げる）は神崎竜二との交友で解放される例外的な高等テク。2分は採用しない。
- **炭の配置**: 基本は **トライアングル（三角配置）**。
- **お任せ注文**: 「お任せで」と頼む客は珍しくない。普通にある注文の仕方。
- **吸い出し**: 炭を置いて蒸らした後、提供前に何度か吸って温度を立ち上げる工程（最低2回・3回までは無傷、それ以上は葉が痩せる。やめ時は自分で選ぶ）。吸い方で熱を上げ下げできる。
- **プレゼン工程は廃止（2026-06-12）→ FLAVOR TRIAL（審査）で上書き（2026-06-13）**: 弾丸・論破系の旧「プレゼン」は復活させない。ただし大会には **FLAVOR TRIAL** がある＝提供後、**コンセプト（=制作前の方針）と、制作結果から自動生成したアピールポイント（=実績）を審査員のザワザワに「ぶつける」**ことで「言ったことと作ったものの一致」を証明する審査パート（master_spec 第2部 #3・実装済 `flavorTrial()`）。正式用語は **コンセプト／アピールポイント／ぶつける**、反論は **「香ってない！」「ズレてる！」**。スピーチ調・弾丸系は禁止。
- **詰める量**: 基本12g。ボウル（ハガル）の容量までは増やせる（素焼き・大型は15〜20g）。多く詰むほど味の劣化は遅いが、必要な熱と葉代が増える。

---

## dialogue JSON スキーマ

```json
{
  "dialogues": [
    {
      "dialogue_id": "unique_id",
      "metadata": { "bg": "res://...", "effect": "smoke" },
      "lines": [
        { "speaker": "hajime", "face": "normal", "text": "..." },
        { "speaker": "", "face": "", "text": "ナレーション行" },
        { "type": "condition", "stat": "技術", "threshold": 30, "next_true": "branch_a", "next_false": "branch_b" },
        { "type": "show_cg", "cg_id": "cg_ch1_nagumo_smile" },
        { "type": "hide_cg" },
        { "type": "game_over" }
      ],
      "branches": {
        "branch_a": [ { "text": "..." } ]
      }
    }
  ]
}
```

- `speaker` は `data/characters.json` の `id` と完全一致が必要
- `face` の値: `normal` / `smile` / `surprise` / `sad` / `serious` / `smug` / `wink` / `evil` / `excited`

---

## キャラクター ID 早見表

| ID | 名前 | 役割 |
|---|---|---|
| `hajime` | 蒸野 始 | 主人公 |
| `sumi` | 墨田 丈一郎 | 師匠 (tonari) |
| `naru` | 鳴切 亮太 | ライバル ch1（**人格者の好敵手**。惜しみなく教える。イキリは旧設定） |
| `adam` | 吾妻 大夢 | ライバル ch1（ダブルアップル職人） |
| `minto` | 緑川 栞 | ライバル ch1（自称20歳・実年齢29歳） |
| `tsumugi` | 白木 つむぎ | ヒロイン ch1 (tonari 常連) |
| `oneesan` | お姉さん | みんとの私服・素の姿用エイリアス（立ち絵は minto の `ura_*`。ch1では正体を明かさない） |
| `rin` | 匂坂 凛 | ヒロイン ch1〜（27歳・年上枠。問屋街『Dr.fookah』2階、海外メーカーNIGHTSIDE日本代理店。はじめを「モルモットくん」と呼ぶ） |
| `salaryman` | サラリーマン | tonari 常連（ストーリー専用） |
| `kako` | かこ | tonari 常連ちょい役（FLデザイナー） |
| `rira` | りら | tonari 常連ちょい役 |
| `ageha` | 宵野 葉子 | ライバル ch2（ch1 DAY4夜に「謎のギャル」としてカメオ。香り=ホワイトグミベア） |
| `kumicho` | 神崎 竜二 | ライバル ch2（シーシャ組長） |
| `rei` | 田中 健太 | ライバル ch2-3（V系。ch1バイトに正体を伏せてカメオ来店済み） |
| `dr_kemuri` | チャコール博士 / 炭場 創 | ライバル ch2・裏ボス戦の仕掛け人 ch5（❌「ドクター・ケムリ」は旧名） |
| `mashiro` | 真白 ましろ | ヒロイン ch3（別名:シガーマン） |
| `mukai_master` | ムカイさん / 向井 | ch3 溜まり場「mukai」店長 |
| `tetsuko` | テツコ | mukai 裏口の猫 |
| `nandi` | ナンディ・カルダモン | ライバル ch3 |
| `steve` | スティーブ・デイビス | ライバル ch3 |
| `volk` | ヴォルク・イヴァノフ | ライバル ch3 |
| `master_hookah` | 王 煙楼 | ラスボス ch4 |
| `sheikh` | シェイク・アル=ガリヤーン | ライバル ch4 |
| `shisha_9000` | SHISHA-9000 | 隠しボス ch5 |
| `nagumo` | 南雲 修二 | 大会審査員長（45歳、シーステーション会長） |
| `maezono` | 前園 壮一郎 | 大会審査員（口癖:「シーシャはおいしいねえ」） |
| `pakki` | パッキー | 大会MC兼マスコット（笑い声:「ぷぷぷっ！」）※焚口ショウと統合済み |
| `emil` | エミル | 審査員（元トルコ職人） |
| `dj_smoke` | DJ SMOKE | 審査員 |
| `da_silva` | ダ・シルヴァ太陽 | ch4 ゲスト審査員（チャドと統合済み） |

---

## 大きいファイルの注意

全文読み込みはトークンを多く消費します。必要な箇所のみ読んでください。

| ファイル | 行数 | 推奨アクセス方法 |
|---|---|---|
| `web/js/game.js` | 約8,000行 | 関数名・定数名で Grep してから部分読み取り |
| `data/dialogue/ch1_main.json` | 926行 | `dialogue_id` で Grep して前後だけ読む |
| `data/dialogue/ch1_tournament.json` | 838行 | 同上 |
| `data/characters.json` | 656行 | `jq '.[] | select(.id == "xxx")'` で1件抽出 |
| `brand/story_and_structure.md` | ~900行 | 必要な章の見出しで Grep してから部分読み取り |

### 部分読み取りコマンド例

```bash
# 特定キャラのデータだけ取得
jq '.[] | select(.id == "adam")' data/characters.json

# dialogue_id を全件確認（内容は読まずに構造把握）
jq '[.dialogues[].dialogue_id]' data/dialogue/ch1_main.json
```

---

## ブラウザ版 開発ワークフロー（ビルド・テスト・規約）

**ブラウザ版（`web/`）がメインの開発トラック。Godot版は当面保留**（ブラウザ版優先・余裕が出たら移植）。
作業前に `docs/web_version_plan.md`（方針）と `docs/owner_requests.md`（要望台帳＝反映漏れ防止）を読む。

### ビルド（data/ や web/ を変えたら必須・両方）
```bash
pip install Pillow numpy scipy    # 立ち絵の透過余白計測＋足元アンカー(ax)計測（初回のみ。scipy欠落だと立ち絵の横位置がズレる）
python3 web/build_data.py         # data/*.json → web/js/data.js に束ねる
python3 web/build_standalone.py   # 1ファイル配布版 web/dist/shisha_ch1.html を生成
```
- 追加した JSON は build_data.py の読み込み一覧に入れないと web に出ない（例: `sheesha_posts.json` はGodot専用で未バンドル）。

### ヘッドレステスト（全8本・全緑が基準）
```bash
python3 -m http.server 8123       # リポジトリルートで起動して放置
node web/test/playthrough.mjs     # 1章優勝ルート通し（~6分・stats=80を強制して勝ちを検証）
node web/test/ch2.mjs             # 2章通し
node web/test/screenshots.mjs     # 敗北→再挑戦
node web/test/reel.mjs            # スロット分布/天井/救済（純ロジック・速い）
node web/test/kuji.mjs            # くじ収支
node web/test/balance.mjs         # 経済（バイト最低8000円 等）
node web/test/map_hover.mjs       # マップのホバー安定性
node web/test/portraits.mjs       # 立ち絵の身長スケール回帰（スミさん=みんと等身に見えたらFAIL・速い）
```
- 重い3本(playthrough/ch2/screenshots)は**同時に走らせない**（CPU枯渇でタイムアウト）。1本ずつ。
- playwright 依存（`require("playwright")` か `/opt/node22/lib/node_modules/playwright`）。
- 会話編集 `python3 tools/dialogue_editor.py` ／ 改行プレビュー `web/tools/linebreak_editor.html`。

### 状態管理・流儀（別パターンを勝手に増やさない）
- 状態は単一の `state`（`save()`/localStorage `shisha_ch1_save_v1`）、大会中の一時状態は `tt`。
- 会話は dialogue JSON →`DialogueEngine`（`playDialogue`/`playCustom`）。報酬は「〜上がった」テキストキュー(`parseTextCue`)か `type:"apply"`/metadata で付ける。
- 残り日数は `daysUntilTournament()`/`{daysLeft}` に一本化（台詞へ日数を直書きしない）。台詞は `interpolate()` を通る。
- スロット文言は `bubble(text, ms, cls)`、連発防止は `pick()`、ステ伸びは `gainStat()`＋章上限 `statSoftCap()`。

### やらない（テスト・正史を壊す）
- テストフックを壊さない: `__pullDebug` / `__heatDebug` / `__steamDebug().end()`（蒸らし弾幕の即終了） / 調整(R2)の「このままでいく」 / 審査の `.trial-appeal[data-backed][data-cat]`＋`#trial-doubt[data-need]` / 結果カウントの `pointer-events:none`。
- **蒸らしミニゲームは雑念弾幕（`runSteamDodge`）**。「覚悟＋締め」(`runSteamWait`) は2026-06-14にオーナー指定で差し戻し済み。復活させない。0分は神崎交友で解放＝弾幕スキップ。
- ステの生数値をUIに出さない（★と抽象語のみ）。旧ステ名（技術力/洞察力/メンタル/度胸/味覚/集中力）禁止。
- タイミング系ミニゲームは必ず `miniCountdown()` で 3・2・1 を挟む。
- `main` へ直push禁止＝PR。`--force`/`--allow-unrelated-histories` 禁止（Git Safety）。

### 参照（巨大docは本体に詰めず参照）
`docs/web_version_plan.md`（方針/引き継ぎ）・`docs/owner_requests.md`（要望台帳）・`docs/master_spec.md` 第2部（大会仕様）・`brand/story_and_structure.md`（章別・必要章のみ）

---

## 制作スキル（.claude/skills/ — 該当作業では必ず使う）

再発バグ防止と意図の汲み取りのため、頻出作業は手順をスキル化してある。詳細は各 SKILL.md が正。

| スキル | 使う場面 |
|---|---|
| `owner-request` | オーナーの指摘・要望・バグ報告・プレイ感想への対応全般（受領→解釈確認→横断確認→台帳更新） |
| `dialogue-edit` | 台詞・イベント・ゲーム内テキストの追加・編集（改行・報酬キュー・旧名・話者IDのチェックリスト） |
| `web-build-test` | web/・data/ 変更後のビルドとヘッドレステスト（変更→テスト対応表・直列実行ルール） |
| `canon-check` | 矛盾・設定齟齬・旧名残存の点検、設定に関わる文章を書く前の正本確認 |
| `portrait-fix` | 立ち絵のズレ・表情切替ジャンプ・見切れ・髪欠け・身長バランス・立ち絵追加（症状別診断フロー） |

---

## 作業時の注意事項

- **キャラクターを追加・変更する場合**: `data/characters.json` の `id` と dialogue JSON の `speaker` を必ず一致させる
- **CG ID を指定する場合**: `cg_ch1_nagumo_smile` のように実在するキャラのIDを使う（例: `toki` は存在しない）
- **ステータス名**: 5種類のみ。変名・旧名は使わない
- **growth_stats.notes の書き方**: 「〇〇から学んだ」ではなく「いつの間にか△△が変わっていた」視点で書く
- **大会スクリプト ch2〜ch4 はほぼ同じ構造**（ch1 を参考にすれば足りることが多い）
- **主人公のステータス初期値に偏りはない**。テーマ上の強みは「素直さ」。
- **キャラクター名と呼称**は `data/characters.json` と `web/js/data.js` の最新表示に合わせる

---

## ストーリー整合ルール（2026-06-11 改定）

- **「-EN:CODE-」の意味は ch5 まで作中で説明しない**。ch5で回収: 煙を作る＝生き方のエンコード、吸う＝デコード。AIの煙は「誰もエンコードしていないコード（宛先のない煙）」
- **ch4 の優勝の一台は和風**（和素材で日本をアピール。DA要素は入れない）。**ch3ダブルアップル事件の贖罪はch5のDA単体勝負で回収**（アダムへのリスペクトも同所）
- **ch5 は採点UI（スコア表示）を出さない**。勝敗は観客の「もう一回吸いたいのはどっち」の挙手
- **スミさんが折れた理由**は「負けたから」ではなく「勝つための煙で客の顔が見えなくなったから」（はじめの ch2 の鏡像）
- **チャコール博士は味覚を失った元職人**（はじめの味覚喪失の鏡像）。ch5戦後、9000は破壊されず教材として残る
- **全編モチーフ「店の匂い」**: 店を持つとは匂いを背負うこと。各章に一度だけさりげなく置く（説明しない）
- **ch1の優勝は実力ではない**: 技術点・個性点は下位で、南雲の総合印象点1票だけで勝っている（**師匠スミさん**が優勝の夜のLIMEで採点表を突きつける＝突きつけ役はなるではなくスミさん・2026-06-13改定）。「実力で勝った」と書かない
- **みんとの私服=「お姉さん」**(speaker `oneesan`)。ch1では正体を明かさない。身分証確認の記憶が「自称20歳」の嘘の伏線

## 接客・金銭の規範

- **日本のシーシャ屋にチップ文化はない**。客が現金を置いていく描写は禁止。バイトの臨時収入は「店からの売上ボーナス」「給料への上乗せ」「まかない」で表現する

## リーフ（葉）の規範

- **はじめ（主人公）が使うのはブロンドリーフのみ**。ゲームの配合候補は全てブロンド（flavors.json の `leaf: "blond"`、stepMix がフィルタ）
- **ダーク／シガーリーフは用語・他キャラの演出専用**（ましろはブロンドも作れるがシガー/ダークを好む）。はじめに使わせない——「普通の葉で世界一になる」が本作の背骨
- 用語解説はゲーム内の用語集（`data/glossary.json`、会話画面の「用語」ボタン）に追記する

## シガー（cigar）用語の注意

本ゲームで「シガー」という言葉が出てきた場合、基本的には**葉巻そのものではなく「シガーリーフ（葉巻の葉っぱ）を使ったシーシャ」**のことを指す。「シガーマン」も葉巻職人ではなく、シガーリーフシーシャの凄腕職人。

---

## ヒロイン・好感度・修羅場システム

- **ヒロイン**: つむぎ・ましろ・みんと・アゲハ・凛の5人。「メインヒロイン」という枠組みは設けない。プレイヤーが好きなキャラを一番愛せる構成を目指す。
- **好感度**: 各ヒロインに5段階の好感度がある。好感度MAXになった時に「付き合う」か「友達のまま」の選択肢が出現する。
- **修羅場イベント**: 好感度MAXかつ「付き合っている」状態が2人以上の場合に発生する特別イベント。
- ❌ 「つむぎ・ましろがメインヒロイン」は旧設定

### 恋愛ルートの着地タイミング

- **ch3まで**に全ヒロインの恋愛ルートを着地させる（付き合う/友達のまま）
- **ch4（ドバイ）に新たな付き合えるレベルのヒロインは追加しない**
- ch4では既存ヒロインが「応援」として登場する形で感情を回収する

### ch4（ドバイ大会）へのヒロイン登場条件

| キャラ | 友達 | 彼女 |
|---|---|---|
| つむぎ | 来ない | 来る（あなたのために） |
| アゲハ | 来ない | 来る（あなたのために） |
| みんと | 来ない | 来る（あなたのために） |
| **ましろ** | **来る**（ムカイさんに言われた＋東京編を見届けたい） | **来る**（同上＋大事な人だから） |
| 凛 | 来ない（本国出張と被る） | 来る（「最重要サンプルの品質管理」名目で） |

- ましろは **ch3クリアしていれば好感度・恋愛状態に関係なく登場**する唯一のキャラ
- 登場セリフは `data/dialogue/ch4_mashiro_dubai.json`（friend版・girlfriend版）

### ましろの呼び方

- はじめがましろを呼ぶときは **「ましろちゃん」** で統一

---

## キャラクター間クロスオーバー・噂システム

キャラクター同士がクロスオーバーした噂やストーリーを積極的に設計する。例:
- 南雲会長がシガーマンの噂を恐れている（実際にはましろ）
- ムカイさんがシガーマンと勘違いされている（本当のシガーマンはましろ）
- チャコール博士の人体実験の噂が業界内で囁かれている
こうした世界観のクロスオーバーがゲーム性を深くする。

---

## 矛盾・改行崩れの再発防止ルール（2026-06-15）

ストーリー矛盾・会話破綻・改行崩れは「設定が複数箇所に散って二重管理になっている」「改行がデータとコードの両方で決まる」「報酬がプロサ（地の文）に埋まっている」という**構造**から生まれる。以下を守ること。

### 1. 設定の一元管理（Single Source of Truth）

各「事実」には**正本を1つだけ**置く。他は参照するだけで、事実を書き直さない。

| 事実の種類 | 正本（ここだけを編集） | 二次（手で同期しない） |
|---|---|---|
| キャラのID・本名・年齢・ステータス | `data/characters.json` | brand/docs の人物表は説明用。数値・年齢を書かない |
| 表示名（あだ名）・話者の別名 | `data/characters.json` の `name` | ⚠️ `web/js/engine.js` の `SPEAKER_NAMES` は**ハードコードの二重管理**。原則 characters.json 由来の `char_names` に寄せ、新キャラ名をここへ増やさない |
| ステータス名（5種） | CLAUDE.md「ステータス」節 | コード定数 `STAT_KEYS`/`STAT_JA2EN`（engine.js）と一致必須 |
| 大会名・章レギュレーション | CLAUDE.md「大会名・大会システム」節 | story_and_structure.md は説明、矛盾したらCLAUDEが正 |
| 章ごとのストーリー（プロット） | `brand/story_and_structure.md` | docs/master_spec は仕様、brand のフィードバック系は履歴 |
| 台詞 | `data/dialogue/*.json` | `web/js/data.js` は**生成物**。直接編集禁止（`build_data.py`で再生成） |

- 同じ事実を2箇所に書かない。書くなら一方を「→ ○○を参照」にする。
- ⚠️ **正本だが古い記述が残っている既知の地雷**:
  - `brand/story_and_structure.md` ほか brand/docs に**旧タイトル「煙の向こう側」**が残存。**正式タイトルは「水煙前線 -EN:CODE-」**（CLAUDEが正）。見つけたら直す。
  - `brand/brand` / `brand/chapter1（character）` は**旧設定の残骸**（旧名「ドクター・ケムリ」、旧主人公表記「蒸野 はじめ」等）。**参照・引用しない**。`review_scope.md` の「コア」に `brand/**` とあるが、これらの旧ファイルは正史ではない。

### 2. 改行は「コード側（autoWrap）」に一本化する

改行は **`web/js/engine.js` の `autoWrap()`（`WRAP_LIMIT=24` 全角換算・禁則処理つき）＋ 最大2行で改ページ（`MAX_PAGE_LINES`）** が決める。**データ側で決めるのではない**。

- 台詞テキストに**手動改行 `\n` を入れない**。手動 `\n` は autoWrap の前段で分割されるため、(a) 旧フォント幅向けの改行が残って二度折れする、(b) 短い断片が孤立する、(c) 改ページ位置がぶつかる、という崩れの主因になる。
  - 例外: 演出上どうしても改行したい箇所のみ。その場合も**1行が全角24文字を超えない**ように書く。
  - 既存の手動 `\n`（`lover_events.json` に多数）は崩れ報告が出たら撤去方向で直す。
- 1台詞は**全角24文字×2行＝48文字**を目安に収める。超えると自動で改ページされ、文の途中で切れて不自然になる。長い説明は台詞を分ける。
- 改行確認は `web/tools/linebreak_editor.html`。日数は直書きせず `{daysLeft}`（`interpolate()`）を使う。

### 3. 報酬を地の文に埋めない（埋めるなら厳密に）

ステ上昇・好感度は `web/js/game.js` の `parseTextCue()` が**台詞テキストを正規表現で読んで**発火する（`/(技術|センス|根性|魅力|洞察|好感度)/` ＋「上がった／少し上がった／大きく上がった」）。これは台詞を書き換えると報酬が黙って壊れる／重複する温床。

- 報酬を確実にしたいイベントは、地の文頼みにせず `type:"apply"` か metadata で明示的に付ける。
- 台詞で報酬を表すときは**規定の言い回しを厳守**: `……【技術】と【センス】が上がった。`（1〜2pt=少し上がった／3〜4pt=上がった／5pt〜=大きく上がった）。
- 報酬目的でない地の文に、ステ名（技術/センス/根性/魅力/洞察）＋「上がった」を**偶然並べない**（誤発火する）。

### 4. 編集後セルフチェック（毎回）

台詞・設定を触ったら、コミット前に最低これを確認:

```bash
# 1) 構造リンタ（禁止語・話者ID実在・手動改行・行長・報酬キューを一括検査）
python3 tools/lint_dialogue.py            # ERROR が出たら直す（exit 1）。WARN は気付き用
python3 tools/lint_dialogue.py ch1_main   # 触ったファイルだけ部分一致で
# 2) JSONが壊れていないか＆web再生成
python3 -m json.tool data/dialogue/<触ったファイル> >/dev/null && python3 web/build_data.py
# 3) ヘッドレステスト（該当章）
```

- `tools/lint_dialogue.py` の **ERROR**（旧名・旧設定の混入／未登録 speaker／壊れた JSON）は**必ず0**にしてからコミット。
- **WARN**（手動 `\n`／全角48字超／報酬キュー）は崩れ・誤発火の温床。新規追加では出さない方針。既存の WARN（`lover_events.json` 等の手動改行）は崩れ報告が出た箇所から撤去する。

### 5. モデル差（Fable→Opus）で崩れが増える理由と対策

旧 Fable で出なかった崩れが Opus で出やすいのは、モデルの**文体傾向**が構造の弱点を突くため。性質を理解して打ち消す:

- **Opus は一文が長く・装飾的になりがち** → 全角24字の `WRAP_LIMIT` を超えやすく、自動改ページで文が割れる。**対策**: 編集時に「1台詞は全角48字以内・周囲の台詞と同じ短さで」と明示し、書いたら autoWrap 換算で字数を確認する。
- **Opus は文章を「良くしようと」言い換える** → canon の固有名詞・言い回しから逸れて矛盾・旧名復活が起きる。**対策**: 設定・固有名詞は**創作せず正本からそのまま写す**。迷ったら本節の正本表を引く。地の文の報酬表現は規定フレーズを一字一句変えない。
- **Opus は広い文脈を取り込み、古いファイルまで“正”として混ぜる** → `brand/brand` 等の旧設定を拾って propagate する。**対策**: 参照は正本に限定（`review_scope.md` のコアでも旧 brand ファイルは除外）。読み込む前に「どれが正本か」を本節で確定させる。
- 結論: 解決は「Fable に戻す」ではなく**構造を頑健にする**こと（1〜4）。正本を1つにし、改行をコードに寄せ、報酬を構造化し、コミット前 grep を必ず通せば、どのモデルでも崩れにくい。
