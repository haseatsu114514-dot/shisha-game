# 目・顎の追加修正

ユーザーの「この調子で他のキャラも直す必要あるのとか表情があればやっていて」に沿って、全22キャラ100表情の点検で残った候補を修正した。2026-10-24、`fix/portrait-jawline` へローカル反映。GitHub照会がForbiddenのためpush・PR・公開反映は未実施。

## 現在の反映：あげは4枚／みんと笑顔は元へ復元

| キャラ | 表情 | 変更 |
|---|---|---|
| みんと | smile | 正面化したv1は不採用。元の傾き・表情へバイト一致で復元 |
| あげは | normal / serious / smile / surprise | 顎の黒白二重縁を弱め、肌と首を連続して描画。髪・衣装・チョーカーと各表情のポーズを維持 |

[以前の5枚の顔比較](adopted-face-comparison.webp)は履歴。みんと笑顔のAFTERは不採用で、現在はBEFOREの元画像へ復元済み。各 `*-face-compare.webp` は左が元画像、右が候補。白・灰・暗背景、150%・100%・50%を並べた。`*-full-compare.webp` は全身の同寸比較。

標準image_genによる全身の再描画なので、顔の丸み・描線の滑らかさ・細かな衣装描写には元絵との差がある。先行修正と同じ画風を目指し、表情の意味や衣装デザインは維持した。細い帯での顔合成や輪郭線の一括除去は使用していない。

## ましろ2枚はユーザー方針により元画像を維持

後続指示「ましろは破綻そんなしてないなら変えなくてもいい」に従い追加生成を中止。元の半目・顔形状に明確な破綻はなく、顎の白縁を一律に消す必要はない。以下は不採用候補の履歴。

normalを6案、seriousを1案生成したが、不採用。通常v1/v2は白い縁の改善不足、v3/v4は頭部が小さくなる。v5は逆に髪と頬が大きくなり、v6は再び小顔化。真剣v1も通常v3と同じ頭身差がある。

限定した別AI確認でも、通常の頭頂→顎は元約155.5pxに対してv3/v6約141.5px、v5約162.5px。既存の真剣・笑顔・驚きは約148.5〜151.5px。白縁の改善と引き換えに表情切替のサイズ差が入るため、2枚とも元PNG/WebPを維持した。機械的な顔拡縮・部分合成で救済していない。候補と実際の生成指示は再検討用に保持する。

## 再現・検証

- [integration.json](integration.json)：採用状態、元／反映後／WebPのhash、足元と全高の計測。あげは採用4枚と復元したみんと笑顔はPNG/WebPが全RGBA一致。足元の横ずれは0.5px以内、下端は一致。全高差は最大2px。`spriteScale` は変更していない。
- [generation.json](generation.json)：標準image_genの実参照、役割を記したプロンプト、原画hash。差し替え前の参照は `previous/` にバイト一致で保存。
- [実VN確認](../../../docs/qa/portrait-jawline/followup-runtime-review/browser-check.json)：みんと全10表情（私服を含む）・あげは全5表情をPC1280×720／スマホ844×390で確認。以前の修正前5枚との比較も含め40表示を確認した履歴。みんとの正面化を含む旧画面で、現在は [復元後の確認](../../../docs/qa/portrait-jawline/minto-smile-restore-runtime/browser-check.json) を参照。
- あげはの通常顔アイコンを更新。ゲームは `assets/ui/face_icons/face_ageha.png` を直接読み、アイコン用WebPは使わない。
- `prepare.py` は候補を一様縮小して既存の可視全高・足元へ配置するだけで、ゲーム素材を書き換えない。各原画は解像度が異なるため、その原画の可視全高に応じて一様縮小している。頭部だけの拡縮は行わない。
- ましろ以外の未修正画像は従来の個別判定を維持。[全表情一覧](../../../docs/qa/portrait-jawline/index.html)では、先行2枚＋あげは追加4枚の計6枚が修正済み。みんと笑顔は元へ復元、ましろ2枚は元を維持。その他のみんと8枚と合わせ11枚は必要以上に変えず経過確認。

```sh
python3 asset_sources/portraits/face-corrections-followup/prepare.py ageha normal 1
python3 remake/tools/build_manifest.py --portraits-only minto ageha
python3 remake/tools/serve_preview.py --port 8123
node docs/qa/portrait-jawline/check-followup-runtime.cjs
```

## みんと笑顔の復元（ユーザーの追加指摘）

「なんか正面になってたり変わりすぎでは」に対応。正常な頭の傾きや笑顔まで変えたv1を不採用にし、元PNGをバイト一致で復元。元の右眼は虹彩・ハイライト・白目が読め、頭の傾きと笑顔として自然な左右差。限定した別AIでの再確認でも明確な潰れとは判断しない。前回の高優先判定を撤回し、追加の目修正を行わない。[傾きを考慮した診断画像](minto-smile-original-eye-review.png)は読取確認専用で、ゲーム画像を回転加工したものではない。目の完全左右対称を優先して顔向き・表情を作り替えない。通常v4を他表情の顔向きへ機械的に展開しない。

[復元の画素・状態検証](minto-smile-restoration.json)、[実VNの復元前後](../../../docs/qa/portrait-jawline/minto-smile-restore-runtime/browser-check.json)。旧 `validation.json` は5枚反映時点の履歴で、現行の採用状態は `integration.json`。

```sh
REVIEW_MINTO_SMILE_RESTORE=1 node docs/qa/portrait-jawline/check-followup-runtime.cjs
```
