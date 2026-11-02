# 漫画の選別一覧（第1〜72話）

**採否はオーナーが画像を見て選別。全件未選別として一覧化し、AIの採点・おすすめ順は付けない。** 第1〜48話の復刻候補を追加して、1話から通して選べるようにした。第49〜72話は既存の24候補。ゲームの画像登録・採用済み画像は変更していない。

既存のClaude Artifacts選別ツールへの取り込みには [catalog.json](catalog.json) を使う。番号・題名・登場人物・左①/右②の画像パス・個別台帳を収録。`panels[0]`→`panels[1]`の順に同じ3:2枠で表示し、`selection: unreviewed`は素材側の初期値。ツール側にある利用者の既存判定を上書きしない。原画シートの並びやregionではなく、この2枚を選別対象にする。

番号はこの一覧内の管理番号。別の制作バッチ（例: PR #2258）にも同じ61〜72番があるため、既存ツールとの照合は番号だけでなく`id`と画像パスを使う。別バッチの画像・判定は上書きしない。

## 復刻方針と注意点

第1〜48話は28話を再作画、20話は原画の切り出しと紙色補正で規格化。全て1コマ1WebP、左→右、3:2許容内・最大1440×960・400KiB以下。原画を拡大・左右反転せず、旧右→左の話はコマ単位で導入→オチへ並べ直した。第1話は4コマ原版を保存し、ネタを残した2コマ版を別に制作。第42話は既存PR #1398の原画を参照し、そのPRの実装には変更しない。

旧作を見て選ぶため、元ネタと台詞を優先して復刻した。旧作の3人構成・多めの台詞・看板文字などは、新規制作の「2人・3台詞」と異なる場合がある。これらは台帳に注意を残し、正式採用前の編集確認対象とする。第21〜40話は強い不条理の「旧・暴走編」であり、現行の「シーシャあるある＋少しのシュールさ」と区別して表示。どの話も勝手に採用・除外していない。

検証: 第1〜48話の96枚を規格チェック。実際のロード画面でPC 1280×720・スマホ横844×390の計96表示を確認（21話の切り出し修正後も両画面で再確認）。代表15話の両画面スクリーンショットを各話フォルダに保存。原版の見出し断片が残る候補は正式採用前の画像整理対象。

| 話 | 題名 | 登場人物 | 区分 |
| --- | --- | --- | --- |
| 01 | [店、間違えた？](#01) | りゅうじ・はじめ | 旧話の復刻 |
| 02 | [兄弟でも別](#02) | りゅうじ・はじめ | 旧話の復刻 |
| 03 | [若衆の男泣き](#03) | りゅうじ・はじめ | 旧話の復刻 |
| 04 | [消すのは匂い](#04) | りゅうじ・はじめ | 旧話の復刻 |
| 05 | [噂の本人](#05) | りゅうじ・はじめ・ましろ | 旧話の復刻 |
| 06 | [選べるおすすめ](#06) | アダム・はじめ | 旧話の復刻 |
| 07 | [専門外](#07) | アダム・はじめ | 旧話の復刻 |
| 08 | [人気ナンバーワン](#08) | みんと・はじめ | 旧話の復刻 |
| 09 | [営業終了](#09) | みんと・はじめ | 旧話の復刻 |
| 10 | [バイブスのメモ](#10) | あげは・はじめ | 旧話の復刻 |
| 11 | [全部見てけ](#11) | なる・はじめ | 旧話の復刻 |
| 12 | [香りの感想](#12) | 凛・はじめ | 旧話の復刻 |
| 13 | [サメ映画](#13) | サメちゃん・はじめ | 旧話の復刻 |
| 14 | [見た目と重さ](#14) | ましろ・りゅうじ | 旧話の復刻 |
| 15 | [本日の一杯](#15) | ムカイさん・はじめ | 旧話の復刻 |
| 16 | [覚えていたこと](#16) | みんと・はじめ | 旧話の復刻 |
| 17 | [似顔絵](#17) | つむぎ・はじめ | 旧話の復刻 |
| 18 | [儚い仕事人](#18) | ひより・はじめ | 旧話の復刻 |
| 19 | [見学だけ](#19) | サイ・はじめ | 旧話の復刻 |
| 20 | [師匠の教え](#20) | スミさん・はじめ | 旧話の復刻 |
| 21 | [苦手なもの](#21) | りゅうじ・はじめ | 旧・暴走編（復刻） |
| 22 | [炭の引退式](#22) | りゅうじ・はじめ | 旧・暴走編（復刻） |
| 23 | [一口の重さ](#23) | りゅうじ・はじめ | 旧・暴走編（復刻） |
| 24 | [延長料金](#24) | りゅうじ・はじめ | 旧・暴走編（復刻） |
| 25 | [メニュー改訂](#25) | アダム・はじめ | 旧・暴走編（復刻） |
| 26 | [永久指名](#26) | アダム・はじめ | 旧・暴走編（復刻） |
| 27 | [専門外・再び](#27) | アダム・はじめ | 旧・暴走編（復刻） |
| 28 | [生活もダブル](#28) | アダム・はじめ | 旧・暴走編（復刻） |
| 29 | [総選挙](#29) | みんと・はじめ | 旧・暴走編（復刻） |
| 30 | [営業外](#30) | みんと・はじめ | 旧・暴走編（復刻） |
| 31 | [単位・きゅん](#31) | あげは・はじめ | 旧・暴走編（復刻） |
| 32 | [あと一匹](#32) | あげは・はじめ | 旧・暴走編（復刻） |
| 33 | [対策本部](#33) | りゅうじ・ましろ・はじめ | 旧・暴走編（復刻） |
| 34 | [持ち帰り](#34) | ましろ・りゅうじ・はじめ | 旧・暴走編（復刻） |
| 35 | [ラテアート](#35) | ムカイさん・はじめ | 旧・暴走編（復刻） |
| 36 | [極秘会談](#36) | りゅうじ・ムカイさん・はじめ | 旧・暴走編（復刻） |
| 37 | [新しい役職](#37) | サメちゃん・はじめ | 旧・暴走編（復刻） |
| 38 | [月曜の香り](#38) | 凛・はじめ | 旧・暴走編（復刻） |
| 39 | [少しだけ](#39) | なる・はじめ | 旧・暴走編（復刻） |
| 40 | [即戦力](#40) | つむぎ・はじめ | 旧・暴走編（復刻） |
| 41 | [炭の耳](#41) | スミさん・はじめ | 旧話の復刻 |
| 42 | [体内時計](#42) | ましろ・はじめ | 旧話の復刻 |
| 43 | [予約の正体](#43) | はじめ・スミさん | 旧話の復刻 |
| 44 | [畳みの極意](#44) | はじめ・スミさん | 旧話の復刻 |
| 45 | [一行の秘訣](#45) | はじめ・スミさん | 旧話の復刻 |
| 46 | [雨音の合奏](#46) | はじめ・スミさん | 旧話の復刻 |
| 47 | [座り心地派](#47) | はじめ・スミさん | 旧話の復刻 |
| 48 | [看板の向き](#48) | はじめ・スミさん | 旧話の復刻 |
| 49 | [蒸らしの時計](#49) | はじめ・スミさん | シーシャあるある |
| 50 | [強めの確認](#50) | はじめ・スミさん | シーシャあるある |
| 51 | [香りの残業](#51) | はじめ・スミさん | シーシャあるある |
| 52 | [味の説明書](#52) | はじめ・スミさん | シーシャあるある |
| 53 | [個性派面接](#53) | はじめ・アダム | キャラのこだわり |
| 54 | [味変の限界](#54) | はじめ・アダム | シーシャあるある |
| 55 | [比率の大改革](#55) | はじめ・アダム | シーシャあるある |
| 56 | [試食の圧力](#56) | はじめ・アダム | キャラのこだわり |
| 57 | [甘さのものさし](#57) | はじめ・なる | シーシャあるある |
| 58 | [褒める技術](#58) | はじめ・なる | キャラのこだわり |
| 59 | [反省の向き](#59) | はじめ・なる | キャラのこだわり |
| 60 | [別腹の確認](#60) | はじめ・なる | シーシャあるある |
| 61 | [おまかせの罠](#61) | はじめ・スミさん | シーシャあるある |
| 62 | [感想の落とし穴](#62) | はじめ・スミさん | シーシャあるある |
| 63 | [少しだけの幅](#63) | はじめ・スミさん | シーシャあるある |
| 64 | [他店の勉強](#64) | はじめ・アダム | キャラのこだわり |
| 65 | [一年中の旬](#65) | はじめ・アダム | キャラのこだわり |
| 66 | [休憩も一筋](#66) | はじめ・アダム | キャラのこだわり |
| 67 | [名前で休憩](#67) | はじめ・なる | シーシャあるある |
| 68 | [甘くない注文](#68) | はじめ・なる | シーシャあるある |
| 69 | [研究の昼ご飯](#69) | はじめ・なる | シーシャあるある |
| 70 | [人気の一位](#70) | はじめ・みんと | シーシャあるある |
| 71 | [甘さの接客](#71) | はじめ・みんと | シーシャあるある |
| 72 | [写真の主役](#72) | はじめ・みんと | シーシャあるある |

<a id="01"></a>

## 01　店、間違えた？

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../01-restored/panels/restored-01-1.webp) | ![オチ](../01-restored/panels/restored-01-2.webp) |

[原画・台本・生成・検品記録](../01-restored/comics.json)

<a id="02"></a>

## 02　兄弟でも別

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../02-restored/panels/restored-02-1.webp) | ![オチ](../02-restored/panels/restored-02-2.webp) |

[原画・台本・生成・検品記録](../02-restored/comics.json)

<a id="03"></a>

## 03　若衆の男泣き

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../03-restored/panels/restored-03-1.webp) | ![オチ](../03-restored/panels/restored-03-2.webp) |

[原画・台本・生成・検品記録](../03-restored/comics.json)

<a id="04"></a>

## 04　消すのは匂い

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../04-restored/panels/restored-04-1.webp) | ![オチ](../04-restored/panels/restored-04-2.webp) |

[原画・台本・生成・検品記録](../04-restored/comics.json)

<a id="05"></a>

## 05　噂の本人

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../05-restored/panels/restored-05-1.webp) | ![オチ](../05-restored/panels/restored-05-2.webp) |

[原画・台本・生成・検品記録](../05-restored/comics.json)

<a id="06"></a>

## 06　選べるおすすめ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../06-restored/panels/restored-06-1.webp) | ![オチ](../06-restored/panels/restored-06-2.webp) |

[原画・台本・生成・検品記録](../06-restored/comics.json)

<a id="07"></a>

## 07　専門外

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../07-restored/panels/restored-07-1.webp) | ![オチ](../07-restored/panels/restored-07-2.webp) |

[原画・台本・生成・検品記録](../07-restored/comics.json)

<a id="08"></a>

## 08　人気ナンバーワン

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../08-restored/panels/restored-08-1.webp) | ![オチ](../08-restored/panels/restored-08-2.webp) |

[原画・台本・生成・検品記録](../08-restored/comics.json)

<a id="09"></a>

## 09　営業終了

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../09-restored/panels/restored-09-1.webp) | ![オチ](../09-restored/panels/restored-09-2.webp) |

[原画・台本・生成・検品記録](../09-restored/comics.json)

<a id="10"></a>

## 10　バイブスのメモ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../10-restored/panels/restored-10-1.webp) | ![オチ](../10-restored/panels/restored-10-2.webp) |

[原画・台本・生成・検品記録](../10-restored/comics.json)

<a id="11"></a>

## 11　全部見てけ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../11-restored/panels/restored-11-1.webp) | ![オチ](../11-restored/panels/restored-11-2.webp) |

[原画・台本・生成・検品記録](../11-restored/comics.json)

<a id="12"></a>

## 12　香りの感想

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../12-restored/panels/restored-12-1.webp) | ![オチ](../12-restored/panels/restored-12-2.webp) |

[原画・台本・生成・検品記録](../12-restored/comics.json)

<a id="13"></a>

## 13　サメ映画

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../13-restored/panels/restored-13-1.webp) | ![オチ](../13-restored/panels/restored-13-2.webp) |

[原画・台本・生成・検品記録](../13-restored/comics.json)

<a id="14"></a>

## 14　見た目と重さ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../14-restored/panels/restored-14-1.webp) | ![オチ](../14-restored/panels/restored-14-2.webp) |

[原画・台本・生成・検品記録](../14-restored/comics.json)

<a id="15"></a>

## 15　本日の一杯

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../15-restored/panels/restored-15-1.webp) | ![オチ](../15-restored/panels/restored-15-2.webp) |

[原画・台本・生成・検品記録](../15-restored/comics.json)

<a id="16"></a>

## 16　覚えていたこと

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../16-restored/panels/restored-16-1.webp) | ![オチ](../16-restored/panels/restored-16-2.webp) |

[原画・台本・生成・検品記録](../16-restored/comics.json)

<a id="17"></a>

## 17　似顔絵

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../17-restored/panels/restored-17-1.webp) | ![オチ](../17-restored/panels/restored-17-2.webp) |

[原画・台本・生成・検品記録](../17-restored/comics.json)

<a id="18"></a>

## 18　儚い仕事人

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../18-restored/panels/restored-18-1.webp) | ![オチ](../18-restored/panels/restored-18-2.webp) |

[原画・台本・生成・検品記録](../18-restored/comics.json)

<a id="19"></a>

## 19　見学だけ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../19-restored/panels/restored-19-1.webp) | ![オチ](../19-restored/panels/restored-19-2.webp) |

[原画・台本・生成・検品記録](../19-restored/comics.json)

<a id="20"></a>

## 20　師匠の教え

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../20-restored/panels/restored-20-1.webp) | ![オチ](../20-restored/panels/restored-20-2.webp) |

[原画・台本・生成・検品記録](../20-restored/comics.json)

<a id="21"></a>

## 21　苦手なもの

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../21-restored/panels/restored-21-1.webp) | ![オチ](../21-restored/panels/restored-21-2.webp) |

[原画・台本・生成・検品記録](../21-restored/comics.json)

<a id="22"></a>

## 22　炭の引退式

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../22-restored/panels/restored-22-1.webp) | ![オチ](../22-restored/panels/restored-22-2.webp) |

[原画・台本・生成・検品記録](../22-restored/comics.json)

<a id="23"></a>

## 23　一口の重さ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../23-restored/panels/restored-23-1.webp) | ![オチ](../23-restored/panels/restored-23-2.webp) |

[原画・台本・生成・検品記録](../23-restored/comics.json)

<a id="24"></a>

## 24　延長料金

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../24-restored/panels/restored-24-1.webp) | ![オチ](../24-restored/panels/restored-24-2.webp) |

[原画・台本・生成・検品記録](../24-restored/comics.json)

<a id="25"></a>

## 25　メニュー改訂

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../25-restored/panels/restored-25-1.webp) | ![オチ](../25-restored/panels/restored-25-2.webp) |

[原画・台本・生成・検品記録](../25-restored/comics.json)

<a id="26"></a>

## 26　永久指名

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../26-restored/panels/restored-26-1.webp) | ![オチ](../26-restored/panels/restored-26-2.webp) |

[原画・台本・生成・検品記録](../26-restored/comics.json)

<a id="27"></a>

## 27　専門外・再び

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../27-restored/panels/restored-27-1.webp) | ![オチ](../27-restored/panels/restored-27-2.webp) |

[原画・台本・生成・検品記録](../27-restored/comics.json)

<a id="28"></a>

## 28　生活もダブル

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../28-restored/panels/restored-28-1.webp) | ![オチ](../28-restored/panels/restored-28-2.webp) |

[原画・台本・生成・検品記録](../28-restored/comics.json)

<a id="29"></a>

## 29　総選挙

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../29-restored/panels/restored-29-1.webp) | ![オチ](../29-restored/panels/restored-29-2.webp) |

[原画・台本・生成・検品記録](../29-restored/comics.json)

<a id="30"></a>

## 30　営業外

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../30-restored/panels/restored-30-1.webp) | ![オチ](../30-restored/panels/restored-30-2.webp) |

[原画・台本・生成・検品記録](../30-restored/comics.json)

<a id="31"></a>

## 31　単位・きゅん

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../31-restored/panels/restored-31-1.webp) | ![オチ](../31-restored/panels/restored-31-2.webp) |

[原画・台本・生成・検品記録](../31-restored/comics.json)

<a id="32"></a>

## 32　あと一匹

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../32-restored/panels/restored-32-1.webp) | ![オチ](../32-restored/panels/restored-32-2.webp) |

[原画・台本・生成・検品記録](../32-restored/comics.json)

<a id="33"></a>

## 33　対策本部

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../33-restored/panels/restored-33-1.webp) | ![オチ](../33-restored/panels/restored-33-2.webp) |

[原画・台本・生成・検品記録](../33-restored/comics.json)

<a id="34"></a>

## 34　持ち帰り

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../34-restored/panels/restored-34-1.webp) | ![オチ](../34-restored/panels/restored-34-2.webp) |

[原画・台本・生成・検品記録](../34-restored/comics.json)

<a id="35"></a>

## 35　ラテアート

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../35-restored/panels/restored-35-1.webp) | ![オチ](../35-restored/panels/restored-35-2.webp) |

[原画・台本・生成・検品記録](../35-restored/comics.json)

<a id="36"></a>

## 36　極秘会談

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../36-restored/panels/restored-36-1.webp) | ![オチ](../36-restored/panels/restored-36-2.webp) |

[原画・台本・生成・検品記録](../36-restored/comics.json)

<a id="37"></a>

## 37　新しい役職

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../37-restored/panels/restored-37-1.webp) | ![オチ](../37-restored/panels/restored-37-2.webp) |

[原画・台本・生成・検品記録](../37-restored/comics.json)

<a id="38"></a>

## 38　月曜の香り

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../38-restored/panels/restored-38-1.webp) | ![オチ](../38-restored/panels/restored-38-2.webp) |

[原画・台本・生成・検品記録](../38-restored/comics.json)

<a id="39"></a>

## 39　少しだけ

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../39-restored/panels/restored-39-1.webp) | ![オチ](../39-restored/panels/restored-39-2.webp) |

[原画・台本・生成・検品記録](../39-restored/comics.json)

<a id="40"></a>

## 40　即戦力

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../40-restored/panels/restored-40-1.webp) | ![オチ](../40-restored/panels/restored-40-2.webp) |

[原画・台本・生成・検品記録](../40-restored/comics.json)

<a id="41"></a>

## 41　炭の耳

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../41-restored/panels/restored-41-1.webp) | ![オチ](../41-restored/panels/restored-41-2.webp) |

[原画・台本・生成・検品記録](../41-restored/comics.json)

<a id="42"></a>

## 42　体内時計

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../42-restored/panels/restored-42-1.webp) | ![オチ](../42-restored/panels/restored-42-2.webp) |

[原画・台本・生成・検品記録](../42-restored/comics.json)

<a id="43"></a>

## 43　予約の正体

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../43-restored/panels/restored-43-1.webp) | ![オチ](../43-restored/panels/restored-43-2.webp) |

[原画・台本・生成・検品記録](../43-restored/comics.json)

<a id="44"></a>

## 44　畳みの極意

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../44-restored/panels/restored-44-1.webp) | ![オチ](../44-restored/panels/restored-44-2.webp) |

[原画・台本・生成・検品記録](../44-restored/comics.json)

<a id="45"></a>

## 45　一行の秘訣

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../45-restored/panels/restored-45-1.webp) | ![オチ](../45-restored/panels/restored-45-2.webp) |

[原画・台本・生成・検品記録](../45-restored/comics.json)

<a id="46"></a>

## 46　雨音の合奏

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../46-restored/panels/restored-46-1.webp) | ![オチ](../46-restored/panels/restored-46-2.webp) |

[原画・台本・生成・検品記録](../46-restored/comics.json)

<a id="47"></a>

## 47　座り心地派

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../47-restored/panels/restored-47-1.webp) | ![オチ](../47-restored/panels/restored-47-2.webp) |

[原画・台本・生成・検品記録](../47-restored/comics.json)

<a id="48"></a>

## 48　看板の向き

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../48-restored/panels/restored-48-1.webp) | ![オチ](../48-restored/panels/restored-48-2.webp) |

[原画・台本・生成・検品記録](../48-restored/comics.json)

<a id="49"></a>

## 49　蒸らしの時計

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../49-steeping-clock/panels/steeping-clock-1.webp) | ![オチ](../49-steeping-clock/panels/steeping-clock-2.webp) |

[原画・台本・生成・検品記録](../49-steeping-clock/comics.json)

<a id="50"></a>

## 50　強めの確認

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../50-mint-question/panels/mint-question-1.webp) | ![オチ](../50-mint-question/panels/mint-question-2.webp) |

[原画・台本・生成・検品記録](../50-mint-question/comics.json)

<a id="51"></a>

## 51　香りの残業

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../51-scent-overtime/panels/scent-overtime-1.webp) | ![オチ](../51-scent-overtime/panels/scent-overtime-2.webp) |

[原画・台本・生成・検品記録](../51-scent-overtime/comics.json)

<a id="52"></a>

## 52　味の説明書

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../52-flavor-address/panels/flavor-address-1.webp) | ![オチ](../52-flavor-address/panels/flavor-address-2.webp) |

[原画・台本・生成・検品記録](../52-flavor-address/comics.json)

<a id="53"></a>

## 53　個性派面接

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../53-apple-interview/panels/apple-interview-1.webp) | ![オチ](../53-apple-interview/panels/apple-interview-2.webp) |

[原画・台本・生成・検品記録](../53-apple-interview/comics.json)

<a id="54"></a>

## 54　味変の限界

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../54-apple-light/panels/apple-light-1.webp) | ![オチ](../54-apple-light/panels/apple-light-2.webp) |

[原画・台本・生成・検品記録](../54-apple-light/comics.json)

<a id="55"></a>

## 55　比率の大改革

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../55-apple-ratio/panels/apple-ratio-1.webp) | ![オチ](../55-apple-ratio/panels/apple-ratio-2.webp) |

[原画・台本・生成・検品記録](../55-apple-ratio/comics.json)

<a id="56"></a>

## 56　試食の圧力

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../56-apple-judge/panels/apple-judge-1.webp) | ![オチ](../56-apple-judge/panels/apple-judge-2.webp) |

[原画・台本・生成・検品記録](../56-apple-judge/comics.json)

<a id="57"></a>

## 57　甘さのものさし

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../57-sweet-unit/panels/sweet-unit-1.webp) | ![オチ](../57-sweet-unit/panels/sweet-unit-2.webp) |

[原画・台本・生成・検品記録](../57-sweet-unit/comics.json)

<a id="58"></a>

## 58　褒める技術

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../58-cake-praise/panels/cake-praise-1.webp) | ![オチ](../58-cake-praise/panels/cake-praise-2.webp) |

[原画・台本・生成・検品記録](../58-cake-praise/comics.json)

<a id="59"></a>

## 59　反省の向き

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../59-cake-apology/panels/cake-apology-1.webp) | ![オチ](../59-cake-apology/panels/cake-apology-2.webp) |

[原画・台本・生成・検品記録](../59-cake-apology/comics.json)

<a id="60"></a>

## 60　別腹の確認

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../60-dessert-stomach/panels/dessert-stomach-1.webp) | ![オチ](../60-dessert-stomach/panels/dessert-stomach-2.webp) |

[原画・台本・生成・検品記録](../60-dessert-stomach/comics.json)

<a id="61"></a>

## 61　おまかせの罠

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../61-leave-it-to-you/panels/leave-it-to-you-1.webp) | ![オチ](../61-leave-it-to-you/panels/leave-it-to-you-2.webp) |

[原画・台本・生成・検品記録](../61-leave-it-to-you/comics.json)

<a id="62"></a>

## 62　感想の落とし穴

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../62-all-favorites/panels/all-favorites-1.webp) | ![オチ](../62-all-favorites/panels/all-favorites-2.webp) |

[原画・台本・生成・検品記録](../62-all-favorites/comics.json)

<a id="63"></a>

## 63　少しだけの幅

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../63-short-visit/panels/short-visit-1.webp) | ![オチ](../63-short-visit/panels/short-visit-2.webp) |

[原画・台本・生成・検品記録](../63-short-visit/comics.json)

<a id="64"></a>

## 64　他店の勉強

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../64-apple-study/panels/apple-study-1.webp) | ![オチ](../64-apple-study/panels/apple-study-2.webp) |

[原画・台本・生成・検品記録](../64-apple-study/comics.json)

<a id="65"></a>

## 65　一年中の旬

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../65-apple-season/panels/apple-season-1.webp) | ![オチ](../65-apple-season/panels/apple-season-2.webp) |

[原画・台本・生成・検品記録](../65-apple-season/comics.json)

<a id="66"></a>

## 66　休憩も一筋

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../66-apple-break/panels/apple-break-1.webp) | ![オチ](../66-apple-break/panels/apple-break-2.webp) |

[原画・台本・生成・検品記録](../66-apple-break/comics.json)

<a id="67"></a>

## 67　名前で休憩

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../67-sweet-name/panels/sweet-name-1.webp) | ![オチ](../67-sweet-name/panels/sweet-name-2.webp) |

[原画・台本・生成・検品記録](../67-sweet-name/comics.json)

<a id="68"></a>

## 68　甘くない注文

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../68-not-sweet/panels/not-sweet-1.webp) | ![オチ](../68-not-sweet/panels/not-sweet-2.webp) |

[原画・台本・生成・検品記録](../68-not-sweet/comics.json)

<a id="69"></a>

## 69　研究の昼ご飯

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../69-cake-lunch/panels/cake-lunch-1.webp) | ![オチ](../69-cake-lunch/panels/cake-lunch-2.webp) |

[原画・台本・生成・検品記録](../69-cake-lunch/comics.json)

<a id="70"></a>

## 70　人気の一位

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../70-mint-ranking/panels/mint-ranking-1.webp) | ![オチ](../70-mint-ranking/panels/mint-ranking-2.webp) |

[原画・台本・生成・検品記録](../70-mint-ranking/comics.json)

<a id="71"></a>

## 71　甘さの接客

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../71-mint-service/panels/mint-service-1.webp) | ![オチ](../71-mint-service/panels/mint-service-2.webp) |

[原画・台本・生成・検品記録](../71-mint-service/comics.json)

<a id="72"></a>

## 72　写真の主役

| ①導入 | ②オチ |
| --- | --- |
| ![導入](../72-mint-photo/panels/mint-photo-1.webp) | ![オチ](../72-mint-photo/panels/mint-photo-2.webp) |

[原画・台本・生成・検品記録](../72-mint-photo/comics.json)

## 検査

画像の比率・寸法・容量とハッシュを全件検査。各話のwarn・処理方法・旧作固有の違いは個別台帳へ記録。ゲームの登録を変更しない素材整備のため、採用済み画像のゲーム内置換は行っていません。
