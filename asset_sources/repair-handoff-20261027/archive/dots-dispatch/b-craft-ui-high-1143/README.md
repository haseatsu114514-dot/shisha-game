# シーシャ制作UI比較の保存成果

`comparison.html` は実ゲームoriginalと未生成のAI比較欄を明確に分けたローカル一覧です。外部公開していません。

- 固定公開main `a76749f01f32b29c864a35a86a6ad9ac6640f5f4`、1440×900、新規localhost/profile内のfixture起点で15 primaryを実撮影。追加状態4枚も採用し、旧版を含むoriginalファイル23枚を保全。AI画像は0枚。
- `capture-manifest.json` に個々のpath/size/hash、source/fixture/browser来歴を保存。全437 snapshotファイルは固定mainの公開Git blobと一致。
- 必要素材・CSS・fontsを補完。ランダムなタイトル絵の未取得prefetchは制作画面へ表示されず、全種類取得しない。
- 3方向と45指示は再設計せず継続。炭はシーシャ用トング、吸い出しはハガル主/水入りボトル副と吸う強さ、パッキングのゲーム性を指示へ追加。
- `evidence/imagegen-submission-plan.json` は送信前台帳。参照は自分で撮影した公開ゲームscreenだけで、各sourcepath/size/role/hashを記録。private cacheやprofile/SAVE/logを生成へ送らない。
- 19:52に今回作業の通信量制約は解除。標準image_genは提供されているが、既存契約内利用の公式表示/照会機能がなく、その項目だけ未確認。推論試験/生成call/API fallback/追加課金なし。
- 新しい撮影driverは正規承認で既存Chromeを通常sandbox、新規profile、外部通信遮断、127.0.0.1のみで実行。最初の水入れはdriverの準備待ち順でtimeoutし、実ゲームと同じwaitBenchReady順に直した。製品修正ではない。
- 既存19診断、以前のsource/manifest/galleryを保存。製品・採用素材・通常参照・既存ユーザーSAVE・Git/branch/claim/PRに変更なし、cloneなし。
- 最終順位等はfixtureシナリオで、プレイヤーが全工程を完了した証拠や全SAVE/LOAD復帰検証ではない。実UIの見出し重なり等も改造せず元画像に残している。

続きは同じB sessionでSTATUSを確認し、公式に既存契約内と確認できた範囲だけ標準built-inへ送る。送信拒否時はその対象を再試行せず記録する。旧初期化/旧finalizeスクリプトは保存状態を巻き戻すため再実行しない。
