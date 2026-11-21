# Issue #4046 第1章の実プレイ所見

[Issue #4046](https://github.com/haseatsu114514-dot/shisha-game/issues/4046) の3件を Chromium の横持ちタッチ 844×390 で再検証した。配合は PC 1280×720 でも確認した。

## 修正と理由

1. **初回配合**　[#4060](https://github.com/haseatsu114514-dot/shisha-game/pull/4060) で、スマホ横持ちの支給葉カードは葉の名前と ± を横に並べるようにした。最初の注文に使えるレモン・オレンジ・ミントをその場で比較できるため、この配置を採用した。現行 main の NEW GAME から配合の案内を閉じ、6つのボタンが一覧の初期表示に入ることを再確認した。844×390 でボタンは実寸約44 px。両サイズでミントを 0→1→0 g と操作し、一覧の初期スクロール位置は 0 のままだった。
2. **穴あけ講評**　#4060 で、浅い穴が半数以上なら押し加減の助言を講評と詳細の先頭に出すようにした。現行 main の 844×390 ではスミさんの長い講評が2ページに分かれ、修正操作が2ページ目に送られていた。既存テストが照合する詳しい助言はそのまま使った。スミさんの一言を「穴が浅いな。少し長く押せ」に短縮した。外周12＋中周12、目印24/24、ズレ0、浅い穴24で、原因と次の操作が最初の表示に収まり、詳細の冒頭の既存文でも短いタップが原因だと読める。
3. **心得の盤**　#4060 で、6/10「灯す」の吹き出しを左へ寄せ、詳細の明るさも保つようにした。DAY3 の観音堂で「体力」を選び、案内を開いたまま「最大体力＋8」と「白火1で払う」を読めた。案内の順番どおりに進み、白火3→2で確定できた。

## スクリーンショット

配合の修正前は #4060 直前の main `a49a61db81`。盤の修正前は `a283503f5f` に同じ旧版の案内モジュールを読み込ませ、吹き出しと詳細の重なりを再現した。穴あけは今回の変更直前と変更後を比較した。撮影時の main は `a283503f5f`。PR の起点 `ad21a4b791` までに入った変更は TRPG の表示。

| 所見 | 画面サイズ | 修正前 | 修正後 |
| --- | --- | --- | --- |
| 初回配合 | 844×390 | [修正前](shots/01-mix-844-before.webp) | [修正後](shots/01-mix-844-after.webp) |
| 初回配合 | 1280×720 | [修正前](shots/01-mix-1280-before.webp) | [修正後](shots/01-mix-1280-after.webp) |
| 穴あけ講評 | 844×390 | [修正前](shots/02-holes-844-main-before.webp) | [修正後](shots/02-holes-844-after.webp) |
| 心得の盤 | 844×390 | [修正前](shots/03-board-844-before.webp) | [修正後](shots/03-board-844-after.webp) |

撮影には独立したブラウザーコンテキストを使用した。修正後の DAY1 はタイトルから NEW GAME で開始し、会話送りに既存のテスト機能を使った。穴あけは針が目印と重なる時点に短いポインター入力を送った。修正前の DAY1 と両版の DAY3 はそれぞれの画面の入口から起動した。

## 今回の変更ファイル

- `remake/js/craft/audience.js`　深さを指摘する場合のスミさんの一言を短縮。
- `remake/test/browser/ch1_first_play_feedback.mjs`　844×390 の最初の表示と詳細の冒頭を検査。
- `docs/qa/issue-4046/RESULT.md` と `docs/qa/issue-4046/shots/`　検証記録と前後比較。

配合 UI と盤の案内は #4060 の実装を再確認した。本PRの変更範囲は穴あけ講評の表示、回帰テスト、検証記録。

## テスト結果

- `node --experimental-vm-modules remake/test/foil_holes.mjs` と `python3 remake/tools/build_css_bundles.py --check` は成功。
- Chromium の `step_intro.mjs` は 2/2、`ch1_first_play_feedback.mjs` は 5/5、`board_tutorial.mjs` は 5/5、`board_phone_text.mjs` は 10/10 成功。
- 追加の `first_brew.mjs` は 7/11 成功。残り4件は Chromium のクラッシュ（`heat-help-touch`）または素材リクエストの `ERR_INSUFFICIENT_RESOURCES`（`holes-and-steam-help`、`first-customer-lemon`、`third-recorded-loss-continue-retry`）で失敗した。対象画面の初回配合は上記テストと両サイズの撮影でも操作を確認した。
- 最初の実行では疎チェックアウトの素材が 404 になり、一部の Chromium 実行で読み込み時にリソース不足が発生した。既存のローカルキャッシュから該当コミットと一致する素材を補い、上記の結果を再実行で得た。
- 保存前に `tools/check_git_safety.sh` を実行した。共有の Git メタデータが読み取り専用のため GitHub API で作業ブランチに保存し、`git ls-remote` で HEAD を照合した。

## PR

[Draft PR #4127](https://github.com/haseatsu114514-dot/shisha-game/pull/4127)
