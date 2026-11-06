import { imgFileUrl } from "./img-file.js";

// ロード画面（作業台に入るとき）に出る2コマ漫画の登録。仕様: docs/spec/loading_screen_and_comics.md、
// 制作規格: asset_sources/loading-comics/README.md。
//
// 形式:
//   id / title / minChapter（必須）, contexts?（省略時はどこでも）, note?（素材台帳メモ）, caption?（コマの下の一行解説）
//   cast     : 出てくるキャラの id（はじめ以外。data/characters.json の id）。全員と「会った」後にだけ出る。
//              会ったかどうかは core/title-art-unlock.js の hasMetCharacter（state.met と等価の既存記録）で判定する。
//   panels[2]: { src, alt, region?, bubbles? }（region は原画シートの一部を切り出すとき。現在の登録は使っていない）
// 新規の話は 1536x1024 の下敷きで描き、tools/loading_comic_cut.py で 1コマ=1ファイル（3:2・最大 1440x960 の WebP）に
// 揃え、紙色の余白は fill で埋める。ネタバレになる話は minChapter で明かす章まで待たせる（シガーマンの2話は第4章から）。
// 2026-11-02 オーナーの選別（102話から採用25話、全キャラ参戦34話から採用4話、補充の1回目から5話・2回目から3話）。1キャラ2話を超えた採用分は保留で残し、
// どれをゲームに入れるかは最後にオーナーが決める（asset_sources/loading-comics/batch-allcast-refill-20261102/README.md）。画風の統一は後日の作り直しで行い、今は元の絵で登録している。
export const LOADING_COMICS = [
  {
    id: "sumi-cold-tea",
    title: "冷めた紅茶",
    cast: ["sumi"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2258:sumi-cold-tea）",
    caption: "シーシャの話になると、時間を忘れる二人。",
    panels: [
      { src: imgFileUrl("loading/sumi-cold-tea-1.webp"), alt: "左: はじめが冷めた紅茶を見て「お茶、冷めました。」。右のスミさんは頬杖で「話しすぎたな。」。" },
      { src: imgFileUrl("loading/sumi-cold-tea-2.webp"), alt: "スミさんが指を立てて楽しそうに話を続け、はじめはノートを開く。はじめ「話はまだ熱い。」。" },
    ],
  },
  {
    id: "sumi-cloth-fold",
    title: "畳みの極意",
    cast: ["sumi"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2229:sumi-cloth-fold（復刻一覧の restored-44 と同じ画像））",
    caption: "掃除のあと、ふきんを畳む練習をしていたら。",
    panels: [
      { src: imgFileUrl("loading/sumi-cloth-fold-1.webp"), alt: "左: はじめが清潔な白いふきんを持ち「畳み方は？」。スミさんが「角をそろえろ。」。" },
      { src: imgFileUrl("loading/sumi-cloth-fold-2.webp"), alt: "はじめが折り紙の鶴そっくりに畳んだ白ふきんを手にして困惑「鶴になった。」。スミさんは無言で眼鏡をずらし驚く。布の鶴は飛ばない。" },
    ],
  },
  {
    id: "sweet-unit",
    title: "甘さのものさし",
    cast: ["naru"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2246:sweet-unit）",
    caption: "なるは、甘さをお菓子で考える作り手です。",
    panels: [
      { src: imgFileUrl("loading/sweet-unit-1.webp"), alt: "左: はじめがメニューを持って「甘さ控えめで。」。右のなるが考えて「ケーキなら何口？」。" },
      { src: imgFileUrl("loading/sweet-unit-2.webp"), alt: "なるがショートケーキの一切れとフォークを示して好みを確かめる。はじめは苦笑いで「単位が独特。」。" },
    ],
  },
  {
    id: "adam-key-ring",
    title: "鍵より目印",
    cast: ["adam"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2258:adam-key-ring）",
    caption: "アダムは、よく鍵をなくします。",
    panels: [
      { src: imgFileUrl("loading/adam-key-ring-1.webp"), alt: "左: はじめが「鍵、見つかります？」。右のアダムが鞄から小さな鍵をつまんで「目印がある。」。" },
      { src: imgFileUrl("loading/adam-key-ring-2.webp"), alt: "鍵には本物ほど大きなリンゴのキーホルダーが二つ。アダムの手が重さで下がり、はじめが驚いて「目印が重すぎる。」。" },
    ],
  },
  {
    id: "mint-ranking",
    title: "人気の一位",
    cast: ["minto"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2246:mint-ranking）",
    caption: "ぺぱーみんとのキャストは、みんと一人です。",
    panels: [
      { src: imgFileUrl("loading/mint-ranking-1.webp"), alt: "左: はじめがメニューを見て「人気一位は？」。右のみんとが自分を指して「みんとです♡」。" },
      { src: imgFileUrl("loading/mint-ranking-2.webp"), alt: "みんとはウインク。はじめがメニューのミントとチョコの絵を指して「味の方です。」。" },
    ],
  },
  {
    id: "mint-service",
    title: "甘さの接客",
    cast: ["minto"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2246:mint-service）",
    caption: "みんとの店は、接客も楽しみのひとつ。",
    panels: [
      { src: imgFileUrl("loading/mint-service-1.webp"), alt: "右のみんとが味のメニューを見せて「甘さ、足します？」。左のはじめが少し照れて「味の話ですよね？」。" },
      { src: imgFileUrl("loading/mint-service-2.webp"), alt: "みんとが頬に指を当てて営業スマイルで「接客も甘め♡」。はじめは照れ笑い。" },
    ],
  },
  {
    id: "cake-apology",
    title: "反省の向き",
    cast: ["naru"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2246:cake-apology）",
    caption: "失敗したお菓子にも、なるは誠実です。",
    panels: [
      { src: imgFileUrl("loading/cake-apology-1.webp"), alt: "なるがしぼんだスポンジケーキを前に「失敗した。」。左のはじめが「次がありますよ。」と励ます。" },
      { src: imgFileUrl("loading/cake-apology-2.webp"), alt: "なるがスポンジケーキに向かって深々と頭を下げている。はじめ「謝る先そっち？」。" },
    ],
  },
  {
    id: "adam-photo-album",
    title: "写真の主役",
    cast: ["adam"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2258:adam-photo-album）",
    caption: "アダムの旅行の思い出は、いつも同じ主役。",
    panels: [
      { src: imgFileUrl("loading/adam-photo-album-1.webp"), alt: "左: はじめがアダムのアルバムをのぞいて「旅行の写真です？」。右のアダムが満足げに「いい記録だ。」。" },
      { src: imgFileUrl("loading/adam-photo-album-2.webp"), alt: "開いたアルバムの写真は、山も海も赤リンゴと青リンゴが主役。はじめ「全部リンゴだ。」。" },
    ],
  },
  {
    id: "restored-01",
    title: "店、間違えた？",
    cast: ["kumicho"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-01）",
    caption: "強面の店主・りゅうじの店は、ちゃんとシーシャ屋です。",
    panels: [
      { src: imgFileUrl("loading/restored-01-1.webp"), alt: "重い扉を開けたはじめ「店、間違えた……」。白いチェックのスーツにサングラスのりゅうじが「苦手なもんはあるか。」。はじめ「えっ。」。" },
      { src: imgFileUrl("loading/restored-01-2.webp"), alt: "りゅうじが果物の絵のメニューを広げて「フレーバーの話だ。」。はじめはほっとして「シーシャ屋だ……」。りゅうじ「ゆっくりしてけ。」。" },
    ],
  },
  {
    id: "restored-02",
    title: "兄弟でも別",
    cast: ["kumicho"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-02）",
    caption: "吸い口は、一人ひとつが決まりです。",
    panels: [
      { src: imgFileUrl("loading/restored-02-1.webp"), alt: "りゅうじが重々しく小箱を差し出して「兄弟の盃だ。」。はじめは驚いている。" },
      { src: imgFileUrl("loading/restored-02-2.webp"), alt: "箱の中には個包装の吸い口が二本。りゅうじ「吸い口は別な。」。はじめが笑って「そこは徹底。」。" },
    ],
  },
  {
    id: "restored-05",
    title: "噂の本人",
    cast: ["kumicho", "mashiro"],
    contexts: ["craft"],
    minChapter: 4,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-05）",
    caption: "噂の「シガーマン」の正体は、本人だけが知らない。",
    panels: [
      { src: imgFileUrl("loading/restored-05-1.webp"), alt: "りゅうじが黒い煙の化け物を思い浮かべながら「シガーマン……化け物だ。」。はじめは聞き入っている。" },
      { src: imgFileUrl("loading/restored-05-2.webp"), alt: "明るい喫茶店で、ましろが紅茶を手に震えて「こわいねぇ……」。ましろに「本人」の札が向いている。はじめ「……」。" },
    ],
  },
  {
    id: "restored-08",
    title: "人気ナンバーワン",
    cast: ["minto"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-08）",
    caption: "ぺぱーみんとの持ちネタ、「人気No.1」。",
    panels: [
      { src: imgFileUrl("loading/restored-08-1.webp"), alt: "みんとが「人気No.1」の自分のポスターの前で「人気No.1♡」。はじめは感心して「おぉ…！」。" },
      { src: imgFileUrl("loading/restored-08-2.webp"), alt: "キャスト紹介の壁には、みんとの写真が一枚だけ。はじめ「ほかのキャストは？」。みんとがウインクして「みんと♡」。" },
    ],
  },
  {
    id: "restored-12",
    title: "香りの感想",
    cast: ["rio"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-12）",
    caption: "香りの感想を言葉にするのは、意外とむずかしい。",
    panels: [
      { src: imgFileUrl("loading/restored-12-1.webp"), alt: "凛想がクリップボードとペンを差し出して「正直に書いてね。」。はじめは真剣に考えている。" },
      { src: imgFileUrl("loading/restored-12-2.webp"), alt: "はじめが見せた紙には大きく「いい匂い」の一言。凛想が頬杖をついて「語彙も貸そうか。」。" },
    ],
  },
  {
    id: "restored-13",
    title: "サメ映画",
    cast: ["samechan"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-13）",
    caption: "サメちゃんは、サメ映画の時だけ少し強がり。",
    panels: [
      { src: imgFileUrl("loading/restored-13-1.webp"), alt: "ソファでサメ映画を見ながら、サメちゃんが王冠のサメのぬいぐるみを抱いて「怖くないのじゃ。」。隣のはじめはポップコーンを持って笑顔。" },
      { src: imgFileUrl("loading/restored-13-2.webp"), alt: "サメちゃんはぬいぐるみで目を隠して震えている。「側近よ、目を開けろ。」。はじめは目を閉じたまま笑っている。" },
    ],
  },
  {
    id: "restored-15",
    title: "本日の一杯",
    cast: ["mukai_master"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-15）",
    caption: "ムカイさんは、渋い見た目で甘いもの好き。",
    panels: [
      { src: imgFileUrl("loading/restored-15-1.webp"), alt: "帽子を目深にかぶったムカイさんが渋く「いつものを。」。注文を取るはじめ「はい。」。" },
      { src: imgFileUrl("loading/restored-15-2.webp"), alt: "出てきたのはクマの顔のラテアート。ムカイさん「耳、大きめで。」。はじめはにこにこしている。" },
    ],
  },
  {
    id: "restored-17",
    title: "似顔絵",
    cast: ["tsumugi"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-17）",
    caption: "つむぎの絵には、いつも少し遊び心があります。",
    panels: [
      { src: imgFileUrl("loading/restored-17-1.webp"), alt: "タブレットで絵を描くつむぎに、はじめが身を乗り出して「俺も描いて。」。" },
      { src: imgFileUrl("loading/restored-17-2.webp"), alt: "つむぎが見せた絵は、はじめの帽子とパーカーの猫。はじめ「猫になった。」。つむぎ「似てます。」。" },
    ],
  },
  {
    id: "restored-18",
    title: "儚い仕事人",
    cast: ["hiyori"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-18）",
    caption: "ひよりは、弱音を吐きながらも仕事が速い。",
    panels: [
      { src: imgFileUrl("loading/restored-18-1.webp"), alt: "ノートパソコンの前で、ひよりが頬杖をついて「私、壊れてしまいそう……」。はじめは心配そう。" },
      { src: imgFileUrl("loading/restored-18-2.webp"), alt: "画面には「議事録」「経費」「引継ぎ」がすべて済みの印。ひより「全部、送信しました。」。はじめ「仕事は速い。」。" },
    ],
  },
  {
    id: "restored-19",
    title: "見学だけ",
    cast: ["sai"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-19）",
    caption: "ボードゲームカフェの部活は、気づけば始まっています。",
    panels: [
      { src: imgFileUrl("loading/restored-19-1.webp"), alt: "ボードゲームカフェで、サイが穏やかに「見学だけでも。」。はじめ「はい！」。" },
      { src: imgFileUrl("loading/restored-19-2.webp"), alt: "はじめはいつの間にか「部長」の腕章をつけ、ゲームの箱を抱えている。サイ「では、部長。」。はじめ「いつの間に？」。" },
    ],
  },
  {
    id: "restored-21",
    title: "苦手なもの",
    cast: ["kumicho"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-21）",
    caption: "りゅうじは、客の苦手を絶対に出しません。",
    panels: [
      { src: imgFileUrl("loading/restored-21-1.webp"), alt: "はじめがりゅうじに「ミント、苦手で。」。りゅうじは手帳に書き留めている。" },
      { src: imgFileUrl("loading/restored-21-2.webp"), alt: "店に「ミント出禁」の札。りゅうじが判を押して「徹底する。」。はじめ「国家？」。" },
    ],
  },
  {
    id: "restored-26",
    title: "永久指名",
    cast: ["adam"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-26）",
    caption: "アダムのダブルアップル愛は、一生ものです。",
    panels: [
      { src: imgFileUrl("loading/restored-26-1.webp"), alt: "アダムが改まって招待状を差し出し「大事な報告だ。」。はじめは身構えている。" },
      { src: imgFileUrl("loading/restored-26-2.webp"), alt: "結婚式場で、タキシードのアダムが赤リンゴと青リンゴに「生涯、これだけ。」。はじめ「相手、味？」。" },
    ],
  },
  {
    id: "restored-29",
    title: "総選挙",
    cast: ["minto"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-29）",
    caption: "ぺぱーみんとの総選挙は、毎回大接戦。",
    panels: [
      { src: imgFileUrl("loading/restored-29-1.webp"), alt: "みんとが投票用紙を差し出して「総選挙だよ♡」。はじめは用紙を見ている。" },
      { src: imgFileUrl("loading/restored-29-2.webp"), alt: "会場のポスターも候補も全部みんと。壇上のみんと「接戦でした♡」。客席のはじめ「相手、誰？」。" },
    ],
  },
  {
    id: "restored-32",
    title: "あと一匹",
    cast: ["ageha"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-32）",
    caption: "あげはのぬいぐるみ集めは、止まりません。",
    panels: [
      { src: imgFileUrl("loading/restored-32-1.webp"), alt: "ぬいぐるみに囲まれた店で、あげはがピンクのクマを抱いて「あと一匹だけ♡」。はじめは困り顔。" },
      { src: imgFileUrl("loading/restored-32-2.webp"), alt: "店がクマのぬいぐるみで埋まっている。はじめ「店がクマ。」。" },
    ],
  },
  {
    id: "restored-33",
    title: "対策本部",
    cast: ["kumicho", "mashiro"],
    contexts: ["craft"],
    minChapter: 4,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-33）",
    caption: "シガーマン対策会議に、思わぬ参加者。",
    panels: [
      { src: imgFileUrl("loading/restored-33-1.webp"), alt: "りゅうじが黒い影の絵を指して「対策会議だ。」。はじめは真剣に聞いている。" },
      { src: imgFileUrl("loading/restored-33-2.webp"), alt: "「シガーマン対策本部」に、怖がるましろが「僕も怖いよ〜。」。りゅうじ「先生、お願いします。」。ましろに「本人」の札が向いている。" },
    ],
  },
  {
    id: "restored-38",
    title: "月曜の香り",
    cast: ["rio"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-38）",
    caption: "凛想の香りの問題は、ときどき意地悪です。",
    panels: [
      { src: imgFileUrl("loading/restored-38-1.webp"), alt: "凛想が細い試香紙を差し出して「何の香り？」。はじめは香りを確かめている。" },
      { src: imgFileUrl("loading/restored-38-2.webp"), alt: "香りから月曜の会社の景色が浮かぶ。はじめ「月曜。」。凛想「正解。」。" },
    ],
  },
  {
    id: "restored-39",
    title: "少しだけ",
    cast: ["naru"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2263:restored-39）",
    caption: "なるは、聞かれたら全部教えてくれる人。",
    panels: [
      { src: imgFileUrl("loading/restored-39-1.webp"), alt: "はじめがなるに「少しだけ教えて。」。なるがうれしそうにノートを開く。" },
      { src: imgFileUrl("loading/restored-39-2.webp"), alt: "大学の講義室で、角帽のなるが黒板の前に立つ「ノート、持った？」。学生席のはじめ「入学してる。」。" },
    ],
  },
  {
    id: "wang-lychee",
    title: "ライチの皮",
    cast: ["master_hookah"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2374:allcast-wang-lychee）",
    caption: "王煙楼の得意な味は、ライチ。",
    panels: [
      { src: imgFileUrl("loading/wang-lychee-1.webp"), alt: "王煙楼がライチを一つはじめに差し出して「むいてごらん。」。はじめは「はい。」と受け取る。" },
      { src: imgFileUrl("loading/wang-lychee-2.webp"), alt: "はじめが一つ目に苦戦している横で、王煙楼の前の器にはむき終えたライチが山盛り。はじめ「手元が速すぎる。」。" },
    ],
  },
  {
    id: "sui-stamp-card",
    title: "会長の名刺",
    cast: ["sui"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2374:allcast-sui-stamp-card）",
    caption: "C.STATIONは、誰でも入りやすい店です。",
    panels: [
      { src: imgFileUrl("loading/sui-stamp-card-1.webp"), alt: "黒いスーツの須井が、名刺のような紙を差し出して「須井だ。」。はじめは緊張して受け取り「会長さん……」。" },
      { src: imgFileUrl("loading/sui-stamp-card-2.webp"), alt: "はじめが受け取った紙は、マスが並んだスタンプカード。須井は真顔のまま。はじめ「スタンプカードだ。」。" },
    ],
  },
  {
    id: "sheikh-traveler",
    title: "旅の人",
    cast: ["sheikh"],
    contexts: ["craft"],
    minChapter: 4,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2374:allcast-sheikh-traveler）",
    caption: "ドバイで会った旅人は、実は。",
    panels: [
      { src: imgFileUrl("loading/sheikh-traveler-1.webp"), alt: "異国の路地で、茶色いフードの外套の男にはじめが「旅の人ですか？」。男は落ち着いて「ただの旅人だ。」。" },
      { src: imgFileUrl("loading/sheikh-traveler-2.webp"), alt: "外套がめくれ、白と金の豪華な民族衣装が丸見えになる。はじめが指さして「隠しきれてない。」。" },
    ],
  },
  {
    id: "dasilva-festa-break",
    title: "休憩もフェスタ",
    cast: ["da_silva"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2374:allcast-dasilva-festa-break）",
    caption: "太陽にとっては、何でもお祭り。",
    panels: [
      { src: imgFileUrl("loading/dasilva-festa-break-1.webp"), alt: "疲れたはじめがソファで「少し休憩を。」。花柄シャツのダ・シルヴァが両腕を広げて「休憩もフェスタだ！」。" },
      { src: imgFileUrl("loading/dasilva-festa-break-2.webp"), alt: "マラカス・紙吹雪・果物の山で大騒ぎになり、ダ・シルヴァはマラカスを振る。はじめ「休めない。」。" },
    ],
  },
  {
    id: "sui-long-review",
    title: "一言の講評",
    cast: ["sui"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2399:allcast-sui-long-review）",
    caption: "審査員長の須井会長は、口数より感想が多い人。",
    panels: [
      { src: imgFileUrl("loading/sui-long-review-1.webp"), alt: "店のカウンターで、はじめが紅茶とお菓子を前に「感想、ください。」。腕を組んだ須井が「一言で済む。」。" },
      { src: imgFileUrl("loading/sui-long-review-2.webp"), alt: "須井が巻物を広げると、講評の紙が店の奥まで長く続き、はじめはその紙にぐるぐる巻きにされている。はじめ「一言じゃない。」。" },
    ],
  },
  {
    id: "sheikh-camel-gift",
    title: "みかんのお礼",
    cast: ["sheikh"],
    contexts: ["craft"],
    minChapter: 4,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2399:allcast-sheikh-camel-gift）",
    caption: "シェイクの好きな味はぶどう。お礼も王様の大きさ。",
    panels: [
      { src: imgFileUrl("loading/sheikh-camel-gift-1.webp"), alt: "異国の街角で、はじめがみかんを一つ差し出して「みかん、どうぞ。」。白い民族衣装のシェイクが胸に手を当てて「礼をしよう。」。" },
      { src: imgFileUrl("loading/sheikh-camel-gift-2.webp"), alt: "シェイクがみかんを手に、ぶどうの大きなかごを両脇に積んだラクダの手綱をはじめに渡している。はじめ「お返しが大きい。」。" },
    ],
  },
  {
    id: "uranaishi-kotatsu",
    title: "机の正体",
    cast: ["uranaishi"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2399:allcast-uranaishi-kotatsu）",
    caption: "路上の占い師は、冬でも同じ机で待っている。",
    panels: [
      { src: imgFileUrl("loading/uranaishi-kotatsu-1.webp"), alt: "雪の降る路地で、マフラー姿のはじめが震えながら「寒くないですか？」。フードの占い師が占いの机の前で「ヒヒ、平気さ。」。" },
      { src: imgFileUrl("loading/uranaishi-kotatsu-2.webp"), alt: "はじめが机の布をめくると、中はこたつ。占い師はみかんを横にお茶を飲んでいる。はじめ「こたつだった。」。" },
    ],
  },
  {
    id: "uranaishi-beach",
    title: "海にも出店",
    cast: ["uranaishi"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2399:allcast-uranaishi-beach）",
    caption: "路上の占い師は、なぜか思わぬ所にも現れる。",
    panels: [
      { src: imgFileUrl("loading/uranaishi-beach-1.webp"), alt: "路地の占いの机で、浮き輪を持ったはじめが「明日から海です！」。フードの占い師が頬杖で「ヒヒ、いいねえ。」。" },
      { src: imgFileUrl("loading/uranaishi-beach-2.webp"), alt: "翌日の砂浜。水着で浮き輪を持つはじめの横に、パラソルの下で占いの机を出した占い師がいる。はじめ「海にもいる。」。" },
    ],
  },
  {
    id: "samechan-watermelon-bite",
    title: "スイカの一口",
    cast: ["samechan"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2399:allcast-samechan-watermelon-bite）",
    caption: "サメちゃんは、笑うとギザ歯が見える店主です。",
    panels: [
      { src: imgFileUrl("loading/samechan-watermelon-bite-1.webp"), alt: "海辺の店で、はじめが丸ごとのスイカを抱えて「スイカ、切ります？」。サメのパペットを持ったサメちゃんが「そのままでよいのじゃ。」。" },
      { src: imgFileUrl("loading/samechan-watermelon-bite-2.webp"), alt: "スイカにサメの歯型そのままのギザギザの大きなかじり跡。サメちゃんは満足げにもぐもぐしている。はじめ「歯型がサメだ。」。" },
    ],
  },
  {
    id: "saku-every-order",
    title: "注文当て",
    cast: ["saku"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2407:allcast-saku-every-order）",
    caption: "綾取は客の好みを予想するのが好き。ときどき、ずるい。",
    panels: [
      { src: imgFileUrl("loading/saku-every-order-1.webp"), alt: "店のカウンターで、綾取が指を立てて「注文、当ててみせる。」。メニューを持ったはじめが「じゃあ、どうぞ。」。" },
      { src: imgFileUrl("loading/saku-every-order-2.webp"), alt: "カウンターいっぱいに、紅茶・コーヒー・ジュース・ソーダの飲み物がずらりと並び、綾取はピースして得意げ。はじめ「全部出てきた。」。" },
    ],
  },
  {
    id: "saku-photo-face",
    title: "記念写真",
    cast: ["saku"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2407:allcast-saku-photo-face）",
    caption: "片側だけ上がる綾取の笑顔は、写真だと少し怪しい。",
    panels: [
      { src: imgFileUrl("loading/saku-photo-face-1.webp"), alt: "店の入口の前で、はじめがスマホを構えて「一枚撮りますね。」。綾取がピースして「かわいく頼むよ。」。" },
      { src: imgFileUrl("loading/saku-photo-face-2.webp"), alt: "はじめが見せるスマホの画面には、稲妻を背に悪役のように笑う綾取が写っている。本人はきょとんとしている。はじめ「悪役の顔だ。」。" },
    ],
  },
  {
    id: "ageha-full-coord",
    title: "全身コーデ",
    cast: ["ageha"],
    contexts: ["craft"],
    minChapter: 1,
    note: "番外編のギャグ漫画です。左から右へお読みください。（PR2407:allcast-ageha-full-coord）",
    caption: "あげはは「カワイイは最強」が信条のギャル店長。",
    panels: [
      { src: imgFileUrl("loading/ageha-full-coord-1.webp"), alt: "ピンクの店内で、あげはが服のハンガーを抱えて「コーデしたげる！」。はじめは少し引いて「お手柔らかに。」。" },
      { src: imgFileUrl("loading/ageha-full-coord-2.webp"), alt: "はじめが帽子からズボンまで全身ヒョウ柄、ハートのサングラスに金のチェーンの姿で光の中に立ち、あげはが両手の親指を立てる。はじめ「全身ヒョウ柄。」。" },
    ],
  },
];

/**
 * 純粋関数。いま出せる漫画（章・場面・2コマの形・出てくるキャラ全員と会っているか）を返す。
 * isMet を渡さなければキャラの条件は見ない（プレビュー用）。
 */
export function eligibleLoadingComics(comics, { context = "default", chapter = 1, isMet = null } = {}) {
  return comics.filter(comic => comic && comic.id && comic.title &&
    Number.isInteger(comic.minChapter) && comic.minChapter <= chapter &&
    (!comic.contexts || comic.contexts.includes(context)) &&
    comic.panels?.length === 2 &&
    (!isMet || !Array.isArray(comic.cast) || comic.cast.every(id => isMet(id))));
}
