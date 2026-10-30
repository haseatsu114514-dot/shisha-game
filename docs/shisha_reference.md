# シーシャ描写の参考資料（台詞・地の文・画像の共通入口）

シーシャの工程・機材・葉・温度・用語を書く／描くときに、どこを見ればよいかの一覧。**数値と機材の説明は `data/*.json` と `remake/js` が正**で、`docs/archive/setting_book/` は二次資料（2026-10-30 に主な誤りは直したが、食い違えば `data/` を優先）。`docs/archive/` は履歴で根拠にしない。

## 0. 書く前の原則

- 固有名詞・数値は創作せず、下の正本から写す。迷ったら `docs/gameplay_agent_reference.md`「シーシャ屋の文化・共通ルール」が最上位。
- 実在ブランド名（Al Fakher、Fumari 等）は出さない。作中のメーカーは **アルファーヘブン・ドバジ・アフサール・フォースフェクタ・フワリ・ナイトサイド** の6社（`data/flavors.json`・全77銘柄）。
- 用語は **HMD**（HMSと書かない）、**タヌキッシュリッド**（ターキッシュと書かない）、**ハガル（ボウル）**、地の文・台詞では「煙」。旧名・旧ステータス名・禁止表現（「DA」略記など）は `tools/check_legacy_terms.py`・`tools/lint_dialogue.py` が検査する。
- 旧設定（プレゼン／FLAVOR TRIAL、5能力以外の旧ステータス名、旧キャラ名）を混ぜない。

## 1. 健康・物理の説明（オーナー確定）

| 項目 | 正本 |
|---|---|
| 水の役割は「煙を冷やして吸いやすくする」だけ。有害物質への影響は「諸説ある」と言い、濾過・除去と断定しない。爆煙は「グリセリンと熱の仕事」 | `docs/gameplay_agent_reference.md`「水と煙の説明」、台詞 `data/dialogue/ch1_sumi.json`、図解 `remake/js/vn/shisha-diagram.js`、`docs/owner_requests.md` K14（#1113 / #1128） |
| 煙の正体（グリセリンと水分が熱で気化）・ブロンド／ダークリーフ・シガーリーフの用語集（プレイヤーにも見える） | `data/glossary.json` |
| ニコチンの言い方の例（「ニコチンは入っています。無理せずどうぞ」） | `data/baito_events.json` |
| 誇張した数値（博士の「0.5秒」）はキャラの持ちネタとして残す。実測めいた数値を増やす提案は未決定 | `docs/gameplay_agent_reference.md`「数値の精度」 |

## 2. 店の文化・接客・葉の規範（台詞向け）

- `docs/gameplay_agent_reference.md`: **シーシャ屋の文化・共通ルール**（ミントの好み、蒸らし時間、炭の三角配置、お任せ注文、吸い出し、詰める量、ダブルアップルの正史）、**接客・金銭の規範**（チップなし等）、**リーフ（葉）の規範**、**シガー用語の注意**、**ストーリー監査後の固定事項（2026-10-18）**。
- 年齢確認・来店の流れ・店ごとの個性は `brand/story_and_structure.md`「はじめと店の人たち」、`brand/character_profiles.md`、`docs/asset_ai_guidance.md`「店ごとの個性と照明」。
- 各キャラの味の話（温度帯でどう味が変わるか、#1108）は `data/dialogue/ch1_naru.json`・`ch1_minto.json`・`ch1_adam.json`・`ch2_kumicho.json`・`ch2_rei.json`・`ch3_rivals.json`・`ch3_mashiro.json`。まとめ読みは `docs/archive/setting_book/06_flavors_recipes.md`（二次資料）。
- 好きなフレーバーは `data/characters.json` の `favorite_flavor`（サメちゃんは `data/dialogue/samechan.json` の `profile`）。

## 3. 制作工程と数値（ゲームの実装）

| 工程 | 正本 |
|---|---|
| 工程の順番（準備→配合→パッキング→水入れ→穴あけ→炭→蒸らし→吸い出し→提供→調整2回→審査、5工程各20%） | `docs/master_spec.md` 冒頭の最新節と「本書の読み方」、`remake/README.md`「第1章の流れ」 |
| 蒸らしタイマー（分1分・秒10秒刻み、上限10分、00:00では開始不可、通常5〜8分） | `remake/README.md`、`data/glossary.json`、`docs/owner_requests.md` GP21〜26 |
| 水入れ（開始水量0から適正ラインまで注ぐ） | `remake/js/craft/water-pour.js`、`docs/owner_requests.md` #1081 E01 |
| 穴あけテンプレート（外12・中8・内4。ロートスHMDはアルミを張らず穴工程を飛ばす） | `remake/js/craft/holes_logic.js`、`holes_templates.js` |
| 炭（フラット／キューブ、三角3個が基本、4個・混合は解放フラグ） | `data/equipment.json`、`docs/gameplay_agent_reference.md`「炭の配置」 |
| 温度帯の表情・熟練度・適温の見せ方（陽炎・虹背景は過熱側の演出） | `docs/master_spec.md` 2026-10-26 の節、`remake/js/craft/thermal.js`、`remake/js/craft/temperature-model.js` |
| 機材の容量・価格・一言説明（シリコン12g／80beat 15g／素焼き20g、HMD、炭、パイプ、専用ハガル） | `data/equipment.json` |
| フレーバー・レシピ・裏レシピ・NGミックス | `data/flavors.json`、`data/recipes.json`、`data/secret_recipes.json`、`data/ng_mixes.json` |
| 家シーシャ・まかない練習・熟練度 | `docs/master_spec.md` 2026-10-26 の節、`remake/README.md` 同節 |

## 4. 画像・CG（機材の形と構造）

- **入口は1つ**: `asset_sources/shisha-hardware-reference/drawing-sheet/README.md`（生成前の構成メモ・貼る文・QAチェックリスト・詳細資料の索引）。`docs/asset_ai_guidance.md` から同じ場所へ飛ぶ。
- 部位名と空気の流れ（台詞で仕組みを説明するときも使う）: `asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md`。
- ボウル内部・アルミ・炭の置き方・HMDの種類: `bowl-interiors-foil-coal-placement-20261009.md`。
- ホース・吸い口・マイチップ: `hose-and-mouthpieces-20261009.md`、`mouthpiece-handle-skins-20261009.md`。
- ヒロインCGの必須ルール（HMD必須・直炭なし・炭は2〜3個）: `heroine-title-cg-rules-20261009.md`。
- 生成でよくある構造ミスと実例: `ai-generation-structural-pitfalls.md`、`ng-examples/README.md`、`visual-qa-necklace-hose-20261009.md`。
- フレーバー保管（小さなタブ、客からは見えない）・炭の個数: `docs/asset_ai_guidance.md`、`flavor-storage-tubs-issue396/README.md`。
- 炭の個数は、**画像（HMD内）は通常2〜3個・4個は稀**、**制作工程（アルミ上）は三角3個が基本**。場面に合わせて使い分ける。

## 5. 未決定・注意

- ダークリーフ（ナイトサイド等）のパッキング・アルミ工程は接続中（#1126）。確定するまで台詞で手順を断定しない。
- 実測めいた数値の扱い（`docs/reports/issue1107-*`・`issue1081-e06`）はオーナー未決定。
- `docs/archive/setting_book/` の人物の一人称・呼称表、店舗説明は全件照合が未了（同README参照）。
