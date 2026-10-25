# 会社員・笑顔の配置補正

2026-10-24、立ち絵のサイズも点検し、おかしければ揃えるという追加指示に対応。通常の足元へ合わせ、`chr_salaryman_smile.png` 全体を左4px・上3pxへ平行移動した。拡縮・顔や身体の描き直しはしていない。

`salaryman-smile-before.png` に修正前を保存。処理は `python3 tools/align_sprite_anchor.py -c salaryman`、配信用WebP・manifestは `python3 remake/tools/build_manifest.py --portraits-only salaryman`。`integration.json` に前後SHA-256・画素保持・足元差・WebP一致を記録。

全体の点検・実ゲームの比較は [サイズ点検](../../../docs/qa/portrait-sizing/README.md)。今回の追加依頼では画像生成は実施していない。ローカル反映済み、公開未反映。
