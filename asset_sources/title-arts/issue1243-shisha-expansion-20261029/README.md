# タイトル画面キービジュアル候補・拡充分（Issue #1243・シーシャ中心テーマ）

タイトル画面右側アート用の**追加候補**です。オーナー指示（2026-10-29）「シーシャにちなんだタイトルアートをもっと増やしていきたい」に基づく**候補プールの拡充**で、既存50候補（Draft PR #1287）と、オーナー選定済みの10枚（#1243 コメント 6476391764）を置き換えるものではありません。**候補・オーナー選定用の Draft PR で、採用前提ではありません。ゲーム本体の素材（remake/img・manifest・コード）は一切変更していません。**

## 背景: 既存50候補のテーマ分類（実測）

分類基準: A=シーシャ中心（器具・喫煙・煙・店のシーシャ作業そのものが主題）／B=シーシャ関連（フレーバー素材・香り・調査が主題、またはシーシャ店が舞台だが主題は別）／C=非シーシャ。

- **A シーシャ中心: 9/50（18%）** ／ B 関連: 23 ／ C 非シーシャ: 18
- キャラ別 A の枚数: スミ3、なる1、アダム1、みんと1、あげは1、ましろ1、サメちゃん1、**つむぎ0、凛0、ひより0**

シーシャ中心の候補が全体の2割未満で、3キャラは0枚だったため、全10キャラにシーシャが主役級の場面を各3案ずつ追加しました（候補番号は前回の1〜5に続く **6〜8**）。

## 制作方法（役割分担はオーナー指示）

- **シチュエーション＋生成プロンプト: Codex A**（gpt-6-astra / effort high の下書き）。調整役が `docs/setting_book/02_characters.md` と照合して確定（アダムの左右配色ルール、サメちゃんのパペットは右手、凛は眼鏡なし、みんとの節度ある服装、あげはの若々しい顔立ち等を確認）。設計正本は `prompts/` 内の各キャラファイル
- **画像生成: Codex A**（gpt-6.1-sol / medium）。各キャラの立ち絵（sprite）と既存タイトルアート（ある場合）を参照に生成。全30枚 **1024×1536 PNG**
- 生成ゲート: 当夜の書き込み障害（生成画像の0バイト化）のため、障害解消の実測（2026-10-29 03:16 司令塔確認）後に試し生成1枚で再判定し、**2,222,034バイトで正常保存を確認**してから本制作に入りました
- 明らかな破綻・指定逸脱がある場合は1回まで再生成（実績5件: つむぎ6＝煙に猫の顔が明確に出た初回を却下し「見えるか見えないか」の表現へ、なる7＝煙の流れの分離、みんと8＝構図と照明、ましろ6＝既存絵と近い構図の回避、ましろ8＝螺旋煙と炭の分離）。残った軽微な指定差分は `prompts/<キャラ>-report.md` に記録

## フォルダ構成

- `candidates/<キャラ>/title_art_<キャラ>_new<NN>_<場面>.png` … 原寸候補（30枚、NN=06〜08）
- `candidates/<キャラ>/title_art_<キャラ>_new<NN>_<場面>.webp` … ゲーム組込用 WebP 版（同30枚）
- `compare/<キャラ>_compare.jpg` … キャラごとの3枚比較シート（10枚）
- `prompts/<キャラ>.md` … 企画＋プロンプト全文、`<キャラ>-report.md` … Codex の生成記録（方法・再生成・破綻・自己評価）

## 新規30場面の一覧

| キャラ | 6 | 7 | 8 |
|---|---|---|---|
| sumi | quiet_service（完成した一台をトレイで客席へ） | apple_fan_packing（ダブルアップルの葉を扇状に詰める） | amber_storefront（夕方の店先で組み上げた一台） |
| naru | dessert_layers（デザートのように葉を重ねる） | lemonade_smoke_ribbon（氷レモネードの上を渡る煙のリボン） | cream_cloud_showcase（クリーム色の煙柱と完成した一台） |
| adam | double_apple_orchestra（10個のダブルアップルボウルを指揮） | apple_smoke_sommelier（ベースの中で渦巻く煙を味わう） | twin_apple_throne（赤と緑の二台に挟まれた玉座） |
| tsumugi | window_smoke_cat（窓辺の煙が葉耳の猫に見える） | pencil_and_hose（鉛筆とホース、煙の曲線を観察） | quiet_blend_preparation（自作レシピ『夜のスケッチ』を詰める） |
| minto | peach_sorbet_finish（『ピーチ・ソルベ』の仕上げ） | aurora_dream_service（『オーロラ・ドリーム』をトレイで提供） | after_hours_glasscare（閉店後、素の姿でベース磨き） |
| rin | midnight_hagal_trial（深夜、専用ハガルで試し吸い） | blend_library_command（フレーバー缶の壁で二缶を比較） | amber_glass_window（閉店間際、ウィンドウのベースを整える） |
| ageha | perfect_coal_moment（震える手を克服した炭置きの瞬間） | tropical_bowl_parfait（パフェのように見せるボウル） | peach_cloud_wink（丸い煙の塊越しのウインク） |
| mashiro | velvet_dense_exhale（ダークリーフの濃い煙を吐く） | sleepy_tea_audience（紅茶と重厚な一台に囲まれる） | drifting_spiral_watch（螺旋にほどける煙を見上げる） |
| hiyori | peach_scent_composure（儚げポーズと隠せない目の輝き） | one_day_return_service（一日だけ復帰して一台を運ぶ） | ponytail_after_hours（ソファで跳ねるポニーテールの先） |
| samechan | korochan_duet_rings（コロちゃんと二つの小さな煙の輪） | blue_base_supervision（青い水と氷、パペットの監督） | tide_scepter_declaration（一台を三叉の矛に見立てた宣言） |

## 調整役のおすすめ（最終選定はオーナー）

| キャラ | おすすめ | 理由 | 次点 |
|---|---|---|---|
| sumi | 6. quiet_service | トレイに載った一台と静かな笑顔。「提供する店主」の一枚で完結する | 7. apple_fan_packing |
| naru | 7. lemonade_smoke_ribbon | 看板メニューの氷レモネードと煙のリボン。なるの研究者気質が映える | 6. dessert_layers |
| adam | 8. twin_apple_throne | 赤と緑の二台が左右から挟む玉座構図。配色ルールごと彼の芝居になる | 6. double_apple_orchestra |
| tsumugi | 6. window_smoke_cat | 彼女のモチーフ「煙の生き物」が自然な煙の偶然として立つ唯一の一枚 | 8. quiet_blend_preparation |
| minto | 6. peach_sorbet_finish | 看板レシピの仕上げをプロの微笑みで。店主としての彼女が出る | 7. aurora_dream_service |
| rin | 6. midnight_hagal_trial | 専用ハガルを手前に、自分の肺で見極める凛の厳しさと気だるさ | 7. blend_library_command |
| ageha | 6. perfect_coal_moment | 炭を置ききった安堵のガッツポーズ。彼女の内面まで描けた一枚 | 8. peach_cloud_wink |
| mashiro | 6. velvet_dense_exhale | 重い煙そのものが主役。ましろ固有の満足感が最も濃い | 7. sleepy_tea_audience |
| hiyori | 6. peach_scent_composure | 素焼きハガルの一台を前にした儚げな横顔と上機嫌の目の対比 | 7. one_day_return_service |
| samechan | 6. korochan_duet_rings | 本人とコロちゃんの「二人同時」リング。魔王の芝居と照れが同居 | 7. blue_base_supervision |

## 次のステップ

今後の選別では、既存50候補・選定済み10枚とあわせて本30枚も候補プールに含める（オーナー方針: 過去に決定済みのアートも今後の選別候補に含める）。採用分のみ別 PR で `remake/img/ui/title_arts/` へ反映する。
