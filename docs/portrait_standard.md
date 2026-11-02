# 立ち絵の規格（大きさ・顔・画風）

2026-11-02 オーナー「キャラの立ち絵がサイズや拡大率、顔の大きさ、顔アイコンが合わない。見た目は気に入っているので統一する方法を考えて。画風もAIっぽく見えづらくした上で統一したい」。
これまでは規格の数値が無いまま、別々の時期・道具で生成した絵を手作業で合わせていた。2026-10-10の「立ち絵そろえ」で13人をそろえた後に18人が増え、また崩れた。
そこで**数値の規格と、立ち絵ごとの顔の位置の記録**を作り、顔アイコン・比較図・CIの検査をその記録から自動で出すようにした。

- 顔の位置の記録：[data/portrait_metrics.json](../data/portrait_metrics.json)（規格の数値もここが正本）
- 道具：`tools/portrait_metrics.py`（測る・確かめる・表と比較図を出す）
- 比較図：[face-size-ingame.png](../asset_sources/reference-sheets/face-size-ingame.png)（会話画面と同じ倍率で全員の顔を並べる）
- 直す順番と進捗：[asset_sources/portraits/standard-20261102/progress.md](../asset_sources/portraits/standard-20261102/progress.md)（「立ち絵そろえ」で進める）

## 1. そろえるもの

| 項目 | 規格 | 確かめ方 |
|---|---|---|
| 画像 | 896×1200 のRGBA透過PNG。通常と表情差分は同じキャンバス・同じ足元 | `tools/fit_portrait.py`・portrait-fix スキル |
| 身長 | `data/characters.json` の `spriteScale`（身長の設定÷172cm）だけで決まる。絵の中の人物の高さでは決めない | 会話エンジンが本体の高さを自動でそろえる（`remake/js/vn/engine.js` の `frame()`） |
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
- 頬は目の少し下の高さで、耳・横の髪を含めない顔の肌の左右の端。耳や髪まで含めると、顔アイコンの顔が片側へ寄る（2026-11-02 久世・王煙楼で起きた）。ロボは耳の部品の内側まで。
- 位置ずらしだけ（`align_sprite_anchor.py` で数px動かした等）なら、`overlay` で点が合っていることを見てから `stamp <id>` で版だけ記録してよい。見ていないのに `stamp` しない。
- 新しいキャラは区分（`class`）も書く。同じ人物の別衣装は `sprite`・`folder`・`label`・`same_person` を書く（`minto_private` が例）。

## 3. 画風の規格

基準は採用済みの**みんと（営業姿の通常）・あげは・凛**。同じ作品の同じ描き手に見えることを優先し、次の点で「AIっぽさ」を減らす。

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
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead.
```

## 4. 2026-11-02 の測定結果

全32枚（31人＋みんとの私服）を測った。数値は1280×720の会話画面での頭の高さ。全員の表は `python3 tools/portrait_metrics.py report`。

| 判定 | キャラ |
|---|---|
| 規格内 | はじめ・スミさん・なる・アダム・みんと（営業姿・私服）・凛・ひより・南雲・博士・サラリーマン・久世・ヨル・ムカイさん・エミル、小柄のつむぎ・ましろ・あげは・サメちゃん |
| 頭が大きい | 組長 6.29頭身（165px）、上園 6.38頭身（149px。測定の誤差±0.1の範囲で境目） |
| 頭が小さい | スティーブ 8.04、サイ 8.39、REI 8.67、マキ 8.74、路上占い師 8.78、シェイク 8.88、王煙楼 8.98、ヴォルク 9.04、太陽 9.08（同日後から追加：サイフ 8.62、ラシード 9.75。作り直しは進捗表の段階2.5） |
| 同じ人物で差がある | みんとの私服は営業姿より頭が12%大きい（6.41頭身と7.00頭身） |

頭が小さい9人は、2026-10-20 以降にまとめて追加した、写実寄りの絵の人たち。標準の中央（約7頭身）より頭が15〜23%小さく、並ぶと別の作品に見える。

## 5. 新しいキャラ・描き直しのときの手順

1. 参照画像に、同じ区分の規格内のキャラを「頭身の目標」として1枚入れる（標準ならアダム・南雲・はじめ、小柄ならましろ）。
2. 3節の英文を足して生成し、原画を `asset_sources/portraits/<フォルダ>/` に保存する。
3. `fit_portrait.py` 等で896×1200へ縮小・配置し、表情差分は通常の足元・頭の位置に合わせる。
4. 2節の手順で測り、`check` で規格内か見る。外れたら頭の大きさの指定を直して作り直す。
5. 顔アイコン・WebP・manifest を作り直し、会話画面で表情を切り替えて確認する（portrait-fix スキル）。
