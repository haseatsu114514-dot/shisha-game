# パッキー：動画生成用リファレンスシート 1案

完成PNG: `pakki-reference-sheet.png`（1536×1024、1716672 bytes）。正規内蔵 image_gen.imagegen で新規制作。`preview.html` で表示できます。

構成は上段に正面・側面・背面・斜め3/4全身、下段に通常・笑顔・悲しみ・真剣・驚き。白系背景と余白、同じ人物・衣装・配色の1案です。別キャラの画像は入力していません。既存あげは・はじめの画像自体も入力せず、構成のみを文章で引き継ぎました。

## 採用根拠

今回確認した main: `ea0229dbd6635299b78faba04c4956f28a9e0577`。

- [採用索引](https://github.com/haseatsu114514-dot/shisha-game/blob/ea0229dbd6635299b78faba04c4956f28a9e0577/remake/data/manifest.json): `portraits.pakki` と対応素材。
- [唯一の参照原画](https://github.com/haseatsu114514-dot/shisha-game/blob/ea0229dbd6635299b78faba04c4956f28a9e0577/assets/sprites/characters/pakki/chr_pakki_normal.png): `assets/sprites/characters/pakki/chr_pakki_normal.png`。
- 原画 Git blob SHA-1: `05561f4ddc66fef241210bc6e23263742a0a29fe`。実ファイル照合済み。
- [設定](https://github.com/haseatsu114514-dot/shisha-game/blob/ea0229dbd6635299b78faba04c4956f28a9e0577/data/characters.json)。設定は data/characters.json の該当人物。文章の旧衣装案より採用実画像を優先しました。
- 第1章登場根拠: current ch1_tournament.json speaker + manifest portrait

現在mainの必要な通常立ち絵1枚だけをGitHub connectorのbase64指定で取得し、復号後のGit blob SHA-1が一致。原画 521132 bytes。

原画を実際に見てから生成。維持した特徴: 白い煙型マスコットの輪郭、黒い楕円の目、ピンクの頬、赤い蝶ネクタイ、金色のハンドピースと青いホース。

## 新規補完・制約

煙の立体形状と背面、ホースの回り込み。側面に生成された尻尾状の突起は1回の整合修正で除去。

背面・不可視構造・回転図の形状は推定で、画像内にも英語脚注を付けています。公式設定として確定していません。5表情は通常原画から新しく描いた提案で、他の採用表情原画そのものの複製ではありません。実見した通常原画以外を見たことにはしていません。生成画は原画よりピクセル感が滑らかです。顔・画素・体型寸法の完全一致を保証せず、新しい身長・公式色コードも設けていません。

## 仕様・確認記録

- `generation-prompt.txt`: 構成・衣装・色・表情・推定範囲を含む完全仕様と生成プロンプト。
- `evidence/source-index.json`: 現在mainの採用索引抜粋、設定と素材メタデータ。
- `evidence/output-review.json`: 入力画像照合、完成画像の目視確認、寸法・byte数・SHA-256。
- `correction-prompt.txt`: 側面の不要な突起だけを除く整合修正。修正前画像はこの保存資料に含めていません。


## 保存状態

制作資料として本ディレクトリに保存。Libraryは司令役が保存済みの実記録と照合しました。この保存作業でのLibrary再アップロードはありません。元の採用スプライト、ゲームUI、ゲーム素材manifestは変更していません。
