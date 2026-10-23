# #636 / PR #637 温度ゲージ・ミックス熱特性の独立レビュー記録

**マージ保留。今回の引き継ぎ・実装・テスト成功はマージ許可ではない。**

## 引き継ぎと対象

- 旧レビュー基準HEAD: `5194bce41eec9bb87a5ae9ac3832bdf9b617677e`
- 新worker: `codex-thermal-handover-20261017-7f13` / agent `codex`
- [旧担当ハンドオフ](https://github.com/haseatsu114514-dot/shisha-game/issues/636#issuecomment-6231184498)
- [transfer run 39013772928](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39013772928): SUCCESS。ログのIssue/ownerと[最新bot台帳](https://github.com/haseatsu114514-dot/shisha-game/issues/636#issuecomment-6231228048)の新owner/runを照合後に編集開始。
- 元Macの直接検査はできない。停止宣言、manage_taskの背景タスクなし、clean・未追跡/stash/未pushなし・ローカル/PR完全HEAD一致は旧担当本人の投稿に基づく。OS全体のプロセス不在とは主張しない。
- 既存ブランチ `codex/636-dobaj-ceiling-bonus-fix` を継続。元PR・ブランチの置換、force push、予約解除、main直pushなし。
- 統合main: `13bf4a125d781c1d1bc4e6e94687e72f8d9477f4`。通常mergeで取り込み、既存の採点・温度・蒸らしテストを確認後に実装。
- 実装commit: `f0227137da0b5ee8f42b5287be6d9d58a6d2f649`。後続commitは同条件比較テストとこのQA記録。最終完全HEADとCI状態はPR #637の完了記録を参照。
- Open PRの変更ファイルを照合。#631の商品データ・採点テストは保持。#605/#617の予約・保全基盤は変更なし。追加の#645はTRPG/台詞で今回の実装箇所と重複なし。mainの家シーシャ・配合比率表示も保持。
- 既存checkout/cacheを再利用。対象PR/mainのref限定・blobなしfetchの最初のpackは25.48 KiB（API等を含む総通信量は未計測）。新規の家シーシャ原画はsparse対象外として取得せず、フルクローン・全履歴/全ブランチ/LFS取得はしていない。

## 実装

`temperature-model.js:temperatureBands` が共有する中心と帯を唯一の計算元とした。

- 正の有限なgを正規化したwで `C = 0.54 × Σ(w×t)`、`A = E × Σ(w×W)`。
- 適温は `C ± 0.12A`、最適温は `C ± 0.05A`。幅へのt・社数ペナルティなし。
- `temperatureFitness` は連続値で中心100、最適温端90、適温端65、帯外Slope=360、0〜100。`pullResult` はその後に既存の葉ダメージ減算・整数丸めを行う。完成品の `craftQuality` とは別。
- `makerMixProfile` は同じ帯を返し、既存メーカー加算と得点側シナジー減衰を維持。互換プロパティ `widthPenalty` は1固定。吸引許容とドバジ比率による過熱軽減の式は変更なし。
- 配合中の折り畳み表示を常時表示の横ゲージへ変更。未選択、適温/最適温の文字・数値、境界線、中心線を表示。黄金比の正解・審査員の好み・品質予想点は表示しない。
- 温度計は中心に加え幅の変更も検出。ミックス・蒸らし・吸い出し・調整・背景・過熱採点は共有帯を参照。背景の基準位置も適温/最適温の両端・中心へ写す。
- ドバジ85点固定上限はない。添加で非縮小を保証するのは移動後中心からの許容幅で、添加前の絶対温度での高得点ではない。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| `node remake/test/mix_temperature.mjs` | PASS。全64葉のモデル、768境界ケース、15,090ドバジ幅ケース、位置/幅の独立、100/90/65両側境界の直前直後、Slope=360 |
| 幅ケースの条件 | 総量12g固定、機材3組、AF/ピーキー単社/他社複数の5組。0g、微小量、0.1g、1g、25/50/75/100%、純ドバジ直前と端点、0.1%刻み。両半幅の連続性・非縮小 |
| `node remake/test/craft_scoring_spec.mjs` | PASS。主要4社+2.50/ドバジ+0.80、混合シナジー、実採点の寄与、49/50/51%の吸引許容/過熱軽減、飽和/丸め、85点超、適合度≠品質 |
| `node remake/test/steam_temperature.mjs` | PASS。気候・11,340温まりサンプル・予測・炭/時間バランス |
| `node --experimental-vm-modules remake/test/data_loading.mjs` | PASS |
| `node remake/test/golden_ratio.mjs` | PASS。既存判定・得点・課題との分離を保持 |
| `node remake/test/browser/mix_temperature.mjs` | 8/8 PASS。PC/タッチ/低減モードの実配合→蒸らし→吸い出し→調整、全葉の表示/判定一致、同じtでメーカー/機材だけ変更、旧セーブ・分離 |
| 同条件比較の追加実行 | PC/タッチ各PASS。総量12g・同機材・同気候・開始温度0.64・同蒸らし成績・2回のキープ。3配合で実吸い出しと実品質採点を比較 |
| `node remake/test/browser/ch1_presentation.mjs` | 10/10 PASS。PC/タッチの常時ゲージ・多数葉・操作・既存配合/詰め/審査表示 |
| `node remake/test/browser/thermometer_alignment.mjs` | 3/3 PASS。PC、縦横回転、低減モード。全工程の帯/現在針/実吸引中の温度一致 |
| `node remake/test/thermal_background.mjs` | PASS。背景の画素/色・帯・熱の引継ぎ・冷却/過熱・失敗・タッチ/低減モード、page errors 0 |
| Git Safety / agent docs / 変更差分の空白検査 | PASS |

Chromiumは `/usr/bin/chromium`、ブラウザ実行は `CHROME_EXECUTABLE_PATH=/usr/bin/chromium` を指定。結果JSONはこのディレクトリに保存。全8ケース実行後、比較2ケースのみ実吸い出し・品質測定を追加して個別再実行した。実行時に本体コード変更なし。

初回の旧固定帯期待値、タッチ縮尺測定、練習fixtureのミント在庫不足は修正し、該当テストを再実行してPASS。main取り込み時の空白検査では既存原画比較HTML2件の末尾空行を検出したため、無関係な原画資料は編集せず、自分の変更差分が空白検査を通ることを確認した。

## 同条件比較と画面証拠

| 配合（12g） | 中心 | 適温全幅 | 最適温全幅 |
| --- | --- | --- | --- |
| ダブルアップル9g＋ミント3g | 0.56700 | 0.24960 | 0.10400 |
| NSアールグレイ12g | 0.62100 | 0.18720 | 0.07800 |
| NSアールグレイ9g＋バニラ3g | 0.57375 | 0.21840 | 0.09100 |

実吸引は同じ開始温度0.64から2回キープ。針の実行タイミングによる提供温度の微差はJSONに記録しており、提供温度まで完全同一とは主張しない。既存レシピの成立やメーカー加算も品質に影響するため、品質点を温度適合度として扱わない。

- [PC比較測定](comparison-desktop.json) / [タッチ比較測定](comparison-touch.json)
- 基本配合: [PC](basic-desktop.webp) / [タッチ](basic-touch.webp)
- ピーキー葉: [PC](peaky-desktop.webp) / [タッチ](peaky-touch.webp)
- ピーキー葉＋ドバジ: [PC](peaky-dobaj-desktop.webp) / [タッチ](peaky-dobaj-touch.webp)

## 未実施・残事項

- 物理PC/スマートフォンでの手動プレイ、実機Safari/iOS、長時間の全レシピ・全章バランス評価は未実施。PC/タッチはChromiumの自動操作と画面画像の目視確認。
- 最終HEADのGitHub CI・独立レビュー完了は別途PRで記録する。旧HEADの15件成功を新HEADの成功へ流用しない。
- 主観的な針の止めやすさ・長期レシピバランスは確定評価していない。主要4社の新たな個性化、最低吸引回数や容量超過の案内変更は範囲外。
- PR #637は明示的マージ保留。予約は新workerが保持する。
