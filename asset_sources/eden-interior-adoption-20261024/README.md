# EDEN 内装の正式採用

オーナー承認：「これで採用ゲームに反映して」。

## 原画・指示

- [採用原画](../../docs/qa/eden-interior-concepts/eden-pixel-matched.png)（Git blob `8bf4e7dffa49aff8d8cd35eb59f04d074773a2a6`）
- [生成指示](../../docs/qa/eden-interior-concepts/pixel-matched-prompt.txt)
- [比較・過去候補](../../docs/qa/eden-interior-concepts/README.md)

原画は先にGitHubで比較・採用した同一ファイルを参照し、重複コピーしない。

## 採用内容

- 窓を追加せず、現行店内の間取り、カーテン、ランプ、ソファ、暗めの暖色照明を維持。
- 他店を参考にドットの描き方を調整。りんごの対は画面左が緑、右が赤。
- シーシャ台はテーブル・展示台上。ソファ上には配置しない。
- 台が描画済みのため、`remake/js/core/scene-art.js` のEDEN専用旧合成を撤去。
- 人物の髪色、既存ロゴ、登場絵、台詞は変更しない。

## ゲーム用変換

採用原画1672×941をLanczosで1280×720へ一度だけ縮小。
`assets/backgrounds/bg_eden_shop.png` と、既存 `build_images.encode` で作成した `remake/img/backgrounds/bg_eden_shop.webp` を更新。
両方とも既存の通常Git管理画像（legacy指定）で、LFS履歴や管理方式は変更しない。新しいファイル名や目録項目は不要。

## 検証

- 画像のデコード・寸法1280×720・既存manifestのPNG/WebP登録を確認。
- JavaScript構文と差分の空白を検査。
- `adam_eden_711.mjs` の `pc-map-and-entry` / `touch-map-and-entry` / `pc-eden-visit` / `touch-eden-visit` が全て成功。
- 入店と会話の回帰検証で、EDENが旧台を重ねず採用背景1枚で描画されることを検査。
- PC会話・タッチ入店後のスクリーンショットを目視。
