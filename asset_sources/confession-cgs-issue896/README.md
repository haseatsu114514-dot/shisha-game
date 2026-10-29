# 現行ルートの告白CG 3枚（#896 A6）

2026-10-23の「他の生成が必要な画像があれば進めて」に基づく新規CG。正規立ち絵・data/dialogue/confession.jsonを参照し、既存show_cgへ実画像を登録した。採用確認・merge・公開前の保存候補。

| ID | 台本・構図 | 本人参照 |
| --- | --- | --- |
| cg_minto_confession | 私服の栞、夜の川沿いで主人公の腕に寄り添う | minto/chr_minto_ura_normal.png・ura_smile.png、hajime/chr_hajime_normal.png |
| cg_tsumugi_confession | 夜の商店街の帰り道、主人公の服の裾を掴み、タブレットを抱える | tsumugi/chr_tsumugi_normal.png、hajime/chr_hajime_normal.png |
| cg_rin_confession | 閉店後の問屋街、試香紙を持ち、余裕が少しほどけた笑顔 | rin/chr_rin_normal.png |

本人・衣装はassets/sprites/characters/の上記原画、粒度・材質・照明はassets/ui/title_arts/title_art_keyvisual_01.pngを実際に開いてimagegenへ添付した。タイトル絵の人物・機材は転用していない。3枚とも非喫煙場面でシーシャ台なし。台詞・恋愛条件・報酬は変更なし。

原画はassets/cgs/cg_*_confession.pngに無加工保存。実プロンプトはこのフォルダ、SHA256・参照はsources.json。1672×941横長。build_manifest.pyに既存の背景等と同じ限定更新--cgs-onlyを追加し、3CGだけをWebPへ変換・manifestに登録。既存画像の一括取得・再変換なし。元のmanifest項目を保持し、generatedとcgs/webpへの3追加だけが変化することを構造比較した。

## 目視・修正

- みんと: 黒髪・緑の瞳・クリームのカーディガン・緑のペンダント・バッグ、照れた表情と両手の袖掴みを確認。PC会話枠は下側の手を覆うが、顔と上側の手による腕への寄り添いは見える。DSでは全体表示。
- つむぎ: 初稿は会話枠で裾を掴む手が隠れたため不採用。引きの構図へ修正したv2は靴下が短くなり不採用。v3で正規の膝下までの黒靴下と黒い靴へ戻した。最終版は顔と裾を掴む手がPC/横タッチ/DSすべてで見える。v3の夕暮れの住宅街は実際の発生場所・時間と不一致だったため、v4で実背景bg_street_night.webpを参照して夜の商店街へ修正。rejected/に元3枚を保持し、本編には登録しない。
- 凛: 髪型・灰青の瞳・輪のピアス・長方形ペンダント・白シャツ・黒ベルト/パンツを確認。試香紙は平たい1本で、煙やタバコにしない。顔・紙・手は会話枠より上。
- 3枚の原画とPC表示、横タッチ凛、DSみんと、最終つむぎの全3表示を目視した。全9スクリーンショットを保存したが、未目視の組合せを目視確認済みとは扱わない。

## 検証

実ChromiumでPC1280×720、横タッチ844×390、DS1280×720の各3枚、計9ケースを表示。実DBのconfession_*_acceptからshow_cgと次の台詞を取り出し、実VN playで表示・WebP全decode・CG ID・寸法・pageerrorなしを確認（browser-qa.json）。つむぎ最終版は3ケースを再実行（browser-tsumugi-final-qa.json、同名スクリーンショットは最終版）。自然な恋愛条件達成からの通しではない。みんとの名前欄???は新規stateで紹介flagを立てていないfixtureによるもので、台詞や名前表示コードは変更していない。

manifest差分を構造比較し既存項目保持、追加CG3件・WebP3件だけを確認。不正パス--cgs-only ../bad.pngを拒否しmanifestを変更しないこと、Python構文、git diff --check、Git Safetyも成功。全章通し・実機Safari・自然な告白選択/ギャラリー解放・CI・独立レビューは未完。

予約: #896 run39958116924 success、CLAIMED_ISSUE=896、bot owner codex-896-flavors-20261023-a一致。箱のPR #898とは別branchで保存。

NEXT: 3CGの採用確認、必要CI・レビュー、自然な告白経路の確認後に統合。箱PR #898はfirst_brew.mjs:123の共有CI失敗で未統合（修正中PR #870）。本台帳の他項目は未完。

## 発生場所・時間の照合（ユーザー指摘への修正）

remake/js/daily/calendar.jsの夜行動後にromance.jsのmaybeConfessionが呼ばれ、slot >= 2（夜）で発生する。data/dialogue/confession.jsonの冒頭とacceptを照合した。

- 栞: 冒頭に「川沿いの遊歩道」。夜・私服・腕に寄り添うCGは台本と一致。
- つむぎ: 台本は帰り道。専用背景指定がなく、実行時は共通通り背景の夜差分。夕暮れの住宅街という初稿の補完は撤回し、実際の夜の商店街の庇・シャッター・店舗配置を画像参照して修正。
- 凛: 閉店間際の問屋街、シャッターの下りた通り。夜の問屋街CGは台本と一致。

栞・凛もCG前には共通通り背景が使われ、専用の川沿い・問屋街背景は未実装。今回の変更はCGのみで、台本・発生条件・背景指定は変更していない。つむぎv4はPC/横タッチ/DSの3表示を再検証。

## 告白CG 4枚の追加登録（2026-10-29）

オーナー選定（2026-10-29、選別チャット経由）で採用された4枚を、上記3枚と同じ手順で登録した。

| ID | 採用候補 | 寸法 |
| --- | --- | --- |
| cg_ageha_confession | 新規（Codex A 制作、work/codex-a-confession-cgs/） | 1920×1080 |
| cg_mashiro_confession | 新規（同上） | 1920×1080 |
| cg_hiyori_confession | 新規（同上） | 1920×1080 |
| cg_samechan_confession | 新1「正面・手を取り合う」（Codex A 制作、work/codex-a-samechan-confession/ の samechan-candidate-1.png） | 1672×940 |

- 原画は assets/cgs/ へ無加工保存（sha256 は sources.json、採用候補の台帳は各 work フォルダの LEDGER.md）。サメちゃん分は既存3枚の生成寸法（1672×941）と1px 異なる 1672×940 だが、採用原画を優先し無加工とした。
- あげは・ましろ・ひよりの show_cg は台詞側に接続済み（ひよりは PR #1432）。サメちゃんは本登録にあわせて confession_samechan_accept の手つなぎ台詞の直前へ show_cg、末尾へ hide_cg を追加した。
- 配信は build_manifest.py --cgs-only で WebP 化し manifest へ登録。ギャラリー一覧用サムネイル（remake/img/cgs/thumbs/、512×288）は既存分と同じ寸法・近い容量で生成した。
