# ショップ商品画像 (#586)

WORKER: codex-c-shop-art-20261016-8e7fb2cb0e
CLAIM: 38786636524 SUCCESS / STATUS: 38786847504 SUCCESS

`inventory.json` は開始時の全店頭26ID・現在画像・欠落理由・今回の対象。
現行mainで確認できた採用基準は #505 / PR #510 の植物原画
`asset_sources/shop-ui-issue505/flavors-original.png` と採用モック `approved-concept.png`。
以前の箱パッケージの採用原画は確認できず、旧版を復元せず現在の植物画を基準に制作する。
PR #558 は #437 の機材外観カタログ準備であり、フレーバーパッケージではない。
#437 の正本・カタログ・ハンドル/チップ・選択/保存は今回の範囲外。

`originals/` は組み込み image_gen.imagegen の実生成PNG。追加API経路は使っていない。
`generation-records.json` は実際のプロンプトと生成元パスの記録。
`generation-manifest.json` は全対象の制作予定。未実施の予定と採用済みを混同しない。

現在は制作途中。図柄/透過/余白の最終QA、残りの原画、HMD3種、配信用変換、
ゲーム表示への接続、PC/touch/旧セーブ検証、CI/reviewが未完。Draftで保持しマージしない。
