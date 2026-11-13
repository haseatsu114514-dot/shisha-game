# ひより・レース衣装と学生時代

オーナーが「今のレースブラウス案」を選択。現在の正本はピンクブラウンのポニーテール、白〜アイボリーのフレンチスリーブ・レースブラウス、黒パンツ、名札なし。伏し目と小さな微笑みで儚さを表す。学生時代はミディアムヘアと黒Tシャツ・エプロン、元気な笑顔。

`generation.json` にbuilt-in image_genの指示、生成ファイル名、原画SHA-256を保存。各 `*-source.png` は1024×1536の生成元を改変せず保存。ユーザー添付の服装写真は服の形だけの参考で、人物の顔やベージュのパンツは採用していない。

全6枚に共通のunion bboxと倍率を使用し、896×1200へ配置（上下20pxの余白）。`tools/normalize_sprites.py` のRGBAコピーを使い、アルファの二乗を修正。元の透明度を閾値削除せず保持。足元アンカー整列のdry-runは変更0枚。配布WebPはlossless/exactでPNGとのRGBA比較が全6枚一致。runtimeは `assets/sprites/characters/hiyori/`、顔アイコンは `assets/ui/face_icons/face_hiyori.png`。

本編で使用する表情はnormal/sad/smile/surprise/tears/student_smile。後半・別衣装の表情は未制作。[本編の接続仕様](../../../docs/spec/hiyori_implementation.md)、[PC／スマホの確認](../../hiyori-encounters-20261011/README.md)。
