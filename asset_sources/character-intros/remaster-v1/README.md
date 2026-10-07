# 再制作した4人の登場カットイン

最新指示CI10「立ち絵を重ねる感じ」「立ち絵は作ったやつ」「ダンガンロンパ風にシンプルでスタイリッシュに」に合わせ、人物は再描画せず、制作済みのPNGをそのまま重ねた。白黒・斜めの帯・大きな名前・少量の差し色で構成した。

[4人の比較](comparison.png)

| キャラ | 完成プレビュー | 使用した立ち絵 |
|---|---|---|
| はじめ | [1280×720](hajime/preview.png) | 通常 `normal` |
| アダム | [1280×720](adam/preview.png) | 熱意 `intense` |
| なる | [1280×720](naru/preview.png) | 笑顔 `smile` |
| チャコール博士 | [1280×720](dr_kemuri/preview.png) | 笑顔 `smile` |

人物の実PNGは `references/` にバイト一致でコピー。出典・SHA-256は [provenance.json](references/provenance.json) と [characters.json](characters.json)。PR #201で制作した素材はPR #204でもmainへ保存済み。顔・髪・服の塗り直し、色調補正、画像フィルタや別の体との合成はなく、全体の拡縮と配置だけを行っている。

文字はゲームと同じ **Zen Kaku Gothic New** の1書体。大きな呼び名の下に、別の本名がある場合だけ小さく（）を付け、ふりがなは表示しない。アダム・なる・博士の二つ名と一言は `data/characters.json` の既存 `intro_cutin` を使用。はじめには既存の登場データがないため「tonariの新人」と、実際の会話にある夢を短くした「いつか自分の店を持ちたい」を紹介文の案として表示する。ゲームの台詞や人物設定は変更していない。

編集可能な [HTML](index.html)・[CSS](style.css)・[文字と配置](characters.json) を保存。リポジトリをHTTP配信し、`index.html?character=hajime`（`adam`・`naru`・`dr_kemuri`）で各人を表示する。外部フォントや画像生成サービスへの接続は不要。

プレビューの再書き出しは、Playwright・Python3・Chromiumがある環境で `node asset_sources/character-intros/remaster-v1/render-preview.cjs`。`CHROME_EXECUTABLE_PATH` でChromiumのパスを指定できる。文字のはみ出し・画像読み込み・ブラウザエラーを同時に確認し、結果は [render-validation.json](render-validation.json)。

ゲーム内の初登場演出のコード・PNG／WebP・manifestは変更していない。成果物は紹介画面の確認用画像と編集元。最初に作った描画入りの案は、最新指示で未使用となった履歴として `unused-generated/` に保存している。
