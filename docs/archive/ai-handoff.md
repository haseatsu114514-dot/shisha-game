# 開発状況と再開手順

確認時点: **2026-10-15 09:38 UTC**。mainは [`e489bd8e`](https://github.com/haseatsu114514-dot/shisha-game/commit/e489bd8ed4a44081dcad68cc02a92217e041bb6b)。以下はこの時点のスナップショットで、最新のIssue・PR・CIを再確認して使う。

> 2026-10-23: Issue予約（claim / release / handoff）は撤廃した。下の表にある「正式移管待ち」「予約前の停止」「担当確認待ち」などの予約起因の待ち条件はすべて無効で、そのまま着手してよい（同じファイルを変える開いたPRだけ確認する）。

## ゲームの方針と参照先

- 現行ゲームは [remake/](../../remake/README.md)、共有データは `data/`、素材は `assets/`。物語・人物は [物語正本](../../brand/story_and_structure.md)と[人物設定](../../brand/character_profiles.md)、要望は [要望台帳](../owner_requests.md)を参照する。
- はじめが普通の葉で世界一を目指す物語。出会いから得た手つきや関係を肯定し、回復を日常の積み重ねとして描く。ましろ一人の救済や恋人成立による完治へ戻さない。友情と恋愛の価値・既存の関係分岐を保つ。
- [PR #550](https://github.com/haseatsu114514-dot/shisha-game/pull/550)の古い改稿案を現在の採用仕様として復活させない。特にましろと回復の描写は上記の現行正本と照合する。王冠画像の候補保存と本編採用も区別する。
- 章・素材・機能の「保存済み」「採用済み」「本編接続済み」は別々に判断する。旧版の実装メモや過去のPASSだけで現行版の完了を断定しない。

## 直近の統合済み成果

| PR | 統合状態・確認した検証 |
| --- | --- |
| [#568](https://github.com/haseatsu114514-dot/shisha-game/pull/568) | 10月15日09:13:06 UTCにmerged。つむぎの下描き実回答を完成作へ反映。提出head `18632c98`のPR起動CIは取得13件すべてSUCCESS（[文書チェック](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38700446601)）。[局所QA](../qa/issue452-tsumugi/README.md)を保持。親Issue #452全体の完了とは扱わない。 |
| [#569](https://github.com/haseatsu114514-dot/shisha-game/pull/569) | 10月15日09:15:38 UTCにmerged、mainの上記コミット。ひよりと双方10投の独立対戦。提出head `178b245d`のPR起動CIは取得11件すべてSUCCESS（[斧投げ回帰](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38702124821)）。[QA](../qa/axe-versus/README.md)。本編の相手解禁・街からの接続など #540の残件は別。 |

これらは提出headのCI確認で、マージ後main全体のCI・公開版QA・実機Safariの再検証結果ではない。

## 進行中・保留中の作業

| Issue / PR | 現在の成果と残作業・次の一手 |
| --- | --- |
| [#447](https://github.com/haseatsu114514-dot/shisha-game/issues/447) / [Draft #566](https://github.com/haseatsu114514-dot/shisha-game/pull/566) | `c8ecfa40`。予約owner名はIssueの最新bot台帳とPR本文で一致する。ただし実担当セッションの所在・停止・未commit/未push作業の有無は未確認で、引継ぎ可能とは確定していない。実回答・応募・旧セーブfixture更新を保存。PR報告では省略なしの `bonds.mjs` は配達会話 `remake_delivery_minto_handoff` の `metadata.private_scene=true` による表情整合assertでFAIL。診断用にassertを置き換えた完走は正式PASSではない。提出headの取得CI5件はSUCCESS（[ブラウザ回帰](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38693578180)）だが、このFAILを解消した証拠にはしない。配達会話の `private_scene` 1項目の修正許可は受領済み。再承認待ちではなく、実担当の確認または正式移管待ち。再開条件を満たしてから当該1項目を修正し、省略なし全体検証を通す。 |
| [#556](https://github.com/haseatsu114514-dot/shisha-game/issues/556) | 自然到達runnerの行動枠精算待ち。最新コメントは正式予約前・編集前の停止記録。参照ガードや他担当の予約を迂回せず、着手可能か先に確認する。修正対象は原則 `hiyori_axe_natural.mjs`。default/work/giftのPC・タッチで必要読了＋会話終了＋slot2精算を上限内に待ち、既存の料金・順序・保存assertを維持する。過去のwork単発PASSでcloseしない。 |
| [#422](https://github.com/haseatsu114514-dot/shisha-game/issues/422) / [Draft #557](https://github.com/haseatsu114514-dot/shisha-game/pull/557) | `e7e055c5`。GET-only事前チェックの第一段階。既存20fixtureは今回再実行PASS、[同headの文書CI](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38534558373)もSUCCESS。一方、読取中にbaseだけをretargetするP2の再現では `no_detected_overlap`・取得失敗0を返した。`pull_identity`がhead/state/file数のみを比較し、baseを比較していない（[対象コード](https://github.com/haseatsu114514-dot/shisha-game/blob/e7e055c5376131c7aae518e8981f01c1e8048aa8/tools/pr_change_preflight.py#L130)）。正式移管待ちのまま、次担当は移管確認後にbase repo/ref/SHAの変化を不完全取得として検知する回帰を追加し、既存20件を維持する。予約workflow統合や #422全体完了は別。 |
| [#437](https://github.com/haseatsu114514-dot/shisha-game/issues/437) / [Open #558](https://github.com/haseatsu114514-dot/shisha-game/pull/558) | `a1705cb5`。既存16fixtureと実4原画のSHA256・PNG IHDR寸法/RGBA/CRC検証を今回再実行PASS。原画は1536×1024、design_only、runtime未導入。PR起動CIの取得結果は0件で成功とは記録しない。10月15日09:19 UTCの独立レビューでPillow verify/loadによる全4PNGデコード、1536×1024・RGBA・alpha 0〜254・SHA一致を確認済み。本更新でも同じ検査を再実行PASS。09:34 UTC時点でDraft解除済み・Open未マージ。切抜き/アンカー/接続径・透過仕上げ・runtime実画面適合は未検証。採用済みデザインを完成済み配信用素材と扱わず、描画契約と素材仕上げを次工程にする。 |
| [#549](https://github.com/haseatsu114514-dot/shisha-game/issues/549) / [Draft #550](https://github.com/haseatsu114514-dot/shisha-game/pull/550) | 王冠構図3案と旧改稿計画を保存。画像選定と第3章題は未決。古い計画を一括マージせず、最新の物語正本との差分・採否を確認する。 |
| [#563](https://github.com/haseatsu114514-dot/shisha-game/issues/563) / [Draft #567](https://github.com/haseatsu114514-dot/shisha-game/pull/567) | 第2章3店の夜素材・表情・個別交流の棚卸し文書。本編への新素材・会話追加の完了ではない。 |
| [#471](https://github.com/haseatsu114514-dot/shisha-game/issues/471) / [Draft #481](https://github.com/haseatsu114514-dot/shisha-game/pull/481) | 街歩き候補を保存。配置判断と復旧後の歩容・ズームの目視検証などが残る。最新mainとの差分を再確認し、保存済み候補を正式配置と扱わない。 |
| [Draft #539](https://github.com/haseatsu114514-dot/shisha-game/pull/539) | OVA画風24候補の比較保存。未採用候補を本編の正式素材へ一括置換しない。 |

この文書のためのツール検証は、#557/#558の上記コミットから取り出した未変更ツール・fixtureを一時領域で実行したもの。#558のPillow検証は正本に記録された4原画を読み取って実施した。本編や各PRを修正していない。base retargetはAPI fixtureでの再現で、実PRのbase変更は行っていない。各PRの完了・マージ可能性を認定するものではない。

## 追加依頼の進捗（2026-10-15 10:01 UTC確認）

依頼元からの引継ぎでは、[#575 パッキー表示](https://github.com/haseatsu114514-dot/shisha-game/issues/575)、[#576 配達の入店演出](https://github.com/haseatsu114514-dot/shisha-game/issues/576)、[#577 会話による施設解禁](https://github.com/haseatsu114514-dot/shisha-game/issues/577)、[#578 地図のゲスト表示](https://github.com/haseatsu114514-dot/shisha-game/issues/578)は、オーナーが別エージェントへ依頼済み。実担当名・実担当セッションの稼働は未確認であり、こちらで重複着手しない。

GitHubで確認した事実は、4件ともOpen、#575〜#577はコメント0件、#578にはbotの予約記録があること。予約記録だけで実担当の所在・稼働・完了を確定しない。取得した最新mainは上記と同じ `e489bd8e`、本引継ぎPR #571もDraft・未マージ。各依頼の担当・ブランチ・コミット・検証結果・残作業を対応付けてから進捗を更新する。#576は #447/PR #566、#577は #540/#556との変更範囲を調整する。

## 本プロジェクトの作業運用（2026-10-15合意）

以下は本プロジェクトの依頼対応・進捗記録に適用する運用であり、上記の実装・検証結果とは区別する。

- オーナー本人の判断が必要な承認待ち・確認待ちは放置せず、何を答えると何が進むか、選択肢と推奨を添えて依頼元へ質問する。回答済みの事項は記録を確認し、同じ承認を繰り返し求めない。
- レビュー・テストを実施中なら「稼働中」とし、本人回答待ちや外部結果待ちと区別する。待っている対象と、再開条件を明記する。
- 手動で他担当へ渡されたIssueは重複着手せず、GitHub上の担当記録・ブランチ・コミット・テスト・残作業と対応付ける。対応が不明なら、同じファイルを変える開いたPRがないかを確認する。
- GitHub更新がないことだけで利用上限による停止と断定しない。確認できた稼働状況・本人の報告・待ち条件を根拠にし、分からない状態は未確認として記録する。

## 次担当の開始手順

1. [既存の開発入口](../../AGENTS.md)と[資料ガイド](../current_documentation_guide.md)を読み、最新mainを取得する。上のリンク先の状態・最新コメント・head・CI・変更ファイルを取り直す。この表より新しい記録を優先する。
2. 新規タスクの選定は、既存Issueの依存・担当・未完の内容から行う。保存済みPRの修正なら対応Issueの引継ぎ範囲を確認し、そのブランチで続ける（Issue予約は2026-10-23に撤廃済み）。
3. #557を引き継ぐ場合の最初の技術作業は上記base変更の回帰追加。#556なら着手制約の解消を確認して3モードの同期修正。#566は許可済みの1項目について再承認を求めず、実担当確認または正式移管を済ませてから再開し、別担当が重ねて編集しない。
4. 対象Issueの受入条件と変更ファイルを小さく固定し、[現行テスト手順](../../remake/README.md)から関連検証を選ぶ。物語・採否など未決の仕様を細部実装の判断で確定しない。
5. 成果をcommit/pushしてPRに検証・残作業・次の一手を残す。未完はDraftで保全する。この文書も更新する場合は確認時点・コミット・根拠リンクを揃え、古いPASSを新headの結果へ読み替えない。
