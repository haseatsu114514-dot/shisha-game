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
node --experimental-vm-modules remake/test/daily_consistency.mjs
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
- 日常シフトのVM回帰は新授業の依存先を正しくcraft/coalsへ解決し、saveをmockした上で既存の接客・天候・履歴・収入・時間帯の全assertionがPASS。既存heat_feedbackの上級個数fixtureは習得/4点の両フラグを明示した（構文確認済み、全件の実ブラウザ結果はCIを参照）。

## PR #732 CIのfixture修正

HEAD `94fa8fc70b743ae880f812ff48acb67a58646ca6` の `Chapter 1 eve choices and saves` は未習得の練習に配置工程を期待し、`scenes` は未習得saveで混合炭を期待して失敗した。前者は配置工程がなく、練習だけで習得しないことを明示的に検証する。後者は混合炭の描画・入力テストなので、習得・混合解放・cube所有をfixtureへ明示した。ゲーム本体とdataはこの修正では変更しない。

実Chromeで失敗した3ケース（`pc-practice`、`touch-practice`、`mixed-shapes-keyboard-and-automatic-removal`）がPASS。独立context、既存ローカル素材/Git blobのSHA照合、外部通信を制限したローカル配信で検証した。タッチの初回は起動前にローカルHTTPの接続resetで失敗し、検証サーバーの待受キューを増やした再実行でPASS。テストや本番のtimeout・assertionは緩和していない。構文、diff whitespace、coal_training、daily_consistencyもPASS。GitHub Actions全件の結果はPRの最新HEADを参照する。

`95fde17258f33a4517a5513b5e6741c945ee5af5` では前夜練習とscenesを含む21ジョブが成功し、最後のchromiumで `title_arts` の起動時画像数が0件となった。ローカル再現では既定のResource Timingバッファが250件で満杯（fullイベント8回）となり、読み込み済み画像が記録から欠落していた。起動前に2048件を確保すると全262リソースとタイトル画像1件を記録できた。テスト支援の任意initScriptで起動前に確保し、バッファ未満であることと画像が正確に1件であることをassertする。本番の起動・配信・画像選択には変更なし。

修正後のtitle_arts全3ケースがPASS。CIで停止地点より後のvn_visual_readiness、tonari_opening、tutorial_transition、continue_readiness、continue_audio、continue_neon、continue_typing、steam_slash、steam_word_cut、steam_attack_growth、steam_refresh、steam_forecast、thermometer_alignment、dev_toolsの14スイートも既存ChromeとローカルキャッシュでPASS。store_logos、facility_map、map_reveals、shop_uiはソースが既存キャッシュになく、ローカル未実行（PASSには含めない）。新規ダウンロードなし。最新HEADのActionsでこれらを含む全体を確認する。

## 最新mainとの地図ピン待ちの切り分け

`ec7fe36`のCIが実際に実行した合成commitは`d636a1a`（main親`20ed21c`）だった。PRの記録上のbaseやローカル`97dba20`だけでは、実行コードの同一性を判断できない。前の調査での「ゲーム本体は同一」という判断を訂正する。最新main照合値は`8a5bb15`で、`20ed21c`以後はCLI/予約文書の変更のみ。

オーナー許可の成果物`12194362245`を1回取得（14,410,179 bytes、SHA256は[ci-map-compat.json](ci-map-compat.json)）。DAY4/5の失敗画面ではC.STATIONを含む未解放施設のピンがなく、通信失敗とpage errorは各0件だった。mainの`bc9e131`（#733 / merged PR #734）は、自主来店後の`_spot_guide_*`を施設解放条件とし、未解放ピン自体を非表示にしている。面識だけのfixture・旧「？？？」ピン待ちが不整合の原因。main側でもselection/chromiumが失敗し、Open PR #683にも同じ境界が記録されていた。

- `action_context`は訪問ケースだけ、自主来店済みのなるのguideフラグを明示。実SAVE/LOAD後の訪問、料金、日程、遭遇、夜イベントの既存assertionを保持。
- `street_selection`は通常・画像欠落の来店済みfixtureへ同フラグを明示。未解放ではピンなしをassertし、街の入口でも入れないことを保持。さらに面識あり・guideなしのPC/タッチケースを追加した。閉店・臨時休業・既訪問・資金不足・ガイド・保存・行動/報酬の不変確認は削除しない。
- `axe_bar_discovery`は噂前の非表示をassertし、実VNでの噂読了後に実ピンから入れる流れを保持。中断・状態変更・旧保存の検証も維持。

初回照合時は上記テストの変更重複はなかった。その後#683が更新され、`action_context`・`street_selection`、続いて`store_logos`・`facility_map`に同種のfixture修正が入った。2026-10-20 JSTの再開時には#683がmain `7ce32bd`へマージ済み。main側の成果を保護し、ブランチの整合時に通常施設と探索入口の境界を引き継ぐ。#683のHUD/占い/施設処理、#598/#636の担当コードは独自に変更しない。今回の対応はテストと検証記録のみ。

CI合成commitの15テキストファイル（計611,780 bytes）はGit treeのblob SHAを照合し、検証サーバーだけで差し替えた。checkoutの本番ファイルは変更しない。街の不足ソース5点（約19KB）、施設画像1点（465,736 bytes）、街素材4点（計1,103,804 bytes）だけ限定取得しSHA照合。フルクローン・一括素材取得・依存追加なし。14.4MBのZIPや画像は再アップロードせず、小さな検証JSONを保存する。

実ChromeでDAY4/5の訪問2件、axe_bar_discovery全12件、street_selection全35項目がPASS。未解放・旧保存・画像欠落の境界を含む。素材不足の途中実行は全体PASSに数えない。timeout延長や検証の省略はせず、旧ピン表示の期待値を現行仕様の非表示assertionへ置き換えた。最終HEADのCI結果はPRのChecksを参照する。

CI後半の`store_logos`と`facility_map`にも同じ解放条件の不足があったため、解放済みfixtureに自主訪問フラグを明示し、未解放施設のピン自体がないことをassertした。ロゴは全18 UIケースがPASS。施設アイコンはPC/横タッチ/縦タッチ×通常/DSの6条件で、昼・夜・第2章・未解放・旧保存、イベント印、画像読込、状態不変までPASS（page error/通信失敗は0件）。

説明パネルの前面化で以前のピン中央が遮られる場合は、`document.elementFromPoint`で同じピンに届く表示位置を確認して実マウス/タッチ入力する。届く位置がなければ失敗し、forceクリックやCSS隠しは使わない。既存の選択結果・44pxターゲット・当たり判定・配置/保存検証は保持する。店舗ロゴ・施設アイコンの本番実装やCSSは変更しない。

上のPASSはCI合成`d636a1a`に対する保存済み結果。最新main `7ce32bd`では通常施設だけを非表示とし、未発見の斧投げBarなど探索入口には旧「？？？」ピンを残すよう更新されたため、main統合後の最終結果とは区別する。速度の許容幅320〜410と、実入力での選択検証を維持して再確認する。

### main `7ce32bd` 統合後の確認

既存ブランチへ最新mainを統合し、テスト3ファイルの競合を解消した。`action_context`・`axe_bar_discovery`・`store_logos`はmain版をそのまま再利用し、重複実装を残さない。HUD・占い・地図・#598のくじ処理・#636の温度モデル/採点/ゲージもmainとの差分なし。施設テストはmainの追加assertionを保持した上で、DOMの直接clickを実際に届く座標へのマウス/タッチ入力へ置き換えた。通常施設の非表示assertionと、街の面識だけでは解放されない2ケースを追加し、速度上限は410のまま。

実際の統合済みindex（tree `766ea312af4b6054043c34595780ea5e5d22eb30`）を配信し、訪問2件、斧投げBar全12件、街全35項目、ロゴ全18 UIケース、施設全6画面条件、炭のPC/タッチ/低減motion全3件がPASS。炭専用ユニットと日常VM回帰、mainとの差分の構文/whitespaceもPASS。最初の街実行は既存ソース未配置で失敗し、SHA一致cacheを配置した再実行だけを最終PASSに数える。

main取り込みはcommit情報のみの限定fetch（新規pack最大360,447 bytes）、取得済みAPI差分からのtree復元（406,680 bytes）、必要なテキスト差分（1,582,560 bytes）で行い、画像/LFSは追加取得していない。検証と最終ソースblobは`ci-map-compat.json`の`final_integration`を参照。初期の前後画像と`source-hashes.json`は初回保存時のsnapshotとして保持し、統合後の全ソースhashとは区別する。
