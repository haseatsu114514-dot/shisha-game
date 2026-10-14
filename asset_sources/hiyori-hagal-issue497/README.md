# ひより専用ハガル：停止時の保存・引き継ぎ

**前担当の停止時記録を保持したDraft。2026-10-15の再開指示は、安全条件が揃った後のマージ・公開確認・予約解除を含む。以下の旧結果を新headの成功として扱わない。**

採用済みの正本は [v1の選定](../hagal-bond-concepts-issue504/selection.json) の、ひよりB「素顔でひと休み」。画像選びからやり直さない。元の4案シートは変更していない。

## 保存した変更

- B案右下を `image_gen.imagegen` で透過単体化。初回v1と輪郭修正v2、実プロンプト、入力の役割とSHAを `provenance.json` に保存。v2を本ブランチの `assets/ui/making/bowl_empty_hiyori.png` とWebPへ接続した。
- 元のB案の赤い素焼き、小さな斧と葉、脚の斜め帯、底側の複数孔を保持する方向。人物・文字・他の3案・HMD・炭・ホイルは入れない。実機製品や寸法の検証済みとは扱わない。
- 1254×1254 RGBA、alpha 0〜255、透明余白あり。PNGとWebPのalphaは完全一致。初回・再生成とも赤/黄色の外縁でalpha 24以上の画素は0だった。低alphaの輪郭を含め、実表示での白/暗背景QAは未完。
- `suyaki_hiyori` を容量20g・非売品・売却不可で追加。オーナー回答「その案で進める」に基づき、ピーチ3g以上で既存の香り+4／総合ボーナス+1だけを使う。他の専用機材の効果は変更しない。
- `route.finale.gift` を専用IDへ接続。正式斧投げ・仕事・実回答・反応読了の既存条件を維持し、締めくくりの実台本・既存 `giftOpen/grantGift` を使う。新しい告白や仕事会話は作らない。
- 制作の器と贈り物a/bが専用画像を選ぶ。背の高い贈り物の絵は縦横比を保って高さ440px以内に収める。葉の位置と口の高さは初期合わせで、PC/タッチの目視は未完。
- `build_manifest.py --making-only bowl_empty_hiyori.png` で本人の1件だけ追加。他のmanifest各値・素材登録の保持を照合した。Open PR559とmanifestが重なるが、本人のmaking/makingBox/webpだけを変更し、立ち絵には触れない。

## 検証結果と失敗

静的確認：Git Safety、`check_agent_docs.py`、`check_confession_flags.py`、変更JSON3件の解析、変更JSの構文、`git diff --check` PASS。
`check_agent_docs.py` 初回は疎チェックアウト未取得の参照資料で失敗し、mainの該当資料を取得後に同じチェックがPASSした。資料本体は変更していない。

新規 `remake/test/browser/hiyori_hagal.mjs` の初回実行：

- PASS 3件：正式機材と未読ガード、旧所有での未読補完/重複防止、所持・装備・ピーチ3g境界。
- FAIL 3件：実ギフトの友人/恋愛分岐とSAVE/LOAD・LIME保持をまとめたケース。どの条件が失敗したかの詳細出力を追加したが、停止指示後の再実行はしていない。
- 中断ケースは待ち続けたため、停止整理でテストプロセスを終了した。これはユーザーによる停止処理の影響を含む結果で、ゲーム不具合の確定でも成功でもない。テストの中断開始を、本番のconversation lifetimeを持つ `meetHiyoriAtTonari()` へ修正したが未再検証。
- PC/タッチの受け取り→機材選択→パッキング→SAVE/LOAD、贈り物a/bの画面内表示は未到達。`qa/` に初回JSONと失敗画面を保存した。

既存の仕事・共通関係テストは「未登録機材の拒否」を明示するfixtureへ変え、元assertを保持している。本番の正式機材を使う新規テストとは区別する。既存回帰の再実行、新規ゲームから後半までの自然到達、実告白・旧恋人/友人・連打・欠落画像・全CI・実機Safariは未完。`hiyori_axe_natural.mjs` およびIssue556の待ち条件は変更していない。

## 再開の最初の手順

1. このIssueのowner/保存head、他PR、最新mainを再確認。別workerは正式transferとそのrun指定statusの成功が必要。
2. `qa/hiyori-hagal.json` の3失敗と中断を読む。新規テストを詳細出力付きで実行し、作り物のLIME予約・セーブ正規化・中断経路を含め、fixtureと本体を切り分ける。assertを削除・弱体化しない。
3. 葉とリム・受け取り演出をPC/タッチで目視し、必要なら専用画像の寸法値だけを調整。無関係な機材の表示を変えない。
4. 既存仕事/関係・保存・LIME・他キャラの専用機材を再実行し、通常NEW GAMEから実際の後半到達を検証。fixtureの直接呼出しを自然到達の証拠にしない。
5. 最終headのCI・レビュー・仕上がり確認後に、改めてマージ可否を判断。現在はマージ不可。

WORKER: codex-recovery5-20261015-e7b1  
ISSUE: 497  
BRANCH: codex/497-hiyori-hagal-recovery  
CLAIM: 38613748541 SUCCESS / actual CLAIMED_ISSUE=497  
STATUS: 38613895764 SUCCESS / actual CLAIM_VALIDATED_ISSUE=497 / RUN=38613748541  
予約を保持して停止。次のIssueを並行予約していない。

## 2026-10-15 正式な再開・診断

- 所有者が旧担当の終了・再開禁止を指示。Macのlive停止・未保存変更はこのクラウドから未確認で、行政上の終了例外であることをIssue承認記録に明記。TRANSFER `38618544044` SUCCESS / `CLAIMED_ISSUE=497`、そのrun指定STATUS `38618972148` SUCCESS / `CLAIM_VALIDATED_ISSUE=497`。新worker `codex-resume497-20261015-78909ed2f9`。
- 保存head `688085af446e942de680d25c1447f70353df6f92` の診断再実行で、3失敗はいずれも `limeStable=false` だけ。LOADが不完全なfixtureへ `originId` / `replyState` / `afterClose` を補完していた。本番の保存形式は変えず、fixtureを現在の予約スキーマへ修正。全体一致・LIME一致・重複・料金の元assertは維持した。修正後の3ケースはPASS。
- 未再検証だった実会話の中断入口はPASS。回答0を保存→LOADで旧会話をキャンセル→質問を再表示せず友人として1個だけ受領。
- 既存関係UIの「未読なのに告白を案内しない」assertを保持。正式機材が登録された現在も、未読時は斧投げ・仕事を案内し、全読了後はtonariの節目を案内する。
- 画像の白/暗背景での目視では、赤い素焼き・斧と葉・斜め帯・底の孔を保持し、外縁の白い矩形や目立つ色フリンジはない。画像の再生成はしていない。
- PC/タッチの実g操作と回答ボタンを追加したテストは再検証中。自然NEW GAMEは別runnerで実行中。CI・最終QAが揃うまでDraftと予約を保持する。

### 再開後の実入力・画面QA

`qa/recovery/` は旧QAを上書きせず保存した追跡資料。`hiyori-hagal-working-tree.json` は13/13 PASS、`relationship-ui-working-tree.json` は8/8 PASS。これらはe31dcb4b後の作業ツリーで実行し、最後の贈り物寸法調整・名前非重複assertを入れる前の結果で、最終head CIの代わりではない。

- PCと844×390タッチの実Q2ボタン、友人/恋愛の反応、専用ギフト1個、実機材選択、ピーチ3g＋ミント17gを実＋ボタンで入力。21gは拒否、3gの既存効果と20g表示を確認。
- 専用器の配合・パッキングを撮影し、機材と1個の所有をSAVE/LOADで保持。前提のイベント読了・所持葉はfixtureであり、通常NEW GAMEからの獲得証明ではない。
- [`PC操作動画`](qa/recovery/pc-receive-mix-pack.webm) / [`横持ちタッチ操作動画`](qa/recovery/touch-receive-mix-pack.webm)、[`PC配合`](qa/recovery/pc-mix.png) / [`タッチ配合`](qa/recovery/touch-mix.png)、[`PCパッキング`](qa/recovery/pc-pack.png) / [`タッチパッキング`](qa/recovery/touch-pack.png)、[`白/暗の透過比較`](qa/recovery/alpha-white-dark.png)。動画はPlaywrightの縮小録画で、実機Safariではない。
- 贈り物a/bの見せ場を固定秒ではなく名前の表示完了で一時保持して撮影。忙しい環境で空の退場を撮る誤判定を防ぎ、器と名前の画面内表示・非重複を検証する。ひよりだけ最大高さを380pxへ調整し、他キャラの寸法は維持。
- 旧保存headの診断3FAIL、サーバー終了とスクリーンショットの失敗、通常NEW GAME初回の停止を別JSONで保持。自然workのPC初回はDAY3練習で45秒の停止検出、タッチはサーバー終了/接続拒否。どちらも成功扱いしない。
- 通常NEW GAMEから斧投げ→仕事→実友人回答→ギフトまで進める追加モードを独立CI jobで検証する。旧axe/workモードとIssue556の待ち・停止条件は保持する。結果が未確認ならマージしない。
- LIME本番VM PASS（通知・保留・競合再案内・旧名・予定・告白条件を含む）、台詞lint ERROR 0 / WARN 328、confession flags・agent docs・actionlint・JS構文・diff check PASS。実機Safari・全章通しは未実施。
