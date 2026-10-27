# Issue #563 — 採用3会話と既存表情の選択

## 2026-10-18：既存normalを採用する現在の方針

ユーザー「563は既存」により、今回の対象場面には既存画像を使う。組長・零は現行mainの本人立ち絵がnormal各1枚だけであり、別人物や別画風を流用しない。神崎の迎え・助言2箇所のsmile指定、REIが曲の間を語る4箇所のserious指定を、明示的にnormalへ変更する。normalの落ち着いた顔を場面に合わせて使い、笑顔・集中専用の新差分が存在するとは扱わない。

使用元は `assets/sprites/characters/kumicho/chr_kumicho_normal.png`／`assets/sprites/characters/rei/chr_rei_normal.png`。実表示は既存の同名normal.webp。画像bytes・manifest・会話本文・会話順・読了／保存処理は変更しない。採用3会話の接続（PR #603）は保持する。

以下の旧smile／serious採用原本の識別・403取得障害は履歴として保持するが、今回の既存画像方式の開始条件にはしない。不採用の生成候補と1回修正は別ブランチ`codex/563-expression-previews-20261018`に保全し、本編へ流用しない。追加生成・顔合成・旧原本の取得再試行は行わない。

[既存表情の実表示・手動SAVE/LOAD・3会話回帰QA](../../docs/qa/ch2-existing-expressions-563/README.md)を参照。夜背景・営業中器具差分は保留し、別の受入項目として残す。以下は2026-10-16時点の制作・採用履歴。


同worker `codex-563-20261015-01a13c35`、claim `38697952277`を保持。開始基準main `6c05ae3198e4959b59557e272f74ff94f4eae4e5`。旧棚卸しPR #567はマージ済みなので、後続ブランチ`codex/563-approved-dialogues-expressions`を使用する。

## 採用と編集順

親タスクから、2026-10-16 01:10 UTCの会話方向採用と04:42:44 UTC「かんざきとれいおっけー」を受領。3会話と神崎smile／REI seriousの採用を再承認待ちへ戻さない。#563の3会話・2表情を先行し、`data/dialogue/ch2_preparation.json`を本Issueが担当、#564は統合後の版から添削する指示。着手前の#564公開コメント0、全8Open PRの予定対象への直接変更パス重複なし。他環境の未push作業が見えるとは主張しない。

夜背景・未承認章題・筋書き・ヴォルクの第2章登場・離別理由・味覚回復は範囲外。マージ・公開・Issue終了・移管・予約解除は行わない。

## 会話ソース

Library `libfile_1c5319cd97108191b558b14fcd7b1065`、file `file_00000000651881f59579cc48fb351da7`、名称「shisha-game_第2章_3会話台本提案と2表情制作指示_A_2026-10-16.md」。Library readで658行を全件取得（has_more=false）。[read本文の保存](approved-proposal.library-read.md)は読取内容の保存であり、ダウンロードに成功した原本bytesとは記載しない。本文にある別環境のローカルパスは参照・流用していない。

本文のJSON提案から3ID（ageha 14行、kumicho 12行、rei 14行）を正本`data/dialogue/ch2_preparation.json`へ追加。REIの「……ああ。……喋りすぎた」だけは現行text-styleの句読点規約とlintに合わせ「……ああ、……喋りすぎた」へ調整した。元のread本文は変更しない。既存6場面の内容・IDは保持し、能力・好感度・連絡先・思い出の制御行は新設しない。

初回chat完走→次の実訪問でfollowup→以後repeat。新しい章日・好感度・練習・試聴条件を設けない。相談回数0/未定義はchat、1以上で新読了未定義ならfollowup、明示読了後はrepeat。旧セーブの未読場面を訪問数から完了と推定しない。

続編はテキストのみの形式と必要IDを起動時・訪問前に検証し、既存室内の読込み後に読む。正常finishとstate所有者一致まで費用・体力を保留し、その後に通常再訪の料金・体力・好感度・能力候補と新読了を確定する。保存は既存calendarの行動精算境界に任せ、新しい早期saveを追加しない。cancelled・例外・途中LOADでは新会話の課金／読了なし。初回chat・既存repeatの課金順序は保持する。

## 採用済み画像の未完・取得障害

| 採用物 | Library ID | file ID |
| --- | --- | --- |
| 神崎smile `chr_kumicho_smile.png` | `libfile_f0bc037c84f48191acbc72ca90b6fad8` | `file_000000002fb0823081bd63137d849919` |
| REI serious `chr_rei_serious.png` | `libfile_91ca8f57bef88191a98f97cb11278c78` | `file_00000000cc2882309d7fa29b95717f00` |
| 比較 `ch2-expression-face-composites-comparison.png` | `libfile_6a79c53dd0a88191917d66c26bba8327` | `file_00000000f58482308f342ab27b0f79f8` |

Library正規手順のprepare_materializeと、今回のskillソースから取得した`library_file_transfer.py`で全4ファイルの取得を試行。全件`library file transfer failed: download failed`。取得情報を更新して同じhelperで再試行しても失敗。配信先2ホストへの無認証HEADによる接続診断はともに`URLError: Tunnel connection failed: 403 Forbidden`だった。署名URL・転送token・headersはリポジトリへ保存しない。

親側の896×1200 RGBA／顔領域のみ／alpha不変というレビューを受領したが、本環境ではPNG bytes未取得で、独立再測定・hash照合・目視・WebP変換・manifest再計測をしていない。現行normal PNG・WebP・原画・manifestは保持。**神崎smile／REI seriousは未組込みで、現在はnormalフォールバック。これを完成した人物表示QAと扱わない。** 権限拡大・新規認証・トークン生成による回避はしていない。

次工程は本環境で正規転送できる状態から、上記3画像を取得してLibrary identityを保持し、寸法/RGBA/alpha/顔領域差分を現行normalと照合。旧原本を保持し、採用PNGと可逆WebP、限定manifestを更新、本人性・足元・実会話での切替を確認する。#563担当と予約は変更しない。

## 検証の境界

実行結果は[QA記録](../../docs/qa/ch2-followups/README.md)。会話のロジック・保存・現在の画像での組版と、未取得の新表情画像の検証を分ける。採用した2表情・完成した旧normalを再生成して取得障害を隠さない。
