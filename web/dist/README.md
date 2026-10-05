# web/dist — ビルド成果物

- `shisha_ch1.html` — `python3 web/build_standalone.py` が生成する1ファイル版（約65MB）。
  アセットは data URI で埋め込み済みで、ローカルでそのまま開ける。
- **リポジトリには入れない**（`.gitignore` 済み・2026-10-04）。台詞を直すたびに65MBの丸ごとが履歴に積もり、
  リポジトリが重くなるため。公開版は GitHub Pages のデプロイ（`.github/workflows/deploy-pages.yml`）が
  main への push のたびにビルドして置く: https://haseatsu114514-dot.github.io/shisha-game/shisha_ch1.html
- 手元で欲しいときは `python3 web/build_data.py && python3 web/build_standalone.py` で作る。
