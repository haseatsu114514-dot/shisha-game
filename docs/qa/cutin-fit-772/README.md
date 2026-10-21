# カットイン専用fit（#772）

現main `ea0229dbd6635299b78faba04c4956f28a9e0577` で修正前後をChromeの隔離componentにより比較した。通常1280×720・844×390は背景とstageが一致。DS1280×800ではstageが1280×736、背景が1280×720で下端16pxが未被覆だった。

固定1280×720の文字・人物・背景を一緒にcontainし中央配置する。DSでは構成y72..792、専用背面がstage全域y64..800を覆う。余剰部分はカットインの地色で埋めるため、元画像と異なるレターボックス領域は残る。画像のcrop・反転・一律拡大、全体stage、フォント、会話UI、人物の配色は変更しない。

修正後の3条件で文字・仮人物・背景の矩形、通常版の前後不変、DSの背景一致・地色による余白被覆、resize、art/fallback両経路、直接子MutationObserver、入力遮断・表示時間、cleanupと初期化失敗rollbackのassertがPASS。driver exit 0。before 5.432秒、after 0.785秒。旧A記録の合計1分未満を含め30分上限内。

実素材・本編・実時間animation・全人物・全章は未実施。合成SVG、fallback font、mock data/audio/sleep、reduced motionを使う。ユーザー報告の帯との同一性と素材内部の余白は未確認。`results.json` に実測値を保存。

再現（既存Mac Chrome、追加依存・通信なし）:

```sh
node docs/qa/cutin-fit-772/fixture.mjs /tmp/cutin772-after.html
node docs/qa/cutin-fit-772/browser-check.mjs /tmp/cutin772-after.json /tmp/cutin772-after.html docs/qa/cutin-fit-772/results.json
```

最後の引数は通常2条件の修正前矩形を持つbaseline JSON（`results.json` のbeforeをdriverが読む）。ブラウザの導入や全素材の取得は不要。

旧A成果は `~/Documents/Codex/2026-10-20/task-9/work/cutin772` にGit管理外で残っていた。原本は無変更、製品3ファイルとfixture/driverを再利用しこのPRでGitHubへ保存した。QA記録は現mainでの測定に更新。停止確認とrelease→claimの経路はIssueコメント6307318184に記録。空PRのtransferはcoordinatorが拒否するため使用していない。
