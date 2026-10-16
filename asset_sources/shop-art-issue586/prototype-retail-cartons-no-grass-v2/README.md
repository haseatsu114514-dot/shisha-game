# 小売箱風・草背景なしの代表比較（v2）

**採用保留。代表3フレーバー＋HMD1点だけ。量産・本編接続・公開はしない。**
旧21点は今回以前に新規生成した植物画ベースの箱/機材案であり、後日使える別案として原画・配信画像・consumerコードを全て保持する。
過去の歴史的パッケージPNGを発見したという扱いにはしない。

同じworker/Issue586/PR587。旧head `7c58a04e3674d5b4a559947ee9d7da6cd77fad00` のCI12件SUCCESSを確認したが、画像採用の承認ではない。
新status run `38795781004` は成功し、同ownerとclaim run `38786636524` を再検証済み。
mainの重複しない章タイトルQA資料だけを同一ブランチへ明示merge。PRのmainへのmergeはしていない。

現行 `data/flavors.json` でmint/double_apple/grapeはすべて「アルファーヘブン」、短縮表示「AF」。実在Al Fakherはメーカー写真のレイアウト/箱形参照だけ。
公式写真のロゴ・冠・アラビア語・宣伝文句は転用せず、ゲーム既存のAFだけを独自の単純な文字配置で使い、商品名はHTMLの比較キャプションへ置く。
メーカー参照写真は一時参照のみでリポジトリへ同梱しない。URLとハッシュはmanifest.json。

HMDは曖昧な指示を「tanukish_lidの大きい上部突起を除去」と読む。器具そのもの/機能は除去しない。
既存の通気口の配置を保ち、新しい穴・ハンドル・ボウル・炭で埋め合わせない。解釈自体も今回の比較で人の確認待ち。

生成済み4点は `originals/`、新旧一覧は [comparison-old-vs-retail.png](comparison-old-vs-retail.png)、日本語の商品名付き比較は [index.html](index.html)。全点とも組み込み `image_gen.imagegen` による実生成で、元PNGのバイト列は変更していない。
実際のプロンプト全文は [prompts.json](prompts.json)、出力元・入力参照・保存先は [generation-records.json](generation-records.json)、公式参照URL/ID/寸法/alpha/SHA256は [manifest.json](manifest.json)。メーカー写真は今回追加していない。

4点のPNG復号・RGBA・原出力とのSHA256一致を確認。旧headからの129ファイル（旧21原画/配信画像・ショップコード・dataを含む）は全て同一で、本編/データ/配信画像の差分は空。詳細は [validation.json](validation.json)。今回ゲームテストは再実行せず、通常CIは新しいpush headに対して別途動く。

代表比較のため、AFの字形と箱の占有率には差がある。ネイティブ出力の一部にalpha=1の微小ノイズが端まであり、可視物体の境界はalpha>=8で記録する。原画には加工せず、比較シートの配置だけ可視境界で揃えている。本採用する場合の字形/余白統一・透過端処理は方向性確認後の作業。

次は人による「小売箱の方向性」と「HMDの解釈」のレビュー待ち。量産、旧案の削除、画像マッピング変更、mainへのマージ、公開はこの段階では行わない。
