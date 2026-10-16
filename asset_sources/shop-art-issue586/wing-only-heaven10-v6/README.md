# Heaven10 source-only wing composition v6

2026-10-16 03:10:18UTCの人間指示「画像は翼マークだけ合成でもいい」と、約03:42UTCの親によるv5代表3独立レビューPASS・残りHeaven7への拡張指示に基づき制作。新規image_gen/API呼出0。

mint/double_apple/grapeは、v3由来の承認済みv5 output/maskをそのままバイト再利用。残りblueberry/strawberry/pineapple/lemon/orange/watermelon/cinnamonはv3相当原画がないため、既存v4 native候補を不変のSOURCE基準として翼・輪だけをコード合成。v4のmint/grape再構成を採用したことにはならず、v4全体のHOLD履歴は不変。今回もruntime/全18導入/merge承認ではありません。

## 成果物

- comparison-heaven10.png:10枚の完成source一覧、全ID/由来表示。
- comparison-before-after-heaven10.png:10枚すべての前後比較。3枚v3 base→accepted v5、7枚v4 candidate→v6 codeを区別。
- outputs/<id>-wings-composite.png:1254 RGBA。3コピー+7新code出力。生成ツールの新native出力ではありません。
- config.json:各原画SHA/前面四隅/old glyph検索窓/brand ROI/果実・帯の保護polygon/target座標。wrapper-seven-source-baseline.jsonと自身のRGBA/alpha SHA照合。
- manifest.json:全10 source/output PNG・RGBA・alpha SHA、処理由来、実測before/after、homography全係数、mask/復元/shape/gap/tilt。全IDはHeaven10のみ。
- qa/:全10のnative100%/200%crop・前面補正・mask overlay/diff heatmap・66/112/128px。10枚分へ可変長layout、3枚用canvasで切り捨てていません。
- masks/:old/new/union/changed/保護領域を原寸保存。

## 処理

v5 compose.pyをSHA固定で読み取り利用し、v5ファイルを一切変更しません。承認済み3枚には再合成を呼ばず、outputとmask/QAをexact byte copy。新7枚はそれぞれの前面四隅に同じcanonical翼+oval haloをhomography投影。共通前面700×1000、targetu=.50/v=.185/幅=.45。白マットink、盛り上がり/影/発光なし。旧glyph+6pxの狭い輪郭mask内だけを局所cubic紙面推定し、new投影maskとのunionだけ変更。矩形一括塗り・果実/帯/箱/背景の再生成/resize/recolor・全alpha処理なし。protected polygonに当たればassert停止し、maskを広げたり他の絵を動かしません。

旧v4印刷の実測v=.1655〜.16600をbefore値として記録。新印刷の実出力RGB210測定はu=.50000〜.50071、v=.18550（再利用mintのみ.18600）、幅=.44571〜.44714。前面四隅は各sourceを目視約±2px、位置約±.0035u/±.0026v、角度約±.4°の不確かさ。カメラ校正ではなく、sampling後の実測値をtargetと混同しません。

旧マークで隠れた紙面/紙目は局所推定で、元の不可視textureを完全復元したとは主張しません。元sourceにある低alpha端ノイズは全alpha不変のためそのままです。pixel同一のマーク印刷とも主張しません。同じcanonical contour/3feather lobes/halo gap設計を共用し、実測量をmanifestへ保存しています。

## 検証

```sh
python3 asset_sources/shop-art-issue586/wing-only-heaven10-v6/compose_family.py --check
python3 asset_sources/shop-art-issue586/wing-only-heaven10-v6/verify_saved.py --check
python3 asset_sources/shop-art-issue586/wing-only-composite-v5/compose.py --check
python3 tools/check_agent_docs.py
git diff --check
```

126artifactのbyte再現、全10保存PNGdecode/RGBA/全alpha変更0/mask外RGBA変更0/果実帯保護領域変更0/source/output SHA PASS。独立verify_saved.pyは保存maskのunionと実diffを照合し、ingredient領域RGB1pixelと背景alpha1pixelのメモリ内negative controlを検出。実ファイルはtamperしません。編集前head182c7fa4にあるshop-art159ファイル（うち既存v5全46）をgit blob bytes不変で検証し、data/assets/remakeも変更0。accepted v5三PNGのexact byte再利用を別途assert。保存PNGの検証結果はsaved-png-checks.json。

v5の既存39artifact再現もPASS。Python syntax/docs/diffはPASS。全10全体/前後/前面補正/66・112・128pxと新7native100%の旧インク復元・輪郭cropを実際に目視確認し、目立つ旧白フリンジ/二重輪/矩形patchは見られませんでした。wrapperも全10saved pixel QAと新7native crop・全10thumbnail/一覧を独立目視PASS。parent-independent-qa.jsonの全10output SHAがこのmanifestと一致することを確認済みです。依存はmanifest記載のOpenCV/NumPy/PillowとQAラベル用Mac Arial。compose_family.pyはsource画像を変更せず、再現に必要な不変v5コードをSHA固定しています。

## 採用・担当境界

SOURCEのみ。Dobaj6/Absal2は今回未制作、SHOP外46 HOLD。旧素材v2/v3/v4/v5/botanical21/HMD/旧WebP全部保存。Draftの旧consumerには旧21と未承認HMD3 mappingが残り出荷不可。今回mappingやruntimeを変更せず、既存5bowl/charcoal・IDs/価格/効果/save不変。PC/touch/save/HTTPゲーム回帰はsource-onlyなので今回不要・未実施で、導入済みとは言いません。全18/runtime/HMD/mergeは将来の別判断。#437未編集、#597/#598はA担当でCはclaim/startしません。

同worker codex-c-shop-art-20261016-8e7fb2cb0e、thread01a140d2-7791-7aa2-9b89-4ad03675a977、Issue586、PR587Draft、originalclaim38786636524を保持。source run成功+全14コメント現行owner/run+保存PRheadを読み取り検証（reservation-verification.json）、新workflow/status未発行。他Open PRの新folder重複なし、main1ec3dddbとの差分なし。release/transfer/merge/publication/checkout削除なし。

既存3枚Libraryはlibfile_aa321c23b8cc81919004ed4808de8a28で確認済み・重複upload不要。wrapperが新10比較のLibrary保存を確認済み。一覧libfile_321f31ee40f88191bb7993e4b2b3c809、全前後libfile_2b14f951c73881918b46b188ff5e9936（ともにversion0）。file ID/名前/source SHAはlibrary-previews.json。Cの重複uploadはありません。
