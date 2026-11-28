# スチルを縦画面向けに作り直す（2026-11-28・要望台帳 VPT01〜VPT05）

オーナー「このゲームのスチルを縦画面レイアウトに合わせてAPIで作り直していって」
「ついでに質感の統一感もしたい。今の新バージョンの立ち絵の絵柄に合わせてかつ、AI臭さを減らす感じで」
「スチルは室内の場合で元の見た目から破綻する場合は背景しっかりわからないようにしたい。部屋の構成が破綻したりよくある」。

本編のスチル（イベントCG）53枚を、縦画面C案「煙の舞台」の画面に合わせた **2:3（1024×1536）** の絵に作り直した。
チェキ・プリクラ（写真の収集物）と、制作途中の下描き `cg_ch1_tsumugi_sketch_wip` は対象外。

| 置き場 | 中身 |
|---|---|
| `originals/<cg_id>.webp` | 採用した原画（1024×1536・WebP 品質95。生成のPNGを変換しただけで、加工していない） |
| `prompts/<cg_id>.txt` | その原画に実際に渡した文面と参照画像の一覧 |
| `generate.py` | 生成・採用の道具と、53枚の場面の指定（`SCENES`） |
| `remake/img/cgs/portrait/<cg_id>.webp` | ゲーム（縦画面の試作）が読む絵（1024×1536・WebP 品質84） |

**本編の横画面のスチル（`assets/cgs/`・`remake/img/cgs/<cg_id>.webp`）と manifest は変えていない。** 縦の絵は今のところ縦画面の試作 `remake/previews/portrait-stage/` の「スチル」の場面だけが読む（`?view=play&scene=stills`。区切りは `&set=ch1|ch2|ch3|ch4|ch5|love`、1枚を直接なら `&still=<cg_id>`）。

## 作り方

OpenAI の画像生成API（`images/edits`、モデル `gpt-image-2.6-sunburst`、1024×1536、品質 high、1回1枚）。鍵は環境変数から読み、値は記録していない。
生成は合計70回（53場面の初回53回＋試作と作り直し17回）。

1回の生成に渡す参照画像と役割（文面の中で番号ごとに書き分ける）:

1. **今の横長のスチル**（`remake/img/cgs/<cg_id>.webp`）… 中身（瞬間・人物・しぐさ・表情・小物・時間帯・場所の色）を知るためだけ。描き方・顔・服・背景は写さない
2. **写る人物の新バージョンの立ち絵**（`remake/img/sprites/character_variants/new/<id>/chr_<id>_<表情>.webp`）… 本人（顔・髪・服・年齢・体格）
3. **画風の目標2枚** … [立ち絵の規格](../../docs/portrait_standard.md) 6節の③④（みんと営業姿・あげはの新版の通常）。本人が場面にいる時は、凛想・つむぎの新版で代える

文面は共通の6つの決まり＋場面の文でできている（`generate.py` の先頭）:

- **FORMAT（縦の構図）**: 顔・大事な手・大事な小物は上から8〜62%の高さに置く。下30%は帯と暗がりが重なるので、膝・卓・床などの静かな続きにする。横並びだった2〜3人は前後にずらして重ねる。**会話の枠・名前の札・ステータス・ボタンは描かない**（ゲームが重ねる）。
- **STYLE（新バージョンの立ち絵の絵柄）**: [立ち絵の規格](../../docs/portrait_standard.md) 3節の英文を、場面の絵向けに広げたもの。濃い輪郭線（外側をやや太く）、形のはっきりした2〜3段のセル影、髪の帯状のハイライトと目の小さなキャッチライトだけ。テカリ・エアブラシ・リムライト・光の粒・レンズフレア・写真の質感・細かすぎる模様・ドット絵の粒を入れない。主な色は髪と肌のほか3〜4色。顔は立ち絵の目・眉・鼻・口のまま、汎用の美形顔へ寄せない。
- **室内の背景（部屋を描かない）**: 壁の角・窓・棚・扉・階段・天井の線・つり下げランプの形・絵・植物を描かず、**その場所の色だけの大きなぼけ**にする（tonari なら琥珀と焦げ茶とモザイクランプの青・赤・緑、PEPPERMINT ならミントとピンク、など場面ごとに色を指定）。人物が触れている物（手前の卓の縁・座っている椅子・手の中の物・使っている台）だけをはっきり描く。きらきらした玉ぼけにはしない。
- **屋外の背景**: 場所が分かる程度に残し、人物より描き込みを少なく、少しぼかす。看板に文字を入れない。
- **はじめ**: 一人称の場面は手と袖まで。後ろ姿の場面は背中・肩・後頭部まで。顔を出すのは大会（`cg_ch1_tournament_battle`）とツーショット写真（`cg_minto_cheki`）だけ（元のスチルと同じ）。
- **文字・UI**: 文字・数字・ロゴ・透かし・ゲームの画面部品を描かない。

第2〜5章の26枚（#3952 で作ったもの）は、[`stills-ch2-ch5-3952/prompts.md`](../stills-ch2-ch5-3952/prompts.md) の場面文（正本の確認を済ませたもの）と機材の8行をそのまま読み、横長の時の「添付の部屋を使う」と構図の文だけを縦の決まりで上書きした。そのほかの27枚は、台本の `show_cg` 前後の文と今のスチルから、場面文を `generate.py` に書いた。

```bash
cd asset_sources/stills-portrait-20261128
python3 generate.py list                     # 場面の一覧（室内／屋外・はじめの写り方・台の有無）
python3 generate.py prompt <cg_id>           # 渡す文面と参照画像を見るだけ
STILLS_WORK=/tmp/stills python3 generate.py gen <cg_id> 01      # 生成（作業用フォルダに PNG と文面）
STILLS_WORK=/tmp/stills python3 generate.py adopt <cg_id> 01    # 採用: originals/・prompts/・remake/img/cgs/portrait/ へ
```

## シーシャ台が写る場面

`docs/shisha_reference.md` §4.2 の英文をそのまま足し、そのあとに試作で分かった補足を1文足した（ロータス型が王冠のようなギザギザの縁になった・ハガルが顔の0.7倍に膨らんだため、「低く平らな丸缶に通気の切れ込みと小さなつまみの蓋」「ハガル＋HMDは顔の半分まで」「床置きの台は座った人の肩まで」と書く）。準備前（ボウル未装着）の場面ではこの補足を外し、「ステムの先は小さな凸型の金属ポストだけ」と書く（補足が残っていると組み上がった台が描かれた）。
§4.3 の8行は、#3952 の26枚は `stills-ch2-ch5-3952/prompts.md`、ほかは `generate.py` の `SCENES` の `hookah` に書いてある。siryou の写真は今回の環境に無いので添付していない（検品を厳しくした）。

台が写る14枚（`cg_ch1_tournament_battle`・`cg_oneesan_first_smoke`・`cg_ch2_ageha_lesson`・`cg_ch3_national_ask_customer`・`cg_mashiro_double_apple`・`cg_ch4_festa_welcome`・`cg_ch4_traveler_tongs`・`cg_ch4_sheikh_reveal`・`cg_ch4_world_handshake`・`cg_ch5_shisha_9000`・`cg_ch5_adam_two_bowls`・`cg_ch5_tsumugi_serves_hajime`・`cg_ch5_regular_hose_lap`・`cg_ch5_cocreation_notes`）は、§4.4 の項目のうち次を原寸で見た: ホースを両端から追って1本（分岐・途切れ・人物を囲む輪なし）、ホースは側面のポートから、ステムはベースの口に真っ直ぐ、水はベースの下の方、完成・喫煙の台はHMD付きで直炭なし、未装着の2枚（シェイク登場・SHISHA-9000）はポストだけ、煙は口元からだけ。縮尺は目で比べ、大きすぎた `cg_oneesan_first_smoke` の初回（ハガル＋HMDが顔の約0.74倍）は作り直した。付け根の個別の拡大確認（§4.4 の3項目め）は未確認のものがある。

`cg_mashiro_double_apple` は、制作プラン（[ch3-mashiro-handoff](../ch3-mashiro-handoff/README.md)）の「台・HMD・炭は画角の外」を3回指定したが、3回とも台が画面の端に入った。採用した3回目は、ホースが「ハンドルの下端→1本→台の側面のポート」でつながり、煙・缶・味の名前は無い。台を消すかどうかはオーナー確認の項目にした。

## 検品と作り直し

全53枚を、元のスチル・新バージョンの立ち絵と並べて見た（本人性・服・小物・文字・UIの描き込み・縦の配置・背景の部屋が出ていないか）。作り直した場面と理由:

| cg_id | 回 | 理由 |
|---|---|---|
| 試作3枚（`cg_ch1_sumi_training`・`cg_minto_casual`・`cg_oneesan_first_smoke`） | 1→2 | 「下に会話の枠が重なる」と書いたら、**会話の枠やステータスのアイコンまで絵に描かれた**。「枠やUIはゲームが重ねるので描かない」と書き直した |
| `cg_oneesan_first_smoke` | 2→3 | ハガル＋HMDが顔の約0.74倍（§4.1.1 の基準は0.6以下）。床置きの台・補足文を足した |
| `cg_ch2_ageha_lesson` | 2→3 | HMDが王冠のようなギザギザの形でロータス型に見えない |
| `cg_ch1_tsumugi_heart_art` | 1→2 | タブレットの画面にひび割れのような白い線 |
| `cg_ch1_tournament_battle` | 1→2 | 奥の出場者2人がはじめと同じ帽子姿。台本どおりアダムとみんとにした |
| `cg_naru_last_chance`・`cg_ch3_half_cake`・`cg_ch3_national_ask_customer`・`cg_ch4_festa_welcome`・`cg_ch4_sheikh_reveal` | 1→2 | **なる・綾取が元のスチルの旧い服で描かれた**（立ち絵の差分はどれも新しい服）。この2人には服の指定を自動で足すようにした（`OUTFITS`） |
| `cg_ch4_sheikh_reveal`・`cg_ch5_shisha_9000` | 1→2 | 準備前なのに組み上がった台が描かれた（上の補足文が原因。未装着の場面では外した） |
| `cg_ch4_traveler_tongs` | 1→2 | 旅装の男の髪が明るい灰色で、日陰の椅子の同じ男と別人に見えた |
| `cg_ch5_sumi_pulls_chair` | 1→2 | スミさんの顔が帽子の影に隠れて見えない |
| `cg_mashiro_double_apple` | 1→3 | 台が写り、吐いた煙もあった（上の節） |

### アダムの服の色（VPT06・2026-11-28）

オーナー「アダムの服の色だけ直して」。新バージョンの立ち絵のアダムは**白い半袖Tシャツ＋黒い長めの腰エプロン＋黒いズボン**だが、#3952 の場面文と `data/characters.json` の `visual_concepts`（旧い設定の文）が「黒いヘンリーシャツ」のままだったため、`cg_ch5_adam_two_bowls` と `cg_ch1_tournament_battle`（奥のアダム）が黒いシャツで描かれていた。
採用した絵を入力にした images/edits（範囲指定なし）で、服の色だけを立ち絵に合わせた。ほかの人物・台・構図は変わっていない（並べて確認）。範囲指定（マスク）つきの編集は、指定の範囲の外まで描き直されて、はじめがアダムに置き換わったので使わなかった。以後の生成でも白いTシャツになるよう、`generate.py` の `OUTFITS` にアダムを足した。`data/characters.json` の文は正本の設定なので変えていない（食い違いはオーナー確認）。

残っている小さな点（作り直していない）: 凛想の試香紙がやや太い（たばこには見えない）、あげはの豹柄が丸い花のような斑点に寄る（立ち絵の柄に近い）、`cg_ch5_adam_two_bowls` のタッパーの手書きのシールは読めない線だけ（保管シールの例外の範囲）。

## 2026-11-28 追加分（VPT07〜VPT14）

オーナー「最近追加したシーンはまだスチルがないのもあるので　ボリュームや頻度的に追加案とかもあれば作って　ヌールとか新目やキャラだったりつむぎのバイトとか」「恋愛描写でヒロインたちの可愛い姿をあと何枚か見たい」「15年前のスミさんが全然見た目若くない、あとは回想シーン用に若いシェイクとかスミさんとか先代のマスターとかは立ち絵ではなくスチルで描きたい　デザインは任せる　これは何枚か候補みたい」「スチルはたまにはじめの顔が変なのがあった」「縦画面でも会話中にカットインとかたまに入る演出復活させたい」。

### 追加の案 22枚（`generate.py` の `new=True` の場面。元の横長の絵は無い）

人物ごとのスチルの数（今の53枚）を数え、0〜1枚の人物と、ヌール・つむぎのバイト・恋愛の場面から選んだ。**本編の台本にはまだ `show_cg` を入れていない**（オーナーの採用後に入れる）。試作の「スチル」の場面（`&set=new`）で、出す台詞（本編の台本の行）つきで見られる。

| cg_id | 人物 | 出す所（台本 / 場面 / 行の頭） |
|---|---|---|
| `cg_noor_confession` | ヌール（告白のスチルが無かった） | confession / confession_noor_accept /「小指が、今度は迷わずに絡んだ」 |
| `cg_hiyori_lover_shoulder` | ひより（恋人） | lover_events / lover_hiyori_lv5 /「肩に、ひよりさんの頭の重みが乗った」 |
| `cg_ageha_shaky_hand` | あげは（大会前夜・恋人） | tournament_dates / tournament_date_ageha /「差し出された手のひらに、スマホを向けた」 |
| `cg_samechan_theater` | サメちゃん | samechan / outing_samechan_1 /「そっと横を見ると、サメちゃんが」 |
| `cg_minto_epilogue`・`cg_tsumugi_epilogue`・`cg_rio_epilogue`・`cg_noor_epilogue` | 後日談 | ending / epilogue_<人> の該当行（`asset_sources/epilogue-cgs-20261111/` の横長の原案の中身を縦で描き直した） |
| `cg_hiyori_axe` | ひより・マキ | hiyori / hiyori_axe_reveal_close /「よっしゃあああ」 |
| `cg_noor_hagal` | ヌール | ch4_desert / ch4_noor_bond_finale /「包みをほどくと」 |
| `cg_ch5_tsumugi_chalkboard`・`cg_ch5_tsumugi_sendoff`・`cg_ending_shutter` | つむぎ（バイト） | ch5_main / ch5_tsumugi_full_house・ch5_match_day_arrival（sendoff）、ending / ending_salaryman_name |
| `cg_ch4_camel_watch` | ファーリス・ハリール | ch4_camel_race / ch4_camel_watch |
| `cg_ch3_yoru_playlist` | ヨル・ムカイ | ch3_mukai / ch3_mukai_yoru_playlist |
| `cg_ch3_steve_timer`・`cg_ch3_volk_jam`・`cg_ch3_emil_seal`・`cg_ch3_kuraudo_live` | スティーブ・ヴォルク・エミル・クラウド | ch3_rivals・ch3_volk・ch2_rei |
| `cg_ch4_longlong_pipe` | 王煙楼 | ch4_longlong / ch4_longlong_bond_finale |
| `cg_ch5_taiyo_chair` | 太陽 | taiyo_bond / ch5_taiyo_bond_finale |
| `cg_outing_rio_beans` | 凛想 | ch1_events / outing_rio_1 |

作り直し: ヌールの告白・つむぎの後日談（つないだ手が下3割に沈んでいた）、あげはの震えてる手（手が下の端）、エミル（空気漏れを確かめる場面なのに煙が出ていた・台が新しいステンレスだった）。

### 回想 4枚と候補（VPT09。`candidates/`）

若いスミさん・若いシェイク・先代のマスターは、立ち絵を作らずスチルで描いた。若い人物は、今の立ち絵を「顔の作りだけ」の参照に渡し、年齢・しわ・白髪・ひげ・眼鏡・帽子・服は写さないよう指示した（`generate.py` の `younger`）。色は少しだけ褪せた思い出の色（セピアや粒・ぼかしは使わない）。

- `cg_ch4_young_sumi_water`（今のスチルの作り直し。オーナー「15年前のスミさんが全然見た目若くない」）・`cg_ch4_sensu_first_shisha`（終電の晩・若い千須）: **若いスミさんの3案**（A 眼鏡なし・ひげなし／B 眼鏡・無精ひげ／C バンダナ・無精ひげ）
- `cg_ch4_cigar_bar_friend`（葉巻のバーに異国の台・若いシェイクと先代のマスター）・`cg_ch4_master_keys`（店を閉める夜に鍵を預かる）: **先代のマスターの3案**（A 白髪・丸眼鏡・蝶ネクタイ／B 坊主・口ひげ・革エプロン／C 白髪まじり・細い口ひげ・スーツ）

12枚の候補は `candidates/<cg_id>-<a|b|c>.webp`（文面は同名の `.prompt.txt`）、見比べの図は `candidates/candidates.jpg`。

**決定（2026-11-28 オーナー）**: マスターは「赤茶色のやつ」＝**案Cの顔（白髪まじりのオールバック・細い口ひげ）に、どの場面も赤茶のカーディガン**（確認の質問で「案Cの顔＋赤茶の服」）。若いスミさんは**案B（眼鏡）**のまま、「ちょっとだけ今のはじめに似てるのも良い」ので、はじめに少し似た髪と目元を許す一文を足した（`generate.py` の `YOUNG_SUMI_LOOK`）。葉巻のバー（`cg_ch4_cigar_bar_friend` の c2）と鍵の夜（`cg_ch4_master_keys` の c3）を、この決定で作り直して採用した。15年前の水と終電の晩は案Bのまま。回想の3枚（`cg_ch4_cigar_bar_friend` など）は本編の台本にまだ入れていない。

### はじめの顔（VPT08）

はじめの顔が写る2枚（`cg_ch1_tournament_battle`・`cg_minto_cheki`）が、立ち絵より目が細く鋭い・大人びた歯を見せる笑いになっていた。採用した絵を入力に、はじめの顔だけを立ち絵どおり（丸くやわらかい目・丸いあご）に描き直した（`generate.py edit <cg_id> hajime_face`。ほかの人物・台・構図はそのまま）。後ろ姿の5枚は顔が出ないので触っていない。

### 本編の縦画面で使う（VPT12）

本編の縦画面（`?look=vertical`）の会話で一枚絵が出たとき、縦に作り直した絵がある53枚は、横長の絵の代わりに縦の絵を幅いっぱいに出す（`remake/js/looks/vertical/stills.js`・`talk.js` の `syncCg`）。本編の横画面と旧版の見た目は今までどおり横長の絵。追加の案と回想の3枚は、台本に入れるまで本編には出ない。

## まだやっていないこと

- 本編の横画面への組み込みと、縦画面の時のギャラリー・縮小画像は未着手。追加の案・回想の台本への組み込み（`show_cg`）はオーナーの採用後。
- オーナーの採用判断。試作の「スチル」の場面で53枚を順に見られ、下の「横の元絵」で今の横長と見比べられる。
