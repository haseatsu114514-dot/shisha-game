# Issue #3802　はじめのCG再生成候補

Draft PR [#4079](https://github.com/haseatsu114514-dot/shisha-game/pull/4079)

Codex 画像生成で元絵を構図・画風の参照にして、7点をそれぞれ全体から描き直した。はじめの顔と髪は現行の立ち絵に合わせた。部分編集を行った [PR #4072](https://github.com/haseatsu114514-dot/shisha-game/pull/4072) とは別の候補。

比較図は左が元絵、右が候補。下に全16コマのはじめの首元を各コマごとに拡大した。全コマで鎖・ドッグタグがなく、みんととあげはの首飾り、リュウジのネクタイを確認した。

| CG | 生成寸法 → 納品寸法（px） | 比較図 | 元絵と見比べた差異 |
| --- | --- | --- | --- |
| [cg_minto_cheki](cg_minto_cheki-regen.png) | 1672×941 → 1920×1080 | [みんとのチェキ](cg_minto_cheki-comparison.png) | みんとのピース、緑のハート付きチョーカー、胸のリボンを維持。はじめの顔の傾きと笑み、店奥の小瓶の並びに差がある。 |
| [cg_minto_confession](cg_minto_confession-regen.png) | 1672×941 → 1672×941 | [みんとの告白](cg_minto_confession-comparison.png) | みんとは左のはじめの袖を両手でつかみ、見上げている。指の角度と対岸の灯りの位置が変わった。私服の緑のペンダントとバッグのチャームが見える。 |
| [cg_ryuji_purikura](cg_ryuji_purikura-regen.png) | 1024×1535 → 1024×1536 | [リュウジとのプリクラ](cg_ryuji_purikura-comparison.png) | 4コマともリュウジが左。右上の両手ハート、右下の笑顔、紫のネクタイを維持。手の位置や見出しの改行、周囲のシールの間隔に差がある。 |
| [cg_ageha_first_purikura](cg_ageha_first_purikura-regen.png) | 1025×1534 → 1024×1536 | [あげはとの初プリ](cg_ageha_first_purikura-comparison.png) | 4コマともあげはが左。右上の指さしと左下の頬に指を添えるポーズを維持。指の向き、文字の大きさ、ハートの配置に差がある。 |
| [cg_ch2_ageha_purikura_strip](cg_ch2_ageha_purikura_strip-regen.png) | 966×1629 → 640×1080 | [あげはのプリクラ帯・通常](cg_ch2_ageha_purikura_strip-comparison.png) | 上下ともはじめが左。上段のあげはのピース、下段の開いた口と指ハートを維持。はじめの襟のかかり方とパーカーの紐の見え方が変わった。 |
| [cg_ch2_ageha_purikura_strip_gal](cg_ch2_ageha_purikura_strip_gal-regen.png) | 966×1628 → 640×1080 | [あげはのプリクラ帯・ギャル](cg_ch2_ageha_purikura_strip_gal-comparison.png) | 下段はあげはが左でウインク、はじめは右で目を閉じて笑う。金色の光と濃いピンクの帯を維持。下段の顔の寄り方とクマシールの形に差がある。 |
| [cg_ch2_ageha_purikura_strip_soft](cg_ch2_ageha_purikura_strip_soft-regen.png) | 966×1629 → 640×1080 | [あげはのプリクラ帯・ソフト](cg_ch2_ageha_purikura_strip_soft-comparison.png) | 淡いピンクの帯と、下段で二人が目を開けてほほ笑む表情を維持。下段のはじめの髪のかかり方、あげはの指ハートと下端の飾りの位置に差がある。 |

寸法が異なる6点は画面全体を Lanczos で元絵の幅・高さにリサイズした。切り抜きや余白の追加はしていない。表情やポーズに場面の意味が変わるほどの差は見られなかった。

作業前に指定 worktree 内で 307,200 バイトのファイルをコピーし、内容の一致を確認。成果物は候補用PNG 7点と比較図7点。配信用PNG・WebPには変更なし。

次の手順はオーナーによる候補選定。
