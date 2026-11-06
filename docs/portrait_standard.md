# 立ち絵の規格（大きさ・顔・画風）

2026-11-02 オーナー「キャラの立ち絵がサイズや拡大率、顔の大きさ、顔アイコンが合わない。見た目は気に入っているので統一する方法を考えて。画風もAIっぽく見えづらくした上で統一したい」。
これまでは規格の数値が無いまま、別々の時期・道具で生成した絵を手作業で合わせていた。2026-10-10の「立ち絵そろえ」で13人をそろえた後に18人が増え、また崩れた。
そこで**数値の規格と、立ち絵ごとの顔の位置の記録**を作り、顔アイコン・比較図・CIの検査をその記録から自動で出すようにした。

- 顔の位置の記録：[data/portrait_metrics.json](../data/portrait_metrics.json)（規格の数値もここが正本）
- 道具：`tools/portrait_metrics.py`（測る・確かめる・表と比較図を出す）
- 比較図：[face-size-ingame.png](../asset_sources/reference-sheets/face-size-ingame.png)（会話画面と同じ倍率で全員の顔を並べる）
- 直す順番と進捗：[asset_sources/portraits/standard-20261102/progress.md](../asset_sources/portraits/standard-20261102/progress.md)（「立ち絵そろえ」で進める）
- 背景の規格は別に [背景の規格](background_standard.md)

**立ち絵の作り方の入口はこの文書だけ**（2026-11-02 に1本化）。`docs/prompts/image_generation_guide.md`・`codex-image-prompt`・`character-portrait-remaster` の各スキルは、画風と頭身についてはここを指す。古い「高密度のドット絵調」「fine pixel-art grain」の画風の言葉は使わない。

## 1. そろえるもの

| 項目 | 規格 | 確かめ方 |
|---|---|---|
| 画像 | 896×1200 のRGBA透過PNG。通常と表情差分は同じキャンバス・同じ足元 | `tools/fit_portrait.py`・portrait-fix スキル |
| 身長 | `data/characters.json` の `spriteScale`（身長の設定÷172cm）で決まる。承認済みの新版限定調整は `spriteScaleVariants.new` を使う。画風限定の横アンカーは `spriteAnchorVariants.<画風>`（`head` / `feet`）。現行のアンカーは変更しない。絵の中の人物の高さでは決めない | 会話エンジンが本体の高さを自動でそろえる（`remake/js/vn/engine.js` の `frame()`） |
| 頭身 | **標準 6.4〜7.7（目安7.0）**、**小柄 5.4〜6.2（目安5.8）** | `python3 tools/portrait_metrics.py check` |
| 同じ人物の衣装違い | 会話画面での頭の大きさの差が5%以内 | 同上（`same_person`） |
| 表情差分 | 通常と同じ頭の大きさ・位置。表情に伴う小さな首の傾きだけ許す | 通常と重ねて見る（`fit_portrait.py` の比較画像） |
| 顔アイコン | 手で拡大率を決めない。顔の大きさが枠の0.58倍、頭の上下の中央が上から0.48の位置、頬の中央が枠の中央になるよう自動で切り抜く | `python3 tools/make_face_icons.py <id>` |
| 原画 | 1回の生成で1人・1表情、人物の高さ1300px以上。ゲーム用へは縮小だけで配置する | 2026-10-09 の解像度調査 |

頭身は「頭頂〜靴底」÷「頭頂〜あご」。頭頂は髪の上端で、帽子・フード・角・髪飾り・アホ毛は含めない（隠れているときは推定する）。
顔アイコンの0.58・0.48は、2026-10-04〜10-10 にオーナー確認で手調整した主要キャラのアイコンの中央値。

### 体型の区分

- **小柄**：つむぎ・ましろ・あげは・サメちゃん。今の採用絵（PU04・PU05 の「顔はやや大きいほうが可愛い」「頭身は戻していい」）に合わせた枠。あげは・サメちゃんも 2026-11-02 オーナー「可愛い方」でこの枠に決定。
- **ロボ**：SHISHA-9000。頭身は規格の対象外で、顔アイコンだけ測った位置で作る。
- **マスコット**：パッキー。測らない。顔アイコンは `tools/make_face_icons.py` の手調整のまま。
- それ以外は**標準**。区分を変えるのはオーナーの判断。変えるときは `data/portrait_metrics.json` の `class` を直す。
- **規格外のまま残す人**：上園（6.38頭身）は 2026-11-02 オーナー「そのまま」。記録に `accepted` を書くと警告が出なくなる。
- **同じ人物の衣装違い**：みんとは 2026-11-02 オーナー「可愛い方」で、頭が大きい私服（6.41頭身）に営業姿を合わせる。

### 会話画面の拡大率（2026-11-05）

オーナー指定のつむぎ参考プレビューに合わせ、会話の本体高を画面高×1.675×その人物の `spriteScale`、足元の沈み込みを画面高の0.58倍にする。新版つむぎ（倍率0.9）は1280×720で本体約1085px・頭頂約52px。現行・新絵の両方に適用し、画像固有の透過余白はそれぞれのmanifest値で補正する。身長設定や頭身・顔アイコンの切り抜きは変えない。

背の高い人物は頭上3%の安全域へ下げ、頭・帽子を見切れさせない。二人の左右配置と表情の共通アンカーは保つ。パッキーとてつこは人間用の倍率へ引き伸ばさず、従来の本体高・接地を保つ。登場カットイン・CGにはこの倍率を使わない。

## 2. 測り方

通常の立ち絵を差し替えた・キャラを足したときは、そのキャラを測り直す。記録が古いままだと CI（quick の `tools`）と `make_face_icons.py` が止まる。

```bash
python3 tools/portrait_metrics.py grid <id> /tmp/grid.jpg      # 10px ごとの目盛り付き拡大図
python3 tools/portrait_metrics.py set <id> eyes=左x,左y,右x,右y chin=x,y crown=x,y cheeks=左x,右x,y
python3 tools/portrait_metrics.py overlay <id> --out /tmp/ov.jpg   # 赤丸＝目、緑＝あご、紫＝頭頂、黄＝頬。原寸で合っているか見る
python3 tools/make_face_icons.py <id>                           # 顔アイコンを作り直す
python3 tools/portrait_metrics.py check                         # 規格の判定（規格外は WARN。CI は止めない）
python3 tools/portrait_metrics.py sheet                         # 比較図を作り直す
python3 tools/portrait_metrics.py faces <id>                    # 表情差分の頭の高さ・足元が通常からずれていないか
```

- 目は黒目の中心（画面の左の目が先）。閉じた目は線の中央。
- あごは先端の一番下。ひげで隠れているときは輪郭から推定する。
- 頬は目の少し下の高さで、耳・横の髪を含めない顔の肌の左右の端。耳や髪まで含めると、顔アイコンの顔が片側へ寄る（2026-11-02 綾取・王煙楼で起きた）。ロボは耳の部品の内側まで。逆に、髪で頬が隠れているときは、見えている肌だけで測ると狭すぎて顔アイコンが寄りすぎる（2026-11-02 レヰで起きた）。隠れている側は、目の外側と輪郭から髪の下の頬の線を推定する。頬の幅は頭の高さのおよそ0.5〜0.6倍になる。
- 位置ずらしだけ（`align_sprite_anchor.py` で数px動かした等）なら、`overlay` で点が合っていることを見てから `stamp <id>` で版だけ記録してよい。見ていないのに `stamp` しない。
- 新しいキャラは区分（`class`）も書く。同じ人物の別衣装は `sprite`・`folder`・`label`・`same_person` を書く（`minto_private` が例）。

## 3. 画風の規格

基準は採用済みの**みんと（営業姿の通常）・あげは・凛想**。同じ作品の同じ描き手に見えることを優先し、次の点で「AIっぽさ」を減らす。

- **線**：濃い色のはっきりした輪郭線。外側の輪郭はやや太く、内側の線は細く。全部同じ太さの線にしない。
- **影**：形のはっきりした2〜3段の影で塗る。エアブラシのぼかし・リムライト・グロー・肌のテカりを入れない。
- **ハイライト**：髪は基準絵と同じく帯状の数か所、目は小さなキャッチライトだけ。全体に白い光を散らさない。
- **描き込みの量**：布のしわは意味のある大きなものを数本。全身に細かい刺繍・模様・何百本もの細い毛束を散らさない。肌の毛穴・写真のような布目を描かない。
- **色**：髪と肌のほかに主な色は3〜4色。
- **顔**：目・眉・鼻・口の形はそのキャラ固有のまま。よくある「AIの美少女・美形顔」へ寄せない。年齢・性別の差を残す。
- **姿勢**：完全な正面・左右対称を避け、重心を片足に置く（既存のポーズを保つ描き直しでは変えない）。
- **仕上げ**：縮小は全員同じ方法（LANCZOS）だけ。採用原画へ後から彩度・明度を足さない（PU03）。透過の端の色のにじみ・取り残しを消す。
- 全身・顔の検品は [AIっぽさを抑える制作メモ](prompts/ai_naturalness_guide.md) と [素材規約](asset_ai_guidance.md) も参照する。

生成のプロンプトには、次の英文をそのまま足す（キャラの説明・表情・参照画像の役割は別に書く）。

```
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead.
```

## 4. 2026-11-02 の測定結果

全32枚（31人＋みんとの私服）を測った。数値は1280×720の会話画面での頭の高さ。全員の表は `python3 tools/portrait_metrics.py report`。

| 判定 | キャラ |
|---|---|
| 規格内 | はじめ・スミさん・なる・アダム・みんと（営業姿・私服）・凛想・ひより・伏見・博士・サラリーマン・綾取・ヨル・ムカイさん・エミル、小柄のつむぎ・ましろ・あげは・サメちゃん |
| 頭が大きい | 組長 6.29頭身（165px）、上園 6.38頭身（149px。測定の誤差±0.1の範囲で境目） |
| 頭が小さい | スティーブ 8.04、サイ 8.39、レヰ 8.67、マキ 8.74、辻占のオババ 8.78、シェイク 8.88、王煙楼 8.98、ヴォルク 9.04、太陽 9.08（同日後から追加：スハイル 8.62、ハリール 9.75。作り直しは進捗表の段階2.5） |
| 同じ人物で差がある | みんとの私服は営業姿より頭が12%大きい（6.41頭身と7.00頭身） |

頭が小さい9人は、2026-10-20 以降にまとめて追加した、写実寄りの絵の人たち。標準の中央（約7頭身）より頭が15〜23%小さく、並ぶと別の作品に見える。

## 5. 新しいキャラ・描き直しのときの手順

1. 参照画像に、同じ区分の規格内のキャラを「頭身の目標」として1枚入れる（標準ならアダム・伏見・はじめ、小柄ならましろ）。
2. 3節の英文を足して生成し、原画を `asset_sources/portraits/<フォルダ>/` に保存する。
3. `fit_portrait.py` 等で896×1200へ縮小・配置し、表情差分は通常の足元・頭の位置に合わせる。
4. 2節の手順で測り、`check` で規格内か見る。外れたら頭の大きさの指定を直して作り直す。
5. 顔アイコン・WebP・manifest を作り直し、会話画面で表情を切り替えて確認する（portrait-fix スキル）。

## 6. 生成のたびに渡す参照セット（1回の生成で4枚）

どの経路（Codex・画像API・人への依頼）で作るときも、参照画像は次の4枚を**リポジトリのファイルから**渡し、プロンプトに役割を書く。言葉だけで画風や頭身を伝えない。足りない参照を別のキャラで代用したり、横並びのシートを渡したりしない（人物が縮んでぼやける）。

| 役割 | 渡すもの | 標準 | 小柄 |
|---|---|---|---|
| ① 本人（顔・髪・衣装・色・ポーズ） | その表情の現行立ち絵 `assets/sprites/characters/<id>/chr_<id>_<face>.png`。表情差分では合格済みの新しい通常の原画も | 共通 | 共通 |
| ② 頭身の目標（同じ区分・同じ性別） | 規格内のキャラの通常 | 男性は伏見（6.93）、女性は凛想（6.53） | ましろ（5.76） |
| ③④ 画風の目標 | みんと営業姿の通常 と あげはの通常 | 共通 | 共通 |

プロンプトには 3節の英文と、②の役割を「頭身の目標だけ。顔・髪・体格・衣装は写さない」と明記する（完成した書き方は [prompts.md](../asset_sources/portraits/standard-20261102/prompts.md) の各ブロック）。新しいキャラの初回も同じ4枚で、①の代わりに `brand/character_profiles.md` の容姿の文を使う。

## 7. 並べたときの検査（立ち絵を足した・差し替えたPRで必ず）

頭身が規格内でも、並べたときの違和感は**配置**から起きる。原因は3つに分かれる。

| 原因 | 何が起きるか | 直し方 |
|---|---|---|
| 足元の基線・余白 | 表情を切り替えると上下に動く、足が浮く | `tools/fit_portrait.py` で通常と同じ足元に合わせる。`python3 tools/portrait_metrics.py faces <id>` で差を見る |
| 左右の重心 | 表情で左右に跳ぶ | 同上。`align_sprite_anchor.py` で数px動かした後は `overlay` で点を見てから `stamp` |
| 会話画面の天井 | `spriteScale` が約1.02以上のキャラは、頭が画面の上端97%を越えないように会話エンジンが下へ沈める（`remake/js/vn/engine.js` の `frame()`）。2026-11-02 時点で組長・シェイク・スミさん・スハイル・サイ・マキ・アダム・伏見・博士・なるの10人が当たっていて、背の高い人ほど沈むので身長差が画面では潰れる | 絵では直らない。`FRAMING.target`（1.36）を下げるか天井を上げるかはコード側の判断で、オーナーの依頼があるときだけ変える |

PRでは次の2枚を作り直して貼る。

```bash
python3 tools/portrait_metrics.py sheet                   # asset_sources/reference-sheets/face-size-ingame.png（会話画面と同じ倍率で顔を並べる）
python3 tools/make_reference_sheet.py lineup              # asset_sources/reference-sheets/height-lineup.png（身長の設定どおりの背比べ）
```

同じ区分のキャラと顔の大きさが揃っているか、足元が一直線か、表情を切り替えて頭が動かないかを、この2枚と会話画面（portrait-fix スキルの「直した後の確認」）で見る。

## 会話で現行と新立ち絵を切り替える

設定の「会話の立ち絵」で現行／新バージョン／七海風を切り替える。初期値は現行。端末設定として保存し、進行・セーブ枠・登場カットインの絵柄とは独立する。会話中は同席者も即時に切り替わる。同じ衣装の未制作表情は選択した画風の通常絵を保持し、衣装・顔・口具が途中で現行へ戻ることを防ぐ。衣装群自体（`ura_*`・`office_*`・`axe_*` 等）や人物が未導入なら現行を使う。通常1枚だけの仮採用を表情一式完成とは扱わない。候補画像は自動で採用しない。現行画像を削除・上書きしない。

採用した新立ち絵は `assets/sprites/character_variants/new/<id>/chr_<id>_<face>.png` に置く。本書の検品後、`python3 remake/tools/build_manifest.py --portrait-variants-only <id>` で新絵の表情・余白・WebPだけを登録する。同じ人物の新絵は同一キャンバス・足元にそろえ、旧絵のframing値をコピーしない。みんとの私服は `ura_*` のまま保持する。

局所検証: `node --experimental-vm-modules remake/test/portrait_style.mjs`。生成処理は Pillow・NumPy・SciPy の揃った環境で `python3 remake/test/portrait_variants.py` を実行する。

ブラウザ回帰: プレビューサーバーを起動し、`node tools/ci/run.mjs --kind browser --suites portrait-style-browser,portrait-framing-desktop,portrait-framing-touch`。PC・横持ちタッチで旧設定、反復切替、同席者、未制作の表情・人物・私服、設定の開閉・再読込、台詞・配置・保存への非干渉を確認する。部分的な新絵のテストはブラウザ内だけで行い、検証画像を本編へ登録しない。

新版だけ表示倍率を変える場合は `data/characters.json` の `spriteScaleVariants.new` を指定する。未指定の新版と現行への差分フォールバックは既存 `spriteScale` を使う。つむぎv4は新版0.90、現行0.88を維持する。


七海風は `assets/sprites/character_variants/nanami/<id>/` と `--portrait-style nanami` を使う。全件ビルドも両画風を保持する。

2026-11-05 の仮採用はスミ新版5表情と、本人了承済みのあげは新版通常1枚。あげはは原画人物高1185pxの例外で、了承済み896×1200プレビューをそのまま再使用し、頭部アンカーで中央へ配置する。残り4表情は通常を保持する。七海風あげはの拒否済み生成は再試行しない。取得済みの七海風スミ通常・博士4表情は一式不足のため候補保管のみ。

[前回の出典・取得状態](../asset_sources/portraits/style-trial-20261105/sources.json)は当時の記録。配信先の追加許可後に、博士・ひより両画風と七海風スミを含む128枚・35組を追加した。[追加素材の取得・書き出し記録](../asset_sources/portraits/library-candidates-20261105/integration.json)でLibrary ID・SHA256・寸法と派生PNGを対応させる。元の身長・縦横比・色・顔・体格・外線を保ち、896×1200へ縮小して足元アンカーをそろえる。外線は新版つむぎと比較し、不必要に太くしない。ヌールの頭サイズ・外線、みんとの私服、その他品質保留は完了にしない。七海風つむぎ通常は原画高1261pxで規格未達、未許可配信先の16枚は取得未試行。通常絵が取得できない組は登録しない。レヰ・組長は頭を5%大きくした新通常が別途制作中と分かったため、調整前の通常絵の登録を保留に戻す。

画風別manifestの `h`・`b` は通常の人物高・足元を基準とする。ひよりの斧投げなど通常より上へ出る小物は `topOverhang` に全表情共通の上余白を記録し、会話エンジンは人物を縮めず共通の下移動で見切れを防ぐ。現行カットインの配置には現行原画、グラフィック配置には専用原画を使い、会話の画風をカットイン用配置へ流用しない。

`remake/conversation-preview.html?character=ageha&portraitStyle=new` は本編と同じ会話エンジン・ウインドウで全登録人物と衣装・表情を比較でき、未導入と通常保持を明示する。実行画面の確認と静止試算を区別する。

正本21表情を基に制作した両画風42表情と七海風通常2枚、了承済み新版通常2枚の最終46参照から、正式取得・SHA照合・通常絵との整合を確認した33枚を追加。[正本・正式取得・書き出し記録](../asset_sources/portraits/received-expressions-20261105/integration.json)を参照。はじめ3・なる2・ぱっきー1・レヰ9・組長9・綾取9枚。レヰ・組長は頭を5%大きくした了承済み新版通常と、それを基準にした七海風通常を各表情と組にする。既存の通常原画も制作側の参照SHAと一致する組だけ、通常の人物高・足元アンカーへ合わせる。はじめの口具・首紐・飾りは再出現させず、なるはD上着・灰色ズボン・裸耳を維持する。綾取新版は既存normal/wildと合わせて8表情、七海風は5表情。未許可配信先の10枚は取得未試行、通常絵未導入の凛想両画風・ぱっきー七海風の3枚は受領済み保留。制作完了と本編採用を区別し、未導入表情は同じ画風・衣装の通常絵を保持する。現行絵・初期設定・表示倍率・登場カットインは維持する。

綾取（`saku`）の豹変後は、右側候補として選ばれた七海風の悪顔修正版を `nanami/wild` に採用する。[受領・配置記録](../asset_sources/portraits/saku-nanami-wild-20261105/integration.json)に原画ID・SHAと通常基準のfitを保存。原画1036×1518 RGBA・人物高1368pxを、顔や頭身を編集せず既存通常と同じ896×1200・人物高1080px・足元y1140へ縮小する。現行・新版wild、七海風通常、共通配置値は変えない。旧七海風wild原画は以前の出典フォルダに保持する。他方の画風も同じ表情にする指示は推測しない。

みんと私服「お姉さん」は、両画風の `ura_normal/ura_sad/ura_smile/ura_smug/ura_surprise` 各5表情を `minto` フォルダに登録する。[正本・首飾り修正・配置記録](../asset_sources/portraits/minto-private-20261105/integration.json)を参照。了承済みの部分手作業は新版smug/surpriseの首飾り491/497画素だけで、alpha・範囲外RGBA・他8原画は不変。`oneesan`→`minto/ura_*`、表示名と正体フラグ、未制作時の私服通常保持は既存処理を維持する。

同人物の営業・私服を比べるときは、営業の角を人体高に含めない。営業PNGの髪頭頂new y86／七海風y84から足底y1141までの1055／1057pxを基準に、私服を同比縮小して共通の足元へ配置する。`spriteScaleVariants` はnew0.931564・七海風0.929801、現行`spriteScale`0.91は維持。私服の画面上の人体高は従前候補の1080×0.91と一致し、私服だけを小さくせず営業側を約2.2〜2.4%大きくして人体高を合わせる。原画の頭身・顔・衣装色・体格は変えない。頭高差の概測は新版約+3.7%・七海風約+5.0%で、手置き読取誤差を含む七海風の境界を厳密な5%以内とは断定しない。最終判断は会話枠・同席・切替を含む実画面で行う。

上園は両画風のnormal/excited/serious/smile/surprise、鉄仮面（`salaryman`）は両画風のnormal/smileを追加する。[正式受領・原正本照合・fit記録](../asset_sources/portraits/maezono-salaryman-20261105/integration.json)に新しい原画を記録し、以前の若返り／疲れ顔の弱まりで保留した候補とは区別する。元の丸顔・厚みのある体格、鉄仮面の半眼や疲れた目元を保つ。通常絵基準の共通896×1200・人物高1080px・足元y1140で書き出し、現行画像・キャラ表示倍率は変更しない。

同時に受領したつむぎ七海風bowは、耳の点だけ36 RGB画素を直した原画を確認済みだが、対応する七海風通常が未導入のため登録しない。通常の既存正本は人物高1261pxでnative1300px基準の保留が残り、今回のbow受渡しを通常の保留解除・別版選定と解釈しない。新版E1のポーズ選定やましろ／つむぎの頭身も変更しない。


## 受領58正本からの両画風表情（2026-11-05）

統合台帳 `libfile_499d86ec46508191b23e75eaf59c704f` v0の116新規原画から、許可済み配信の78点をSHA・サイズ・RGBAで照合した。通常原画を取得できないダ・シルバの5点は登録を保留し、73点と再利用のマキ七海風通常1点を、11キャラ・22画風群の74画像として追加する。対象は `emil / maki / master_hookah / mukai_master / sai / shisha_9000 / steve / tetsuko / uranaishi / volk / yoru`。現行絵と既存画風群の通常画像・配置値は維持する。

追加差分は現行正本の「各表情の可視高／通常の可視高」の比率を保持し、同じ通常の足元と横アンカーへ同比縮小・配置する。てつこのsleepは低く横に丸まる元の姿の比率を保持し、人間の1300px・頭身基準を適用しない。SHISHA-9000も人間の頭身へ変形しない。原画を無編集で保存し、派生画像のみ離れた低alpha散乱を整理する。頭・体・顔・衣装色・外線そのものは編集しない。

正式fit後にPC1280×720・タッチ844×390で現行／新版／七海風の全表情切替、同画風通常へのfallback、通常復帰、同席、設定切替を確認済み。登場演出も旧／graphicのPC・タッチ40場面で人物・背景・名前・文章の読込を確認し、静的74点と実画面の独立レビューはblockingなし。通常復帰は両端末各30件のステージ実画素も一致した。38新規原画は未許可配信先のためダウンロード未試行。未受領表情は既存処理どおり同じ画風の通常へ戻り、旧衣装へ切り替えない。正本・原画ID・SHA・native寸法・fit値・未取得一覧は `asset_sources/portraits/received58-20261105/integration.json` に記録する。別件の博士の承認済みnormal、レヰの不採用試案、ヴォルクの別試案、つむぎbow、ヌール、あげは七海風の安全保留はこの追加に含めない。

追加許可後の残り38原画と、通常待ちだったダ・シルバ5原画の対応は `asset_sources/portraits/received58-remaining-20261105/integration.json` に記録する。先行74画像と合わせて13人の両画風を補完し、現行画像と既存通常の配置・キャラ倍率を維持する。未選択のヌール、あげはの安全保留、レヰの不採用試案はこの追加に含めない。
