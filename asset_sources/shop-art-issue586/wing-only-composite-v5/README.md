# v5 — 翼と輪だけのコード合成・代表3枚（採用前レビュー）

2026-10-16 03:10:18UTCの人間指示「画像は翼マークだけ合成でもいい」により、v3のmint/double_apple/grapeだけをPillow/NumPy/OpenCVで編集。新しいimage_gen出力ではありません。画像生成呼出0。果実・色帯・箱・カメラ・背景を再生成/拡縮/色変換せず、全alphaを保っています。キャラ合成・全18展開・runtime採用は対象外。

## 比較と成果物

- `comparison-representatives.png`: v3/v5、各3枚の全体比較。
- `outputs/mint-wings-composite.png`, `outputs/double_apple-wings-composite.png`, `outputs/grape-wings-composite.png`: 原寸1254×1254 RGBAの別ファイル。
- `qa/thumbnails-before-after.png`:66/112/128px比較。実ゲーム統合の証拠ではありません。
- `qa/*-logo-crops-100pct.png`, `*-200pct.png`: v3/旧インク除去直後/v5の等倍・2倍crop。
- `qa/front-plane-mark-comparison.png`: 同じ700×1000前面へ補正した比較。
- `masks/*`: old-glyph/new-glyph/allowed-union/changedを原寸binary maskとして保存。
- `qa/*-allowed-overlay.png`, `*-diff-heatmap.png`, `mask-and-diff-review.png`: 編集領域を可視化。

原画はv3既存3ファイルとcanonical-white-angel-mark.pngのみ。v4の果実/帯/形状は使いません。全source/nativeSHAはconfig.json、結果SHAと投影係数/測定/画素数はvalidation.json。元PNGを一度も保存し直していません。

## 処理と制約

各v3の前面四隅を採用し、前面unit座標u=.50,v=.185、幅=.45へ同じcanonicalの翼+oval haloをhomography投影。700×1000の共通前面基準で、縦横比と輪-翼間隔を共通化。4倍samplingから面積平均して輪郭をアンチエイリアス化。RGB247付近の白いマット印刷と小さな紙面輝度の変調のみで、影/盛り上がり/発光は加えません。

旧glyph検索窓/brand ROIはconfig.jsonで先に限定。中性色の白インク2成分だけを抽出し、輪郭に6pxの狭い余白を追加。新glyphの投影coverageとのunionが許可編集maskです。最初の3px/TELEA案では旧形状の暗い痕跡が目立ったため、最終版は旧glyph+6px内だけを周囲の既知中性色紙面からcubic surface推定・内側feather4.5pxで復元しています。矩形全体を塗っていません。係数/既知点数/fit RMSEを記録。未知の元の紙目を完全復元したという主張ではありません。復元部は等倍cropでレビュー可能で、元の細かな紙目が失われる限界があります。

全alphaは原画の配列を保持。許可mask外のRGBA差分は3枚とも厳密に0画素です。許可mask上の元画像の最大色差はmint11/apple12/grape8で、果実/色帯の色を含みません。ROIは前面上部だけで、箱の縁/背景を含みません。全画素処理やICC変換をせず、入力3PNGに色profile metadataはありません。

## QA結果

| ID | 許可mask画素 | 変更画素 | mask外RGBA変更 | alpha変更 |
|---|---:|---:|---:|---:|
| mint |23301|22286|0|0|
| double_apple |29974|28414|0|0|
| grape |26024|24341|0|0|

出力を実際に前面補正しRGB>=210の白インクを測った結果、3枚とも幅=.44714、横中心=.50071。高さの中心vはmint=.18600、apple/grape=.18550。coverage50%の測定は幅=.44714〜.44857、u=.50000〜.50071、v=.18550。両定義を混同せずvalidation.jsonに記録。投影目標が.185だから測定値も厳密に.185だとは記していません。

native投影上辺の傾きはmint約.096°/apple1.762°/grape1.395°。共通canonicalとの前面補正coverage shape IoUは.99525/.99539/.99462。RGB210での輪-翼最短pixel中心間隔は15.18/15.18/15.38px（共通前面幅700基準）、mark幅比約.04850/.04850/.04913。輪/翼は同じ2成分設計で、輪郭/輪の穴/羽根3lobesを目視確認。再samplingによる差を含み、画素同一の印刷とは主張しません。

前面四隅は目視の約±2 native px。位置不確かさは概ね±.0035u/±.0026v、角度約±.4°で、カメラ実測校正ではありません。v4の実測v=.166とは別です。

3つの実PNG・前後比較・等倍/2倍輪郭crop・mask/差分・前面補正・66/112/128pxを目視確認。目立つ旧白フリンジ/二重輪/矩形パッチ/新しい影は見られません。局所紙面推定の痕跡/紙目差の限界は上記のとおり親レビュー対象です。

## 再現と保存確認

```sh
python3 asset_sources/shop-art-issue586/wing-only-composite-v5/compose.py
python3 asset_sources/shop-art-issue586/wing-only-composite-v5/compose.py --check
python3 tools/check_agent_docs.py
git diff --check
```

--checkは全39生成artifact bytesを再計算照合し、nativeSHA/PNGdecode/全alpha/mask外RGBA/狭いROI/中性色/前面位置とshapeをassert。最終版でPASS。Python syntaxもast.parseでPASS。依存: OpenCV4.13.0/NumPy2.4.2/Pillow12.1.1、Mac Arial（QAのラベル用）。同一環境でPNG byte再現。異なるfont/codec版でのbyte同一性は保証しません。

preservation.json: 編集前head0ec190c5368a10bae7124ca37415c549c274edb7（main1ec3dddbの安全merge後）と比較し、既存shop-art113ファイルをgit blob bytes一致、data/assets/remakeの差分0を確認。v2/v3/v4/旧botanical21/HMD/旧deliveryは不変。source SHAも元manifestに一致。今回の全変更はこの新規folderのみ。

## 予約・採用境界

同worker codex-c-shop-art-20261016-8e7fb2cb0e / thread01a140d2-7791-7aa2-9b89-4ad03675a977 / Issue586 / originalclaim38786636524。成功source run・全12コメントの現行bot台帳owner/run・PR587 head/openDraftを読み取り検証（reservation-verification.json）。不要な新statusは発行していません。

v5は代表3枚の比較のみ、親の独立レビュー待ち。v4全10はHOLD。全18展開/runtime/merge/publicationなし。Draftの旧botanical21 consumerには未承認HMD3がまだ残り出荷不可。mainのHMD文字fallbackとの境界は将来承認済み統合時に扱います。既存5bowl/charcoal画像・IDs/価格/効果/save形式は不変。PC/touch/old-save/HTTPゲーム回帰はsource-onlyなので今回未実施、過去結果を今回の導入証拠にしません。最新head CIはIssue/PRで別途snapshot、成功しても採用許可ではありません。

最新LIVEにより#597/#598はAへ担当変更済みでCの次タスクではありません。claim586を保持し、勝手なrelease/transfer/別owner作成/checkout削除を行いません。
