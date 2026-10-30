# Manual DJ — Issue #1064

Entry: `remake/previews/dj/index.html`. Kevin MacLeodの実曲5曲（CC BY 4.0）を、ゲームが提示する3ステージでつなぎます。Stage 1はDance Monster / Digital Lemonade、Stage 2はRaving Energy / Cut and Dry、Stage 3はRising Tide (faster) / Dance Monsterです。全曲の帰属・ISRCは画面下部に掲載しています。

ステージ選択でAが開始し、Bは待機します。Stage 1・2のBにはランダムな±1.2〜2.8%のデチューン、Stage 3には122/120 BPMの差があります。既定はStage 1。音声準備だけでは再生しません。

手動PITCH（スライダー・±0.01 BPM）で合わせ、大きなPLAYを押します。PLAYは即時開始し、フレーズ頭へ予約・同期しません。拍からの符号つきずれをPERFECT / GOOD / OK / EARLY / LATEで表示します。上下の実PCM波形、±1/16拍、Bの±10msナッジで位相を合わせ、8小節ガイドに沿って等パワーの横フェーダーを動かします。テンポは音程にも反映します。

両デッキ再生中かつ対象PLAY記録後に判定できます。ピッチ誤差・PLAYずれ・位相ドリフトの3項目を平均し、S/A/B/Cを表示します。8小節完了時には未判定なら自動判定します。ガイドは開始・同期・テンポ変更をしません。

全体停止/再開は直前の再生デッキだけを復帰し、個別PAUSEはヘッドを保持します。タブ非表示・音声中断時は停止し、自動再開しません。本編SAVE・経済・章進行には接続しません。小窓のコード仮ドット/仮キャラ・生成背景は従来の試作表示です。

検証: `node remake/test/dj_preview.mjs`。音声ローダを注入した制御WebAudioと純関数を検証します。ブラウザテスト `remake/test/browser/dj_preview.mjs` は通常PR CI用です。記録済みの制限に従いローカルでは実行せず、`node --check` のみ行います。実機発音、ループ品質、遅延、タッチ、OS中断の確認はCIと司令塔側の担当です。
