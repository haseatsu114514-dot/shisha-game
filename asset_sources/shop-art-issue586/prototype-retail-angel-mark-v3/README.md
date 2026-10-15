# 白い天使マークの代表比較（v3・採用保留）

同じIssue586/PR587・worker `codex-c-shop-art-20261016-8e7fb2cb0e`・thread `01a140d2-7791-7aa2-9b89-4ad03675a977`。
claim `38786636524` を新status run `38808857759`（SUCCESS）で再検証。旧21点、v2のAF箱3点、HMD修正案、ゲーム本編/データ/配信画像を全て保持する。

今回の変更は代表3箱の絵からAF文字だけを外し、独立した白い翼＋輪の天使マークを共通参照として配置するもの。ゲーム内ブランド名「アルファーヘブン」はデータ/キャプションで維持する。実在メーカーの王冠・文字・ロゴは使用しない。黒い薄箱、各フレーバーの色と素材画、草の共通装飾なしの方針を保つ。

組み込み `image_gen.imagegen` によるマスター生成と3箱の実画像編集を行う。原出力PNGは無加工で保存。比較シート作成だけレイアウト処理を使う。本編接続・量産・旧案削除・merge・公開は行わず、人の方向性レビューを待つ。

共通の原案は白い翼＋輪のマスター。実物の印刷配置参照は選定グレープ版で、前面パネルに対してマーク幅約45%、中心(u=0.50,v=0.185)を目標とする。初回候補と修正前比較は全て保持し、生成ツールでサイズ/位置を修正した。透視投影と生成結果を実測し、ピクセル同一とは表現しない。

比較は `comparison-v2-af-vs-v3-angel.png` と `index.html`。3箱はmanifest.jsonのitems.outputを参照し、共通原案は `originals/canonical-white-angel-mark.png`。白い透過マークの確認用に `qa/canonical-on-dark-preview.png` も保存する。HMDは今回の比較/生成対象に含めていない。

実プロンプトは `prompts.json` / `correction-prompts.json` / `alignment-prompts.json` / `position-prompt.json`、元出力と保存先は `generation-records.json`、ID・正規化パネル・参照元は `manifest.json`。v2の公式写真参照記録は文脈として維持し、新しい白いマークは独立したオリジナル。メーカー写真は追加しない。

`build_review.py` は比較専用の配置と測定だけを行い、原画を変更しない。`mark-measurements.json` は手動で見た前面の4隅から近似的に正面化して白いマークを測る。前面幾何は厳密なCAD寸法ではなく、しきい値による輪郭IoUも完全同一の証明ではない。微細な輪郭/素材テクスチャ/余白の差は生成に残り得る。

PNGの実復号・RGBA/alpha・SHA256・旧資産不変は `validation.json` に記録する。元出力の微小alphaノイズを残したままの代表比較であり、production-readyな透過端処理とはしない。本編のコード/配信/dataには触れていないため、ゲームテストを不要に再実行しない。通常CIは新pushのheadへ別途動く。

次は人による白い天使マークと3箱の方向性レビュー。量産・本編接続・旧案削除・merge/公開・claim releaseはしない。
