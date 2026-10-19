# #694: 炭の習得・取り頃・序盤の熱

Worker: `codex-b-694-handoff-20261019-16adcc966e`。Claim run: `39213455496`。
ゲーム変更の比較元は `5b2b7818ff2596239ca5dd6dbf1e2a2a82af92fb`。
旧担当のbootstrap・未確認成果は変更せず、ローカルの取得済みGit objectsとSHA照合済みcacheから独立したsparse checkoutを準備した。フルクローン・素材/LFS/依存/ブラウザのダウンロードなし。

## 挙動

- スミさん♥2で、シフト後メニューに「キューブ炭の授業を受ける」を追加。新台本 `ch1_sumi_cube_coals` の正常読了後だけ `flags._coal_cube_learned=true` を保存する。旧 `ch1_sumi_training`、好感度、cube所持からは推定しない。中断・古いstateの完了・再読で重複付与しない。既存flags内の追加で、セーブの形とSCHEMAは変更していない。
- 未習得はflat/triangle/3個固定。炭種・配置選択を自動通過。newSession、作業台の再表示、setup、単独drillで同じ制限を使う。旧所有品・旧装備は保持。習得後のfour/mixedには引き続き別フラグと所有条件が必要。
- 上物トングは正式名のgoods所持で判定。通常の `0.5秒 × 能力/体調等の倍率 × レッスン倍率` の後に0.05秒だけ加算。複数本は重複せず、最後の売却後の炭焼きから通常へ戻る。開始時点の幅を表示・入力・誤差・AUTO・共通交換炭で共有する。採点上限100は保持。
- 取り頃の芯を7pxから18pxへ拡大し、輪郭と炭面も明るくする。判定帯と同じ `.pikan` の間は常時発光し、繰返しフラッシュに依存しない。reduced-motionでも同じ取り頃を識別できる。
- flat3だけ、蒸らしのpowerを1.00→0.90、正方向の熱変化を従来比0.94へ。下げ吸い、cube、4点、混合の既存モデルと、温度帯・採点・メーカー効果・合成ゲージは保持する。正方向の補正はflat3の交換炭にも適用する。
- 新500円箱のホース2枠をAFバニラ25g×2へ。50枚/S1枚、価格、補充3日、meta/version、legacyGrades、1000円箱を保持。現行の箱snapshotは引き切るまで旧景品。既所持ホースは保持。実g付与は既存#647の実装をそのまま使用する。

## 比較と検証

[thermal.json](thermal.json) は実際のorigin/mainのcoals/conditionsを読み込んだ前後比較。12g、24穴、通常詰め、炭焼きheatPower70、晴れ23℃/湿度52%、jitter0で測定した。

| 蒸らし | 変更前 | flat3変更後 |
|---|---:|---:|
| 180秒 | 0.185993 | 0.173889 |
| 300秒 | 0.270398 | 0.251671 |
| 480秒 | 0.409660 | 0.382474 |
| 600秒 | 0.466863 | 0.437279 |

vanilla/ダブルアップル/mint/課題配合の4条件は、数値モデル上、3口以内で最適帯へ到達できる。これは実時間の冷え・波・入力を省いた到達性であり、大会勝利や全章バランスのPASSとは扱わない。

くじ定価換算は25,391→25,541円（通常賞EV 510.82円/回）。ラストワン込み28,541円、通常賞売却可能額8,900円。期待値更新は実g×店頭価格によるもので、採点期待値は変更していない。

`browser-results.json` にPC、844×390タッチ、同サイズreduced-motionの実測結果を保存する。各ケースは新規browser contextを使い、タイトル起動、実際のシフト後メニュー、実VNのSKIP/AUTO/Abort、保存復帰、独立したfour/mixed条件、共通burnCoalsの1〜4個、実pointer/touch/keyboard入力を確認する。0.525秒時点で、通常トングはhot、上物所持はjust/発光のままであることを検証する。

同じテストで旧箱のホース付与、引き切り後2日間の維持、3日目補充、新箱の実25g付与と保存を確認する。flat3の大会モードでは実炭焼き→吸い出し→調整2回をAUTOで実行する。蒸らし開始温度は本番の温度式から作るfixtureであり、弾幕を操作した通しプレイではない。

前後画像は同じ炭状態・同じ素材・同じ画面サイズ。beforeでは新CSS全体を無効にして比較元CSSだけを読み込む。

| 画面 | before | after |
|---|---|---|
| PC | [画像](pc-before.png) | [画像](pc-after.png) |
| タッチ | [画像](touch-before.png) | [画像](touch-after.png) |
| 低減motion | [画像](reduced-before.png) | [画像](reduced-after.png) |

再実行（既存Playwright/Chromeを指定。installは不要）:

```sh
node remake/test/coal_training.mjs
node --experimental-vm-modules remake/test/stamina_condition.mjs
node --experimental-vm-modules remake/test/steam_temperature.mjs
node remake/test/mix_temperature.mjs
node remake/test/craft_scoring_spec.mjs
node --experimental-vm-modules remake/test/foil_holes.mjs
node remake/test/golden_ratio.mjs
node remake/test/kuji_balance.mjs
node --experimental-vm-modules remake/test/data_loading.mjs
python3 tools/lint_dialogue.py ch1_sumi
python3 tools/tidy_dialogue_text.py --dry-run
PLAYWRIGHT_MODULE=/path/to/existing/playwright/index.mjs \
CHROME_EXECUTABLE_PATH=/path/to/existing/chrome \
node remake/test/browser/coal_training.mjs
```

## 保護範囲と未検証

- #598の`kuji.js`・同期ロック・演出・箱生成/補充・付与処理は無変更。既存境界照会は未回答のままで、担当移管や未公開成果なしとは判断していない。今回の景品変更は`data/kuji.json`のgradesのみ。
- #636のtemperature-model/score/thermometerと保存成果、#691のch1.js、#631のcraft_scoring_spec、owner_requests、remake READMEは無変更。DS専用開発・削除・巻き戻しなし。
- 実機iPhone/Safari、物理端末の操作感、全章・大会投票までの通しプレイ、長期バランスは未検証。
- ブラウザは実Chromeで、タッチとmotionはエミュレーション。熱工程の実画像6点はSHA照合済みの既存cacheから配信し、無関係な画像・音声・外部通信は意図的に遮断した。完全な本番素材表示の検証ではない。
- 既存総合browserスクリプト`thermal_background.mjs`/`steam_attack_growth.mjs`は通常の`require("playwright")`解決で停止し、PASSに数えない。専用runnerは上記の既存モジュールを明示指定して検証する。既存ch1_tournamentの配置fixtureを新仕様へ更新し構文確認したが、同スイート全件は未実行。
- 台詞lintの既存7 WARNは旧台本の報酬キュー。追加授業の新規WARN/ERRORはない。CIと独立レビューは別途必要。Draftを保持し、マージ・公開・予約解除は行わない。
