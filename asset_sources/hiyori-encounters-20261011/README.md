# ひよりの本編接続・検証記録

他店の相席からスミさんへの報告、伝言、各店での交流、♥3のLIME、私的なtonari再会、三人の会話へ接続。

- `remake/test/hiyori_encounters.mjs`: 全5店での初対面、除外施設、一日一度、実際のマップの有料行動、客席／バイトでの報告、伝言・仕事疲れ・♥3、LIME辞退と翌日再案内、未読期限切れ、予約・読了セーブ、再読の二重報酬防止、PC／スマホの表示。
- `remake/test/hiyori.mjs`: 本心と発話・ログの分離、AUTO／SKIP、レイアウト、共通関係API、章条件、旧セーブ、セーブに触れない別ページ試写の9項目。
- データ読み込み、日常整合性、LIME整合性、全5654文の組版、JSON構文と選択先を検査。台詞lint ERROR0、ひよりはWARN0、全体には既存WARN343。
- `playthrough.mjs`: 新規ゲームから13日間、敗北→再挑戦→優勝までPASS（mainの大会改善取り込み前）。シナリオとLIMEが日常全体を止めないことを確認。最新main `ce1fe206` の大会改善を取り込んだ後も、ひよりの本編7項目と本心・関係の9項目、日常／LIME／データの回帰をすべて再確認してPASS。
- 全6表情は896×1200 RGBA、同じmanifestの配置枠。PNGと可逆WebPは全画素一致、アンカー整列変更0枚。画像と生成指示は [原画一式](../portraits/hiyori-office-v1/README.md)。

`desktop-*.png` / `mobile-*.png` に各表情を実際のVNへ出した画面を保存。`foundation/` は本心表示などの確認。追加した後半台本や海外同行を完成扱いにしない。[現在の接続](../../docs/spec/hiyori_implementation.md)。
