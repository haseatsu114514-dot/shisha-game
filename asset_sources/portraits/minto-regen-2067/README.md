# #2067 みんと立ち絵10表情 再生成記録

- 実施: Grok Bot（OpenAI Images API `/v1/images/edits`、モデル `gpt-image-2.5-sunburst`）
- 参照画像: 各表情の再生成前スプライト（origin/main の `assets/sprites/characters/minto/chr_minto_<face>.png`）
- 設定・プロンプト: `prompt.txt` / 生成: `gen.py` / 配置: `fit.py`
- `raw/`: API出力（1024x1536 RGBA）。全10表情 v1 を採用（リトライなし）。
- 配置: アルファ>40 の外接矩形で切り出し、旧スプライトと同じ高さ・上端・アルファ重心xに合わせて 896x1200 透過へ配置。
- 表情の対応: 営業(コンカフェ) normal/smile/sad/surprise/wink、素(私服) ura_normal/ura_smile/ura_sad/ura_surprise/ura_smug
- 置き換え: Draft PR #1225・#1174（オーナー判断で10表情全再生成に変更）
