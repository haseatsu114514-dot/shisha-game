# シーシャ描写の参考資料（台詞・地の文・画像の共通入口）

シーシャの工程・機材・葉・温度・用語を書く／描くときに、どこを見ればよいかの一覧。**数値と機材の説明は `data/*.json` と `remake/js` が正**。`docs/archive/` は履歴で根拠にしない。

## 0. 書く前の原則

- 固有名詞・数値は創作せず、下の正本から写す。迷ったら `docs/gameplay_agent_reference.md`「シーシャ屋の文化・共通ルール」が最上位。
- 実在ブランド名（Al Fakher、Fumari 等）は出さない。作中のメーカーは **アルファーヘブン・ドバジ・アフサール・フォースフェクタ・フワリ・ナイトサイド** の6社（`data/flavors.json`・全84銘柄）。
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
- 各キャラの味の話（温度帯でどう味が変わるか、#1108）は `data/dialogue/ch1_naru.json`・`ch1_minto.json`・`ch1_adam.json`・`ch2_kumicho.json`・`ch2_rei.json`・`ch3_rivals.json`・`ch3_mashiro.json`。
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
| フレーバー・レシピ・裏レシピ・NGミックス | `data/flavors.json`、`data/recipes.json`、`data/ng_mixes.json` |
| 家シーシャ・まかない練習・熟練度 | `docs/master_spec.md` 2026-10-26 の節、`remake/README.md` 同節 |

## 4. 画像生成の必須手順（機材の形と構造）

シーシャ台・ハガル・HMD・炭・ホースが写る画像を**生成・修正するときは、この節だけ読めば足りる**ようにしてある。Codexアプリで自分が直接生成するときも、人に渡すプロンプトを書くときも同じ手順。根拠・写真の出典は 4.6 の一覧。

### 4.0 参考写真と資料の置き場（非公開リポジトリ siryou）

参考写真と機材の資料は、**非公開リポジトリ [`haseatsu114514-dot/siryou`](https://github.com/haseatsu114514-dot/siryou) の `shisha-hardware-reference/`** に置いている（2026-11-02 にゲームのリポジトリから移した。各サイトの著作物の写真を、公開のゲームのリポジトリに入れないため）。PCでは、ゲームのリポジトリと同じ階層に clone する。

```bash
git clone https://github.com/haseatsu114514-dot/siryou ../siryou   # ゲームのリポジトリの中で実行
```

| 置き場（`../siryou/shisha-hardware-reference/` から） | 中身 | 使い方 |
|---|---|---|
| `web-refs/images/`（一覧は `web-refs/README.md`・`refs.json`） | **日本の店・機材の写真116枚**（内装29・ボウル28・HMD22・台19・炭8・手元7・ホース3）。日本のシーシャ店・通販・紹介記事から | 機材と内装の**見た目の基準**（§4.0.5） |
| `photos/`（一覧は `photos/README.md`） | Wikimedia Commons の自由ライセンス写真76枚。1枚を除き海外 | 部品の**構造・接続・縮尺・持ち方の確認だけ** |
| `*.webp`・`*.md`・`drawing-sheet/` | オーナーが 2026-10-09 に渡した写真50点・構造図3点の縮小一覧（1枚150px前後）と説明、早見表と構造図 | 縮小一覧は参照に使えない。説明と早見表は理解・検品用 |
| `flavor-storage-tubs-issue396/photos/` | オーナー提供で原本が残るタッパーの写真4枚 | フレーバー保管の描写 |

- 写真がある部位は、生成前に**実際に開いて見る**。生成ツールに参照画像を渡せるなら、早見表・構造図ではなく**写真**を渡す（図解を渡すと平板な図の見た目が絵に移る）。
- 日本の店で主流の機材を**オーナーが撮った写真**が入ったら、それを最優先にする（入れる場所は siryou）。
- 写真が無い部位は 4.1 の「正解」と 4.2 の文で描き、生成後チェックを厳しくする。
- ゲームのリポジトリの `asset_sources/shisha-hardware-reference/` に残っているのは、ゲームが使う**作業台の見た目のスキン候補**（`skin-candidates-issue374/`）と、タイトル候補の確認ツールが使う **NG例**（`ng-examples/`）と**タッパーのCG候補**（`flavor-storage-tubs-issue396/candidate/`）だけ。

### 4.0.5 日本のシーシャバーを基準にする（2026-11-02 オーナー方針）

オーナー「シーシャの画像は日本のシーシャバーのものを参照して。海外はあまり参照しない」「実際に店で使われているような機材がメイン」。

- **機材も内装も、今の日本のシーシャバーを基準にする。** 中東風の彫金の台、民族調の内装、路上の喫煙風景は、指定があるときの背景の飾りや「古い店」の演出に限る。
- **`photos/` の写真はほぼ海外**（日本で撮られたのは `stand-lounge-japan-01.jpg` の1枚だけ）。海外の写真は**部品の構造・接続・縮尺・持ち方・炭の大きさを確かめるときだけ**に使い、内装・服装・小物・台の装飾・街並みは写さない。生成ツールに渡すときもその目的に限る。
- 機材と内装の見た目は、下の表と **日本の店・機材の写真116枚**（siryou の [`web-refs/`](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/web-refs/README.md)）で決める。オーナーが日本の店で撮った写真が入ったら、それを最優先にする。

#### 日本の店の定番機材

| 部位 | 日本の店の定番（見た目） | 出典 |
|---|---|---|
| 台（ステム・ベース） | ロシア製ブランドが中心。**ステンレスの細いステム＋幅の広いガラスベース**、小さめの金属の受け皿。飾りは少ない。木のパーツを使う台もある | [Shisha Amigo](https://amigollc.co.jp/procurement/russian-shisha-pipe-brands/)、[CLOUD](https://cloud-jp.net/russia-pipe/) |
| HMD: ロータス型 | 日本の店で「ほぼ必ず見る」王道。正規の Kaloud Lotus と、似た形のノーブランドの両方が使われる。**シリコンボウルにぴったり載る**。蓋と取手のある低い金属の器で、炭は中に置き、蓋を閉めると炭は見えにくい | [EGG SHISHA（名古屋）](https://www.official-eggshisha.com/posts/best-shisha-hmd-devices-japan)、[ヒロインCGルール](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/heroine-title-cg-rules-20261009.md) |
| HMD: ターキッシュリッド | ロータスと並ぶ定番。**ボウルの口にかぶせて側面を囲う蓋のような形**。内径は通常約6.5cm、ジャンボ約7.9cm。80feet やアルパカ系の**浅い陶器ボウル**と組む | [EGG SHISHA](https://www.official-eggshisha.com/posts/best-shisha-hmd-devices-japan) |
| HMD: アマボースト（アマボ） | 近年よく名前が挙がる。**底も全体も薄い金属**で、直置きに近い高火力。アルミを敷いた上に載せて色々なボウルに合わせる。「**ソラリス×アマボ**」は日本の店の定番セット | [EGG SHISHA](https://www.official-eggshisha.com/posts/best-shisha-hmd-devices-japan) |
| ボウル: シリコン | 黒・赤・青などの丸いシリコンの器。ロータス型と組むのが定番 | [EGG SHISHA](https://www.official-eggshisha.com/posts/best-shisha-hmd-devices-japan)、[Dr.Shisha](https://drshisha.jp/products/silicone-bowl) |
| ボウル: ソラリス | ウクライナ製の手作り陶器。**厚みがあり少し大きく、背が低く、葉を盛る上面が平ら**。素焼き（赤茶）と釉薬（色付き）がある | [ASLAJ](https://www.aslaj.com/blog/2022/03/05/solaris/) |
| ボウル: 80feet 系 | 口が広く背の低い陶器。ターキッシュリッドと組む | [EGG SHISHA](https://www.official-eggshisha.com/posts/best-shisha-hmd-devices-japan) |

上の形の説明は記事の文章によるもの。記事の写真や商品写真は**リポジトリに保存せず**、生成の前にリンク先で見る（ロゴ・刻印・商品名は描かない）。

#### 日本のシーシャバーの内装（店ごとに1つ選ぶ）

- ソファ席・大きな窓・高い天井のブルックリン風
- 日本画や和柄を使った和風、追加料金の個室
- 白を基調にした明るいカフェ風（昼はカフェ、夜はバーの店が多い）
- ピンク基調などの写真映えする内装
- 木目とレンガの落ち着いた店
- ハンモック席・ゲーム席・半個室のある遊び心のある店
- 客は若い人・女性同士・友人同士が多く、スイーツ系のフレーバーが人気

出典: [Time Out 東京](https://www.timeout.jp/tokyo/ja/things-to-do/tokyo-shisha)、[RETRIP](https://rtrp.jp/articles/41958/)、[OKWAVE](https://media.okwave.jp/c212/p412/)。店ごとの決め方は `docs/asset_ai_guidance.md`「店ごとの個性と照明」に従い、同じ型を全店に繰り返さない。

#### ゲーム内の機材と、描くときの見た目

`data/equipment.json` の名前は実物のもじり。描くときは右の見た目に寄せる。
実物名（ロータス・ターキッシュリッド・アマボースト・ソラリスなど）は描写の資料にだけ使う。台詞・ゲーム内の文ではゲーム内の名前（ロートス・タヌキッシュリッド・アマバースト）を使う（§0）。

| ゲーム内の機材 | 日本の店での実物 | 見た目の要点 |
|---|---|---|
| シリコンボウル＋ロートスHMD（初期装備） | シリコンボウル＋ロータス型HMD（「シリコンロータス」） | 丸いシリコンの器に、取手付きの低い金属の蓋付きHMDが直接載る。アルミは無し。炭は中に2〜3個 |
| 80beatハガル＋タヌキッシュリッド | 80feet 系の陶器＋ターキッシュリッド（「80ターキッシュ」） | 口が広く背の低い陶器。その口にかぶせる蓋のような金属のHMD |
| 素焼きハガル＋アマバースト | ソラリス（素焼き）＋アマボースト（「ソラリス×アマボ」） | 厚みがあり背の低い赤茶の素焼き、上面は平ら。底の薄い金属のHMDをアルミの上に載せる |
| ハリーザムーン（真鍮パイプ） | 真鍮の伝統寄りのステム | 金色の金属ステム。装飾は控えめにし、ベースは透明ガラス |
| 家シーシャの卓上台 | 小型の卓上モデル（高さ30〜40cm） | 短いステムと小さなベース。ホースも短め |

- **HMDは必ずどれか1モデル**を選び、形を混ぜない。
- **セッティングの幅**を出すときは、台の色・ベースの形・ボウルの種類・HMDの型・ホースの色を組み合わせて変える。全部を同じ「黒いステム＋シリコン＋ロータス」にしない。

### 4.1 部位ごとの正解と、よく出る間違い

| 部位 | 正解 | よく出る間違い（1つでも出たら作り直し） |
|---|---|---|
| ベースと台の付け根 | ガラスのベースの口に、金属のステムが**ゴムのパッキン（またはねじ込み）で真っ直ぐ差さる**。ベースの水は下の方だけで、ステムの先端（ダウンステム）が数cm浸かる | ステムがベースの横腹から生える／ベース全体が水槽／ベースとステムが溶けて一体の花瓶／付け根に意味のない膨らみや二重の口 |
| ステムと受け皿 | 縦1本の金属棒。**受け皿はステム上部**（ハガルのすぐ下）に水平に付く。ステム側面の下寄りに**ホースポート**（1〜2個）、それとは別に小さな**パージ弁** | 受け皿がベース近くや中央にある／受け皿が2枚／ポートとパージ弁を同じ穴にする／ステムが途中で分岐 |
| ハガル（ボウル） | 陶器の器＋**細い脚**。脚がステム先端の小さな金属ポストに**ゴムを介して**載る。口径は大人の掌の幅くらい | 脚が無い・短く潰れる／受け皿と一体化／口径が受け皿並みに巨大／**ハガル未装着の制作画面**なのにボウル・HMD・炭を描く（未装着時は**小さな凸型の金属ポスト**だけ） |
| アルミ | 制作の「詰める→アルミ→穴あけ」の段階だけ。ハガルの口に**平らに張って縁で折り込む**。穴は小さく規則的 | 袋状・布状／完成絵で炭をアルミに直接載せた「直炭」／アルミとHMDを同時に主役にする |
| HMD（ヒートマネジメント） | ハガルの口の上に載る**別部品の低い金属の器**。径はハガルの口と同じくらい、高さは指2本分。蓋・取手・通気口は**1つのモデルで統一** | 台の最上部に浮く／蓋だけ別モデル／煙突・網・取手の寄せ集め／ハガルと融合／受け皿並みに大きい |
| 炭 | **指先ほどの小さな角炭**。表面は灰色の灰、割れ目に少し赤。炎は出ない。完成・喫煙状態は**HMDの中に2〜3個**、制作工程は**アルミの上に三角3個** | 燃える炎／赤い岩／5個以上／HMDの外に転がる／炭から煙が出る |
| ホース | **1本だけ**。ステム側面のポートから出て、重力でたわみ、**硬いハンドル**の根元につながる。ハンドルの先に吸い口 | Y字分岐・3つ目の端／途中で消える・浮く／ボウル・皿・ベースの底から生える／人物を囲む大きな輪／ハンドル無しでホースが直接口に入る |
| ハンドル（ホースの持ち手） | ホースの先に付く**硬い筒**。長さは手のひら1.5〜2個分、ホース側が太く吸い口側がやや細い。木・金属・樹脂。ホースとの境目に金具（ホースアダプター）。指で握って口元へ運ぶ | ハンドルが無くホースを直接くわえる／ホースと同じ太さの柔らかい筒／煙管やタバコのフィルターのような形／ホースとの境目が溶けて一体 |
| 吸い口・マイチップ | **使い捨てチップ**はハンドル先端に差す短い樹脂の筒（指2本分の長さ、色付き半透明が多い）。**首掛けマイチップ**は小さな吸い口本体（指1〜2本分）＋チェーンで、使用中はハンドルの先端に装着 | チェーンだけ／棒飾りだけ／チップをハンドルの大きさに巨大化／チップが指より長い／首のチェーンが煙の通る管につながる |
| 煙 | **人物の口元**から出て広がる | HMD・ホースの根元・チェーンから常時噴出 |
| 縮尺 | ハガルの口 ≒ HMD ≦ 掌の幅、受け皿はHMDの約2.5倍、炭は指先。ハガル＋HMD＋炭を重ねても台全体の約1/6〜1/7・人物の顔の半分くらい。手持ちの物は手と同じ奥行き（数値と測り方は §4.1.1） | カメラへ突き出した巨大ボウル／小さな受け皿に大きなHMD／ハガルの脚が潰れている／ハガルが人物の顔より大きい |

### 4.1.1 大きさ（縮尺）の決め方 ― ハガルが大きく出る対策（2026-11-02）

オーナー「前にリファレンス画像渡してもサイズ感がハガル大きかったりしたことがあった」。参照写真を渡しても、生成ではハガルとHMDが大きく描かれやすい。原因は次の4つで、対策は全部を同時に行う（どれか1つでは止まらない）。

| 原因 | 対策 |
|---|---|
| 大きさの指示が「掌の幅くらい」という相対表現だけ。アニメの絵柄は顔と手が大きいので、それに合わせて機材も膨らむ | **数値・台全体との比・人物の顔との比の3つを重ねて書く**（§4.2 の文に入れた）。「大きく描かない」と否定でも書く |
| 渡した実写がハガルやHMDの**接写**で、写真の中の大きさごと真似される | 縮尺の参照には**台の全体が写る写真か、手で持っている写真を最低1枚**渡す。接写は「形だけを見る。写真の中の大きさは真似しない」と書き添える。接写だけを渡さない |
| 構造の説明が長く、ハガルとHMDが絵の**主役**として扱われる | 主役は人物と場面で、機材は小さな脇役だと書く。構造の説明は §4.2 の文だけにし、ハガルの装飾や質感の描写を足さない |
| 台が画面の手前に来て、遠近で大きくなる | 台は人物と**同じ奥行き**に置き、**受け皿とステムの上部を画面に入れる**（受け皿がいちばんの物差し）。台を手前に置く・見上げる接写は、手前に大きく写す演出を指定したときだけ |

**大きさの目安**（日本の店の業務用の台の一般的な値。製品ごとに違うので、描くときの比の基準として使う。実測の保証ではない）:

| 部位 | 実物の目安 | 絵の中での比べ方 |
|---|---|---|
| 台全体（ベースの底〜HMDの上） | 60〜80cm（家の卓上台は30〜40cm） | 床に置くと、座った人の胸〜肩、立った人の腰〜腿の高さ |
| ベース | 高さ20〜30cm・幅15〜25cm | 台全体の1/3くらい |
| 受け皿 | 径18〜25cm | HMDの約2.5倍 |
| ハガル（ボウル） | 高さ6〜8cm・口径6〜8cm | 大人の掌の幅以下。湯のみやこぶしくらい |
| HMD | 径7.5〜9cm・高さ3〜4cm（例: 低い金属のHMDは底径7.5cm・高さ3cm、ターキッシュリッドの内径は通常約6.5cm） | ハガルの口と同じくらいの径、高さは指2本分 |
| 炭 | 一辺2.5cm前後の角炭 | 指先 |
| ハガル＋HMD＋炭を重ねた高さ | 10〜12cm | **台全体の約1/6〜1/7**、**人物の顔（あご〜頭のてっぺん）の半分くらい** |
| ハンドル | 15〜25cm | 手のひら1.5〜2個分 |
| ホース | 1.5〜1.8m | 床に垂れても余る長さ |

**生成後の測り方**（画像の上でピクセルを測る。目分量で迷ったら測る）:

1. ①ハガル＋HMD＋炭の高さ、②台全体の高さ（ベースの底〜HMDの上）、③人物の顔の高さ（あご〜頭のてっぺん）を測る。
2. **①÷② が 0.12〜0.2**（卓上台は0.25〜0.35）、**①÷③ が 0.6以下**（顔の大きい絵柄でも0.7以下）なら合格。
3. 手で持つ場面は、ハガルの口径が掌の幅以下で、指が脚に回っているか。
4. 台の全体が写っていない構図は②の代わりに受け皿の径を使い、**HMDの径÷受け皿の径が0.3〜0.5**か見る。
5. 遠近で比べられない構図（台が人物よりずっと手前・奥）は、測る前に同じ奥行きの構図へ直す。

**大きく出たときの直し方**:

- まず、同じ構図のまま §4.2 の大きさの文をそのまま入れ直し、「the bowl and HMD came out too large; make them about 60% of their current size」のように前回より小さくする割合を書いて再生成する。
- 画像編集ができるツールでは、**ハガル〜炭の範囲だけを選んで「この範囲だけを○%に縮め、ステムの先のポストに載せ直す。ステム・受け皿・人物は変えない」**と指示する。縮めた後の付け根（ポストと脚）・影・煙のつながりを §4.4 で見直す。
- 手で持っているハガルが大きいときは、手ごと描き直す（手とハガルの大きさの関係を同時に決める）。
- 遠近だけが原因なら、台を人物と同じ奥行きへ下げる構図に変える。

### 4.2 プロンプトに貼る文

場面の指定のあとに、日本語か英語のどちらかを**そのまま**貼る（要約しない）。

> シーシャ（水たばこ）の構造を守って描く。上から順に「小さな角炭 → 炭を収めるHMD（熱管理器具。ボウルの口に載る別部品） → フレーバーを詰めたハガル（器と細い脚） → 灰の受け皿 → 縦のステム → 水の入ったガラスのベース」。ステムはベースの口に真っ直ぐ差さり、ベースの水面は下の方で、ステムを水槽にしない。ホースは1本だけで、本体側面のホースポートから出て、重力でたわみ、手で持つ硬いハンドルの根元につながる。ホースを分岐・途切れ・浮遊させず、パージ弁・ボウル・受け皿・ベースの底から生やさない。人物を囲む大きな輪にしない。完成・喫煙状態ではアルミに炭を直接置かず、HMDの中に炭を置く。HMDは1つのモデルとして成立させ、別の型の蓋・煙突・取手を混ぜない。大きさを守る: 台全体の高さは60〜80cm（床に置くと座った人の胸〜肩の高さ）。ハガル（器）は高さ6〜8cmの小さな器で、口は大人の掌の幅より狭い。HMDはその口と同じ径で、高さは指2本分。ハガル＋HMD＋炭を重ねても高さ10〜12cmで、台全体の約1/6〜1/7、人物の顔の半分くらいしかない。受け皿はHMDの2.5倍前後、炭は指先ほど。ハガルとHMDを大きく描かない（機材は場面の小さな脇役で、主役は人物）。台は人物と同じ奥行きに置き、受け皿とステムの上部も画面に入れる。煙は人物の口元から出し、HMD・ホース根元からは出さない。首掛けのマイマウスピースを描く場合はチェーンだけでなく小さな吸い口本体を付ける。台・ボウル・HMDは今の日本のシーシャバーで使われている形（ステンレスの細いステムと幅の広いガラスベース、小さめの受け皿、シリコンボウルとロータス型HMDなど）を基本にし、中東風の彫金の台は指定があるときだけ。店内も日本のシーシャバー（ソファ席、カフェ風の明るい店や間接照明の店）にする。色・仕上げは自由にデザインし、実在製品・ロゴ・文字は描かない。

> Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.

場面別に足す一文:

- **ボウル未装着の制作画面**: 台の先端は小さな凸型の金属ポスト。ボウル・HMD・炭は描かない。
- **詰める・アルミ・穴あけ**: ハガル＋アルミだけ。炭とHMDはまだ載せない。アルミは口に平らに張り、縁で折り込む。
- **炭を置く（制作工程）**: トングで小さな角炭を扱う。アルミの外周に三角で3個。
- **手でハガル／HMDを持つ**: 手と同じ奥行きで、片手で持てる大きさ。ハガルの口は掌より狭く、指が細い脚に回る。カメラに突き出さない。脚を短く潰さない。
- **完成・喫煙・提供済み**: HMD必須・直炭禁止。炭はHMDの中に2〜3個。

### 4.3 生成前に決める8行（1枚ごとに書いて制作記録に残す）

```
人物      : （キャラID。正規立ち絵 assets/sprites/characters/<id>/chr_<id>_normal.png を見る・渡す）
場面      : 準備中（ボウル未装着）／詰める・アルミ／炭を置く／完成・喫煙／携帯 のどれか1つ
台の型    : 既定は日本のシーシャバーの業務用（ステンレスの細いステム＋幅の広いガラスベース）。彫金の伝統型は指定があるときだけ
HMD       : 完成・喫煙なら必須。具体的な1モデル（ロータス型／ターキッシュリッド／アマボースト など §4.0.5 の表から）。ボウルとの組み合わせも
炭        : 小さな角炭○個（HMD内、または制作工程ならアルミ上に三角3個）
ホース    : 本体の側面ポート → ホース → 硬いハンドル →（チップ）→ 口。画面のどこを通すか
吸い口    : なし／使い捨てチップ／首掛けマイチップ（携帯中）／マイチップをハンドルに装着
構図      : カメラ距離・人物と台の奥行き（同じ奥行きが既定。手持ちも手と同じ奥行き）・受け皿とステムの上部が写るか・場所と時間帯。店内なら §4.0.5 の日本の内装から1つ
```

渡す画像の役割を分けて書く: **本人**＝正規立ち絵、**質感**＝`assets/ui/title_arts/title_art_keyvisual_01.png`、**機材の見た目**＝siryou の `web-refs/images/` の日本の店・機材の写真、**機材の構造**＝siryou の `photos/` の実写（HMDは装着状態、手持ちなら掌が写るもの）。`photos/` の海外写真を渡すときは「構造と縮尺だけ参考にし、内装・服装・台の装飾は写さない」と書き添える。**縮尺の参照には、台の全体が写る写真か手で持っている写真を最低1枚**入れる。ハガル・HMDの接写を渡すときは「形だけを見る。写真の中の大きさは真似しない」と書き添え、接写だけを渡さない（§4.1.1）。早見表・構造図・この表は渡さない。

### 4.4 生成後チェック（原寸で見る。1つでもNGなら直すか再生成）

- [ ] 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- [ ] 積み順が成立: ベース→ステム→受け皿→ハガル→HMD→炭。ステムはベースの口に真っ直ぐ差さっている
- [ ] 完成・喫煙の台はHMD付き。直炭になっていない
- [ ] HMDの蓋・取手・通気口が同じ1モデルの組
- [ ] 縮尺を測った（§4.1.1）: ハガル＋HMD＋炭の高さ÷台全体の高さが0.12〜0.2（卓上台0.25〜0.35）、÷人物の顔の高さが0.6以下。受け皿はHMDの約2.5倍。手持ちはハガルの口が掌の幅以下。ハガルの脚が潰れていない
- [ ] ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- [ ] ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- [ ] 人物を囲む輪・不自然な大回りがない
- [ ] マイチップ: 吸い口本体がある／使用中はハンドル先端に付いている
- [ ] 煙は口元から。HMD・ホース根元・チェーンから出ていない
- [ ] 文字・ロゴ・透かし・UIが焼き込まれていない

不採用の実例（ホースのY字分岐・ハガルが短い・足元を囲む大回り）は `asset_sources/shisha-hardware-reference/ng-examples/README.md`。

### 4.5 ゲーム側の数値との対応

- 炭の個数は、**画像（HMD内）は通常2〜3個・4個は稀**、**制作工程（アルミ上）は三角3個が基本**。場面に合わせて使い分ける。
- フレーバー保管は小さな透明タッパー。客席からは見えない店が多い（`docs/asset_ai_guidance.md`「フレーバー保管と炭の個数」）。
- この節は描写の約束で、制作工程（穴あけテンプレ・基本3炭・採点）や `data/equipment.json` の機材仕様は変えない。

### 4.6 詳しい資料（根拠・出典。必要なときだけ開く）

すべて非公開リポジトリ siryou の `shisha-hardware-reference/` 配下（下のリンクは siryou を見られるアカウントでだけ開ける）。NG例 `ng-examples/` だけはゲームのリポジトリの `asset_sources/shisha-hardware-reference/` に残っている。

| 知りたいこと | ファイル |
|---|---|
| 人が読む早見表の画像と構造図（検品時に見比べる。生成ツールに渡さない） | `drawing-sheet/README.md` |
| 台の型・材質（提供写真9点の一覧と見方） | `README.md` |
| 37写真を横断した誤描写の一覧 | `ai-generation-structural-pitfalls.md` |
| ヒロインの日常・タイトルCG（HMDの具体モデルと寸法・顔の年齢感・背景の変化） | `heroine-title-cg-rules-20261009.md` |
| 首掛けマイチップ・ホース接続の検品 | `visual-qa-necklace-hose-20261009.md` |
| 装着時・手持ちの縮尺の実写と出典 | `installed-and-handheld-scale-20261009.md` |
| 部品名・空気の通り道・パージ（台詞で仕組みを説明するときも使う） | `anatomy-diagrams-20261009.md` |
| ハガル内部の穴・アルミの穴あけ・炭の配置・HMDの種類 | `bowl-interiors-foil-coal-placement-20261009.md` |
| アルミ直置きとHMDの近接写真 | `heat-management-closeups-20261009.md` |
| 喫煙姿勢・煙の出方／設置場所・構図 | `smoking-and-heat-management-20261009.md`、`usage-and-installation-20261009.md` |
| ホース・チップの部品 | `hose-and-mouthpieces-20261009.md`、`mouthpiece-handle-skins-20261009.md` |
| フレーバー保管の実物4写真 | `flavor-storage-tubs-issue396/README.md` |

## 5. 未決定・注意

- ダークリーフ（ナイトサイド等）のパッキング・アルミ工程は接続中（#1126）。確定するまで台詞で手順を断定しない。
- 実測めいた数値の扱い（`docs/reports/issue1107-*`・`issue1081-e06`）はオーナー未決定。
