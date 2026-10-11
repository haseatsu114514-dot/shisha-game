# 朝霧ひより・本編の登場と接続仕様

オーナー指定の「他店で偶然相席→スミさんへの報告と伝言→各店での交流→好感度3でLIMEからtonariへ」を現行の `remake/` に接続した。
キャラの基本情報・外見・服装は [`data/characters.json`](../data/characters.json) の `hiyori`、台本と条件は [`data/dialogue/hiyori.json`](../data/dialogue/hiyori.json) が正本。

## 本編での進め方

1. 自由行動で他店に行き、一服する。KEMURIKUSA、EDEN、PEPPERMINT、Dr.fookahのショールーム、C.STATIONのどこからでも初対面になる。特定の日・店へ固定しない。通常の買い物だけでは発生しない。
2. 次にスミさんと実際に会う。tonariでのバイト、客としての来店、スミさんとの会話、スミさんがいるtonariの固定夜イベントで報告が進む。明るかった学生時代の回想と「気が向いたら一服しに来い」という伝言を受け取る。
3. 他店で再会し、伝言を渡す。その後の来店で仕事疲れの会話へ。さらに別の店でも一日一度の相席会話を重ねる。背景はその訪問先を使う。
4. 好感度3以上で、スミさんから「ひよりが客として来てる」とLIMEが届く。仕事の呼び出しではなく、彼女が自分で寄った私的な来店。返事で向かうと、ひよりには予告せずはじめが顔を出す。
5. 変わらぬ師匠の優しさにひよりが涙する。感動場面の終盤で初めて、師匠への尊敬とはじめへの応援を表の言葉にする。次のtonariで三人の会話が続く。

「星3」の依頼は、既存の好感度表示に合わせて **♥3**（既存の33点の段階）へ接続。能力の★3とは別。
追加の相席だけで行動枠・料金・体力を二重に消費しない。再会のLIMEは昼の行動1回、参加費なし。断る・未読期限切れ・他の約束との競合で永久に失われず、日を改めて届く。スミさんの仕事のLIMEより物語の報告を優先し、同じ朝の連投は避ける。

## 台本とフラグ

| 段階 | 正式台本 | 読了フラグ | 条件 |
|---|---|---|---|
| 他店で相席 | `hiyori_meeting` | `_hiyori_meeting_done` | 第1〜2章のシーシャ店で有効な訪問 |
| スミさんへ報告 | `hiyori_sumi_message` | `_hiyori_sumi_message_done` | 出会い読了・面識、次の実対面 |
| 伝言を渡す | `hiyori_shop_message` | `_hiyori_message_delivered` | 報告読了、他店で再会 |
| 仕事の疲れ | `hiyori_cracks` | `_hiyori_cracks_done` | 伝言読了・♥1以上、他店で再会 |
| 各店で交流 | `hiyori_shop_repeat_0`〜`3` | `_hiyori_repeat_count` | 報告後の既読段階を終え、一日一度 |
| tonariで鉢合わせ | `hiyori_tonari_return` | `_hiyori_tonari_return_done` | 報告・伝言・仕事疲れ読了、♥3以上、スミさんのLIMEに返信 |
| 三人の物語へ | `hiyori_tonari_followup` | `_hiyori_tonari_followup_done` | 再会読了、次にtonariで会う |

`route.enabled` はtrue。未制作イベントは `missing_script` により発火しない。読了フラグは最後まで読んだ後だけ記録し、同時呼び出し・再読による二重報酬を防ぐ。
初対面の店は `_hiyori_meeting_shop`、一日一度の制限は章と日を含む `_hiyori_encounter_day` で保存。
名乗りで `_met_hiyori`、連絡先交換で `_lime_contact_hiyori` を立てる。既存の `flags`・`contacts`・`affinity` に保存するためスキーマ変更なし。旧セーブの好感度から出来事を推測して埋めない。

## 画像と本心

現在はオーナーが選択したレースブラウス案。ポニーテール、白〜アイボリーのフレンチスリーブ、黒のパンツ、名札なし。通常・物憂げ・控えめな微笑み・驚き・感動の涙の5表情と、ミディアムヘアで元気な学生時代の1表情を使用する。
原画と生成指示は [`asset_sources/portraits/hiyori-office-v1/`](../asset_sources/portraits/hiyori-office-v1/README.md)。896×1200の透過PNG、RGBAが一致する可逆WebP、160pxの顔アイコン、manifestを揃えた。背景や別人で素材待ちを埋めない。

正式名は朝霧ひより（あさぎり ひより）。他店で名乗った直後に一度だけ登場カットインを表示し、呼び名「ひより」と「儚げな元スタッフ」、本人の短い台詞を出す。背景は乳白色・淡い桃色・薄い藤色の線香花火。現在の立ち絵をそのまま重ね、柔らかいフェードと小さな火玉の光で儚さを出す。動きを減らす設定では停止し、既読は `_intro_hiyori` で保存する。
原画・指示・実画面の記録は [`asset_sources/character-intros/hiyori-senkou-v1/`](../asset_sources/character-intros/hiyori-senkou-v1/README.md)。PC・横持ちスマホ・動きを減らす設定の3項目を `remake/test/hiyori_intro.mjs` で実行する。

学生時代を知ったはじめがすぐ演技の全容を見抜く展開にはしない。`_hiyori_real_self_known` は今回の回想・再会で立てない。
回想後の一部台詞だけに `inner` を付け、発話の後に淡いピンク・括弧付きで出す。プレイヤーにだけ見え、はじめは聞いた台詞と見た行動へ返す。仕事の疲れは本物で、儚い演技も本人の好きなあり方。

`remake/hiyori-preview.html` の5本は過去の表示確認サンプルで、本編の正式台本とは別。セーブや設定を読み書きしない。未制作の斧投げ背景を他店で代用しない。

## tonariでの仕事の入口（後続追加）

三人の初回の会話（`tonari_followup`）を実際に読み終えた後、**次にtonariでスミさんと対面したとき**、ひよりが客として手帳を鞄へしまう追加回 `hiyori_tonari_afterwork` を一度だけ再生する。総務の具体的な働きぶりと、仕事から意識を切り替えたい気持ちを描く。第1〜2章・♥3以上が条件で、読了後に `_hiyori_tonari_afterwork_done` を保存し、好感度を5点だけ付与する。

この会話は後半の `work_talk` に**代替しない**。斧投げでの素顔の発覚はまだ起きないので `_hiyori_real_self_known` や `_hiyori_work_talk_done`、恋愛・友情の最終条件に影響させない。斧投げ用背景・後半立ち絵がない間も既存のtonari背景と既存表情で完結する独立エピソードだけを接続する。

## 検証と今後の範囲

検証コードは `remake/test/hiyori_encounters.mjs`（本編訪問・報告・LIME・セーブ・PC／スマホ）、`remake/test/hiyori.mjs`（本心・ログ・AUTO・SKIP・共通関係API）、`remake/test/hiyori_intro.mjs`（名乗り・紹介・既読保存）。CIでも実行する。記録は [`asset_sources/hiyori-encounters-20261011/`](../asset_sources/hiyori-encounters-20261011/README.md)。

今回の実装は三人の物語の入口まで。斧投げでの正体発覚、深い仕事の相談、恋愛／友情の締めくくり、専用ハガル、海外同行は未制作。第2章以降のゲーム進行自体も未接続で、条件だけを先行定義している。
`storyEvents` の4本（meeting/cracks/axe_reveal/work_talk）は後半の共通関係システム用のまま保持。スミさんへの報告やtonari再会を既存の4本の代用にして告白を早めない。専用ハガルと正式な後半台本が揃うまで好感度MAXだけでは告白しない。
