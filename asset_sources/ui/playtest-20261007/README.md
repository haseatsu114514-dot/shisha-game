# 煙模様だけを外した能力・回復通知

2026-10-07、PF01/PF16の「煙以外は気に入っていたので元のデザインへ戻す」という指示に合わせて制作。

- 参照原型: `assets/ui/lounge/reward.png`（2172×724 RGBA）。生成前に実画像を確認。
- 採用素材: `assets/ui/lounge/reward-clean.png`（2172×724 RGBA）。image_genで原型を編集し、生成結果をそのまま保存した。
- 指示: charcoalの面にある白い煙・渦だけを取り除く。元の銀色の二重縁、小さな角、横長の形、細かな質感、透明な外側を保持。文字・アイコン・新しい飾りは追加しない。
- 実行素材: `remake/img/ui/lounge/reward-clean.webp`（800×202）。`remake/tools/build_ui_skin.py`で原型と同じ余白の切り出しと縮小を行う。
- 実装: 元のluminosity着色、5色、漢字バッジの枠を復元。体力カードも同じ煙なし素材を使う。ゲージの割合と色はHUDに追従する。

`remake/test/ui_skin.mjs`と`remake/test/playtest_ui.mjs`で素材の読み込み・5色・ゲージ・連続変化・ロードを確認する。
