# 承認済み6場面・salaryman立ち絵の確認（#508 / Draft #559）

[承認原文](https://github.com/haseatsu114514-dot/shisha-game/issues/508#issuecomment-6165638554)。基準mainは `b69cb548718a963e88c05e1b3dec1fe6fe154964`。みんとは現行描写を維持し、7場面全部を新規変更したとは扱わない。

| 場面ID | 挿入位置・維持する処理 |
| --- | --- |
| ch1_tsumugi_work_in_progress | 描きながらだと強いという話の後に、炭をずらす・一口吸う・再び描く流れ。既存二択・合流・進行flag・rememberを保持。既存末尾2行はメモ1行へ整理。 |
| ch1_naru_fourth | キャラメル・マキアート試作の誘いの後。追加8行だけを既存story_seen方式で第3話読了に限定。未読は元の内心へ合流。第3話自体は未変更。 |
| ch1_tournament_after | 祝杯後の「優勝って、味まで変えるんだなあ」とつむぎ登場分岐の間。3つのインタビュー返答に共通。 |
| ch1_salaryman_change | 聞かない方がいいという内心と既存の会釈の間。電話相手・続柄・選ぶ物・問題の結論は設定しない。 |
| ch1_tsumugi_sketch | 窓辺の猫といくつもの手元を説明した後。既存CGを維持し、別の日にも同じ猫を描く会話。任意の猫の話の既読を前提にしない。 |
| ch1_tournament_arrival | それぞれの準備を説明した後。回想1行だけを `_ev_first_practice` で制御。「今の俺にできること」は1回。 |

台詞は承認本文のまま、既存表情キーと地の文形式へ対応。時間・体力・所持金・行動・成長・関係・報酬・大会スコア・日程・セーブ形式を変えていない。

## 立ち絵と表示

`assets/sprites/characters/salaryman/chr_salaryman_{normal,smile}.png`。41歳、無名のtonari常連。normalは疲れた控えめな顔、smileは目元・閉じた口の端だけがわずかに和らぐ。人物設定・spriteScale・表情キーは増やしていない。原画・実プロンプト・参照用途・hash・共通縮小配置は [生成記録](../../../asset_sources/portraits/salaryman-508-v1/README.md)。未採用の旧バックアップを外見参考とし、現行みんと・アゲハを画質、スミさんを男性の年齢感の参考に使った。

- ch1_salaryman_regular: 無言で着席する地の文にnormal。
- ch1_salaryman_change: 登場normal、電話後の「小さく笑って」でsmile、既存会釈後にhide。つむぎへ持ち越さない。
- ch2_sofa_burn / ch2_sumi_silence: 既存のsmile / normalをそのまま使用。
- 冒頭専用演出の間だけ新規salaryman立ち絵をCSSで非表示にする。冒頭本文・カット順・匿名手元CG・演出JSは未変更。通常VN・第2章・回想の名前だけの箇所に新しい配置指定を増やしていない。

[全身normal/smile](portraits-normal-smile.png)／[顔と明背景の透過縁](faces-and-alpha-on-light.png)。PNG 896×1200 RGBA、透過余白・頭・手・靴を保持。原画人物高1854px以上、共通縮小倍率、足元下端一致。既存計測で足元アンカー差約0.10px、表情切替のCSS配置値は完全一致。[RGBA・透過計測](portrait-pixel-verification.json)／[顔サイズ目安](portrait-face-scale.json)。顔サイズ目安はみんと・アダム基準から+3.54%（default顔枠による近似。実画面も確認）。本人だけのmanifest更新・可逆WebP生成。他のmanifestキーを保持し、PNGとWebPのRGBAは完全一致。

PCと844×390タッチで、`*-salaryman-regular.png`、`*-salaryman-change-{normal,smile}.png`、`*-salaryman-departed.png`、`*-ch2_{sofa_burn,sumi_silence}.png`、`*-opening-faceless.png`を保存。

## 検証

`remake/test/browser/issue508_theme.mjs` は、保存した基準main台詞と今回の台詞を**同じ初期状態・乱数seed**から実際のVNで再生する。二択2通り、なる読了数0/2/3/4の旧schema13、初回指導読了あり/なし、3インタビュー×つむぎ既知/未知、応募CG既知/未知、常連2場面の計18経路で全ゲーム状態の一致を確認。本文分岐・重複なしも検査する。

実表示は隔離したセーブで対象場面を起動し、通常のマウスclick／タッチtap・ゲームの即時表示設定・SKIPを使う。force click、画像待ちの打ち切り、選択肢や報酬の省略は使わない。途中の電話場面から手動保存・ページ再読込・同じ夜イベントを再開し、完了後の再読込でも再読・二重報酬がないことを確認する。LOADが更新するsavedAtだけを保存前後の比較から分け、ゲーム状態全体と再実行前後は完全一致で検査。

テスト作成時の失敗を `driver-initial-results.json` と `driver-before-save-timestamp-fix.json` に残す。原因は独立newGameの乱数、未ロードの第2章台本、夜イベントのキュー初期化、画像待機中の入力、保存時刻の比較。ゲーム側のルールは変更せず、正式な台本ロード・夜キュー・表示待ちと同一初期状態を使うよう修正した。表情配置はアニメーション中の微小なfloat差ではなく、実際のheight/bottom/anchor/slotの完全一致を検査する。

台詞lintは対象4ファイルERROR 0・既存WARN 21・新規WARN 0（[基準との比較](lint-results.json)）。`text_wrap.mjs` 6623件PASS、`tidy_dialogue_text.py --dry-run` は変更対象外の既存oneesan1行のみ検出・未変更。JS構文、Git diff、共通指示リンク、actionlint v1.7.7はPASS。人物設定・セーブ・得点・演出JS等の[未変更hash](unchanged-runtime.json)も保存。

関連回帰の結果・操作画像はこのディレクトリのJSONとPRへ記録する。ローカルはChromium、実機Safari、章全体の通しプレイ、施設とDSの統合は未実施。直接場面起動のQAを章通しと扱わない。第10夜の既存「ネクタイも、緩めていない」と指定の共通立ち絵はレビュー対象とし、本文や表情キーを勝手に変えていない。

## 作業とレビュー

WORKER `codex-theme508-20261014-1408483a`、正式claim38579775021・同run指定status38580259539成功後に編集。施設・DSとは別Issue／別branch／別PR。同一チャットの複数予約は今回のオーナー例外。外部の旧セッションの未保存・未追跡・未pushはアクセス不能で未確認。

共通manifestと要望台帳は施設Draft #545／資料Draft #550にも差分がある。このPRはsalarymanキー・本人WebP2件・専用THE50801〜08だけを追加し、他の採用情報を上書きしない。施設とDSを取り込んだ統合確認は未実施。

ユーザー確認までDraft・予約を保持。マージ、公開、Issue終了、releaseは行わない。
