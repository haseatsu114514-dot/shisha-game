# PWA 仕上げの検証（2026-11-10）

## 公開経路

- `remake/index.html` が入口。manifest の `start_url` は `./index.html`、`scope` は `./`、`display` は `fullscreen`、`orientation` は `landscape`。
- アイコンは実体のある PNG（192×192、512×512）で、512 は `maskable` にも指定済み。
- main への push で `.github/workflows/deploy-pages.yml` が `remake/`、`data/`、`assets/` を Pages に配置する。`remake/tools/stamp_deploy.py` が公開版の build ID を付け、既存の `build.json` 確認処理が更新を通知する。

## ローカル確認

- `python3 remake/tools/serve_preview.py --port 8135 --directory /tmp/pwa-1110-site` で、現行 `index.html`、manifest、アイコン、`sw.js` と最小のゲームモジュールを配信。Playwright Chromium で `navigator.serviceWorker.ready` と `controller` を確認。登録 scope は `http://127.0.0.1:8135/remake/`、状態は `activated`。
- ブラウザから manifest を取得し、`fullscreen`、`landscape`、192/512 アイコンと maskable 指定を確認。PNG 実体の寸法も `file` で確認。Android のインストールに必要な構成は揃う。実機の追加メニュー表示は未確認。
- `Cache-Control: public, max-age=3600` を返す別のローカルサーバー（8136）でも、制御中ページから取得した HTML、JS、`../data/` の JSON を配信中に `one` から `two` に差し替えると、次の fetch で `two` を取得。`caches.keys()` は空。ネットワーク専用・`no-store` のため古い Cache Storage の版は残らない。
- 配信中の `sw.js` を変更して `registration.update()` を実行すると `controllerchange` が発火し、新しい worker に切り替わった。`skipWaiting()` と `clients.claim()` の動作を確認。
- `node --check remake/sw.js`、`git diff --check`、`./tools/check_git_safety.sh` は成功。

## quick

`node tools/ci/run.mjs --kind quick` を最後まで実行し、74 スイート中 65 成功・9 失敗（終了コード 1）。失敗はこの sparse checkout に入れていない素材・資料への参照で、PWA の変更箇所に起因する失敗はない。例: `remake/img/ui/poems/poem_ch1.webp`、`remake/img/loading/sumi-cold-tea-1.webp`、`asset_sources/desert-ride-2306/adoption.json`、`asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json`、`assets/audio/dj/km__dance-monster.mp3`、`experiments/proto/street/`、`CLAUDE.md`。失敗スイートは `chapter-poems`、`desert-ride-rules`、`loading-comics-spec`、`slim-deploy`、`docs`、`game-logic`、`audio-and-text`、`tools`、`new-flavors-dubai-shop`。完全な CI checkout で再判定する。
