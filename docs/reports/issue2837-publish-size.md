# Issue #2837 公開サイズ計測（2026-11-07）

## 対象と計測方法

`.github/workflows/deploy-pages.yml` の `Prepare site` を対象にした。`assets/`、`remake/`、`data/` の全ファイル、`tools/title-review/media/` と同ワークフローで個別コピーするファイルを列挙した。全 4,277 ファイルのパス・カテゴリ・実体サイズ・除外可否は [一覧](issue2837-publish-files.tsv) を参照。Git LFS ポインタはポインタの長さでなく、記載された `size`（公開時に取得する実体のサイズ）で計算した。

`stamp_deploy.py` の増分 4,191,809 bytes は別サイトの複製上で実行して実測した。ルート転送 HTML は 478 bytes。版名 `197344e`、日時 `2026-11-07 00:00` で計測したため、実公開日時による数十 bytes の変動はあり得る。

| 区分 | 変更前 bytes | 除外 bytes | 変更後 bytes |
|---|---:|---:|---:|
| `assets/ui` | 444,774,633 | 273,059,051 | 171,715,582 |
| `assets/sprites` | 274,279,339 | 274,279,339 | 0 |
| `assets/backgrounds` | 198,131,772 | 185,187,299 | 12,944,473 |
| `assets/cgs` | 86,885,108 | 82,957,597 | 3,927,511 |
| `assets/audio` | 87,771,469 | 0 | 87,771,469 |
| `remake/img` | 320,135,094 | 0 | 320,135,094 |
| `tools` | 58,994,919 | 0 | 58,994,919 |
| その他のコピー対象 | 30,959,756 | 0 | 30,959,756 |
| `stamp_deploy.py` 増分と転送 HTML | 4,192,287 | 0 | 4,192,287 |
| **合計** | **1,506,124,377** | **815,483,286** | **690,641,091** |

変更後は 1 GB（1,000,000,000 bytes）未満で、削減率は 54.1%。

## 除外根拠

`remake/js/core/data.js` の `img()` と `remake/js/core/portrait-resolver.js` は `remake/data/manifest.json` の `webp` 一覧にある PNG を `remake/img/` の同名 WebP に置き換えて表示する。`sceneBg()`、`portraitInfo()`、`cgUrl()` も `img()` を通る。HTML/CSS/JS とマニフェストを `rg` で照合した結果、`remake/js/minigames/camel-race.js` が `assets/ui/face_icons/face_faris.png` を直接読むため、この1件は維持する。`store-logos.js` の直接参照は `webp` 一覧の対象外。`assets/` 側の他の画像、音声、開発用ファイルについては、参照が無いとの十分な根拠を得られなかったので除外しない。

対応 WebP がある原画 PNG 873件のみを公開コピーから削除する。原画 PNG はリポジトリに残る。`manifest.webp` に記載されているが元 PNG が現存しない4件は削除対象に数えない。画質再圧縮、音声再圧縮、素材差し替え、内容変更は行わない。

## 検証

- 公開コピー相当を複製して除外スクリプトを実行: 873件のみ削除、Faris PNG と対応 WebP は維持。
- `remake/img/` のファイルは一切変更・削除しないため、表示に使う画像のバイト列は同一。
- quick CI の結果とスクリーンショット比較の可否は PR 本文に記載する。
