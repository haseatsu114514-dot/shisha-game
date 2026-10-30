# 占い師 smile — Issue #1433 G2

仮決定（2026-10-30 17:39、オーナー訂正時は差し替え）

Codex の組み込み image_gen.imagegen で1回生成。source.png は未加工原画、prompt.txt は実際に送った最終プロンプト。generation.json に正規化条件と計測を保存。preview.png は明暗背景、compare.png は正本normalとの比較。

参照正本 chr_uranaishi_normal.png は指定sha256と一致するが、顔全体が明るく露出しタロットを持っている。今回の文章指定「顔をフードの陰に隠す・小物なし」と不整合があるため、文章指定を優先し、上顔面を陰に隠しタロットを除いた。ローブ・白髪の三つ編み・配色・体格・立ち位置は正本に合わせた。したがって純粋な口元差分より変更範囲が広い。調整役はこの差異を認識して登録すること。既存normalは変更していない。

最終spriteは ../../../assets/sprites/characters/uranaishi/chr_uranaishi_smile.png 。適用・manifest再生成・テスト修正は調整役が行う。
