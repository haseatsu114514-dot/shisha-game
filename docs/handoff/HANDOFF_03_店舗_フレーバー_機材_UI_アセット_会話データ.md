# 「煙の向こう側」(shisha-game) 引き継ぎ資料
## Part 3 ─ 店舗 / フレーバー / 機材 / レシピ / 大会UI / アセット / 会話データ / ツール

> Part 1(キャラ・ストーリー)、Part 2(システム)に続く実データ編。リビルド時に「中身の物量と置き場所」を把握するための資料。

---

## 1. 店舗・スポット(マップ移動先)

章ごとに `map.gd` が出すスポットが変わる。会話は `data/dialogue/ch*_spots.json` に格納。

### 第1章(地方)
| スポット | 内容 | コスト |
|---|---|---|
| 自宅 / tonari | 拠点(バイト・練習) | 時間消費なし系 |
| ケムリクサ(なる) / Eden(アダム) / ぺぱーみんと(みんと) | ライバル店訪問 | 3,000円+行動1、1日1回 |
| Dr.Hookah(ショップ) | 機材・フレーバー購入 | 入店3,500円・時間消費なし |
| チョイザップ | ジム(会員制) | 入会4,000円 |
| 観音 / 商店街 / テレビ塔公園 | 散策(キャラ遭遇イベントがある時のみ) | ─ |
| C.STATION | 大会会場の下見(`ch1_c_station_visit`/`_end`) | 2,000円 |
- 会話ID: `ch1_choizap_first` / `ch1_choizap_visit` / `ch1_kannon_visit` / `ch1_cafe_visit` / `ch1_c_station_visit` / `ch1_c_station_end`。

### 第2章(全国)
基本は第1章+全国大会のライバル(神崎竜二=`kumicho`、ヴォルク=`volk`)の店が追加(`_build_all_japan_spots`)。

### 第3章(東京)
- 会話ID: `ch3_tokyo_shisha`(東京のシーシャ店・味持ちの差を体感)、`ch3_mukai_visit`(姉妹店mukai)、`ch3_tokyo_sightseeing`(観光)、`ch3_mukai_tetsuko`(看板猫テツコ)、`ch3_return`(帰還)。

### 第4章(ドバイ)
- 会話ID: `ch4_dubai_souq`(スーク=市場・安い無名フレーバー入手)、`ch4_dubai_cafe`(路地裏カフェ=変装シェイク遭遇)、`ch4_return`。

---

## 2. フレーバー

### 現行データ(`data/flavors.json`・6種)
全て「アルファーヘブン」ブランド。各 `price=1550円`。特性値(`heat_tolerance`/`smoke_weight`/`steam_bias`)付き(Part2 §5参照)。

| id | 名前 | カテゴリ | heat_tol | smoke_wt | steam_bias |
|---|---|---|---|---|---|
| mint | AF ミント | cooling | 1.2 | 0.7 | -1.0 |
| double_apple | AF ダブルアップル | spice | 1.0 | 1.3 | +0.5 |
| blueberry | AF ブルーベリー | fruit | 0.9 | 1.0 | 0.0 |
| vanilla | AF バニラ | sweet | 0.8 | 1.1 | +0.3 |
| pineapple | AF パイナップル | fruit | 1.1 | 0.9 | -0.3 |
| coconut | AF ココナッツ | sweet | 0.85 | 1.2 | +0.6 |

### 計画中の全フレーバー(`docs/planned_flavors_list.md`・約55〜60種)
章進行で解禁していく想定。ジャンルバランス: フルーツ13 / 清涼10 / スパイス10 / フローラル9 / スイーツ10 / ティー3。

- **フルーツ(13)**: グレープ, ピーチ, オレンジ, レモン, スイカ, マンゴー, ブルーベリー / グアバ⭐, ドラゴンフルーツ⭐, キウイ, メロン, バナナ, ライチ⭐
- **清涼(10)**: ミント⭐, クールミント⭐, トワイスアイス⭐, ペパーミントシェイク⭐ / アイスグレープ⭐, アイスレモン⭐, デスバイアイス⭐ / ブルーベリーミント⭐, フローズンシトラス, フローズンベリー
- **スパイス(10)**: ダブルアップル⭐, カルダモン⭐, シナモン, クローブ, バジル, アニス⭐, リコリス⭐, ナツメグ, ブラックペッパー⭐, ジンジャー⭐
- **フローラル(9)**: ローズ⭐, ラベンダー⭐, ジャスミン⭐, カモミール / 桜⭐, リリー, ホワイトローズ, バイオレットローズ, ガーデニア⭐
- **スイーツ(10)**: チョコレート, ダークチョコレート, キャラメル, バニラ / カプチーノ⭐, コーヒー⭐, エスプレッソ⭐, ヘーゼルナッツ / コットンキャンディ, ポップコーン
- **ティー(3)**: アールグレイ⭐, ブラックティー, レモンティー

> 解禁設計の目安(ミニゲーム計画書より): Ch1=6種程度 / Ch2=フローラル・ティー解禁で15〜20種 / Ch3=スパイス上位(カルダモン・アニス等) / Ch4=全種(約55)。
> ⭐ はキャラの推しフレーバーと紐づく重要フレーバー(Part1のキャラ別推しと突き合わせ)。

---

## 3. 機材(`data/equipment.json`)

各機材は `chapter_min`(解禁章)・`buy_price`/`sell_price` 付き。スロットは bowl / hms / charcoal(+pipe)。

| id | 種別 | 名前 | 解禁 | 購入 | メモ |
|---|---|---|---|---|---|
| silicone_bowl | bowl | シリコンボウル | 1 | 1,000 | 初期装備・扱いやすい |
| hagal_80beat | bowl | 80beatハガル | 1 | 4,000 | 癖が少ない |
| suyaki_hagal | bowl | 素焼きハガル | 1 | 1,000 | 同じ味で育つ(value=`suyaki`) |
| lotos_hagal | hms | ロートスハガル | 1 | 1,500 | 初期装備・立ち上がり早い |
| tanukish_lid | hms | タヌキッシュリッド | 1 | 2,000 | 素焼きには使えない(相性NG) |
| amaburst_hms | hms | アマバースト | 1 | 1,500 | 素焼き可・高火力(value=`amaburst`) |
| flat_charcoal | charcoal | フラット炭 | 1 | 600 | 安定・有効範囲広い |
| cube_charcoal | charcoal | キューブ炭 | 1 | 1,000 | 高火力・有効範囲狭い(チキンレース) |
| winkwink_hagal | hms | winkwinkハガル | 2 | 3,000 | 大きいハガル向け・熱持ち良いが入りづらい |
| suyaki_minto | bowl | 育った素焼き(ミント) | 99(特殊) | 5,000 | みんと由来・ミント特化加点 |
| suyaki_adam | bowl | 育った素焼き(Wアップル) | 99(特殊) | 5,000 | アダム由来・ダブルアップル特化加点 |
| suyaki_naru | bowl | 育った素焼き(バニラ) | 99(特殊) | 5,000 | なる由来・バニラ特化加点 |

- `chapter_min: 99` のキャラ素焼きは通常ショップに並ばない特殊入手枠(イベント報酬想定)。
- 相性NG: 素焼き(`suyaki`)×タヌキッシュリッド(`tanukish_lid`)。
- ⚠️ ID表記ゆれ: データは `suyaki_hagal`/`amaburst_hms` だが `value` は `suyaki`/`amaburst`。コードのレガシーマップ(Part2 §4)で吸収済み。リビルドは `value` 側のIDで統一推奨。

---

## 4. レシピ / NGミックス

| データ | 件数 | 用途 |
|---|---|---|
| `data/recipes.json` | 8件 | 教わる/隠しレシピ(キャラ交流で習得→大会加点+専用プレゼン手札) |
| `data/secret_recipes.json` | 6件 | 隠しレシピ追加分 |
| `data/ng_mixes.json` | 6件 | 本当にまずい組み合わせ(ペナルティ) |

- 構造・思想はPart2 §5(味スコアの3層構造、`ratio_tolerance`、キャラ紐付け)を参照。

---

## 5. 大会パートのグラフィック刷新構想(`docs/tournament_graphics_redesign.md`)

### コンセプト「中継カメラが回り始める」
日常パート=ヴァルハラ風ピクセルアート(始の日常目線)。**大会突入で画面の質感が一変**し、テレビ中継のような緊張感・高揚感を絵で伝える。

### 美術方向「ダンガンロンパ × ペルソナ × ディバインゲート × 海外Hookah Battle」
- **色**: ネオンマゼンタ/ホットピンク(主アクセント)、エレクトリックパープル(背景・煙)、シアン/エレクトリックブルー(副)、ディープブラック/ダークネイビー(ベース)、ネオングリーン(キャラ固有)、ゴールド(勝利・スコア限定)、白スポットライト。**暖色・ローズゴールドは使わない**。
- **ライティング**: スポットライト/レーザー/ネオン管の硬質な光。背後からキャラ固有色のバックライト。
- **演出**: スモークパーティクル、画面分割トランジション、キャラ紹介カットイン、総攻撃風の決め画面。

### 二重画風の方針
| 要素 | 日常(現行) | 大会(新) |
|---|---|---|
| 画風 | ヴァルハラ風ドット | ダンロン/ペルソナ風ハイコントラスト・アニメ絵 |
| フィルタ | nearest(ドット感) | linear(滑らか) |
| フォント | DotGothic16 | ゴシック系(Noto Sans JP Bold等) |
| ライティング | 暖かいランプ光 | スポット・ネオン・レーザー |
| BGM | チル系 | EDM(`bgm_tournament_edm`) |
| UI | ADVテキストボックス | 実況中継風オーバーレイ |

### 大会キャラ4枠のデザイン雛形(固有ネオンカラー)
構想書ではサンプルイラスト準拠で4人の選手像を定義(Part1のヒロイン/ライバルと対応する想定)。
- Girl A 金髪ツインテ(ヒョウ柄・クマ型クリップ)= **ネオンピンク #ff2d78**(→アゲハ系)
- Girl B 茶髪パーカー(クール)= **エレクトリックパープル #8b5cf6**
- Girl C ミントグリーン三つ編み(清楚・底知れぬ実力)= **シアン #00e5ff**
- Girl D 黒髪小悪魔(ツノ・緑リボン)= **ネオングリーン #39ff14**(→みんとのコンカフェ姿系)

> ⚠️ この刷新はまだ「構想書」。現行の大会UIは別テーマ(`game_manager.gd` の「煙とスタイル」=ダークネイビー/アンバーゴールド)で動いている。大会だけ別パレットに切り替える設計にするか要判断。
> 🕒 **決定: 保留(2026-06時点)**。第1章の実装は**現行テーマのまま**進め、ネオン切替は後で判断する。ミニゲームはプレースホルダ(単色矩形)で作るので、画風確定前でもロジックは進められる。

---

## 6. アセット管理パイプライン

### 仕組み
- 実行時アセットは `assets/`(サブフォルダ: `audio` / `backgrounds` / `sprites` / `cgs` / `ui` / `fonts`)。ルート直下にUUID名のPNGが多数(生成画像の素置き)。
- **`assets_index.json`**: 機械可読のアセット索引(自動生成)。top keys = `summary` / `progress_sheet` / `lookups` / `assets`(124件) / `extra_files`(23件) / `duplicate_filenames` 等。
- **`アセット差し替え進捗管理表.csv`**(96行): 列 = AI判断 / 人間判断 / カテゴリ / ディレクトリ / ファイル名 / 用途 / ステータス / 担当者 / 備考。AI差し替え分と人間レビュー分を追跡。
- `assets/IMAGE_ASSET_REPORT.md` に画像アセットのレポート。

### 再生成
```bash
python3 tools/update_assets_index.py   # assets/ と進捗CSVを突き合わせて索引を再生成
```
索引は「未追跡の実行ファイル」「ファイル欠損のCSV行」も検出する(README参照)。

### 運用の勘所
- 画像は外部生成(Midjourney/DALL-E/ChatGPT等。ファイル名に `ChatGPT Image …` の痕跡あり)→ `assets/` に置き → 索引更新、の流れ。
- UUID名のままだと用途が分からなくなるので、**進捗CSVで用途を管理**するのが前提設計。リビルド時もこのCSV+索引の運用を踏襲すると破綻しにくい。

---

## 7. 会話データ(`data/dialogue/`)の章別構成

スキーマはPart2 §13/CLAUDE.md参照(`dialogues[].dialogue_id` + `lines[]` + `branches`、`speaker`=characters.jsonのid一致必須)。

| ファイル | 行数 | 内容 |
|---|---|---|
| ch1_main.json | 927 | 第1章 本編 |
| ch1_tournament.json | 848 | 第1章 大会 |
| ch1_sumi / tsumugi / minto / naru / adam / ageha | 643/696/570/468/468/107 | 第1章 キャラ別 |
| ch1_spots / events / interval | 343/213/293 | スポット・イベント・インターバル |
| ch2_main / rei / ageha / kumicho / volk | 241/805/598/138/142 | 第2章 |
| ch3_main / mukai / mashiro / spots / tsumugi | 889/268/172/193/86 | 第3章 |
| ch4_main / mashiro_dubai / spots | 394/117/75 | 第4章 |
| ch5_main | 108 | 第5章(SHISHA-9000) |
| confession.json | 607 | 告白(全ヒロイン) |
| ending.json | 708 | 分岐エンディング |
| dreams.json | 109 | 夢シーン(各章 early/main) |
| shop_event.json | 43 | ショップイベント |

- 物量の重心: **第1章が最も厚い**(main+tournament+各キャラで約5,000行超)。Ch2以降は本編がやや薄く、キャラ会話で厚みを出す構成。
- `confession` / `ending` が大きい = 恋愛分岐の物量がここに集中。

---

## 8. 開発支援ツール(`tools/`)

| ツール | 用途 |
|---|---|
| `dialogue_editor.py` / `edit_dialogue.command` | 会話データ(JSON)編集 |
| `apply_character_placeholders.py` | キャラのプレースホルダ画像適用 |
| `generate_dummy_images.py` | ダミー画像生成(未差し替え枠の穴埋め) |
| `normalize_sprites.py` / `sprite_face_swap.py` | スプライト正規化・表情差し替え |
| `update_assets_index.py` | アセット索引の再生成 |
| `check_git_safety.sh` / `enable_git_hooks.sh` | Git安全装置(正規チェックアウト確認・フック有効化) |

> Git運用ルール(README/CLAUDE.md): `project.godot` のあるルートで作業 / `origin/main` からブランチ / `main`直push・force・`--allow-unrelated-histories` 禁止 / 作業前に `check_git_safety.sh`。

---

## 9. 3部通しての「リビルド前 確認チェックリスト」

1. Part1 §6 の名前確定(アダム=吾妻大夢/Eden、みんと=緑川栞、シェイク=ガリヤーン 等)をコード・会話データへ反映。
2. Part2 §14 の要注意(みんと旧名「眠都/みんちゃん」のコード残存、`ROMANCE_CANDIDATES`にましろ未登録、採点見直し)を判断。
3. 機材IDを `value` 側(`suyaki`/`amaburst`)に統一。
4. フレーバー解禁スケジュール(本書§2)を確定。
5. 大会UIを別パレットに切り替えるか(本書§5 構想 vs 現行テーマ)を判断。
6. アセットは「外部生成→assets/→`update_assets_index.py`→進捗CSV」の運用を維持。
