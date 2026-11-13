# AXQ03 斧投げ画面部品

Codex 組み込み image_gen で原画7枚を生成。`cut-mark.png` は安全判定による3回の出力拒否で欠品。生成プロンプト・参照・寸法・SHA-256・検品は [raw/GENERATION.md](raw/GENERATION.md) に記録。採用理由は、既存の松材・胡桃・黒鉄・真鍮・黒板の素材感に揃い、文字を描かず中央を空けたため。組み込みは Claude 側。

## 組み込み（2026-11-12・Claude）

7枚とも採用（原画は無加工のまま `raw/`）。採用版PNGは `assets/ui/axe_throw/`、表示用WebPは `remake/img/ui/axe_throw/`。どちらも `tools/make_axe_quality_ui.py` で作る（リポジトリの直下で `python3 -I asset_sources/ui/axe-quality-ui-20261111/tools/make_axe_quality_ui.py`）。同じスクリプトが表示用の寸法を `tools/geometry.json` に書く。

| 表示用 | 寸法（倍率） | 使う場所 |
|---|---|---|
| `hud-plate.webp` | 2048×192（原寸） | 上の見出しの板（`.axe-header::before`）。両端の斜めの金具の内側に題字と × が来るよう、見出しの左右の余白を 46px・34px に |
| `score-slot.webp` | 512×192（原寸） | 投げ数の枠（`.axe-tile::after`）と合計点（`.axe-total::before`）。今の投は溝の外を橙に光らせる |
| `chalk-window.webp` | 1152×768（0.75） | 投げた後の結果（`.axe-result-card`）・見守る人の一言（`.axe-side .axe-companion`）・まとめ（まとめの間の `.axe-panel`）。木の縁の内側に字が来るよう、余白を少し広げた |
| `rank-medallion.webp` | 384×384（0.5） | まとめのランクの字の後ろ（84px） |
| `banner-orange.webp` | 1024×256（2/3） | LAST THROW・SWITCH・SUDDEN DEATH（`.axe-declare[data-kind="last"\|"half"]`） |
| `banner-green.webp` | 1024×256（2/3） | CHALLENGE CLEAR（`.axe-declare[data-kind="goal"]`） |
| `wood-chips.webp` | 512×256（0.5） | 刺さった瞬間に飛ぶ破片24片（8種を順に使う。`axe.js` の `CHIPS`）。今までの白と黄の三角の代わり |

- 9分割（`border-image`）の切り位置・縁の幅・外へ出す分は `remake/css/axe-throw.css` の「見出し・枠・黒板の窓・ランク・帯の絵」節に、寸法の出どころと一緒に書いた。
- 7枚とも `axe.js` の `UI_ART` に足し、読み込み中に先に解く（読めなければ今までどおり「もう一度読み込む」）。
- 刃の跡（`cut-mark.png`）は届いていないので、刺さった跡は今の描画のまま。
- 検査: `remake/test/browser/axe_polish.mjs`（見出し・枠・合計点・一言・結果・まとめ・ランク・LAST THROW の帯にどの絵が当たっているか、15枚が最初の投の前に読み込まれていること、動く層の image は木片だけで板の絵は無いこと、帯の字がはみ出さないこと）。
