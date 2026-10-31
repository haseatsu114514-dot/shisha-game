# パッキーのホースをシーシャのホースへ（#2064）
旧: 金色の蛇腹カプラー＋黒いゴム先端（マイク風）と紺の蛇腹ケーブル。
新: 真鍮のテーパー状マウスピースハンドル（木のグリップ・細い吸い口）＋金属コネクタ＋紺の滑らかなシリコンホース。
gpt-image-2.5-sunburst の image edit で各表情の現行画像を参照（normal を先に作り、他表情は追加参照）。place.py で normal の高さ・上端・中心に合わせて 896×1200 に配置。face_pakki は新 normal を追加参照に編集して 160×160 へ縮小。
`python3 gen.py normal angry ...` / `python3 place.py raw.png chr_pakki_normal.png out.png`
