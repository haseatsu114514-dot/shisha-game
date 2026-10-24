# 目とフェイスラインの修正・全表情点検

みんと通常v4・あげは悲しみv1の先行2枚に加え、あげはの残り4表情を追加でローカルへ反映。みんと笑顔の正面化案はユーザー指摘で不採用にし、元の傾いた笑顔へ復元。目の左右差と顎の黒白二重縁を、標準image_genによる連続した再描画で調整した。足元を合わせ、PNG・可逆WebP・みんとの顔アイコンを更新。公開反映・最終版へのユーザーの見た目確認は未了。

- [みんとの修正前後](../../../asset_sources/portraits/minto-eye-jaw-review/normal-v4-face-compare.png)：顔を正面寄りに変更し両眼を揃えた。元より目と頬が丸く、頭の傾きも変わる。
- [あげはの修正前後](../../../asset_sources/portraits/ageha-jaw-review/sad-v1-face-compare.png)：顎線と明るい縁を弱めた。顔の描線・陰影は少し滑らかになる。
- [22キャラ100表情の点検結果](audit/README.md)：全表情に個別の判定理由を保存。先行2枚＋あげは追加4枚を修正。みんと笑顔は元へ復元。ましろ通常・真剣は明確な破綻がなく、ユーザーの方針に従って元を維持。
- [追加修正の採否・みんと笑顔の復元](../../../asset_sources/portraits/face-corrections-followup/README.md)、[旧5枚の実VN確認](followup-runtime-review/browser-check.json)、[みんと復元後の実VN確認](minto-smile-restore-runtime/browser-check.json)。
- [現在のPNG/WebP比較ビューアー](index.html)、[統合確認](integration-check.json)、[実VNの表示確認](runtime-review/browser-check.json)。

追加の[全キャラのサイズ点検](../portrait-sizing/README.md)で会社員の笑顔を左4px・上3pxへ整列。目・顎の絵や縮尺は保持した。このサイズ点検ではその他の拡縮・再生成は実施していない。その後の今回の目・顎修正は上記の追加記録を参照。

以下は**不採用となった旧局所合成の履歴**。ユーザーの肌の歪みの指摘後、2枚とも作業前 `1ce4527b` へ一度バイト一致で戻した。その後、今回の再描画を適用した。`rollback-check.json` は復元当時の記録であり、今回の修正後を示すものではない。

## 失敗の原因と検証の訂正

生成は線色だけでなく顎の位置と肌色も変えていた。別AIによる独立確認でも、顎と首の境界に原寸約1pxの局所的なずれが認められた。前回はその画像を幅4pxの手指定マスクで合成し、ずれた境界や色差を残してしまった。

- あげはの元座標 `(500,395)` の肌は RGB `[250,211,165]`、生成候補は元寸法へ縮小すると `[222,158,125]`。明るい肌に暗い色が食い込む。
- みんとではマスク中心が実輪郭より2〜3px肌側を通る箇所がある。
- αを保存しても内部の顎形状はRGBの変化で歪む。「マスク外が不変」「変更が262／230画素だけ」というチェックは美観や形状の維持を保証しない。
- 前回の「顔立ちを保持した修正として合格」という評価は撤回。輪郭を細い帯で切り貼りして救済する手法は再使用しない。

`rejected-v1/` の比較・ゲーム画面・ブラウザ確認・画素検査は**不採用案の履歴**。成功例や現行ゲームの状態ではない。`detail.png` に原寸画素を拡大した比較を保存。`rollback-check.json` が現在の復元確認結果。

## 2回目の候補も不採用

あげは1枚だけ、線の色・明るさのみを変更し、肌と首の境界を動かさないよう標準image_genへ再指示した。出力は `asset_sources/portraits/jawline-cleanup/ageha-sad-rejected-v2.png`。

元の180×170 cropへLanczos縮小して確認したが、顎先x498付近は約1px上へずれ、濃い線と明るい縁も残った。元座標 `(500,395)` はRGB `[250,211,165]` → `[226,182,150]`、`(518,381)` は `[255,224,186]` → `[243,201,167]`。別AIでも不採用判定。ゲームへの合成・適用はしていない。

## 元の症状について確認できたこと

- みんと10表情・あげは5表情は、作業前の元PNGと配信用WebPがRGBA画素単位で一致。変換は可逆。
- 添付の絵はあげは `sad`。顎と首の境目はほぼ不透明（α252〜254）で、元絵に輪郭線として描かれている。透過やWebP変換が黒線を追加しているわけではない。
- 話者の立ち絵は `filter: none; image-rendering: auto`。顎へ線を追加するCSS処理はない。
- 濃さ・ギザつきの調整が課題であり、黒い部分すべてを不要な線と断定しない。チョーカー・髪・自然な首の影は保持する。

## 顔アップ一覧・再現

現在の顔アップと判定は `index.html` / `catalog.json`。以前の他85表情の一律の一次判定は、今回の [100表情の個別点検](audit/README.md) に置き換えた。`faces-*.jpg` は現在素材の一覧補助、`audit/faces-*.webp` は今回修正直前の比較。

```sh
python3 remake/tools/serve_preview.py --port 8123
# http://127.0.0.1:8123/docs/qa/portrait-jawline/
python3 docs/qa/portrait-jawline/build_catalog.py
node docs/qa/portrait-jawline/check-runtime.cjs
REVIEW_OTHER_CHARACTERS=1 node docs/qa/portrait-jawline/check-runtime.cjs
```

`asset_sources/portraits/jawline-cleanup/apply.py` は不採用実験の再現専用。ゲーム素材へは書き込まない。今回もこの細帯合成は使っていない。

GitHub照会はこの環境から `Forbidden`。push・PR作成・公開反映は未実施。作業branch `fix/portrait-jawline` に保存。
