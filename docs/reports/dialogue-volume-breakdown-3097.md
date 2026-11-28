# 章ごとの台詞量と場面別の内訳

2026年11月28日、main の [bfec5e97](https://github.com/haseatsu114514-dot/shisha-game/commit/bfec5e970921432cabf2b1be2f3abcd0e019e4a0) を集計。**全台本フォルダーの本文は833,935字**。このうち章名付き80ファイルが511,328字、章名のない47ファイルが322,607字。以下のグラフと表は、前回と同じく章名付き台本の全分岐を対象とする。1回のプレイで読む字数は、選択肢・訪問先・交友関係で変わる。

![章ごとの台詞量を9種類の場面に分けた積み上げ棒グラフ](dialogue-volume-breakdown-3097.png)

## 字数

| 章 | 本編進行 | 交流・好感度 | 外出 | 大会・最終戦 | 日常・スポット | 仕事・配達 | 制作練習・チュートリアル | LIME場面 | その他 | 合計 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 第1章 | 10,643 | 61,349 | 4,930 | 9,918 | 17,250 | 2,437 | 5,208 | 415 | 0 | 112,150 |
| 第2章 | 18,270 | 43,976 | 2,304 | 5,138 | 25,374 | 11,834 | 2,927 | 0 | 0 | 109,823 |
| 第3章 | 22,416 | 43,561 | 5,281 | 4,591 | 26,393 | 6,463 | 800 | 0 | 0 | 109,505 |
| 第4章 | 15,117 | 40,708 | 8,640 | 8,499 | 30,949 | 4,011 | 1,534 | 0 | 0 | 109,458 |
| 第5章 | 18,502 | 17,325 | 1,280 | 2,977 | 17,006 | 11,611 | 1,691 | 0 | 0 | 70,392 |
| 全章 | 84,948 | 206,919 | 22,435 | 31,123 | 116,972 | 36,356 | 12,160 | 415 | 0 | 511,328 |

## 章ごとの構成比

| 章 | 本編進行 | 交流・好感度 | 外出 | 大会・最終戦 | 日常・スポット | 仕事・配達 | 制作練習・チュートリアル | LIME場面 | その他 | 合計 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 第1章 | 9.49% | 54.70% | 4.40% | 8.84% | 15.38% | 2.17% | 4.64% | 0.37% | 0.00% | 100% |
| 第2章 | 16.64% | 40.04% | 2.10% | 4.68% | 23.10% | 10.78% | 2.67% | 0.00% | 0.00% | 100% |
| 第3章 | 20.47% | 39.78% | 4.82% | 4.19% | 24.10% | 5.90% | 0.73% | 0.00% | 0.00% | 100% |
| 第4章 | 13.81% | 37.19% | 7.89% | 7.76% | 28.27% | 3.66% | 1.40% | 0.00% | 0.00% | 100% |
| 第5章 | 26.28% | 24.61% | 1.82% | 4.23% | 24.16% | 16.49% | 2.40% | 0.00% | 0.00% | 100% |

## 交流と大会の再点検（VOL23）

第2〜4章の総量は第1章の97.6〜97.9%。交流・好感度は第1章の61,349字に対して、第2章43,976字、第3章43,561字、第4章40,708字。第4章には別枠の外出8,640字と日常・スポット30,949字があり、ツアーや現地での再訪でも人と話す。各枠の字数と、実際に誰とどこで会話できるかを併せて判断した。

| 章 | 任意で読める交流 | 大会中とその後 |
| --- | --- | --- |
| 第2章 | 地元の店で7人に計30場面。みんとの傘の話、つむぎが客席で聞く炭の音など、通うと前と違う話を聞ける。 | 提供・調整の合間と講評待ちに出場者が話す。終了後に自分の一台を吸い、苺の香りまで遠く感じる場面は、はじめの感覚に集中する。 |
| 第3章 | mukaiの奥の部屋で休むと、連絡先を知っている地元の10人から計17本（6,844字）の候補。初回の休みは部屋で過ごし、先約のある夜や来訪中の相手には条件が付く。 | 全国大会は最後に台から手を離した四人のやりとりまである。優勝の夜は奥の部屋に一人で戻り、スミさんに連絡する。 |
| 第4章 | 宿で昼に休むと、現地に来ていない知人13人から計20本（6,316字）の候補。初回の休みを終えてから、読める相手の一人目の電話を二本目より先に選ぶ。 | 世界大会では客席の声が入り、優勝後には朝に送り出した人が客席から降りてくる。来場者から恋人を先に最大4人。その日の顔ぶれで台詞が変わる。 |

共通台本 `tournament_craft.json` は章別グラフの範囲外。例として、章指定のある幕間（`interlude1/2/3` と `interlude_pull`）、工程終了（`roundend`）、客席（`stands`）だけでも、第2章16場面・1,565字、第3章3場面・490字、第4章27場面・1,540字ある。勝敗や票、来場者による差分を含む。[大会中の台本選択](../../remake/js/craft/tournament-story-data.js)

**VOL23は今回の増補分を完了とした。** 当初薄かった地元の顔なじみとの再訪・電話と、大会途中の待ち時間・来場者の応援に、実装上の入口と台本の両方を確認した。第2章の味が遠のく場面、第3章の優勝の夜には会話を追加しない。第5章はもともと増量目標の対象外。

## LIMEの読み方

グラフの415字は、第1章の章名付き台本でなる・アダムのメッセージを読む2場面。受信箱には別データから全章のメッセージが届く。朝の通常枠は2通、重要な連絡が重なると最大3通で、シフトの誘いは別枠。同じ人の普段の雑談は関係に応じて2〜6日空け、雑談が2朝続くと次の朝は休む。仕事を除く未読が3通以上ある間も日常の雑談を抑える。ここで示したのは配信条件で、プレイ中の平均受信数は未計測。[朝の配信条件](../../remake/js/daily/lime-pacing.js)

## 集計方法と分類の定義

[既存の章別計測](../../tools/chapter_volume.py)の `load_files`、`chapter_of`、`count_text` を再利用した。対象は `data/dialogue/` 直下の `chN*.json` と `remake_chN*.json`（Nは1〜5）。各 `dialogues[]` 要素の `text` 文字列を再帰走査し、Pythonの正規表現 `\s` に一致する空白を除いた文字数を足した。選択肢や条件で分かれる本文も、`text` で保存されていれば一律に含む。場面件数は `dialogues[]` の要素数で、分岐数・周回時の再生数・プレイヤーが一度のプレイで読む量には換算しない。台本内の置換用文字列は保存されている形で数えた。JS内の文言、章名のない台本、LIME専用データ（`lime_*.json` や `data/lime_messages.json`）は対象外。

章はファイル名で決める。例えば、`ch3_ch4_home.json` の `ch4_prep_adam` は第3章に入る。

| 種類 | 判定に使った場面・進行定義 |
|---|---|
| 本編進行 | 導入、日程に沿う事件、期限救済、物語の後日談。任意でも本筋を補う場面を含む。第1章の `NIGHT_EVENTS`、第2章の `CH2_NIGHTS`・`CH2_DAY_SCENES`、第3章の `CH3_DAILY_PLAN`、第4章の `ch4-progress.js`、第5章の `CH5_AFTERMATH` などを参照。 |
| 交流・好感度 | 人物の訪問・好感度段階、関係の締め、恋人・友人別の会話、交流の集まり。スミさんの訪問列は練習の話題も訪問列として扱う。`affinity-stages.js`、`ch3-story-wiring.js`、`ch3-party.js`、`ch4-lovers.js` などを参照。 |
| 外出 | 一緒に出かける約束、個別の寄り道、ツアーや章内旅行の移動。通常の再訪、散歩や施設の利用は日常・スポット。`outing_*`、`ch3-social.js`、`ch3-outing-progress.js`、`ch4-tour.js`、`ch5-travel.js` などの定義を参照。 |
| 大会・最終戦 | 受付、出場者説明会、前夜祭での大会側の受付、当日の対戦・審査・勝敗と当日挿入される回想。第1〜4章の大会進行、第5章の `CH5_MATCH_SCENES` と二杯目直前の試作回想を参照。 |
| 日常・スポット | 通常の来店・再訪、施設の利用、通勤、休養、散歩や現地のミニゲーム。 `daily/spots.js`、`ch2-outings.js`、`ch3-outing-progress.js`、`ch4-dubai-daily.js` などの巡回・場所定義を参照。 |
| 仕事・配達 | 店のシフト、店番・仕事の手伝い、買い出し・配達、出張シーシャ。`daily/calendar.js`、`ch3-outing-progress.js` の手伝い・店番、`ch4-staff-work-progress.js`、`ch5-catering.js` などを参照。 |
| 制作練習・チュートリアル | 初回の遊び方、成長盤の案内、制作の試作・リハーサルやその講評。`first-brew.js`、`daily/reflection.js`、`ch2-craft-prep.js`、`ch4-inn-trial.js`、`ch5-sumi-trial.js` などを参照。 |
| LIME場面 | 第1章の大会後、なる・アダムからのLIME本文を章名付き台本で再生する2場面。対面でLIMEを交換する場面は交流・好感度。 |
| その他 | 進行上の種類を割り当てられない未接続・テスト用・空の台本。今回の該当は0件。 |

進行・行動を確認してファイルごとに基本の種類を割り当て、複数の種類を含むファイルでは下表の場面IDを優先した。1つの要素は1種類にだけ入る。`*` は末尾の任意の文字列（0文字も含む）。ファイル名は `data/dialogue/` からの相対名で、拡張子 `.json` を省略した。

### ファイルごとの基本分類

| 種類 | ファイル |
| --- | --- |
| 本編進行 | `ch1_main`, `ch1_interval`, `ch2_choice_echoes`, `ch2_isolation`, `ch2_main`, `ch2_story_extra`, `remake_ch2`, `ch3_departure`, `ch3_double_apple`, `ch3_main`, `ch3_prologue`, `ch4_dubai_story`, `ch4_main`, `ch5_main`, `ch5_party` |
| 交流・好感度 | `ch1_adam`, `ch1_ageha`, `ch1_bonds`, `ch1_events`, `ch1_minto`, `ch1_naru`, `ch1_rio`, `ch1_sumi`, `ch1_tsumugi`, `ch2_ageha_story`, `ch2_kumicho`, `ch2_preparation`, `ch2_rei`, `ch3_ch4_home`, `ch3_growth_party`, `ch3_home_calls`, `ch3_mashiro`, `ch3_rivals`, `ch3_saku_mashiro`, `ch3_tsumugi`, `ch3_volk`, `ch4_ageha_dubai`, `ch4_arrival_daily`, `ch4_companion`, `ch4_guests_dubai`, `ch4_home_calls`, `ch4_longlong`, `ch4_lovers`, `ch4_mashiro_dubai`, `ch4_minto_dubai`, `ch4_prep_home`, `ch4_rio_dubai`, `ch4_tsumugi_dubai`, `ch4_visitors` |
| 外出 | `ch3_visits`, `ch4_beach`, `ch4_tour` |
| 大会・最終戦 | `ch1_tournament`, `ch2_tournament`, `ch4_morning` |
| 日常・スポット | `ch1_incognito`, `ch1_spots`, `ch2_city`, `ch2_city_guests`, `ch2_home`, `ch3_activities`, `ch3_club`, `ch3_mukai`, `ch3_outings`, `ch3_tokyo_daily`, `ch4_camel_race`, `ch4_desert`, `ch4_dubai_daily`, `ch4_spots`, `ch5_dubai`, `ch5_shops`, `ch5_tokyo`, `remake_ch1` |
| 仕事・配達 | `ch2_deliveries`, `ch2_tonari_talks`, `ch3_deliveries`, `ch4_staff_work`, `ch5_catering`, `ch5_catering_origin` |
| 制作練習・チュートリアル | `ch3_trials` |

### 場面IDで上書きする分類

| ファイル | 種類 | 場面ID |
| --- | --- | --- |
| `ch1_adam` | 外出 | `ch1_adam_outing_dagurikura` |
| `ch1_events` | 外出 | `outing_*` |
| `ch1_interval` | LIME場面 | `interval_day1_naru_lime`, `interval_day2_adam_lime` |
| `ch1_main` | 制作練習・チュートリアル | `ch1_tutorial_oneesan*` |
| `ch1_main` | 大会・最終戦 | `ch1_meet_rivals` |
| `ch1_rio` | 日常・スポット | `ch1_shop_rio_first`, `ch1_shop_rio_return`, `ch1_shop_rio_monitor`, `ch1_shop_clerk` |
| `ch1_rio` | 仕事・配達 | `ch1_shop_rio_errand`, `ch1_shop_rio_delivery` |
| `ch1_spots` | 交流・好感度 | `samechan_minto_followup`, `hiyori_minto_seat_followup` |
| `ch1_spots` | 制作練習・チュートリアル | `kannon_growth_intro` |
| `ch1_sumi` | 制作練習・チュートリアル | `ch1_sumi_attack` |
| `ch1_sumi` | 本編進行 | `ch1_sumi_eve` |
| `ch1_tsumugi` | 本編進行 | `ch1_tsumugi_eve`, `ch1_tsumugi_work_in_progress` |
| `remake_ch1` | 制作練習・チュートリアル | `remake_tutorial_*`, `remake_first_brew_*`, `remake_midcheck*`, `remake_rehearsal_*`, `remake_preparation_*`, `remake_naru_match*`, `remake_staff_practice` |
| `remake_ch1` | 大会・最終戦 | `remake_round*`, `remake_judging_intro`, `remake_defeat_follow`, `remake_sick_tournament` |
| `remake_ch1` | 本編進行 | `remake_sick_half`, `remake_sick_full`, `remake_homecoming_*` |
| `remake_ch1` | 仕事・配達 | `remake_baito*`, `remake_day1_errand_*`, `remake_delivery_*`, `remake_lemon_gift` |
| `remake_ch1` | 交流・好感度 | `remake_shuraba_*` |
| `ch2_ageha_story` | 本編進行 | `remake_ch2_ageha_scout`, `remake_ch2_ageha_tasting`, `remake_ch2_ageha_slump` |
| `ch2_deliveries` | 日常・スポット | `remake_ch2_aquarium_*`, `remake_ch2_sento_*`, `remake_ch2_chain_*`, `remake_ch2_purikura_solo*` |
| `ch2_deliveries` | 外出 | `remake_ch2_ageha_purikura`, `remake_ch2_purikura_invite`, `remake_ch2_purikura_match`, `remake_ch2_purikura_choose`, `remake_ch2_purikura_trio`, `remake_ch2_purikura_pair`, `remake_ch2_purikura_guest`, `remake_ch2_purikura_ryuji`, `remake_ch2_kuraudo_purikura_after` |
| `ch2_deliveries` | 交流・好感度 | `remake_ch2_kuraudo_trpg`, `remake_ch2_ageha_aquarium`, `remake_ch2_kumicho_sento`, `remake_ch2_ryuji_melty_greeting`, `remake_ch2_kuraudo_melty_greeting` |
| `ch2_home` | 交流・好感度 | `ch2_rio_*`, `ch2_minto_*`, `ch2_adam_*`, `ch2_samechan_*`, `ch2_hiyori_*`, `ch2_naru_*`, `ch2_tsumugi_*` |
| `ch2_home` | 制作練習・チュートリアル | `ch2_prep_*` |
| `ch2_kumicho` | 外出 | `outing_*` |
| `ch2_main` | 制作練習・チュートリアル | `ch2_strawberry_trial_*` |
| `ch2_rei` | 外出 | `outing_*` |
| `ch3_main` | 大会・最終戦 | `ch3_registration`, `ch3_tournament_day`, `ch3_national_*` |
| `ch3_mukai` | 本編進行 | `ch3_mukai_intro`, `ch3_cigarman_rumor`, `ch3_cigarman_shadow`, `ch3_cigarman_trace` |
| `ch3_outings` | 仕事・配達 | `ch3_outing_mukai_help*`, `ch3_outing_mukai_steve*` |
| `ch3_outings` | 外出 | `ch3_outing_enmaku_notes`, `ch3_outing_enmaku_answer`, `ch3_outing_steve_timer` |
| `ch3_rivals` | 本編進行 | `ch3_ayatori_first`, `ch3_ayatori_advice`, `ch3_steve_low_heat` |
| `ch3_rivals` | 外出 | `outing_*` |
| `ch3_volk` | 本編進行 | `ch3_volk_first` |
| `ch3_volk` | 外出 | `outing_*` |
| `ch4_desert` | 交流・好感度 | `ch4_noor_*` |
| `ch4_desert` | 外出 | `ch4_desert_sunset_*` |
| `ch4_dubai_daily` | 交流・好感度 | `ch4_naru_dubai_*`, `ch4_sumi_call_*` |
| `ch4_dubai_daily` | 制作練習・チュートリアル | `ch4_inn_trial_*`, `ch4_rehearsal_*` |
| `ch4_longlong` | 日常・スポット | `ch4_longlong_visit_*` |
| `ch4_main` | 大会・最終戦 | `ch4_wang_reception*`, `ch4_tournament_start`, `ch4_final`, `ch4_result`, `ch4_defeat`, `ch4_sensu_old_rival` |
| `ch4_main` | 日常・スポット | `ch4_festa_revisit`, `ch4_alley_cafe_quiet`, `ch4_dubai_souq_revisit`, `ch4_dubai_cafe_revisit`, `ch4_inn_tool_care` |
| `ch4_main` | 交流・好感度 | `ch4_samechan_dubai_evening`, `ch4_hiyori_dubai_evening` |
| `ch5_dubai` | 外出 | `ch5_dubai_go`, `ch5_dubai_back`, `ch5_dubai_arrival` |
| `ch5_dubai` | 交流・好感度 | `ch5_noor_*`, `ch5_dubai_sheikh*`, `ch5_dubai_taiyo*` |
| `ch5_main` | 大会・最終戦 | `ch5_match_day_arrival`, `ch5_copy_first_cup`, `ch5_relationship_before_second_cup`, `ch5_second_cup_*`, `ch5_prep_recall_*`, `ch5_sumi_trial_recall_*` |
| `ch5_main` | 日常・スポット | `ch5_wang_tonari_visit`, `ch5_free_first_visitor` |
| `ch5_main` | 交流・好感度 | `ch5_free_mashiro_visit*`, `ch5_free_eden_adam`, `ch5_tsumugi_serving`, `ch5_tsumugi_makes_for_hajime`, `ch5_tsumugi_busy_night`, `ch5_tsumugi_little_notes`, `ch5_tsumugi_counsel`, `ch5_tsumugi_menu_board` |
| `ch5_main` | 制作練習・チュートリアル | `ch5_free_tonari_practice`, `ch5_prep_trial_*`, `ch5_prep_adjust_*`, `ch5_prep_keep`, `ch5_sumi_trial_intro`, `ch5_sumi_trial_great`, `ch5_sumi_trial_holes`, `ch5_sumi_trial_heat`, `ch5_sumi_trial_steam`, `ch5_sumi_trial_pull`, `ch5_sumi_trial_failed` |
| `ch5_shops` | 交流・好感度 | `ch5_ageha_lover_*`, `ch5_rio_naru_*` |
| `ch5_tokyo` | 外出 | `ch5_tokyo_van_first`, `ch5_tokyo_go`, `ch5_tokyo_back`, `ch5_tokyo_arrival` |
| `ch5_tokyo` | 仕事・配達 | `ch5_tokyo_mukai_help*` |
| `ch5_tokyo` | 交流・好感度 | `ch5_tokyo_steve*`, `ch5_tokyo_volk*`, `ch5_tokyo_saku*`, `ch5_tokyo_ayatori*`, `ch5_tokyo_mashiro*`, `ch5_steve_bond_finale`, `ch5_volk_bond_finale` |

## 検算と再集計

章名付き80ファイル・1,666場面を分類した。各ファイルで場面合計とJSON全体の `text` の字数が一致し、各章の合計も `tools/chapter_volume.py` の結果と一致する。全台本フォルダーの字数には `data/dialogue/*.json` の同じ本文キーを使用した。フォルダー外の受信箱データ、JS内の台詞、画面の項目名などはこの総数に含めていない。

今回の分類では、第2章の店で人物本人と話す7人分と第3・4章の地元からの電話を交流に計上した。人物の改名は現在の場面IDに合わせた。第5章のつむぎ視点で始まる8場面は本編、店でのつむぎの訪問6場面は交流に分けた。上表が再集計時の分類表になる。

```sh
python3 tools/chapter_volume_breakdown.py > chapter-volume.csv
python3 tools/chapter_volume_breakdown.py --chart chapter-volume.png
```

CSV出力はPython標準ライブラリのみで動く。グラフにはmatplotlibと日本語フォントを使用する。`--font` でフォントのファイルを指定できる。
