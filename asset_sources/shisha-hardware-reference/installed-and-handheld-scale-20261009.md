# 装着時と手持ちの縮尺：実写リサーチ（2026-10-09）

オーナーの追加指摘「装着している画像も調べる」「ヒロインが持つハガルやHMDも大きすぎる」に対応する。生成前に以下の**実際の写真**を開き、選んだモデルの仕様と照合した。外部画像本体は転載せず、出典と確認点を記録する。必要な再制作時は出典から再取得して画像生成ツールへ添付する。

## 手・掌・指との比率

| 実写の出典 | 見た画像 | 生成時に使う確認点 |
|---|---|---|
| [Moze：ボウル準備の公式解説](https://mozeshisha.de/en/knowledge/hookah-bowl-smokebox-knowledge/tobacco-bowl-preparation/) | 「Distribute the tobacco loosely around the phunnel hole」の左右工程写真 | 支える手の指が細い脚へ回る。口径は掌の幅と同程度で、両手で抱える食器の大きさにしない。中央の吸気穴と周囲の葉の位置を分ける。 |
| 同上 | 「Clean the bowl and place the smokebox」の左右工程写真 | 冷たいONMOを片手で縁から扱っている。HMDは径約7.5cm・高さ約3cmの低い別部品で、ボウルの縁へ載る。蓋・取手を別モデルから追加しない。 |
| [B2 Hookah：Provost](https://b2hookah.com/products/provost-heat-controller-aot-heat-management) | 「AppleOnTop-Provost-On-Top-of-Hookah-Bowl」の装着商品写真 | 低い金属上下部品とハガルの適合を確認する。商品写真は手や台全体の縮尺の根拠にしない。世代名をこの写真だけで断定しない。 |
| [Kaloud：Lotus I+の使い方](https://kaloud.com/blogs/how-to/how-to-use-the-kaloud-lotus-i-hookah-heat-management-devices) | 2021年の装着写真（Screen Shot 2021-02-17） | I+の三方向の調整蓋、一本の黒い取手、対応ボウルとの接点。近接写真なので台全体や人との縮尺は別写真で確認する。 |

## 台へ実際に装着した全体写真

| 出典 | 本人記載の構成 | 確認点と限界 |
|---|---|---|
| [実使用者の投稿：Rate my Setup（2024-06-21）](https://www.reddit.com/r/hookah/comments/1dl3nj9/) | Amotion Flashbang / Oblako Mono / ONMO Silver | HMD・陶器ボウル・受け皿・ステム・水入りベースが一枚に写る。小さなHMDに対して台全体が十分大きい。パージの煙でステムが角型ガラスのように見える部分は模写しない。モデル名は投稿者の申告であり、寸法はメーカー仕様で別確認する。 |
| [実使用者の投稿：Setup for the day（2024-10-20）](https://www.reddit.com/r/hookah/comments/1g8az3i/) | Vesper / King Turkish Boy / Kaloud Lotus I+ / Caesar Crystal、Tortugaキャッチャー付き | 低いHMDと細いボウル脚、大きな受け皿・ステム・ベースの関係。蓋は受け皿に置かれ、追加の炭が上に載る写真なので、今回の「蓋を閉じた2炭」の状態へそのままコピーしない。装着比率の参考だけに使う。 |

仕様：[ONMOメーカー](https://onmo-shisha.squarespace.com/)は従来アルミモデルの底径7.5cm／上縁6.6cm／開口5.5cm／高さ3cm、27mmまでの角炭2個。[Kaloud I+公式](https://kaloud.com/products/kaloud-lotus-i-1)は選んだ世代の仕様を確認する。別世代・包装の寸法を混ぜない。

## 制作へ落とす方法

ましろのProvost構成は、[実使用者の2021年の全体写真](https://www.reddit.com/r/hookah/comments/kzglon/)（Provost II / Alpaca Mini Rook）と[El-Badiaの実装着写真](https://www.chicha.com/tutoriel-hmd-aot-provost/)も開いて照合した。前者は手前の上部が大きく写る遠近があり、蓋を傾けた状態なので、その大小・蓋の状態をそのまま新CGへ移さない。後者はフォイルの上に下トレーが載る接点と上下2部品の葉型グリップを確認できる。今回のCGでは同じ奥行きに台を置き、大きな受け皿と小さなハガル／HMDが釣り合う構成へ直す。

1. 手持ちのボウルをカメラ直前へ突き出さず、手と同じ奥行きに置く。顔の大きなアニメ人物では顔だけの比率を根拠にしない。
2. 装着状態は「選んだHMDの径 ÷ 選んだ受け皿径」と「台全体の高さ」を先に決める。例えば径7.5cmのHMDと径20cmの受け皿なら約0.375。これは選択した構成の値で、すべての台の固定規格ではない。
3. HMD単体の形が合っていても、受け皿が極端に小さい・ステムが短い・ベースが細い画像は縮尺を再検品する。
4. 生成後に手持ちは指の届き方・掌の幅、装着は口径・皿径・ステム・ベースを見直す。遠近で比較できない配置は比率を断定せず、同じ奥行きの構図へ修正する。
5. イメージ検索にはAI広告画像も混ざる。生成画像を実写の寸法証拠に使わない。新しく届くオーナー資料は、この一覧へ出典・用途・確認点を追加する。

関連：[ヒロインCG生成ルール](heroine-title-cg-rules-20261009.md)、[ホース分岐NG実例](ng-examples/README.md)。
