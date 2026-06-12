# web/dist — ビルド成果物

- `shisha_ch1.html` — `python3 web/build_standalone.py` が生成する1ファイル版。
  アセットは data URI で埋め込み済みで、ローカルでそのまま開ける。
- このフォルダ（`web/dist/**`）への push が GitHub Pages デプロイ
  （`.github/workflows/deploy-pages.yml`）のトリガーになっている。
  公開URL: https://haseatsu114514-dot.github.io/shisha-game/
- JS/CSS/データを変えたら `python3 web/build_data.py && python3 web/build_standalone.py`
  で再生成してからコミットすること（dist が古いままだと公開版が更新されない）。
