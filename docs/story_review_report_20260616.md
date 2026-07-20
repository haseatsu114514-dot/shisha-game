# ストーリー整合性レビュー 統合レポート（2026-06-16）

全 dialogue JSON（33ファイル）+ data JSON + brand 設定を5並列で走査した結果。

---

## A. 矛盾・破綻 — ERROR（即修正が必要: 13件）

| # | ファイル | 箇所 | 内容 | 修正案 |
|---|---|---|---|---|
| E1 | `ch1_ageha.json` | `ch1_ageha_encounter` | speaker=`ageha` → 表示名が「あげは」になり正体バレ。ch1では「謎のギャル」のはず | speaker を匿名ID（`mystery_girl`等）に変更 |
| E2 | `ch1_minto.json` | `ch1_minto_fifth` | お姉さん＝みんとの正体が**ch1中に明かされる**（「やっと、気づいた？」）。CLAUDE.md「ch1では正体を明かさない」に違反 | ch2に移動、またはヒント止まりに軟化（確認台詞を削除） |
| E3 | `ch3_main.json` | `ch3_tournament_day` | **REIの一人称がch2「俺」→ch3「ボク」に変化**。ch2で積み上げたシャイなキャラがch3で「圧倒的カリスマ」に別人化 | ch3でもREIは無口＋「俺」。台詞は煙で語らせる |
| E4 | `ch3_mukai.json` | `ch3_mukai_intro` | 未登録speaker `customer`（9箇所） | characters.jsonに追加 or ナレーション（speaker=""）に変更 |
| E5 | `ch4_main.json` | `ch4_ending` line 470 | スミさんの大会が「**日本大会**の準優勝者」→正しくは「**世界大会（HAZE: GRAND SMOKE）**」 | 「世界大会」に修正 |
| E6 | `dreams.json` | `ch3_dream` line 236 | 未登録speaker `old_man` | characters.jsonに登録 or speaker="" |
| E7 | `shop_event.json` | `first_visit` | 未登録speaker `shop_clerk`（7箇所） | 同上 |
| E8 | `ending.json` | `ending_start` line 17 | 未登録speaker `everyone` | ナレーション or 登録 |
| E9 | `ch1_spots.json` | `cs_staff_greeting` 等 | 未登録speaker `staff_choizap`, `old_man`（engine.jsのSPEAKER_NAMESにはあるがcharacters.jsonにない） | characters.jsonにmobエントリ追加 |
| E10 | `secret_recipes.json` | line 123 | 旧ステ名「**度胸**」がeffectフィールドに残存 | → 根性 |
| E11 | `secret_recipes.json` | line 152 | 旧ステ名「**味覚**」がeffectフィールドに残存 | → センス |
| E12 | `baito_events.json` | `baito_trouble_01` line 79 | 「**ポチ袋を差し出してくれた**」→ チップ文化禁止に違反 | → 「頷いてくれた」等に修正 |
| E13 | `data/characters.json` | 全体 | **`oneesan`がcharacters.jsonに未登録**。dialogue側はspeaker="oneesan"で参照している | エントリ追加（id: oneesan, name: お姉さん） |

---

## B. 矛盾・破綻 — WARN（要確認: 20件）

| # | ファイル | 箇所 | 内容 |
|---|---|---|---|
| W1 | `ch1_tournament.json` | `ch1_tournament_opening` | 「敗者復活なんて甘い救済はナシ！」— 否定文脈だが禁止語そのもの |
| W2 | `ch1_events.json` | `outing_minto_1` | 報酬テキストが非標準（`気がする`付き・【】なし）→ parseTextCue二重発火の恐れ |
| W3 | `ch1_spots.json` | `ch1_kannon_visit` | 同上（`気がする`・`──`プレフィックス） |
| W4 | `ch1_spots.json` | `ch1_c_station_visit` | 報酬キューが地の文に混在。編集で壊れやすい |
| W5 | `ch1_minto.json` | `ch1_minto_phantom_smell` | growth_stats charm=2（少し上がった）なのにテキストは「上がった」 |
| W6 | `ch1_minto.json` | `ch1_minto_fifth` | 同上 insight=2 |
| W7 | `ch1_adam.json` | `ch1_adam_group_soutoку` | dialogue_idにキリル文字混入（`ку`）→ ASCII `ku` に |
| W8 | `ch1_tournament.json` | line 161 | パッキーの台詞が48文字超 → 自動改ページで切れる |
| W9 | `ch2_main.json` / `ch2_ageha.json` | 複数箇所 | 「味覚」を日常語として使用。リンタ誤検出の可能性。「舌」等に言い換え推奨 |
| W10 | `ch3_mashiro.json` 等 | 複数 | 報酬テキストに前置きが付く（「ましろとの特訓で、【技術】と〜」）→ 非標準 |
| W11 | `ch3_main.json` 等 | 3箇所 | ましろ初対面シーンが3つ存在（フラグ排他制御なし） |
| W12 | `ch3_main.json` | `ch3_tournament_day` | スティーブの設定矛盾: ch2「低温繊細」→ ch3「爆煙エンターテイナー」 |
| W13 | `ch4_main.json` | 全体 | ch4の勝利シーシャが**和風として描写されていない**（canon違反） |
| W14 | `ch5_main.json` | 全体 | **ch5がほぼ未実装**（EN:CODE回収・9000戦・博士過去・サラリーマン最終シーンなし） |
| W15 | `lover_events.json` | mashiro lv1-5 | テキストキュー＋apply で**報酬二重発火**（全5イベント） |
| W16 | `baito_events.json` | `baito_mob_insta` | 「そっとしておく」選択で報酬ゼロ（全イベント報酬必須ルール違反） |
| W17 | `baito_events.json` | 3箇所 | 誤字:「嫁しそう→嬉しそう」「染→絵」「慈てて→慌てて」 |
| W18 | `baito_events.json` | `baito_settings` | base_pay global=6000 vs event=8000 不整合 |
| W19 | `flavors.json` | `mango` | stats/ng_flavors フィールド欠落 |
| W20 | `flavors.json` | 全エントリ | stats が全フレーバーで同一値（プレースホルダ） |

---

## C. 未実装の重要コンテンツ（ストーリー構造分析より）

| 優先度 | 内容 | 現状 |
|---|---|---|
| ★★★ | **ch5 EN:CODE意味回収**（煙を作る＝エンコード、吸う＝デコード、AIの煙＝宛先のない煙） | design docのみ。台詞なし |
| ★★★ | **ch5 SHISHA-9000戦＋博士の過去**（味覚を失った元職人。はじめの鏡像） | ch5_openingのみ。戦闘・回収なし |
| ★★★ | **ch5 サラリーマン最終シーン**（新人の煙を褒める→はじめ笑う。全編の構造的ブックエンド） | 未実装 |
| ★★☆ | **ch4 なるとの再戦**（design docで「最高の感情的瞬間」指定）| `ch4_semifinal` に数行のみ |
| ★★☆ | **ch4 シェイクの変装3回遭遇**（カフェ・裏路地・大会前夜） | `ch4_opening` に軽く触れるだけ |
| ★★☆ | **ch4 和風シーシャの制作・描写** | 一切なし（canonルール違反） |
| ★★☆ | **ch5 ダブルアップル単体勝負**（ch3事件の贖罪） | 未実装 |
| ★★☆ | **スミさんの継承モットー「技を盗め。でも誰から盗んだか忘れるな」** | design docにあるが台詞に未実装 |
| ★☆☆ | **ch4「ジャケットの匂い」シーン**（店の匂いモチーフの着地） | design docのみ |
| ★☆☆ | **ch4 スミのスケッチブック発見**（パッキーのマスコット画） | design docのみ |
| ★☆☆ | **ヒロイン個別ドバイファイル** (tsumugi/minto/rin) | ageha/mashiroのみ存在 |
| ★☆☆ | **凛の味覚低下察知シーン**（「今日のフレーバーノート、嘘ついてるでしょ」） | character profileにあるが台詞なし |

---

## D. ストーリー魅力向上 — 最優先の提案（16件から厳選）

### 1. 感情ピーク強化

| # | 箇所 | 提案 | 効果 |
|---|---|---|---|
| D1 | ch3 味覚回復 | DA事件→回復の間に**中間シーン2-3本追加**。①温度だけ分かる ②果物を1つ間違える ③ましろが先に笑う（気づいてた） | 「おかえり」の感動が何倍にもなる |
| D2 | ch2 孤立 | 仲間離脱の間に**スマホ確認インタースティシャル**を挟む。未読5→4→3→0 | 機械的な数字の減少が孤独を可視化 |
| D3 | ch1 大会後 | 勝利後シーンを2-3分割（①壇上 ②廊下 ③tonariでスミの冷水） | スミの対峙に十分な静けさを確保 |

### 2. キャラクター深掘り

| # | 箇所 | 提案 | 効果 |
|---|---|---|---|
| D4 | ch1 アダム | **DA練習を黙って見つめるシーン追加**。何時間も同じ味を調整し続ける姿。はじめ「俺にはあれはできない」 | ch5 DA勝負の種まき |
| D5 | ch1 なる | 交友前に**客のトラブルをさりげなく助けるシーン**追加 | 知識自慢だけでない人格者の厚みが出る |
| D6 | ch2 アゲハ | **手が震えるシーン**追加。はじめが気づく→笑って誤魔化す | ch4ドバイ告白の伏線。隠し持つ脆さの種 |
| D7 | ch1 REIカメオ | もう少し**印象的な振る舞い**を追加（注文の仕方が独特、音楽の話が一言） | ch2で正体判明時の「あの人か！」体験 |

### 3. 伏線・モチーフ回収

| # | 箇所 | 提案 | 効果 |
|---|---|---|---|
| D8 | ch1 スミ | **「技を盗め。でも誰から盗んだか忘れるな」** を師匠の台詞として実装 | 3部構成の継承テーマ（ch1→ch2借用vs窃盗→ch5 DA勝負）の第1拍 |
| D9 | ch1 C.STATION | 南雲がはじめに**一瞬目を合わせる**描写追加 | 大会で投票する伏線。「あの時の若者」 |
| D10 | ch2 神崎 | **部下がムカイに行って青ざめて帰ってくる**エピソード追加 | シガーマン噂チェーンのch2ブリッジ |

### 4. 選択肢・プレイヤー体験

| # | 箇所 | 提案 | 効果 |
|---|---|---|---|
| D11 | ch1 交友イベント | 各アウティングに**1つ選択肢を追加**（結果は同じでも） | プレイヤーの関与感が上がる |
| D12 | ch1 最終夜 | talk_self / practice にも**報酬を追加**（洞察 / 技術） | 全行動報酬ルールの遵守 |

---

## E. 評価の高かったシーン（触らないこと）

| シーン | ファイル | 評価 |
|---|---|---|
| ダブルアップル事件（「シトラスミント。ダブルアップル、一粒も入ってないよ」※旧設定当時の引用。現在はグレープが正・2026-07-20変更） | ch3_double_apple | ★★★★★ ゲーム全体のベストシーン |
| スミさんの沈黙（「あの顔の男に効いた言葉を、俺はひとつも知らねえ」） | ch2_sumi_silence | ★★★★★ ゲーム最良の台詞 |
| なるの対決（「技術は上がってる。──でもあれ、誰の煙だ？」） | ch2_naru_confrontation | ★★★★★ |
| アダムの距離（「俺の宇宙、いる？」） | ch2_adam_distance | ★★★★★ |
| ch1 大会後のつむぎ「濁ってた」＋採点表ダブルパンチ | ch1_tournament_after | ★★★★★ |
| ムカイでのシガーマン勘違いコメディ → ましろ正体バレ | ch3_mukai_intro | ★★★★☆ |
| アゲハのドバイ告白（1年遅れの観覧チケット） | ch4_ageha_dubai_girlfriend | ★★★★☆ |
| みんとの嘘電話（「嘘って育つの」） | ch3_minto_small_lies | ★★★★☆ |
