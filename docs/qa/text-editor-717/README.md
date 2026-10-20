# 台詞エディタと本編の組版比較（#717）

BASE: `8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d`。実装・回帰テスト: `be5119b9`。
本編の文字幅測定と本心併記ページ生成を `remake/js/vn/layout.js` に抽出し、エディタからも同じ経路を呼ぶ。
書体は同梱のSuien Gothic 500/700、枠・字間・行間・装飾は本編CSSを使用する。
`data/dialogue`、台詞本文、演出上の手動改行、DSレイアウトは変更していない。

## 機械検査

ChromiumのPC 1280×720／通常スマホ横844×390のviewportで、8例ずつ、計16条件・26ページがPASS。
実エディタのiframeと、`index.html`と同じ全CSSを読み込んだ実VNエンジンの `play`・Enter送りを比較した。
両者のHTML（装飾と改行を含む）・font family/size/weight・字間・行間・内幅998pxが全ページで一致。
本文／本心の横幅・台詞枠の下端を検査し、余分なページを見落としていないことも末尾の選択肢到達で確認した。
ゲーム全体のbootや全章プレイの代用ではない。画像・音声の新規ダウンロードなし、外部リクエスト0。

固定例は [text_editor_cases.json](../../../remake/test/text_editor_cases.json)。
長文・強調・短い末尾・手動改行/空行・語中改行・本心併記・対象外話者の本心・結合文字を含む。
[results.json](results.json) にPC／スマホの各ページの原文を保存した。
原文「シー\nシャを作る」と空行が保持されること、Unicode文字後のクリック改行位置と解除も確認した。

修正前の本編engine.jsを同じURLで差し替えて短い末尾／本心を再生し、抽出前後の本編ページ分割も一致した。
修正前エディタのHTMLだけを同じサーバー上で差し替え、旧版の「2行→待った。だけ」の分割差を再現した。

| 条件 | 修正前エディタ | 修正前本編 | 修正後エディタ | 修正後本編 |
| --- | --- | --- | --- | --- |
| PC・短い末尾 | [前](pc-short-tail-before.png) | [前・2ページ目](pc-short-tail-before-game.png) | [後・2ページ目](pc-short-tail-2-editor.png) | [後・2ページ目](pc-short-tail-2-game.png) |
| スマホ・短い末尾 | [前](mobile-short-tail-before.png) | [前・2ページ目](mobile-short-tail-before-game.png) | [後・2ページ目](mobile-short-tail-2-editor.png) | [後・2ページ目](mobile-short-tail-2-game.png) |
| PC・本心継続 | — | [前](pc-inner-before-game.png) | [後](pc-inner-3-editor.png) | [後](pc-inner-3-game.png) |
| スマホ・本心継続 | — | [前](mobile-inner-before-game.png) | [後](mobile-inner-3-editor.png) | [後](mobile-inner-3-game.png) |

## 目視確認（機械検査とは別）

画像を開き、旧エディタで孤立していた「待った。」が直前の行と同じページに残り、同じ書体・枠で読めることを確認した。
本心は最後の発言を残したまま下のピンク文字で続き、枠内に収まる。
語中の手動改行は自動削除しない。不自然な区切りと演出意図を個別確認する警告・マニュアルへ変更した。
長い本心が文途中で続くことも現行本編どおりであり、全台詞の自然さや改稿の適否を保証する検査ではない。

## 検証記録

- `node remake/test/text_wrap.mjs`: 6534台詞PASS。共通の全角換算について装飾・改行・結合文字も確認。
- `python3 tools/test_text_editor_server.py`: 2検査PASS。本心／演出情報を壊さないtext保存と、プレビューの限定配信経路。
- `python3 tools/lint_dialogue.py`: 59ファイル、ERROR 0 / WARN 139。本文の変更なし。
- JS／Python構文、`python3 tools/check_agent_docs.py`、`git diff --check`、Git Safety: PASS。
- 新規ブラウザ回帰は既存Motion endings CIに接続。実PR HEADのCI run・レビュー状態は [PR #739](https://github.com/haseatsu114514-dot/shisha-game/pull/739) に記録する。ローカル成功をCI成功とは扱わない。
- 自己レビュー: 既存の計測式・短い末尾調整・本心配置を保って抽出。別セッションの独立レビューは未実施。

未確認: 実機iPhone/Safari、touch操作、縦向き案内、全章通し、書体が4秒以上遅延する本編起動、補間後本文・報酬キューによる本文変換。
DS専用の開発・検証は行わない。既存 `hiyori.mjs` は既定のPlaywrightブラウザ未配置で起動前に停止し、PASSには含めない。上記比較は既存システムChromiumで実行した。

## 再現

リポジトリルートから、別ターミナルで `python3 -m http.server 8123 --bind 127.0.0.1` と
`python3 tools/text_editor_server.py` を起動する。Playwrightと利用可能なChromiumが必要。

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=work/text-editor-717 node remake/test/browser/text_editor.mjs
```

前後比較を再撮影する場合は、`git show 8a5bb15b:tools/browser/text_editor.html` と
`git show 8a5bb15b:remake/js/vn/engine.js` の出力を `work/` に保存し、その絶対パスをそれぞれ
`BASELINE_EDITOR_HTML`／`BASELINE_ENGINE_JS` に指定する。台詞の保存APIは呼ばず、fixtureはテスト内だけで使う。
