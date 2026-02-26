# shisha-game — CLAUDE.md

Godot 4 製シーシャ屋アドベンチャー＆シミュレーションゲーム。
プレイヤーはシーシャバイト青年「蒸野 始（むしの はじめ）」として、地方大会から世界大会を目指す。

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
| `scripts/autoload/` | GameManager, PlayerData, AfffinityManager 等 |
| `scripts/tournament/` | 大会スクリプト ch1〜ch4（各約3,000〜4,200行） |
| `scripts/daily/` | 日常パート（バイト・練習・マップ移動） |
| `scripts/ui/` | UIコンポーネント |
| `tools/` | dialogue_editor.py 等の開発支援スクリプト |

---

## 主人公

- **ID**: `hajime`
- **フルネーム**: 蒸野 始（むしの はじめ）
- **テーマ**: 「フラットさ」＝誰のスタイルも否定しない。違いをそのまま受け入れる力。
- ⚠️ 「客観視」「客を見る力」は**廃止済みの旧設定**。コード・セリフ・設定に使わないこと。

---

## ゲームデータの重要な仕様

### ステータス（5種類のみ）

`技術` / `センス` / `根性` / `魅力` / `洞察`

- ❌ `技術力` / `洞察力` / `メンタル` は存在しない（旧名・誤記）

### 大会名

- 第1章の地方大会: **SMOKE CROWN CUP**
- ❌ 「第12回 地方シーシャバトル」「地方予選」「県大会」は旧名・NG表現

### セリフ内のステータス上昇表記

`【技術】と【センス】が上がった……！` のように正式名を使うこと。

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
| `sumi` | 炭場 丈一郎 | 師匠 (tonari) |
| `naru` | 鳴切 亮太 | ライバル ch1 |
| `adam` | 吾妻 大夢 | ライバル ch1（ダブルアップル職人） |
| `minto` | 緑川 栞 | ライバル ch1（自称20歳・実年齢29歳） |
| `tsumugi` | 白木 つむぎ | ヒロイン ch1 (tonari 常連) |
| `salaryman` | サラリーマン | tonari 常連（ストーリー専用） |
| `kako` | かこ | tonari 常連ちょい役（FLデザイナー） |
| `rira` | りら | tonari 常連ちょい役 |
| `ageha` | 宵野 葉子 | ライバル ch2 |
| `kumicho` | 神崎 竜二 | ライバル ch2（シーシャ組長） |
| `rei` | 田中 健太 | ライバル ch2-3（V系） |
| `dr_kemuri` | 藤波 創 | ライバル ch2 |
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
| `chad` | チャド | ch4 関連 |
| `da_silva` | ダ・シルヴァ太陽 | ch4 関連 |

---

## 大きいファイルの注意

全文読み込みはトークンを多く消費します。必要な箇所のみ読んでください。

| ファイル | 行数 | 推奨アクセス方法 |
|---|---|---|
| `scripts/tournament/ch1_tournament.gd` | 4,261行 | 該当関数名で Grep してから部分読み取り |
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

## よく使うコマンド

```bash
python3 tools/dialogue_editor.py   # 会話データ編集
```

---

## 作業時の注意事項

- **キャラクターを追加・変更する場合**: `data/characters.json` の `id` と dialogue JSON の `speaker` を必ず一致させる
- **CG ID を指定する場合**: `cg_ch1_nagumo_smile` のように実在するキャラのIDを使う（例: `toki` は存在しない）
- **ステータス名**: 5種類のみ。変名・旧名は使わない
- **growth_stats.notes の書き方**: 「〇〇から学んだ」ではなく「いつの間にか△△が変わっていた」視点で書く
- **大会スクリプト ch2〜ch4 はほぼ同じ構造**（ch1 を参考にすれば足りることが多い）
- **「洞察が主人公の強み」は廃止済みの旧設定**。主人公のステータス初期値に偏りはない
- **「にしお」は「なる」の旧名**。コード・設定に残っていたら「なる」に置換すること

---

## シガー（cigar）用語の注意

本ゲームで「シガー」という言葉が出てきた場合、基本的には**葉巻そのものではなく「シガーリーフ（葉巻の葉っぱ）を使ったシーシャ」**のことを指す。「シガーマン」も葉巻職人ではなく、シガーリーフシーシャの凄腕職人。

---

## ヒロイン・好感度・修羅場システム

- **ヒロイン**: つむぎ・ましろ・みんと・アゲハの4人。「メインヒロイン」という枠組みは設けない。プレイヤーが好きなキャラを一番愛せる構成を目指す。
- **好感度**: 各ヒロインに5段階の好感度がある。好感度MAXになった時に「付き合う」か「友達のまま」の選択肢が出現する。
- **修羅場イベント**: 好感度MAXかつ「付き合っている」状態が2人以上の場合に発生する特別イベント。
- ❌ 「つむぎ・ましろがメインヒロイン」は旧設定

---

## キャラクター間クロスオーバー・噂システム

キャラクター同士がクロスオーバーした噂やストーリーを積極的に設計する。例:
- 南雲会長がシガーマンの噂を恐れている（実際にはましろ）
- ムカイさんがシガーマンと勘違いされている（本当のシガーマンはましろ）
- ドクター・ケムリの人体実験の噂が業界内で囁かれている
こうした世界観のクロスオーバーがゲーム性を深くする。
