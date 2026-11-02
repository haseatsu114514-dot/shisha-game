# シーシャ機材のゲーム素材（参考資料は siryou へ移した）

**シーシャ機材の参考写真と資料は、非公開リポジトリ [`haseatsu114514-dot/siryou`](https://github.com/haseatsu114514-dot/siryou) の `shisha-hardware-reference/` に移した**（2026-11-02 オーナー指示「資料は別の非公開リポジトリにして、ゲームの方からはなくす」）。日本の店・機材の写真116枚、Commons の写真76枚、オーナー提供写真の縮小一覧と説明、早見表と構造図、タッパーの写真4枚はそちら。PCではゲームのリポジトリと同じ階層に clone する。

```bash
git clone https://github.com/haseatsu114514-dot/siryou ../siryou
```

画像生成のルール（貼る文・部位ごとのNG・生成後チェック）は、引き続きこのリポジトリの [`docs/shisha_reference.md` §4](../../docs/shisha_reference.md#4-画像生成の必須手順機材の形と構造) が正本。

## このフォルダに残しているもの（ゲームとツールが読む）

| フォルダ | 中身 | 読んでいるところ |
|---|---|---|
| [`skin-candidates-issue374/`](skin-candidates-issue374/README.md) | 作業台のホースハンドルとマイマウスピースのスキン（採用4種の原画・候補表・検証結果） | `remake/js/appearance/`、`remake/appearance-preview.html`、テスト、`.github/workflows/deploy-pages.yml` |
| [`ng-examples/`](ng-examples/README.md) | 不採用にしたNG原画（ホースのY字分岐・ハガルが短い・足元を囲む大回り） | タイトル候補の確認ツール `tools/title-review/`、`docs/shisha_reference.md` §4.4 |
| `flavor-storage-tubs-issue396/candidate/` | タッパー保管のCG候補（みんと） | タイトル候補の確認ツール `tools/title-review/` |

パスをコードやテストが直接読むので、このフォルダの名前と中の構成は変えない。参考写真や資料をここへ足さず、siryou に入れる。
