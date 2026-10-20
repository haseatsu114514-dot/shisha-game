# 会話UI — Issue #741

ユーザー採用の会話UIを本編の可変文字・操作に分離。`approved-reference.png` は承認済みの文字入り原画、`empty-source.png` はその文字・区切り・次へ印だけを除くよう画像生成で編集した原画。ツール: OpenAI image_gen、2026-10-20。外側は透過。

実装先: `remake/css/vn-lounge.css`。`remake/img/ui/vn-lounge/` のSVGは原画をWebP可逆圧縮して内包し、切り出し領域だけを表示。本文・名前・操作文字・次へ印は本編DOM。本文の幅・高さ・改ページ仕様を維持する。操作枠は本文上辺から10px離す（採用プレビューの最終位置）。

確認: `/remake/conversation-preview.html` は本編エンジンを使用。保存データの読み書きはしない。ひよりの場面は既存台本 `hiyori_shop_repeat_0` の導入の地の文を省いて再生し、ほか3場面はUI確認用の例文。物語の台本は変更しない。
