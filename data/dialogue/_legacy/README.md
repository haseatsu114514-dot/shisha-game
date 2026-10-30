# 改稿前の台本（正史ではない）

Issue #660 の監査対応で隔離した履歴。`data/dialogue/*.json` の直下だけが現行台本。ここを再帰検索して新しい章へ接続しない。ローダ・台詞検査・参照検査から除外するが、JSON構文は保持する。

- ch2_main / ch2_isolation: 博士の初対面、旧ライバル紹介、採点表で否定する優勝。
- ch2_ageha: 最新の ch2_ageha_story.json より前の口調・構成。
- ch2_volk: 第2章から撤去。第3章版へ移し、記憶の参照も更新。
- ch3_main / ch3_mukai / ch3_mashiro: 重複初対面、反復する崩壊、成立前の恋人デートと同文修羅場。
- ch4_main / ch5_main / ending / dreams: 旧大会制度・時系列・人物像の混在。
- forced_events: 廃止された旧版の日割り表。現行第1・2章はremakeの章コード、第3章以降はdata/story_routes.jsonを参照。

履歴中のIDは現行IDと重複してよい。現行ファイルから履歴へジャンプ・参照することは不可。検査は tools/check_story_canon.py。
- ch3_spots（#1893）: 旧第3章スポット台本（ch3_tokyo_shisha / ch3_mukai_visit / ch3_tokyo_sightseeing / ch3_mukai_tetsuko / ch3_return）。どのローダ・FILES・テストからも読まれていなかった。報酬の地の文・「テツコ」表記・ましろのシガー直接提示が残る。
- ch2_steve_cameo（#1893）: ch2_main.json から1場面だけ退避。参照ゼロ。第2章にスティーブが現れる旧設定と「ストップウォッチ」表記。
