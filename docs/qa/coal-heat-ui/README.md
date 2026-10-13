# 炭焼きUIと工程素材の読み込み確認

Issue #503 / PR #541。承認済みモックPR #506の構図を本編へ接続。

## 画像と実表示

- `flat-ready.png` / `flat-collected.png`: オーナー指定の炭から側面を少し低くしたフラット炭。焼成中3+0から回収2+1へ。
- `cube-ready.png` / `cube-collected.png`: 新たに生成した、側面の高い四角いキューブ。同じ形・材質で回収。
- `touch-four-collected.png`: 横持ちタッチ、4個を全部ジャストで取る実入力の途中。
- `exchange-four.png`: 熱管理中の交換炭4個。2つの赤熱炭と暗い早取り炭を回収し、1個を加熱中。

PNG原画の着火前後は同じ1374×1145キャンバス。alpha>=24の輪郭IoUはフラット98.96%、キューブ99.45%。bboxの各辺差はフラット3px、キューブ2px以内。
同じ幅86pxでフラット約69px高、キューブ約88px高。前版のフラット約80pxから少し低くし、薄すぎた初版約60pxより厚みを残した。底面は水平、各炭を同じ方向に平置き。
後部のコード、左奥の1個と適度に内側の手前2個、中央の空き、炭の間隔、長い炭壺の持ち手を目視。
炭の番号、下の焼成説明、吹き出しの突起、3つの収納枠なし。
炭壺は「上から」の角丸小窓。25mm炭/130mm受け部を参考に別視点で縮小する。
炭壺へは入力時の素材/形/焼け具合を複製。画面上の寸法は操作用表現で、熱分布や3D寸法の実測ではない。

## 操作と読込

ローカルHTTPとChromiumで実行。セーブは新しいブラウザーcontextのメモリ上の状態だけ。

| 検証 | 結果 |
|---|---|
| `heat_feedback.mjs` | PC/横持ちタッチ/縦表示、通常3/4個、交換1〜4個の16ケースPASS。実入力・評価・得点・領域の間隔・収まり・同じ回収素材・保存状態不変 |
| `craft_templates_timing.mjs` | PC/横持ちタッチ/縦表示の3ケースPASS。穴配置選択・Space開始・炭の実時刻/早遅判定・位置名の結果表示 |
| `craft_readiness.mjs` | 3ケースPASS。無関係な素材待機から独立、次工程先読みで操作を止めない、必須キューブ画像で時計を待機、混在/Space/Enter/自動回収 |
| `worker_scenes.mjs` | 19ケースPASS。工程・表情・実吸引/穴あけ、遅い画像/表示画像decode、失敗/期限切れ/late load、decodeなし、reduced motion |
| `stamina_condition.mjs` | 体力による炭の成功幅、同じ入力時刻と判定、初回レッスン保護、雑念密度/連続被弾ガードPASS |
| `foil_holes.mjs` / `mix_recognition.mjs` | 配置/完成条件/温度/味/既存境界PASS |
| 試遊入口のフラット/キューブ | 3+0→2+1、LocalStorage不変、pageerror/HTTPエラー0 |

詳細は`readiness-results.json`、`worker-results.json`、`preview-results.json`。
フラットの高さ修正後にもheat_feedback16ケース、readiness3ケース、試遊2種を再確認。最初のreadiness再実行は10秒の準備上限で2ケースが期限切れになったため、先読み検証前に現在工程の必要素材を準備し、必須画像保留の解除後は15秒画像上限＋3秒カウントダウンを含む20秒上限へ合わせた。保留中に時計が始まらない条件は維持。修正前の実行結果も`readiness-before-fixture-fix.json`へ保存した。
画像生成入力・参照履歴・alpha寸法は`asset_sources/coal-heat-ui-game/generation.json`。
既存テストの「隠れた未使用imgも全部待つ」条件を可視画像へ変更し、現在の工程の準備/開始順序は上記の遅延テストで検証する。

## 読込量と測定の範囲

旧`craftAssetUrls("tournament")`の104 URLに対し、選択した炭焼き工程は27 URL。
この数字はreadinessの待機リストの比較で、起動時UIや作業台の共通準備を含む全通信数ではない。
別工程の画像と他人の表情を保留しても、炭焼きの準備は先へ進む。
店内・人物などタイトル後の共通先読みは背景で継続し、ゲーム開始の条件にはしない。

`readiness-metrics.json`はローカル環境の一回の確認: 初回3427ms、同じ素材の再表示1032ms、再通信0、再表示の読み込み幕0。
回線/端末の性能比較や実機での速度保証ではない。初回待機中は入力を止め、必要な素材が準備できてからカウントダウン・時計を始める。

実機iPhone/Safariは未検証。タッチはChromiumの実イベントで確認。公開反映・最終CIはPRへ記録する。

## 正式引き継ぎ後の検証（PR #541）

旧担当の停止・保存済みhead・参照Open PR一覧を確認し、管理者transfer
[38435531517](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38435531517)
と同run指定のstatus
[38435695015](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38435695015)
の成功後に継続した。新ownerは`claude-coal-541-20261014-d17fc2e3`、実クライアントはCodex。

main `ad74d6e40525d695b8ad00bf502074fa94611e6e`を通常マージ。
manifestの既存キー・配列の登録を全件照合し、第2章の素材を保持した。
mainとの差分はmaking素材7件の追加と生成時刻のみ。Open PR #532の素材登録とも別キー。

- `heat_feedback.mjs`: PC/タッチ/縦表示・回収・交換1〜4個、16ケースPASS。
- `craft_readiness.mjs`: 3ケースPASS。必要素材・混在炭・キーボード・自動回収、次工程先読み、キャッシュ再開。今回のキャッシュ再表示49ms、再通信0、幕0（ローカルの一回の測定）。
- `worker_scenes.mjs`: 19ケースPASS。PC/タッチ・表示画像decode・遅延/失敗/期限切れ・代替表示・低モーション。
- `craft_templates_timing.mjs`: 3画面サイズPASS。初回は結果カードの入場中の座標測定がmobileで失敗。`.show`と有限アニメーションの完了を待つようテストを修正し、既存の境界・採点のassertは維持して全ケース再実行。
- `ch1_opening_resume.mjs`の`interrupted-heat`を追加し、PC/実タッチイベントの2ケースPASS。実際の冒頭進行から炭1個を回収してreload。保存済みの練習選択を保ち、未完成の一台を最初から再開、完了記録は1回、所持金・体力・在庫などを保持し、古い炭や読込幕が残らない。
- 試遊入口のflat/cube×PC/touch 4ケースPASS。1個回収→穴あけへ移動→戻るで0/3から再開、LocalStorage不変、pageerror/HTTPエラー0。初回の検証スクリプトは1個目のジャストまで待つ間に別の炭が自然回収されて個数期待が失敗したため、離脱検証は開始直後の1個回収へ変更。自然回収の仕様は変更していない。
- `stamina_condition.mjs`、`foil_holes.mjs`、`mix_recognition.mjs`、`steam_temperature.mjs`、agent docs、diff check PASS。

機能・採点・画像の追加変更は不要だった。今回の追加差分はmain統合、離脱回帰テスト、描画完了のテスト待機と検証記録。
集計・詳細は[handoff-verification.json](handoff-verification.json)。実機iPhone/Safariは未検証。
最終headのCI・マージ・Pagesの公開確認はPRとIssue #503へ記録する。
