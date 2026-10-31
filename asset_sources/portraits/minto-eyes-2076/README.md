# #2076 みんと営業 normal/smile 目の左右差修正
- 実施: Grok Bot（OpenAI Images API `/v1/images/edits` + マスク、`gpt-image-2.5-sunburst`）
- 方法: `gen.py`。顔周り256pxを4倍拡大し、両目の楕円だけ透過マスクで編集→縮小して目の楕円だけを元画像へ合成（他のピクセルは不変、配置も不変）
- 試行: v1（矩形マスク、前髪まで変わり不採用）、v2/v3（楕円マスク）。採用 normal=v2, smile=v2
