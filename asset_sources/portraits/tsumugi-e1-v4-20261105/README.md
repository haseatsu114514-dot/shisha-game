# つむぎ E1 v4

ユーザーが実会話UIで現行と比較し選定した7表情。旧画像を保持し、設定の新版で表示する。新版0.90、旧版0.88。ピアスなし、控えめな笑顔と眉、固定カメラ・中間程度の傷。会釈は選定された現案の腕位置を保持。

`generated-*-untouched.png` は正規画像生成ツールの未加工出力。`finished-*-source.png` は承認された背面・共通体と表情を合わせた高解像度原画。参照の役割、生成条件、共通体合成・正規化は `production-review.json`、採用検品は `adoption-review.json`。英語定型の7頭身は小柄キャラの5.8頭身指定で上書きしている。

全7枚に同じ縮小・配置を適用し896×1200 RGBAに正規化。余白とアンカーは新絵から再計測。配信用WebPは `python3 remake/tools/build_manifest.py --portrait-variants-only tsumugi` で再生成する。
