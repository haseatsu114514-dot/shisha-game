# #579 独立施設アイコン・部分成果

本編未接続。`/remake/facility-icons-preview.html` で比較する。採用元PNGを無変更の完全一致コピーとして `assets/ui/map-facilities-579.png` へ保存し、表示はこの公開対象素材を参照する。生成・加工・再保存・resize・alpha補正はしていない。map.js / store-logos.css / daily.css / index.html / manifest / 台帳 / workflowへの変更なし。

## 採用根拠・原画

今回のオーナーの明示指示により、既存シートを提示した会話への「アイコンはそれ」を採用根拠とする。左＝観音堂、中央＝自宅、右＝喫茶こはく。過去の店舗READMEでは「提案履歴」とされているが、今回の直接指示による専用プレビューのみを作成する。本編採用済み・Issue完了とは扱わない。既存保存原画の再利用で、新しい外部素材・ライセンス・生成依頼は追加していない。元サービスの利用条件を今回独立に再検証したわけではない。

- 元: `asset_sources/store-logos/ch1-issue470/ingame-qa/pin-cutout-546/facilities-source.png`
- 公開用完全一致コピー: `assets/ui/map-facilities-579.png`（親の追加許可、既存fileなしを確認して排他的作成、1,687,132 bytes）
- Git blob: `76fea0c4c5d0fd46364b9ed5df5fa0826d11eda4`
- SHA256: `7289b74ffe67290a444f2e6e95dee7be209ec31ae33d31cd26b39903ed51a284`
- 実測: 2172×724 / RGBA。alpha252＝188024画素、alpha253＝476313画素。完全不透明に補正していない。

## 切出し・表示座標

右端・下端はexclusive。主要領域はPillowでalpha > 2を独立測定し、各辺に原画2pxの余裕を加えた。均等3分割は観音堂と自宅を切断するため使用しない。

| ID / 施設 | alpha > 2 のbbox (l,t,r,b) | CSS表示窓 (x,y,w,h) |
| --- | --- | --- |
| kannondo / 観音堂 | 23,89,834,646 | 21,87,815,561 |
| home / 自宅 | 844,127,1503,679 | 842,125,663,556 |
| kohaku / 喫茶こはく | 1554,106,2118,641 | 1552,104,568,539 |

表示サイズSに対し `scale=S/max(w,h)`。S×Sの中央にw×scale、h×scaleのoverflow:hidden窓を配置する。元画像全体を2172×scale、724×scaleで表示し、窓内のleft=-x×scale、top=-y×scaleへ移動する。アスペクト比を維持し、白い下地・ステッカー縁・filterを画像へ追加しない。プレビューの細い四角は選択ボタンの境界で、アイコン自体の縁ではない。

3窓の外に除外される非透明画素はalpha1の微小点300個。原画内の全alpha > 2画素と周囲の余裕を保持し、隣施設の主要画素は窓外。赤系・黄系の細いフリンジは原画に存在し、そのまま保持する。画像を再着色・alpha補正していない。

## 実行・実画面QA

```sh
node remake/test/facility_icons.mjs
npm ci --offline --ignore-scripts --prefix remake/test/browser
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node remake/test/browser/facility_icons.mjs
```

静的テストはPython3 + Pillowが必要。ブラウザテストは既存browser/package-lock.jsonのPlaywright 1.62.1を使用。元PNGと公開コピーのbyte完全一致・両方のhash/blob、実alpha境界、施設とラベルの対応、隣領域除外、縦横比、不正ID/サイズ拒否を検査。初回は浮動小数点の完全一致assertが失敗し、許容誤差1e-10へ修正した。

### 配信相当の検証（実際のGitHub Pages公開QAではない）

現行deploy-pages.ymlはassets/remakeをコピーし、asset_sourcesを除外するため、初版の原画直接参照では公開プレビューの画像が欠落する。今回、親の明示許可による無変換コピーとFACILITY_SHEETの参照先変更で解消した。切出し座標・施設・表示サイズは変更していない。

ブラウザテスト自身が一時stageへ対象HTML・CSS・JS・assets PNGの4ファイルだけをコピーし、`/shisha-game/` 配下でlocalhostへ配信する。asset_sourcesディレクトリは存在しないことをassertする。全24画像のcurrentSrcが `/shisha-game/assets/ui/map-facilities-579.png` であること、サーバーが受けたURL集合がこの4ファイルだけであることを検査する。元資料へのリクエストやドメインルートへの誤った絶対参照はテスト失敗になる。stageとサーバーは終了時に削除・停止する。外部サーバーの事前起動は不要。

ブラウザではPC 1280×900、タッチ844×390/DPR2、タッチ390×844/DPR2を検査。各24ボタン（明暗×3施設×32/48/64/128px）を実クリック/実tapし、表示窓・元画像の座標、48px以上の独立したボタン領域、PCのEnter選択、横方向の収まり、既存save sentinel不変、ページエラー・リソース失敗0を確認した。タッチはChromeエミュレーションで、実機Safari検証ではない。

証跡: [PC](pc.png)、[横持ちタッチ](touch.png)、[縦持ちタッチ](portrait-touch.png)、[機械検査結果](browser-results.json)。3画面を実際に開いて目視。主要な絵の欠け・施設の誤対応・隣施設の混入は見られなかった。32pxは形状で識別できるが細部は潰れ、暗い背景の観音堂は屋根が暗い。明るい背景ではこはくの湯気が薄い。原画由来の細い色縁は残るが、白いステッカー縁は追加していない。今回の目視はこの静止比較ページの範囲に限る。

## 残作業・競合境界

初回にPR580 / PR481 / PR583の変更file名を個別APIで全ページ照合し、当初の6許可パスとの重複0。今回の親の最新境界確認でも、本編map.jsは580（pin/顔/ゲスト）と481（街歩き入口）、store-logos.cssは580（人物）とIssue574（ロゴ配置/余白/色）の予定境界があるため、本編接続は保留。daily.cssも481の変更範囲。PR583は最新mainに反映され、今回の許可パスと重複なしとの親の確認を受領。今回、他PR全件取得や追加の広い調査は実施していない。

本編の地図タッチ領域・解禁前後・旧save復帰・ゲストとの重なり・通常/AUTO/SKIPは未接続かつ未検証。asset_sources直接参照の配信問題は、公開assets完全一致コピーと上記の配信相当テストで解消。実際の本番URLでの確認・実機Safariは未実施。共有workflow変更やmanifest登録は不要。マージ・公開・Issue完了・claim releaseは禁止範囲として未実施。

WORKER: codex-b579-20261015-91f6ab / SESSION: 01a14069-d6f6-7a91-8b8c-49332a6c98d3 / CLAIM_RUN: 38764988212 / STATUS_RUN: 38777290032（completed/success、実notice一致）。利用枠guardは現mainの45行SyntaxErrorで取得不能、残量不明。無関係なスクリプト修正なし。
