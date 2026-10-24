# 目・顎の追加修正

ユーザーの「この調子で他のキャラも直す必要あるのとか表情があればやっていて」に沿って、全22キャラ100表情の点検で残った候補を修正した。2026-10-24、`fix/portrait-jawline` へローカル反映。GitHub照会がForbiddenのためpush・PR・公開反映は未実施。

## 反映した5枚

| キャラ | 表情 | 変更 |
|---|---|---|
| みんと | smile | 通常v4に合わせて両目の幅・開き・顔の向きを調整。笑顔と頬へ添えた指を維持 |
| あげは | normal / serious / smile / surprise | 顎の黒白二重縁を弱め、肌と首を連続して描画。髪・衣装・チョーカーと各表情のポーズを維持 |

[5枚の顔比較](adopted-face-comparison.webp)。各 `*-face-compare.webp` は左が元画像、右が候補。白・灰・暗背景、150%・100%・50%を並べた。`*-full-compare.webp` は全身の同寸比較。

標準image_genによる全身の再描画なので、顔の丸み・描線の滑らかさ・細かな衣装描写には元絵との差がある。先行修正と同じ画風を目指し、表情の意味や衣装デザインは維持した。細い帯での顔合成や輪郭線の一括除去は使用していない。

## ましろ2枚は未解決・元画像を保持

normalを6案、seriousを1案生成したが、不採用。通常v1/v2は白い縁の改善不足、v3/v4は頭部が小さくなる。v5は逆に髪と頬が大きくなり、v6は再び小顔化。真剣v1も通常v3と同じ頭身差がある。

限定した別AI確認でも、通常の頭頂→顎は元約155.5pxに対してv3/v6約141.5px、v5約162.5px。既存の真剣・笑顔・驚きは約148.5〜151.5px。白縁の改善と引き換えに表情切替のサイズ差が入るため、2枚とも元PNG/WebPを維持した。機械的な顔拡縮・部分合成で救済していない。候補と実際の生成指示は再検討用に保持する。

## 再現・検証

- [integration.json](integration.json)：採用状態、元／反映後／WebPのhash、足元と全高の計測。採用5枚はPNG/WebPが全RGBA一致。足元の横ずれは0.5px以内、下端は一致。全高差は最大2px。`spriteScale` は変更していない。
- [generation.json](generation.json)：標準image_genの実参照、役割を記したプロンプト、原画hash。差し替え前の参照は `previous/` にバイト一致で保存。
- [実VN確認](../../../docs/qa/portrait-jawline/followup-runtime-review/browser-check.json)：みんと全10表情（私服を含む）・あげは全5表情をPC1280×720／スマホ844×390で確認。修正前5枚との比較も含め40表示、画像読込・縦横比・JSエラーの検査が成功。顔と全画面を目視した。
- あげはの通常顔アイコンを更新。ゲームは `assets/ui/face_icons/face_ageha.png` を直接読み、アイコン用WebPは使わない。
- `prepare.py` は候補を一様縮小して既存の可視全高・足元へ配置するだけで、ゲーム素材を書き換えない。各原画は解像度が異なるため、その原画の可視全高に応じて一様縮小している。頭部だけの拡縮は行わない。
- ましろ以外の未修正画像は従来の個別判定を維持。[全表情一覧](../../../docs/qa/portrait-jawline/index.html)では、先行2枚＋今回5枚の計7枚が修正済み、ましろ2枚が調整候補、みんと8枚が濃さの経過確認。

```sh
python3 asset_sources/portraits/face-corrections-followup/prepare.py ageha normal 1
python3 remake/tools/build_manifest.py --portraits-only minto ageha
python3 remake/tools/serve_preview.py --port 8123
node docs/qa/portrait-jawline/check-followup-runtime.cjs
```
