# R2 平成の青いADV・キャラクター比較

本人が示した青い光沢・銀縁のウインドウで、みんと・あげは・つむぎを比較。ひよりを含めた4人を、実ゲームの会話エンジンと正式な立ち絵で表示しています。人物・背景は再生成していません。

**[4人の比較を開く](comparison.png)**

![4人の比較](comparison.png)

- [みんと](minto.png)
- [あげは](ageha.png)
- [つむぎ](tsumugi.png)
- [ひより](hiyori.png)

## 操作するプレビュー

ローカルHTTPで `remake/conversation-preview.html?theme=heisei-blue&character=minto` を開くと、キャラクター欄で4人を切り替えられます。場面は「キャラクター比較」。テーマ欄の「R2 平成の青いADV（比較用）」でこの窓を選べます。GitHubのHTMLファイル表示ではゲームは実行されないため、上の画像から比較してください。

最新の仕上げでは、名前と操作を枠内の同じ見出し段へ接続し、本文30px・名前26px・操作16pxへ整理しています。[変更前後の比較](../../polish/README.md)。

名前・本文・AUTO／SKIP／LOG／用語／▼は実際のHTMLで、画像への焼き込みではありません。以前の指示に合わせ、操作は右上、本文2行と▼の領域を分離。比較用の追加で、本編CONFIGの6テーマや既定11、入手・解放条件には追加していません。セーブ・設定は保存しません。

## 原画・文字・素材

青い窓の銀の葉飾り・二重の縁・光沢を元案から参照して、文字なしの素材を生成。原画は `ui-source.png`、指示は `ui-prompt.txt`。名前札・操作バー・本文面は透明な間隔で機械的に分離し、WebPへ可逆変換しました。

本文と名前には **Zen Old Mincho Regular**（The Zen Old Mincho Project Authors、SIL OFL 1.1）を使用。Google Fonts公式配布TTFをWOFF2へ変換し、全文字マップと横幅メトリクスが同一であることを検証。ライセンスは `remake/fonts/OFL-ZenOldMincho.txt`、配布URLとハッシュは `generation.json`。ブラウザから外部フォント配信サービスへ接続せず同梱ファイルを使います。

みんと・あげはの台詞は `data/dialogue/ch1_events.json`、つむぎは `ch1_bonds.json` の既存文へ表示用の改行だけを追加。表情は比較を揃えるためnormal、ひよりは既存の2行見本とsmile。物語の正本は変更していません。背景のEDEN店内は比較用に共通化しており、3人の来店イベントを追加したものではありません。

原画と素材のハッシュ、切り出し座標、正式立ち絵の参照は `generation.json`。ブラウザで4人の名前・立ち絵の読込・本文2行・非重複・保存不変を検証しています。
