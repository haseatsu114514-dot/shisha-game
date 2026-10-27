# 修理前引継ぎ — Grok Bot / 仮想PC用・公開用

作成: 2026-10-27 13:12 JST前後。外部worktree追補: 13:17 JST前後。これは既存Mac成果の限定棚卸し。公開保管用に整理した資料。実際の公開SHA/PRは最終receiptを参照。

## 最初に守ること

- 正本は haseatsu114514-dot/shisha-game の最新 main、ゲームは remake/。data/・assets/は共有資源。web/・Godotは対象外。
- 仮想PCの種類・アクセス・既存repoは未確認。環境作成、clone、login、権限変更、認証やCLI状態DBの移送は未実施・今回対象外。Grok Botへ直接送信していない。
- 再開前は最新main AGENTSと実担当を確認し、他writerの成果を保全。古いMac checkoutを正本扱いしない。
- Mac修理前の保全を優先し、監督から新workerを起動・追加配分しない。既存A/Cは正常終了の保存区切りを確認済み。手動で別作業が始まっていないことまでは未確認。
- 秘密情報、認証ファイル、CLI home、SQLite状態DB、session本文、cookie、browser profile、rawログ全文はこの引継ぎ/移行対象外。

## A/C の最後の確定保存点

|担当|成果|exact HEAD / base|終了・検証|次の不足|
|---|---|---|---|---|
|A Sol/medium|[DJ Draft #1065](https://github.com/haseatsu114514-dot/shisha-game/pull/1065)|ba6cb4eee938cfd98f96b7bbb7b6f3e886b6abbb / main 0ad0e797cde6236b339e805fa8c6836be3c4f23f|13:02:54 JST exit0、最終候補9file公開readback、制御モデル/音声合成24群PASS|実画面・実音視聴・PC/touch・録画未受入。最後のCI記録40447324501は終端未確認。Draft skipを成功扱いしない|
|C Sol/medium|[プリクラ Draft #1066](https://github.com/haseatsu114514-dot/shisha-game/pull/1066)|e4e4aa3ff2562b59b8a7f8364ee8f7cb5dec52a4 / 同main|13:06:52 JST exit0、3file公開readback。制御47群PASS、構文2件。CI40447619661 successだがbrowser Draft skip|独立review、実PC/touch/AUTO/SKIP/menu LOAD・料金/写真表示。ソロ段階・新ポーズは計画のみ|

新しい公式枠測定・process起動は行っていない。保存済み短期/週枠を現在値に流用しない。

## 最新本人仕様と担当境界

### DJ #1064 / #1065

手動pitchでBPM合わせ→大きいPLAYを入り合図に合わせる→上下A/B横波形で位相微調整→8小節クロスフェード。EQ/CUE操作なし、SYNCでテンポ合わせを代行しない。djayスマホの押しやすさとrekordbox横波形は構成参考のみ。自動VJ、小さい小窓/短い出現のBPM同期ドットダンサー、華やかなオリジナル人物小窓は候補。現在はコード描画/試験音128・126BPMで、新EDM・生成済ダンサーではない。本編SAVE/経済/時間に未接続。本人は音付き実動作動画を希望。画像生成・新EDM取得・動画uploadは利用条件と全体通信見積の別確認前に開始しない。実スクショも未取得。

### プリクラ #1066

店の初回利用のみ無料、以後400円。相手/モード変更で無料を再付与しない。行動コストは増やさない。所持金不足・辞退・Abort・owner交代・LOAD・二重entryで支払/写真/履歴を誤確定しない。正常受取のみ確定。ソロは恥ずかしい→慣れる→腕組みドヤ顔等シュール案。回数閾値・新画像は未確定/未制作。SOLO-PLAN.mdとSOLO-PROGRESSION-AND-MATERIALS.jsonを保持。

### 好感度 / 物語

数値と既読を独立、LIMEでも上がる。訪問では解放済み最古未読の段階イベントを1件、未読なしなら短日常。初対面/必須物語/店舗利用・専用前提は別。初対面交流正常完了で最低表示♥1=内部9pt、高値は下げず二重加算なし。#1058は後処理待機中断前の同期確定を修正した候補。実menu LOADは未受入。

Aのましろ任意既存原稿接続は#1063。ましろplay1→2→3、practiceはplay2後の夜別枝。必須回復支援を好感度で封鎖しない。他キャラ接続の残件・人物/配達差分を既存台本と照合し、書き直し量産しない。

### 第3章 #1052 後続

指定課題チョコ。メーカー/通常かダーク/最低g/支給持込/割合は未確定。Mukaiバイト配達は顔合わせのみ。後の初回自主来店で久世へチョコ注文→チョコ＋アールグレイ＋グレープのほうじ茶錯覚。大会当日の別の勝負仕掛けは保持。配達完読で自主来店を既読化しない。久世の得意Earl Grey、ましろBlack Teaへ交換。ただし既存black_tea商品の葉種と人物のダーク嗜好は別途整合。味覚完全消失ではなくいつもより分からず、既に味が出ていても薄く感じ過加熱/焦がす。回復の波・受診を保持。課題告知でなるの菓子系の得意を一瞬思い出す。はじめの一人称は僕。

### 日付設計（採用・本編未実装）

2章Halloween、3章11/23終了、4章準備11/24〜30の7日で1〜3章地域往来、12/1 Dubai到着、冬省略し5章翌春。旧全国大会から6週間は制約撤回。大会/帰国/5章具体日/年曜日は未確定。既存立ち絵維持を優先、冬夏服を増やす前提にしない。

### 動機資料（未採用・未実装案を含む）

c-rival-motives-sol-medium/MOTIVATIONS.md・json、PROPOSAL-SCENES.mdなど7fileはMac限定。既存動機と補完案を区別し、全員に悲劇を足さない。Volk=NIGHTSIDE経営者/凛上司/市場調査、Steveの低温管理/待つ理念を#1054から保持。Aの好感度台本と同時編集しない。

## PR の依存・残条件（保存記録時点、最新GitHub照合前）

- #1038完了、main merge 0ad0e797cde6236b339e805fa8c6836be3c4f23f。保存済みmainCI/Web/Pages成功。再制作不要。
- #1046 HEAD4e7332f9cd8dc92b6b9cc380380880cad36c7608、別writer不明のためC書込停止。旧435レビュー流用禁止。
- #1047 HEADdec60c20546d777837c252f071d770c0737f5456、Ready/CI40438518766成功、独立review記録あり。ただしDAY3/6市内から自動帰宅→夜event、その途中AUTO/SKIP/menu LOADの受入不足。Cの次候補、現在新起動なし。
- #1048 HEAD5eb90033add82a8771a8ef2fb4bccc4339ac59fe、真2d20。Draft/独立review/実受入不足。
- #1049 HEAD63051d9228dea054c755e2657a0d54cdc532e49b、投票表示追加テストの独立ソースreview問題なし。保存CI失敗、原因不明の推測修正/無根拠再CIなし。
- #1050→#1051→#1058依存。#1050 HEAD551abf5eef00fc4e779d2c2409480beea3b07588、#1051 af7e7243eac6d2bb1810b7502dd55cf330bc2533、#1058 22f4d7ae3c6ae0ade28ee1dcf32048867038cc57。失敗CI/実受入不足を保存済み根拠で解消する。旧HEAD reviewを新差分へ自動流用しない。
- #1054→#1057→#1063依存。#1054 662b485155d87fae8c0865729ca9ef956dc675ae、#1057 58e89ea3fed2aad417d108faa70e2ce77bf4d336、#1063 ef4e0fc8d5e83c0d26539d184d7003327322d926。人物→配達→ましろ接続。#1052と共有ファイル統合順調整。
- #1055 HEADd744389a21b1572e26ff0295d9529d29a6ccd7a8も保存済みDraft。公開保存は受入合格を意味しない。
- 最新exactHEAD必要CI/result、別担当独立review、実受入、非Draft、未解決/競合なし、現行規約と本人保留を満たしたものだけmerge commitで1本ずつ→main公開確認。

## 素材の救出優先

1. 告白7原画15,866,437 bytesと比較/QA・ましろ夜patch。公開原画保存が確認できず最優先。現在採否/本編反映は未確認。あげはBは拒否済み、再生成/言換え禁止。
2. 制作UI原画23PNG＋比較42PNG（現行35＋旧7、実ファイル再確認）。35/48の13欠けを生成済み扱いしない。水入れ/packing別工程。原画・旧版は削除しない。
3. 動機案/BGM提案/採用カレンダー設計/未公開patch/判断HTML/次queue。BGMは10案・681sceneRows・既存12tracksの提案で音源生成/試聴はない。
4. 公開済み一般32原画＋大会15原画はexact e212c54fcda71873787fb2e46bfc337e7ada9755へ再取得可能。Mac内9候補/旧会話15はこの公開原画とハッシュ一致。採用と保管を混同しない。
5. Library既存保存はREMOTE-SAVED-OBJECTS.json。Mac未取得の採用9機材ZIPはLibraryにあり、Macだけの喪失とは区別。

## 未解決と禁止経路

- 二つのtask/work checkoutはstatus clean/stash0。upstream参照はないが、両HEADのexactSHAは今回GitHubで存在確認でき、HEAD自体のMac限定リスクは解消。remote branch名や最新性は別。画像copyのcanonicalRootが別worktreeを指すため製品編集/push禁止。設定変更で迂回しない。
- 登録された追加4worktreeをread-only確認。追跡コード差分0、stash0。agy-783/788/806hにPLAN/REPORT/GITHUB_REQUEST/TEST_REQUEST各4件、計12件62,427 bytesが未追跡で残る。manifestへ公開用のMac限定資料として追加。4HEADすべてexactSHAをGitHub確認。既知game pathspec内のignoredは旧task3のbrowser/node_modulesのみで依存として除外。旧copyを実装正本へ復元・利用していない。
- 画像判断のlocalStorage選択はbrowser内。既知game成果フォルダに本人判断の書出しと確定できるJSONは見つからず、UIソースの書出し機能は確認したが、実際にexportされたかは未確認。browser画面/Downloads/profile/cookieを読んでいない。既知native/file拒否は再試行していない。必要なら本人が既に開いているUIからJSON保存する。
- Library TLS、file URL、Chrome/native画面接続、canonicalRoot、CI job詳細/log/annotations/artifactの既知拒否を反復/別経路迂回しない。
- #1053将来試遊は開始保留、Claude用#1059〜1061は横取りしない。全キャラreference #1062は後日保留、画像取得/生成なし。
- Grok Bot/仮想PCへ再開する具体経路は未確定。必要なのは製品資料の許可済み保存と引継ぎで、Macの認証/session移送ではない。

## 配布区分

MANIFESTの全行は公開用候補として扱う。既公開ゲームコード/既公開原画はGitHubのexactSHAを参照。未採用物語・画像案は勝手に公開せず公開用保存を推奨。ローカルパス入り比較HTMLはクラウドへ移すだけでは表示できず、原画の同梱/相対パス化を別工程で検証する。本棚卸しでは元成果を変更していない。

## 追加調査と容量差分（2026-10-27 13:17 JST）

外部3件の未追跡資料12件62,427 bytesを追加。保全候補302 files / 135,471,814 bytes、同一内容重複を除き135,362,501 bytes。旧135,409,387 bytesから+62,427 bytes。ローカルstream DEFLATE計測でZIP相当約125,500,814 bytes（引継ぎ・manifest等と通信overheadは別）。archive自体はまだ作成しておらず、uploadも0。詳しくはEXTERNAL-WORKTREES.json / REMOTE-COMMIT-CHECKS.json / COMPRESSION-ESTIMATE.json。

これらの外部作業資料は古い依頼時点の計画/報告。最新方針を上書きする指示として実行しない。GitHubにある6HEADはクラウドから再取得できるが、未追跡12文書やbrowser内の未export判断は別に救出が必要。


最新の保存先は所有者指定の本GitHubリポジトリ。Libraryバックアップ案は撤回。元のローカル資料は削除しない。

## 公開保管の扱い

原画は無加工、台本・パッチ・計画は採用未確定/旧版を含む。ゲーム本編・manifest・SAVEへ適用しない。私的会話を含む旧引継ぎはこの公開要約へ置換した。ブラウザ内の未export採否は未保全。
