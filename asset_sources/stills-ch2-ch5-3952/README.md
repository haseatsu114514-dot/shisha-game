# 第2〜5章 新規スチル26枚（#3952 選定）の制作手順

[#3952](https://github.com/haseatsu114514-dot/shisha-game/issues/3952) の80案から、登場頻度を調整して選んだ26枚の生成用資料。**生成プロンプトの全文は [prompts.md](prompts.md)**。組み込み（どの台詞で出して消すか・ギャラリー・検証）は [#3957](https://github.com/haseatsu114514-dot/shisha-game/issues/3957) に記録してある。

## 運用：1シーン3案から採用する

1. 1シーンにつき **候補を3枚**（A・B・C）生成する。3案は同じ瞬間・同じ人物・同じ禁止事項のまま、prompts.md の「3案の振り方」に書いたカメラ位置・距離を変える。**3枚並べて同じ絵に見えるなら作り直す**（引き・中・寄りか、角度がはっきり違うこと）。
2. 生成した原画は**無加工で**このフォルダに保存する（`<cg_id>/cand_a.png`・`cand_b.png`・`cand_c.png`）。各候補に実際に渡した文面を `<cg_id>/prompt_a.txt` などに残す。
3. 3枚を横に並べ、**下25%を半透明の暗い帯で塗り、65%の高さに細い目安線を引いた比較画像** `<cg_id>/compare.png` を作る（線だけにしない）。会話枠に顔・手・主役の小物が沈んでいないかを一目で見るため。
4. 26シーンが揃ってから、オーナーが1枚ずつ選ぶ。**生成の途中で採用を聞いて止まらない。** 選ばれなかった候補も消さない（`initial-not-adopted.png` と同じ扱い）。
5. **採用後の作業は別にやる**（#3957）：採用原画を `assets/cgs/<cg_id>.png` へ**同じバイトのまま**コピー → `python3 remake/tools/build_manifest.py --cgs-only <cg_id>.png` → 台本に `show_cg`／`hide_cg` → 実画面確認。生成の段階ではゲームのファイルを変えない。

新しい PNG は `.gitattributes` で Git LFS に入る。`git add` 後に `git lfs ls-files` で確認する。

## 生成の進め方（2026-11-20 オーナー指示：一気に作る）

**試作で区切らず、26シーンを選定待ちなしで最後まで生成する。** 採用は全部が揃ってからオーナーがまとめて選ぶ。詳しい要望と完了条件は [#4036](https://github.com/haseatsu114514-dot/shisha-game/issues/4036)。

- 2-07・2-11・3-01・4-03・5-10 の15枚は [#3984](https://github.com/haseatsu114514-dot/shisha-game/pull/3984)（branch `muse/stills-trial-1120`）で生成済み。同じbranchで残り21シーンを続ける。
- 順番は prompts.md に載っている順（第2章→第5章）。1章ぶん終わるごとに commit・push し、PR本文の「済み／残り」を更新する。
- 会話枠の基準（下の「検品」）を外れた案は、A〜Cを残したまま `cand_d.png` 以降に作り直しを足す。

## 26枚の一覧

| ID | cg_id | 章 | 場面（台本） | 機材 |
|---|---|---|---|---|
| 2-03 | `cg_ch2_kanzaki_id_check` | 2 | 神崎煙草店の年齢確認 `remake_ch2_delivery_kumicho` | なし |
| 2-07 | `cg_ch2_sofa_wet_cloth` | 2 | 焦げ跡に濡れ布 `ch2_sofa_burn` | 炭とトングのみ |
| 2-11 | `cg_ch2_ageha_lesson` | 2 | 吸い方講座とむせた水 `ch2_ageha_lesson` | 完成1台 |
| 2-14 | `cg_ch2_naru_score_sheet` | 2 | 光る採点表、止まる手 `ch2_naru_confrontation` | 手持ちのハガルのみ |
| 2-16 | `cg_ch2_rest_notebook` | 2 | ノートを閉じて休む（新しい短い場面） | なし |
| 2-17 | `cg_ch2_rei_earphone` | 2 | 片耳ぶんの一曲 `remake_ch2_eve_rei` | なし（閉じたケース） |
| 2-20 | `cg_ch2_ageha_white_bear` | 2 | 閉店後の白いクマ `ch2_tournament_ageha_heart` | なし |
| 3-01 | `cg_ch3_mashiro_no_craft_day` | 3 | 作らないと決めた昼 `ch3_rest_before_recovery` | なし |
| 3-21 | `cg_ch3_liars_night` | 3 | 嘘つきたちの夜の別れ際 `ch3_tournament_eve` | なし |
| 3-02 | `cg_ch3_national_ask_customer` | 3 | 炭より先に客の返事 `ch3_national_adjustment` | 完成1台 |
| 3-03 | `cg_ch3_half_cake` | 3 | 半分ずつのケーキの絵 `ch3_enmaku_cleanup` | なし |
| 3-04 | `cg_ch3_mukai_latte_cat` | 3 | そっぽを向く泡の猫 `ch3_mukai_latte_cat` | なし |
| 4-02 | `cg_ch4_festa_welcome` | 4 | FESTAの椅子と水 `ch4_festa` | 完成1台 |
| 4-03 | `cg_ch4_traveler_chair` | 4 | 名前を聞かずに席を引く `ch4_stranger_first` | なし |
| 4-05 | `cg_ch4_traveler_tongs` | 4 | 返したトングを拭く `ch4_stranger_third` | 完成1台（古い店の台） |
| 4-09 | `cg_ch4_creek_dhow` | 4 | ダウ船の荷積み `ch4_creek_dhow` | なし |
| 4-11 | `cg_ch4_noor_pencil_x` | 4 | 消さなかった× `ch4_noor_story_pencil_line` | なし |
| 4-15 | `cg_ch4_sheikh_reveal` | 4 | 四つ目の台に立つ人 `ch4_tournament_start` | 未装着4台 |
| 4-19 | `cg_ch4_young_sumi_water` | 4 | 十五年前の最初の水（回想） `ch4_ending` | なし |
| 5-06 | `cg_ch5_adam_two_bowls` | 5 | どの顔だった `ch5_free_eden_adam` | 完成2台 |
| 5-07 | `cg_ch5_tsumugi_serves_hajime` | 5 | 奥の席で受け取る一台 `ch5_tsumugi_makes_for_hajime` | 完成1台 |
| 5-10 | `cg_ch5_doctor_yunomi` | 5 | 湯のみを包む博士 `ch5_unrecorded_day` | なし |
| 5-14 | `cg_ch5_regular_hose_lap` | 5 | ホースを膝に置いた客 `ch5_relationship_before_second_cup` | 完成1台 |
| 5-19 | `cg_ch5_cocreation_notes` | 5 | 数字の隣に味の言葉 `ch5_doctor_cocreation` | 完成1台 |
| 5-20 | `cg_ch5_sumi_pulls_chair` | 5 | 帰ると椅子が引かれる `ch5_return_to_tonari` | なし |
| 5-21 | `cg_ch5_party_toast` | 5 | 打ち上げの乾杯 `ch5_party_open` | なし |

IDの `cg_ch<章>_` は、ギャラリーが章を自動で付けるための接頭辞（`remake/js/core/gallery-catalog.js`）。

## 参照画像のルール

生成ツールに渡せる参照は**5枚まで**。役割を書き分けて添付する。

| 役割 | 渡すもの | 注意 |
|---|---|---|
| 本人 | `assets/sprites/characters/<id>/chr_<id>_<face>.png` | 顔・髪・服・年齢感の正本。汎用の顔へ寄せない |
| 場所 | `assets/backgrounds/<bg>.png` | 間取り・材質・照明の参照。背景の中の機材の付け根は正解として写さない |
| 画風 | 指定した採用済みCG（`assets/cgs/`） | **描き方だけ**。人物・構図・小物・機材を写さない |
| 機材 | `../siryou/shisha-hardware-reference/web-refs/images/` から、**台の全体（ベース〜受け皿）が写る日本の店の写真1枚** | 構造と縮尺だけ。写真の内装・ロゴは写さない。siryou が無いPCでは添付せず、検品を厳しくする |

早見表・構造図は添付しない（図の見た目が絵に移る。`docs/shisha_reference.md` §4.3）。

## 検品（候補ごと・原寸で見る）

- **本人**：正規立ち絵と顔を拡大して並べる。髪・目の色、服、年齢感。アダムの髪は本人の左が緑・右が赤（正面では画面左が赤）。
- **会話枠**：顔・大事な手・主役の小物が上65%に入っている。**主役の上端と下端が画面の何%の高さか（上端0%・下端100%）を測って qa.md に数字で書く。** 下端が65%を超えたら不合格。直すときは同じ画像を編集して主役を上へ動かす（カメラを引く・人物を少し小さくする・卓を中段へ上げる）。
- **小物**：指定にないキャンドル・観葉植物・腕時計・アクセサリー・飾りを足していない。人物の持ち物は立ち絵にある物と本文に書いた物だけ。
- **はじめ**：顔が写っていない（手・袖・肩・背中まで）。
- **文字**：紙・画面・看板・缶・タッパーに読める文字・数字・ロゴがない。擬似文字もない。
- **機材がある絵**：`docs/shisha_reference.md` §4.4 を通す。ホースは1本ずつ両端から追い、分岐・第三の端・浮きがない。HMD は1モデル、炭はHMDの中に2〜3個（未装着の絵では台の先は小さな凸型の金属ポストだけ）。ハガル＋HMD＋炭の高さ÷台全体が0.12〜0.2、÷顔の高さが0.6以下。
- **AIっぽさ**：`docs/asset_ai_guidance.md` の必須5項目（テカリ・量産顔・擬似文字・小物の崩れ・既存CGと同じ描き手か）。

検品の結果は `<cg_id>/qa.md` に候補ごと1〜3行で残す（測った主役の高さ、合格・不合格の理由。確認していない項目は「未確認」と書く）。基準を外れたら、ほかが良くても「合格」にしない。
