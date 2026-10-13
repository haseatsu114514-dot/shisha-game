# Dr.fookah ショップUI（#505）

オーナー承認の白い紙＋紫の案を本編 `remake/` へ実装。入店前の二択には既存の1F／2F背景を使用し、「街に戻る」を大きな紫枠のボタンにした。チュートリアル・大会準備は直接1Fへ進む。

- `approved-concept.png`: 承認された方向性の生成モック。
- `entry-mockup.png`: 画像と戻るボタンを追加した操作モックの画面。
- `flavors-original.png`: image_genによる18種類の植物イラスト原画。元データは透過PNG。
- `generation.json`: 生成条件・採用素材・ハッシュ。実行素材は `remake/img/shop/flavors.webp`。
- 実画面・回帰検証は `docs/qa/shop-ui-issue505/` と `remake/test/browser/shop_ui.mjs`。

実物機材の新規生成・既存背景の加工は行っていない。機材の画像は採用済み制作素材を再利用し、専用画像がないHMDは種類の記号で表示する。原画の各植物を目視確認し、切り出し窓をCSSで指定。文字・価格・在庫・操作はすべてHTMLで描画する。
