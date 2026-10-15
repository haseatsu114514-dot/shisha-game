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
- 冒頭のsalaryman発話に `portrait: false` を指定し、自動立ち絵だけを生成しない。話者名・音声・本文・カット順・匿名手元CG・演出JSを保持し、冒頭専用CSSは削除。既存 `hide_portrait` は表示済み画像を消す命令であり、後続の本人発話で再表示されるため代用できない。通常VN・第2章・回想の名前だけの箇所に新しい配置指定を増やしていない。

[全身normal/smile](portraits-normal-smile.png)／[顔と明背景の透過縁](faces-and-alpha-on-light.png)。PNG 896×1200 RGBA、透過余白・頭・手・靴を保持。原画人物高1854px以上、共通縮小倍率、足元下端一致。既存計測で足元アンカー差約0.10px、表情切替のCSS配置値は完全一致。[RGBA・透過計測](portrait-pixel-verification.json)／[顔サイズ目安](portrait-face-scale.json)。顔サイズ目安はみんと・アダム基準から+3.54%（default顔枠による近似。実画面も確認）。本人だけのmanifest更新・可逆WebP生成。他のmanifestキーを保持し、PNGとWebPのRGBAは完全一致。

PCと844×390タッチで、`*-salaryman-regular.png`、`*-salaryman-change-{normal,smile}.png`、`*-salaryman-departed.png`、`*-ch2_{sofa_burn,sumi_silence}.png`、`*-opening-faceless.png`を保存。

## 検証

`remake/test/browser/issue508_theme.mjs` は、保存した基準main台詞と今回の台詞を**同じ初期状態・乱数seed**から実際のVNで再生する。二択2通り、なる読了数0/2/3/4の旧schema13、初回指導読了あり/なし、3インタビュー×つむぎ既知/未知、応募CG既知/未知、常連2場面の計18経路で全ゲーム状態の一致を確認。本文分岐・重複なしも検査する。

実表示は隔離したセーブで対象場面を起動し、通常のマウスclick／タッチtap・ゲームの即時表示設定・SKIPを使う。force click、画像待ちの打ち切り、選択肢や報酬の省略は使わない。途中の電話場面から手動保存・ページ再読込・同じ夜イベントを再開し、完了後の再読込でも再読・二重報酬がないことを確認する。LOADが更新するsavedAtだけを保存前後の比較から分け、ゲーム状態全体と再実行前後は完全一致で検査。

テスト作成時の失敗を `driver-initial-results.json` と `driver-before-save-timestamp-fix.json` に残す。原因は独立newGameの乱数、未ロードの第2章台本、夜イベントのキュー初期化、画像待機中の入力、保存時刻の比較。ゲーム側のルールは変更せず、正式な台本ロード・夜キュー・表示待ちと同一初期状態を使うよう修正した。表情配置はアニメーション中の微小なfloat差ではなく、実際のheight/bottom/anchor/slotの完全一致を検査する。

台詞lintは対象4ファイルERROR 0・既存WARN 21・新規WARN 0（[基準との比較](lint-results.json)）。`text_wrap.mjs` 6623件PASS、`tidy_dialogue_text.py --dry-run` は変更対象外の既存oneesan1行のみ検出・未変更。JS構文、Git diff、共通指示リンク、actionlint v1.7.7はPASS。人物設定・セーブ・得点・演出JS等の[未変更hash](unchanged-runtime.json)も保存。

関連回帰の結果・操作画像はこのディレクトリのJSONとPRへ記録する。ローカルはChromium、実機Safari、章全体の通しプレイ、施設とDSの統合は未実施。直接場面起動のQAを章通しと扱わない。採用済みnormal/smileは変更していない。最新レビューに従い、通常来店の「ネクタイを少しだけ緩めて」を「襟元に指を入れて」、第10夜の「ネクタイも、緩めていない」を「鞄を膝に置いたまま、背筋を伸ばしている」へ最小修正。前者は既に緩んだネクタイを更に緩める動作、後者は画像と反対の服装状態となるため。第10夜の席選び・張り詰めた様子を残し、電話相手を本当の本人と決める内心は追加しない。

## 作業とレビュー

WORKER `codex-theme508-20261014-1408483a`、正式claim38579775021・同run指定status38580259539成功後に編集。施設・DSとは別Issue／別branch／別PR。同一チャットの複数予約は今回のオーナー例外。外部の旧セッションの未保存・未追跡・未pushはアクセス不能で未確認。

共通manifestと要望台帳は施設Draft #545／資料Draft #550にも差分がある。このPRはsalarymanキー・本人WebP2件・専用THE50801〜08だけを追加し、他の採用情報を上書きしない。施設とDSを取り込んだ統合確認は未実施。

ユーザー確認までDraft・予約を保持。マージ、公開、Issue終了、releaseは行わない。

## 最新コメント対応（2026-10-15 JST）

WORKER `codex-508-review-20261015-9e15d538`。オーナーによる旧担当停止・引き継ぎ確認後、[正式transfer38646818128](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38646818128) と [指定status38646979791](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38646979791) 成功。最新main `f8ab2c78` をmergeし、sai/makiとsalarymanの人物・WebP登録を保持。初回競合解消でWebP2登録を落とした失敗は表示QAが検出し、`caeccdcf` で修正済み。

`portrait: false` はその行の話者の自動表示・先読みを抑える汎用指定。既に登場している人物の退場は従来どおり `hide_portrait` で指定する。通常行の既存挙動・話者名・音声・保存形式は変えない。

大会テストは到着から開幕会話までを15秒のまま計測し、旧本文／現本文で初回指導未読／現本文で既読を比較する。通過した各行と経過msを成果物へ保存。優勝後の `ch1_tournament_after` は当該失敗のSKIP範囲に含まれない。

最新ローカルChromium 154: 専用6ケース（18経路比較、PC/タッチ4場面・冒頭、途中再開）6/6 PASS。対象4ファイルlint ERROR0/WARN21、text_wrap 6666件PASS、JS構文・共通資料リンクPASS。新しい実画面は [review-20261015](review-20261015/) に保存。通常/電話/退店後・第2章2場面と冒頭をPC/タッチで目視確認し、表情位置ぶれ・文字のはみ出しなし。

ローカル大会は7/8 PASS。SKIP自体は未読8.518秒（55行）、既読7.391秒（56行）、旧本文8.326秒（51行）で完了し、画像保留中の制作未開始・解放後の開始も通過した。その後、外部BGM `bgmer.net` のネットワーク接続拒否を厳密なresource検査が検出したため、ケース全体はFAILとする。assertを緩めたりBGMを差し替えたりしていない。過去の15秒超過は現環境では再現せず、過去記録だけから遅延原因を断定しない。現行未読の追加4行は最短26ms間隔で通過し、既読時の回想も停止しない。

Chrome151のローカル導入は `cdn.playwright.dev` への403 Domain forbiddenで停止。固定依存playwright1.62.1（Chromium151.0.7922.34）のCIで再検証する。

再開時の予約statusも [38663312507](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38663312507) SUCCESS（transfer38646818128指定）。最初のChrome151比較run38647517174は専用6/6・大会9/10。唯一の失敗は旧本文比較を開始するpage.evaluate内の動的importで `Resulting promise was garbage collected`。比較用dataモジュールを画像保留前のinitへ移し、本番開始を同期呼出しに揃えた（dd0518b6）。ゲーム側処理・15秒上限・画像ゲート判定は変更していない。

最終コード `dd0518b61c83a043a060d262064e35ebd65dcd99` の [Chrome151 CI38663234376](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38663234376) は SUCCESS。151.0.7922.34を実ログで確認し、専用6/6（18経路）、大会10/10 PASS。[永続化した計測・ログ抜粋](review-20261015/chrome151-ci.json)。後続コミットはQA資料・スクリーンショットだけでゲーム／テストの変更なし。

| 同一CIでのSKIP範囲（到着→開幕会話終了） | 表示行数 | 実測 |
|---|---:|---:|
| 旧本文・指導未読 | 51 | 6.645秒 |
| 追加後・指導未読 | 55 | 6.730秒 |
| 追加後・指導既読 | 56 | 6.754秒 |

追加分の差は85ms／109msで、SKIPの行送り25msと整合する範囲。回想分岐のスタックではない。過去の15秒失敗は再現せず、過去の詳細トレースがないため当時の待機原因は断定できない。今回の追加を理由に15秒上限を緩和する根拠はなく、元の判定を保持する。優勝後の場面は当該SKIP範囲に含まれない。読み込み・話者の入場待ちを含めて全経路が完了し、画像保留中の制作未開始／画像解放後の開始も合格。

実機Safari・章全体の通し・施設／DSを含む全統合の手動確認は未実施。局所場面のQAを章全体の確認とは扱わない。Draft／予約を保持し、マージ・公開・close・releaseなし。
