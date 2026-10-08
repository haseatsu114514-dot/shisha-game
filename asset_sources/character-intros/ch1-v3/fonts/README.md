# 登場カット用フォント

Noto Sans JP（SIL Open Font License）を使用。今回のオーナーの名前フォント改善依頼に従い、前回のZen Kaku Gothic Newから変更した。

上流: https://github.com/google/fonts/tree/main/ofl/notosansjp

[OFL全文](OFL-NotoSansJP.txt)。可変ウェイト100〜900。必要な日本語・公式名・一言・操作部の字形だけをWOFF2へサブセット化している。再配布・単体HTMLへの埋め込みはOFLに従う。

追加の名前やセリフを編集した場合は `build-font.py` を実行し、`render-preview.cjs` で単体HTMLも再生成する。フォント再生成だけはネットワークとfonttools・brotliを使う。プレビューの利用時は通信不要。
