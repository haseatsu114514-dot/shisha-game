# ヒロインアート・個別背景とドット感の19案

2026-10-08 / TA01–12 / 現行タイトル右側のアートを検討する独立した縦2:3の原画。

つむぎ・ましろ・みんと・アゲハ・凛・サメちゃんの6人×3場面と、みんとの仕事／私生活の中間の1場面。計19案。現行ましろの絵のように見える細かなドット感を生成段階で指定し、色・場所・照明・小物を各人と各場面で分けた。

最初の15案は[旧案](../heroine-concepts-v1-20261008/README.md)として残す。今回は原画の比較・保存であり、本編のタイトルや立ち絵は差し替えていない。

| ヒロイン | 01 シーシャ | 02 | 03 | 追加 |
|---|---|---|---|---|
| つむぎ | [煙の色と木のぬくもり](tsumugi/01-smoke-colors.png) | [タブレットの猫](tsumugi/02-tablet-cat.png) | [川辺のスケッチ](tsumugi/03-twilight-sketch.png) | |
| ましろ | [レトロ喫茶の一服](mashiro/01-heavy-smoke.png) | [小さな台所でお茶](mashiro/02-tea-break.png) | [雨の駅で待ち合わせ](mashiro/03-after-rain.png) | |
| みんと | [ミント色のお出迎え](minto/01-cafe-welcome.png) | [チェキ撮影コーナー](minto/02-instant-photo.png) | [休日の窓辺](minto/03-private-window.png) | [閉店後の素顔](minto/04-after-hours.png) |
| アゲハ | [ピンクの試香席](ageha/01-professional-taste.png) | [昼の商店街で](ageha/02-grocery-smile.png) | [撮影スタジオの一瞬](ageha/03-model-moment.png) | |
| 凛 | [黒い試香室](rin/01-night-tasting.png) | [輸入サンプルを選ぶ](rin/02-flavor-samples.png) | [深夜の窓辺](rin/03-late-coffee.png) | |
| サメちゃん | [シーシャークの試運転](kafuka/01-shishark-test-run.png) | [コロちゃんとサメ映画](kafuka/02-shark-movie.png) | [水族館でコロちゃんと](kafuka/03-aquarium.png) | |

背景は、つむぎの創作と自然、ましろのレトロ喫茶と生活、みんとのミント色の店と休日、アゲハの都会的なポップさ、凛の無機質な試香室、サメちゃんの海とサメ映画で分けた。外の景色は現代日本の川辺・駅・商店街・水族館とし、旧案の似た欧州風の街並みを引き継がない。

みんと04は、仕事の黒／ミントの衣装の上に私服の白いカーディガン、髪を下ろし、飾りを外した閉店後の場面。公私の中間の1人として描き、分割画面や2人の姿を合成しない。サメちゃんは採用済みの黒髪・濃い青のインナー、ストリートシスター服、王冠のコロちゃんを第一参照にした。

## 個別の実物シーシャ

| ヒロイン | 台の実物資料 | 上部の方式 |
|---|---|---|
| つむぎ | [WOOKAH Classic Walnut](https://store.wookah.pl/en/859-wookah-classic-walnut.html)・木製ステムと木の外装の台 | [Alpaca LeRook](https://alpacabowls.com/collections/lerook/products/alpaca-lerook-bowl-8)の形＋閉じたHMD |
| ましろ | [Khalil Mamoon Turkey brass](https://khalilmamoon.com/products/turkey-1-level)・真鍮の装飾と長い首のガラス台 | 陶器ハガルの口全体をアルミで覆い、その上に炭。アルミの銀色を明示 |
| みんと | [Oduman製品資料](https://odumanjapan.com/product/oduman-atomic)のN2 Travel・コンパクトな透明ガラス | 適合するSamsaris＋閉じたLotus系HMD |
| アゲハ | [AMY Diamond Pink](https://www.amydeluxe.de/en/Diamond/AMY001C-PK)・ピンクのダイヤモンドカット形 | LeRook型の陶器ハガル＋閉じたHMD。色はイラスト上のアレンジ |
| 凛 | [Steamulation Pro X Mini](https://shisha-steamulation.de/en/pro-x-mini/)・金属ステムと黒い台 | [Samsaris Lapis I](https://kaloud.com/products/samsaris-lapis-i-ceramic)＋閉じたHMD |
| サメちゃん | [Shishabucks Cloud Micro](https://www.shishabucks.com/hookahs/cloudmicro-hookah/)・青い蓋の透明キューブ | [Sky Bowl](https://www.shishabucks.com/hookahs/sky-bowl/)＋[Stratus HMD](https://www.shishabucks.com/hookahs/stratus-heat-management-device/) |

Cloud Microは蓋にハガルとホースを接続する実物のコンパクトな構造。普通の長いステムや大皿を追加しない。ほかの台は差し込み部・皿・ハガルを別部品として描く。1本のホースを台の適切なポートから手元までつなぎ、葉／ハガルへの炭の直置き、誤接続、重複、浮遊を点検する。

メーカー写真は構造確認に使い、ゲームへ転載しない。原画では製品の文字・ロゴを複製しない。現在のましろのタイトル絵はドットの画風のみの資料で、誤った裸ハガルと炭の構造や、全員の背景の型としては使用しない。

## 原画と指示

`concepts.json`に19案、`*.prompt.txt`に実際の生成指示、`*.png.generation.json`に出力元・寸法・原画／指示／実参照のSHA256を保存。`references.json`に実物写真の出典・SHA256。以前からの採用立ち絵と画風資料は、旧案フォルダの変わらない`references/`を参照する。

`make-prompts.py`は今回の19案の指示を作った記録。原画を加工する処理は含まない。すべて画像生成ツールのPNGをそのままコピーし、元の出力も残す。比較一覧のスクリーンショットはブラウザによる表示確認で、原画ではない。
