# 実写の参照画像（生成ツールに渡す・生成前に見る）

シーシャ台・ハガル・HMD・炭・ホースを描く前に見る**実物の写真**の置き場。ルールは [`docs/shisha_reference.md` §4](../../../docs/shisha_reference.md#4-画像生成の必須手順機材の形と構造)。

**2026-11-02: Wikimedia Commons の自由ライセンス写真 76枚を収集**（2回に分けて収集。下の一覧。すべてパブリックドメイン・CC0・CC BY・CC BY-SA のどれか。出典・作者・ライセンスは一覧と `sources.json` に記録）。2026-10-09 に提供された写真は当時の作業環境から保存できず、親フォルダの `*.webp` に1枚150px前後の縮小一覧として残っただけなので、ここが生成に使える唯一の実写。

**まだ薄いもの（オーナーの撮影待ち）**: 日本の店で主流の機材そのもの（2回目の収集でも Commons にはほぼ無かった。英・独・露・西・日など多言語の検索語、国別カテゴリ、機材を撮る投稿者の投稿一覧まで当たった）。Lotus 型 HMD（シリコンボウルとの組み合わせ）、ターキッシュリッド型 HMD、蓋付き高火力 HMD、80Feet 系のターキッシュ陶器、シリコンボウル、日本の店の業務用の台の全体。Commons にはこれらの写真がほとんど無い。

**日本で撮られた写真は `stand-lounge-japan-01.jpg` の1枚だけで、ほかはすべて海外**（`sources.json` の `region`）。海外の写真は部品の構造・接続・縮尺・持ち方・炭の大きさを確かめるときだけに使い、内装・服装・小物・台の装飾・街並みは写さない（2026-11-02 オーナー方針「日本のシーシャバーを参照、海外はあまり参照しない」）。機材と内装の見た目は `docs/shisha_reference.md` §4.0.5 の日本の店の表で決める。

写真はゲーム内素材として使わず、生成前に見る・生成ツールに渡す参照にだけ使う。再配布するときは作者表示（CC BY-SA は同じ条件での共有）が要る。

## 入れ方（Codexアプリ／Claude Code）

1. 写真をチャットに添付して「`asset_sources/shisha-hardware-reference/photos/` に下の命名で保存して commit」と頼む。Codexアプリは手元のPCで動くので、添付ファイルをそのままコピーできる（クラウド実行では保存できないことがある。その場合はPCのフォルダへ直接置く）。
2. 長辺 1600px 程度・JPEG で十分（1枚 300KB〜1MB）。元の大きさのまま入れない。
3. `asset_sources/` 配下の新規画像は `.gitattributes` で **Git LFS**。`git add` のあと `git lfs ls-files | grep photos/` で LFS 管理になっていることを確認してから push する。
4. 権利: オーナーや店で撮った写真を優先する。ネットの商品写真・他人の投稿は保存せず、`../installed-and-handheld-scale-20261009.md` のように出典URLだけ記録する。写真に写った値札・ロゴ・文字は生成で複製しない。

## 集める優先順位（2026-11-02 オーナー方針）

0. **日本のシーシャバーで撮った写真**を最優先にする（オーナー撮影など）。海外の写真は足さなくてよい。
1. **今の店で使われている機材**を優先する: 細い金属ステム＋シンプルなガラスベースの業務用の台、シリコンボウル＋Lotus 型 HMD、ターキッシュ型陶器＋ターキッシュリッド型 HMD、素焼き＋蓋付き高火力 HMD／アルミ直炭。彫金の伝統型は数枚でよい。
2. **HMD は型ごとに**: Lotus 型（取手付きの皿、蓋あり／なし）、ターキッシュリッド型（縁の立った浅い蓋）、蓋付き高火力型、蓋なし低容器。それぞれ「単体」と「ボウルに装着」の2枚。
3. **セッティングの幅**: 台の色・ベースの形・ボウルの種類・HMD・ホースの色が違う組み合わせを複数。手元（ハンドル・チップ）と人の手も含める。

## 命名（1フォルダ・接頭辞で部位を分ける）

`<部位>-<状態>-<連番>.jpg`。部位の接頭辞は次の7つに限る。

| 接頭辞 | 写すもの | 欲しい角度・状態 |
|---|---|---|
| `stand-` | 台の全体（ベース→ステム→受け皿→ハガル） | 正面・斜め。**付け根（ベースの口とステム）が見える**もの。ハガル未装着（先端の金属ポストだけ）の状態も1枚 |
| `joint-` | 付け根・接続部の近接 | ベースの口とパッキン、ステム先端のポストとハガルのゴム、ホースポートとパージ弁 |
| `bowl-` | ハガル単体 | 横から（脚の長さ）、真上から（内部の穴）、アルミを張った状態、穴を開けた状態 |
| `hmd-` | HMD | 単体（蓋の開閉）、**ハガルに装着した状態**、炭を入れた状態 |
| `coal-` | 炭 | トングで持ったところ、アルミ上の三角3個、HMD内の2〜3個。指やトングと一緒に写して大きさが分かるように |
| `hose-` | ホース・ハンドル・吸い口 | ポートに刺さった根元、ハンドルの握り、先端のチップ、首掛けマイチップ |
| `hand-` | 人の手と機材 | ハガル／HMDを持った掌、ホースを口元へ運ぶ姿勢（顔は不要） |

例: `stand-full-01.jpg`、`stand-noBowl-01.jpg`、`joint-baseNeck-01.jpg`、`hmd-onBowl-02.jpg`、`coal-inHmd-01.jpg`。

## 一覧（2026-11-02 収集分・76枚）

### 台の全体・店内（24枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [stand-barCounter-01.jpg](stand-barCounter-01.jpg) | バーカウンターに並ぶ台と照明 | [Jeremiah Roth from Salt Lake City, UT, USA](https://commons.wikimedia.org/wiki/File:Hookah%27s_%282910791360%29.jpg) | CC BY-SA 2.0 |
| [stand-barTable-night-01.jpg](stand-barTable-night-01.jpg) | 夜の店のテーブル上の台。皿とアルミを張ったボウル | [Sarah Stierch](https://commons.wikimedia.org/wiki/File:Slim_with_a_hookah_in_Haifa_-_Stierch.jpg) | CC BY 4.0 |
| [stand-cafe-terrace-01.jpg](stand-cafe-terrace-01.jpg) | カフェのテラスに置いた台（赤いベース・アルミのボウル） | [Guilhem Vellut from Annecy, France](https://commons.wikimedia.org/wiki/File:Sheesha_%40_Bur_Dubai_%2815882559731%29.jpg) | CC BY 2.0 |
| [stand-cafe-terrace-02.jpg](stand-cafe-terrace-02.jpg) | 夕方のカフェの卓に置いた台 | [Guilhem Vellut from Annecy, France](https://commons.wikimedia.org/wiki/File:Sheesha_%40_Marina_Caf%C3%A9_%40_Evening_%40_Abu_Dhabi_%2815424445893%29.jpg) | CC BY 2.0 |
| [stand-cafeTable-01.jpg](stand-cafeTable-01.jpg) | カフェの卓上に置いた現代型と赤いホース。台とテーブル・椅子の縮尺 | [Infrogmation of New Orleans](https://commons.wikimedia.org/wiki/File:Miami_Beach_Lincoln_Mall_Hookas.JPG) | CC BY 3.0 |
| [stand-lounge-interior-01.jpg](stand-lounge-interior-01.jpg) | ヨーロッパのシーシャラウンジの内装（ソファ席・間接照明） | [BlaBerTo (Diskussion)BlaBerTo](https://commons.wikimedia.org/wiki/File:Innenansicht_eines_europ%C3%A4ischen_Shishalokals.jpg) | CC BY-SA 3.0 |
| [stand-lounge-japan-01.jpg](stand-lounge-japan-01.jpg) | 日本のシーシャバーの席（ソファ・照明）。日本の店の雰囲気 | [Amber980602](https://commons.wikimedia.org/wiki/File:Yuta_Ito_in_shisha_bar.jpg) | CC BY-SA 4.0 |
| [stand-lounge-tehran-01.jpg](stand-lounge-tehran-01.jpg) | テーブルごとに台を置いたラウンジ | [Nevit Dilmen](https://commons.wikimedia.org/wiki/File:Tehran_Snapshot_00336.JPG) | CC BY-SA 3.0 |
| [stand-lounge-terrace-01.jpg](stand-lounge-terrace-01.jpg) | 夜のテラス席と卓上の台 | [Pierre So](https://commons.wikimedia.org/wiki/File:Chicha_So_Lounge_Marrakech.jpg) | CC BY-SA 4.0 |
| [stand-modern-blue-01.jpg](stand-modern-blue-01.jpg) | 青いアルミステム＋青ガラスベース、ハンドル付きホース、トング。床置きの全体と縮尺 | [Mistershisha](https://commons.wikimedia.org/wiki/File:Wasserpfeife-Little-Dragon.jpg) | CC BY-SA 4.0 |
| [stand-modern-foilBowl-01.jpg](stand-modern-foilBowl-01.jpg) | 現代型の台にアルミを張ったボウルと風防を載せた状態（屋外） | [Plodan](https://commons.wikimedia.org/wiki/File:Wasserpfeife_%2817380%29.jpg) | CC BY-SA 4.0 |
| [stand-modern-hmd-01.jpg](stand-modern-hmd-01.jpg) | HMDを載せた現代型の全体（暗い店内）。写真家の署名が入っている | [WikiShisha](https://commons.wikimedia.org/wiki/File:Fresh_Smoke_cybe_one.jpg) | CC BY-SA 4.0 |
| [stand-modern-lounge-01.jpg](stand-modern-lounge-01.jpg) | 店内に並ぶ現代型ステム。皿・ホースポート・パージの位置が複数台で見える | [Shixart1985](https://commons.wikimedia.org/wiki/File:Hookah_setup_in_a_cozy_lounge_atmosphere_with_soft_lighting_and_comfortable_seating.jpg) | CC BY 2.0 |
| [stand-modern-steel-01.jpg](stand-modern-steel-01.jpg) | ステンレスの細いステムと透明ガラスベース。付け根（ベースの口にステムが差さる）と皿の高さ | [Fluoride89](https://commons.wikimedia.org/wiki/File:Ferro_hookah.jpg) | CC BY-SA 4.0 |
| [stand-modern-studio-01.jpg](stand-modern-studio-01.jpg) | 黒い細いステム＋カットガラスの丸いベース、小さな金属皿、黒いシリコンホース。今の店の標準形 | [KyCaS](https://commons.wikimedia.org/wiki/File:Modernus_kaljanas.jpg) | CC BY-SA 4.0 |
| [stand-restaurantTable-01.jpg](stand-restaurantTable-01.jpg) | 店の卓上に置いた台と、ホースを持つ客 | [Ninara from Helsinki, Finland](https://commons.wikimedia.org/wiki/File:Woman_smoking_a_hookah_in_a_restaurant_in_Tehran%2C_Iran_2011.jpg) | CC BY 2.0 |
| [stand-shopColors-01.jpg](stand-shopColors-01.jpg) | 色付きガラスベースと彩色ホースの陳列 | [Mostafameraji](https://commons.wikimedia.org/wiki/File:Pottery_in_Iran_-_qom_%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87_%D8%B3%D9%81%D8%A7%D9%84_%D8%AF%D8%B1_%D8%A7%DB%8C%D8%B1%D8%A7%D9%86%D8%8C_%D9%82%D9%85_20.jpg) | CC BY-SA 4.0 |
| [stand-shopDisplay-01.jpg](stand-shopDisplay-01.jpg) | 店頭ショーケースの現代型数台（色付きガラスベース）。色と形の幅 | [К.Артём.1](https://commons.wikimedia.org/wiki/File:Hookahs%2C_Novosibirsk_01.jpg) | CC BY-SA 4.0 |
| [stand-shopInterior-01.jpg](stand-shopInterior-01.jpg) | シーシャ専門店の棚と台の並び | [Dosseman](https://commons.wikimedia.org/wiki/File:Adana_Nargile_shop_in_2016_03_1898.jpg) | CC BY-SA 4.0 |
| [stand-shopRows-01.jpg](stand-shopRows-01.jpg) | 店頭に並ぶ多数の台（ガラスベース・ステム・皿） | [Gerd Eichmann](https://commons.wikimedia.org/wiki/File:Jordanien-Wasserpfeifen-04-2010-gje.jpg) | CC BY-SA 4.0 |
| [stand-stemOnly-01.jpg](stand-stemOnly-01.jpg) | ベース無しの現代型ステム一式。皿・ポート・先端の金属ポストが見える | [HookahFloW](https://commons.wikimedia.org/wiki/File:Komplette_Shisha_Rauchs%C3%A4ule.jpg) | CC BY-SA 4.0 |
| [stand-terrace-foilBowl-01.jpg](stand-terrace-foilBowl-01.jpg) | テラスの床置きの台とホース、アルミを張ったボウル | [Krista](https://commons.wikimedia.org/wiki/File:Bait_1971_rose_shisha_%2811389727744%29.jpg) | CC BY 2.0 |
| [stand-tileWall-01.jpg](stand-tileWall-01.jpg) | タイル壁の前の台全体。ホースを台に掛けた状態 | [Guillaume Paumier](https://commons.wikimedia.org/wiki/File:Hookah_-_Freedom_Theatre_in_Jenin_008_-_Aug_2011.jpg) | CC BY 3.0 |
| [stand-traditional-01.jpg](stand-traditional-01.jpg) | 伝統的なエジプト型（彫金ステム・ガラスベース・布巻きホース）。指定があるときだけ使う | [Randhirreddy at English Wikipedia](https://commons.wikimedia.org/wiki/File:Hookah1.JPG) | CC BY-SA 3.0 |

### 付け根・接続部（7枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [joint-bowlOnStem-top-01.jpg](joint-bowlOnStem-top-01.jpg) | 真上から。皿の中央にステム先端、その上にアルミを張ったボウル。皿とボウルの径の比 | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_vrch.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [joint-hosePort-01.jpg](joint-hosePort-01.jpg) | ステム側面のホースポートに緑のホースが刺さる。パージ弁は別の口 | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_srdce.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [joint-hosePort-detail-01.jpg](joint-hosePort-detail-01.jpg) | 分解したステムの中枢部（ホースポート・パージ弁・ダウンステム） | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_srdce_detail.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [joint-modernStem-part-01.jpg](joint-modernStem-part-01.jpg) | 現代型の金属ステム部品（球状の中枢部と細い管） | [Newme](https://commons.wikimedia.org/wiki/File:Shisha_Rauchs%C3%A4ule.JPG) | CC BY-SA 2.5 |
| [joint-smallHookah-top-01.jpg](joint-smallHookah-top-01.jpg) | 小型の台を斜め上から。ボウル・皿・ホースポートの位置 | [لا روسا](https://commons.wikimedia.org/wiki/File:Hookah_egyptian_style_001.jpg) | CC BY-SA 3.0 |
| [joint-trayNoBowl-01.jpg](joint-trayNoBowl-01.jpg) | ボウルを外した皿とステム先端（小さな凸型のポスト）。制作画面の「未装着」の形 | [Original uploader was Aida at cs.wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_vrch_detail.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [joint-traysFromAbove-01.jpg](joint-traysFromAbove-01.jpg) | 真上から見た多数の皿とボウル。皿の径とボウルの比 | [זאב שטיין](https://commons.wikimedia.org/wiki/File:125981_acre_PikiWiki_Israel.jpg) | CC BY 2.5 |

### ハガル（8枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [bowl-egyptian-top-01.jpg](bowl-egyptian-top-01.jpg) | 釉薬のエジプト型（底に複数穴）の真上 | [me](https://commons.wikimedia.org/wiki/File:Shisha_Topf.JPG) | CC BY-SA 2.5 |
| [bowl-egyptian-top-02.jpg](bowl-egyptian-top-02.jpg) | 茶色いエジプト型の底穴の近接 | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_korunka_detail.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [bowl-foil-01.jpg](bowl-foil-01.jpg) | アルミを張って縁で折り込んだボウル（穴あけ前） | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_korunka.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |
| [bowl-fruit-01.jpg](bowl-fruit-01.jpg) | スイカをボウル代わりにした台（フルーツヘッド） | [Serge Melki from Indianapolis, USA](https://commons.wikimedia.org/wiki/File:Hookah_Innovation_%284039163471%29.jpg) | CC BY 2.0 |
| [bowl-packed-pair-01.jpg](bowl-packed-pair-01.jpg) | 詰めた素焼き2個とトングを上から | [Noor Khayat](https://commons.wikimedia.org/wiki/File:%D9%85%D8%B9%D8%B3%D9%84_-_%D8%A3%D8%B1%D8%AC%D9%8A%D9%84%D8%A9.jpg) | CC BY-SA 3.0 |
| [bowl-phunnel-packed-01.jpg](bowl-phunnel-packed-01.jpg) | ファンネル型（中央に1穴）にダークリーフを詰めた真上 | [Tanny100](https://commons.wikimedia.org/wiki/File:Apache_medium_with_dark_leaf.jpg) | CC BY-SA 4.0 |
| [bowl-phunnel-packed-02.jpg](bowl-phunnel-packed-02.jpg) | 小さめのファンネル型に詰めた真上。葉の高さは縁より下 | [Tanny100](https://commons.wikimedia.org/wiki/File:Mini_rook_with_dark_leaf.jpg) | CC BY-SA 4.0 |
| [bowl-phunnel-set-01.jpg](bowl-phunnel-set-01.jpg) | 黄色いファンネル陶器ボウル（横・真上）と、脇に金属HMDの部品 | [HookahFloW](https://commons.wikimedia.org/wiki/File:Shisha_Phunnel_Kopf.jpg) | CC BY-SA 4.0 |

### HMD（3枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [hmd-coalsGlow-01.jpg](hmd-coalsGlow-01.jpg) | 蓋を開けたHMDの中で赤く灯る角炭（夜）。炭の大きさと数 | [Shixart1985](https://commons.wikimedia.org/wiki/File:Hookah_session_at_night_with_glowing_coals_and_smoke_in_a_relaxed_gathering_atmosphere.jpg) | CC BY 2.0 |
| [hmd-onBowl-home-01.jpg](hmd-onBowl-home-01.jpg) | 取手付きの皿型HMDがボウルの口に載る近接 | [Shixart1985](https://commons.wikimedia.org/wiki/File:Closeup_of_hookah_at_home.jpg) | CC BY 2.0 |
| [hmd-onPhunnel-01.jpg](hmd-onPhunnel-01.jpg) | ファンネルボウルの上に金属HMDを載せた装着状態と分解した部品。HMDとボウルの径の比 | [HookahFloW](https://commons.wikimedia.org/wiki/File:Shisha_Phunnel_Kopf_mit_HMD.jpg) | CC BY-SA 4.0 |

### 炭（8枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [coal-closeup-glow-01.jpg](coal-closeup-glow-01.jpg) | アルミの上で割れ目が赤く灯る角炭3個の近接（アルミ直炭）。灰の白と赤熱の描き分け。制作工程の参考で、完成・喫煙の絵には使わない。右上の透かしは消してある | [Samad2206](https://commons.wikimedia.org/wiki/File:Sheesha_coal.jpg) | CC BY-SA 4.0 |
| [coal-cubes-box-01.jpg](coal-cubes-box-01.jpg) | ココナッツ角炭の箱と角炭、速炭。角炭の大きさ | [HookahFloW](https://commons.wikimedia.org/wiki/File:Shisha_Naturkohle_und_Selbstz%C3%BCnderkohle.jpg) | CC BY-SA 4.0 |
| [coal-heater-01.jpg](coal-heater-01.jpg) | 店に置かれた炭を温める容器 | [רוני קניגסברג](https://commons.wikimedia.org/wiki/File:PikiWiki_Israel_67802_charcoal_tanks_for_hookahs_in_acre.jpg) | CC BY 2.5 |
| [coal-heater-02.jpg](coal-heater-02.jpg) | ラウンジの炭焼きキャビネット | [ProtoplasmaKid](https://commons.wikimedia.org/wiki/File:Hooka_lounge_charcoal_in_Muristan_street.JPG) | CC BY-SA 3.0 |
| [coal-lighting-burner-01.jpg](coal-lighting-burner-01.jpg) | 店のコンロで炭を焼く店員と、横の台・青いホース | [Tracey Hind from Aups, France](https://commons.wikimedia.org/wiki/File:Demonstration_of_lighting_and_using_a_Shisha%2C_Hammamet%2C_Tunisia_%2852764318093%29.jpg) | CC BY-SA 2.0 |
| [coal-onFoil-01.jpg](coal-onFoil-01.jpg) | アルミの上に置いた炭（アルミ直炭）。制作工程の参考で、完成・喫煙の絵には使わない | [Steven Lek](https://commons.wikimedia.org/wiki/File:Coal_on_a_Hookah_39028.JPG) | Public domain |
| [coal-tongs-01.jpg](coal-tongs-01.jpg) | 炭用トング | [Trollhead](https://commons.wikimedia.org/wiki/File:Shisha_Zange.JPG) | CC BY 3.0 |
| [coal-tongs-placing-01.jpg](coal-tongs-placing-01.jpg) | トングで角炭をボウルの上に置く手元。炭の大きさとトング | [Shixart1985](https://commons.wikimedia.org/wiki/File:A_hand_carefully_arranges_charcoal_pieces_on_a_hookah_bowl%2C_readying_it_for_use.jpg) | CC BY 2.0 |

### ホース・ハンドル・吸い口（9枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [hose-disposableTip-01.jpg](hose-disposableTip-01.jpg) | 使い捨てチップ（小さな白い樹脂の筒）。ハンドルの先端に差す | [me](https://commons.wikimedia.org/wiki/File:Shisha_Mundschutz.JPG) | CC BY-SA 2.5 |
| [hose-handle-black-01.jpg](hose-handle-black-01.jpg) | 黒い樹脂のハンドル単体と先端の金具 | [me](https://commons.wikimedia.org/wiki/File:Shisha_Mundstueck.JPG) | CC BY-SA 2.5 |
| [hose-handle-inMouth-01.jpg](hose-handle-inMouth-01.jpg) | 木のハンドルの先の吸い口をくわえた近接。指の持ち方と吸い口の太さ | [Ildar Sagdejev (Specious)](https://commons.wikimedia.org/wiki/File:2008-11-08_Hookah_Bliss.jpg) | CC BY-SA 4.0 |
| [hose-handle-inMouth-02.jpg](hose-handle-inMouth-02.jpg) | ハンドルを口に当てた横顔の近接。ハンドルと顔の大きさの比 | [Ildar Sagdejev (Specious)](https://commons.wikimedia.org/wiki/File:Hookah_Bliss_02.jpg) | CC BY-SA 3.0 |
| [hose-handles-shop-01.jpg](hose-handles-shop-01.jpg) | 店に吊られた多様なハンドル（木・骨・彩色） | [Mostafameraji](https://commons.wikimedia.org/wiki/File:%D9%82%D9%84%DB%8C%D8%A7%D9%86.jpg) | CC BY-SA 4.0 |
| [hose-handles-wood-01.jpg](hose-handles-wood-01.jpg) | 木製・金属のハンドル（持ち手）が並ぶ。長さと太さ | [David Dennis from Scotts Valley, CA, USA](https://commons.wikimedia.org/wiki/File:Flickr_-_DavidDennisPhotos.com_-_Hookah-Shisha_Pipes.jpg) | CC BY-SA 2.0 |
| [hose-hanging-01.jpg](hose-hanging-01.jpg) | 壁に吊られた多数のホース。色と太さの幅 | [ProtoplasmaKid](https://commons.wikimedia.org/wiki/File:Hooka_hoses_in_Muristan.JPG) | CC BY-SA 3.0 |
| [hose-hanging-02.jpg](hose-hanging-02.jpg) | 店に吊られたホースの束。色と太さの幅 | [Gerd Eichmann](https://commons.wikimedia.org/wiki/File:Jordanien-Wasserpfeifen-08-Schlaeuche-2010-gje.jpg) | CC BY-SA 4.0 |
| [hose-traditional-coiled-01.jpg](hose-traditional-coiled-01.jpg) | 伝統型の布ホース＋木のハンドルを丸めた全体。ホース→ハンドル→先端の順 | [Aida at Czech Wikipedia](https://commons.wikimedia.org/wiki/File:Vodni_dymka_slauch.jpg) | CC BY-SA 2.5 / CC BY-SA 3.0 |

### 人の手と機材（17枚）

| ファイル | 見るポイント | 出典（作者） | ライセンス |
|---|---|---|---|
| [hand-lounge-modern-01.jpg](hand-lounge-modern-01.jpg) | 現代的なラウンジで紫のホースを持つ。台と椅子の距離 | [LooTehran](https://commons.wikimedia.org/wiki/File:%D8%B4%DA%A9%DB%8C%D9%84%D8%A7_%D8%B3%D8%A7%D9%84_96_%D8%AA%D9%87%D8%B1%D8%A7%D9%86_2.jpg) | CC0 |
| [hand-picnic-01.jpg](hand-picnic-01.jpg) | 屋外でアルミを張った台を囲む二人。ハンドルの受け渡し | [Michael Coghlan](https://commons.wikimedia.org/wiki/File:Private_Sheesha_Party.jpg) | CC BY-SA 2.0 |
| [hand-preparingBowl-01.jpg](hand-preparingBowl-01.jpg) | 現代型の台の横でボウルに詰める手元。手とボウルの縮尺 | [Shixart1985](https://commons.wikimedia.org/wiki/File:Preparing_the_hookah_with_flavors_and_bowls_in_a_cozy_indoor_setting.jpg) | CC BY 2.0 |
| [hand-servingBowl-foil-01.jpg](hand-servingBowl-foil-01.jpg) | アルミで覆い炭を載せたボウルを店員が運ぶ。風防付き | [Tracey Hind from Aups, France](https://commons.wikimedia.org/wiki/File:Shisha_content_in_silverfoil_with_coals_on_top_%2852763288712%29.jpg) | CC BY-SA 2.0 |
| [hand-smoking-closeup-01.jpg](hand-smoking-closeup-01.jpg) | カフェでハンドルをくわえる近接 | [Enric](https://commons.wikimedia.org/wiki/File:38_Bagdad_Caf%C3%A9_%28S%C3%ADria%29%2C_fumant_el_narguil.jpg) | CC BY-SA 4.0 |
| [hand-smoking-exhale-01.jpg](hand-smoking-exhale-01.jpg) | ハンドルを持って煙を吐く。煙は口から出る | [Wojciech Kocot](https://commons.wikimedia.org/wiki/File:Irnc127-Iranka.jpg) | CC BY-SA 4.0 |
| [hand-smoking-exhale-02.jpg](hand-smoking-exhale-02.jpg) | 店内でハンドルをくわえて煙を吐く横顔 | [Esin Üstün from Istanbul, Turkey](https://commons.wikimedia.org/wiki/File:Smoking_hookah_and_daydreaming_%2815119632767%29.jpg) | CC BY 2.0 |
| [hand-smoking-group-01.jpg](hand-smoking-group-01.jpg) | 屋外でハンドルを持つ複数人。握り方 | [Fquasie](https://commons.wikimedia.org/wiki/File:Smoking_shisha.jpg) | CC BY-SA 4.0 |
| [hand-smoking-group-02.jpg](hand-smoking-group-02.jpg) | 複数台を囲む屋外の席。ホースが人ごとに1本ずつ | [Victorgrigas](https://commons.wikimedia.org/wiki/File:Smoking_Hookah_in_the_Muslim_Quarter_Jerusalem_during_Ramadan.jpg) | CC BY-SA 3.0 |
| [hand-smoking-handle-03.jpg](hand-smoking-handle-03.jpg) | 川辺の席でハンドルを持つ。アルミを張ったボウル | [Omar Chatriwala of Al Jazeera English](https://commons.wikimedia.org/wiki/File:Friends_relaxing_by_the_Tigris_-_Flickr_-_Al_Jazeera_English.jpg) | CC BY-SA 2.0 |
| [hand-smoking-metalHandle-01.jpg](hand-smoking-metalHandle-01.jpg) | 金属のハンドルを片手で持って吸う。ハンドルの長さと握り | [Jaimeluisgg](https://commons.wikimedia.org/wiki/File:Hombre_arabe_fumando_Narguil%C3%A9.jpg) | CC0 |
| [hand-smoking-metalHandle-02.jpg](hand-smoking-metalHandle-02.jpg) | 金属のハンドルで吸って煙を吐く女性。ホースの垂れ方 | [Jaimeluisgg](https://commons.wikimedia.org/wiki/File:Mujer_venezolana_fumando_Narguil%C3%A9.jpg) | CC0 |
| [hand-smoking-night-01.jpg](hand-smoking-night-01.jpg) | 夜の席で二人が吸う。ガラスベースとオレンジのハンドル | [Rosângela Bueno](https://commons.wikimedia.org/wiki/File:Two_men_smoking_the_hookah.jpg) | CC BY 2.0 |
| [hand-smoking-redHandle-01.jpg](hand-smoking-redHandle-01.jpg) | 赤いハンドルをくわえる二人。ハンドルと顔の比 | [James Gordon from Los Angeles, California, USA](https://commons.wikimedia.org/wiki/File:Hooka_time%2C_Damascus%2C_Syria_-_1.jpg) | CC BY 2.0 |
| [hand-smoking-rooftop-01.jpg](hand-smoking-rooftop-01.jpg) | 屋上で吸いながら煙を吐く。台は人の横の床置き、ホースは手元へ一本 | [Unknown authorUnknown author](https://commons.wikimedia.org/wiki/File:129491_deir_al-assad_-_the_girl_and_the_hookah_PikiWiki_Israel.jpg) | CC BY 2.5 |
| [hand-smoking-smokeRing-01.jpg](hand-smoking-smokeRing-01.jpg) | 店内で煙の輪を吐く。煙は口から出る | [Ildar Sagdejev (Specious)](https://commons.wikimedia.org/wiki/File:2008-11-08_Raisa_Sagdejeva_blowing_a_smoke_ring_at_Hookah_Bliss.jpg) | CC BY-SA 4.0 |
| [hand-table-modern-01.jpg](hand-table-modern-01.jpg) | 卓上の現代型とハンドルを持つ二人 | [Magazinostrava](https://commons.wikimedia.org/wiki/File:Pastro_%26_DJ_Behype.jpg) | CC BY-SA 4.0 |

## 写真を足したら

- 上の一覧に行を足し、`sources.json` に出典・作者・ライセンスを記録する（オーナー撮影なら「オーナー撮影」と書く）。
- `docs/shisha_reference.md` §4.0 の「まだ薄いもの」を更新する。
- 生成の記録（`*.prompt.txt` や各フォルダの README）に、どの写真を渡したかファイル名で残す。
