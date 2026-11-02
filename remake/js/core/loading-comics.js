import { imgFileUrl } from "./img-file.js";

// Approved for loading screens by the owner's request to use existing repository comics.
// The source sheet stays intact; regions display only episode 25, left -> right.
//
// Comic data format (see docs/spec/loading_screen_and_comics.md):
//   id / title / minChapter (required), contexts? (default: any), note? (素材台帳メモ),
//   caption?  : 初心者向けの一行解説（コマの下に表示。省略可）。
//   panels[2] : { src, alt,
//     region?  : { x, y, width, height, sourceWidth, sourceHeight } で原画の一部を切り出す。
//     bubbles? : [{ text, x, y, width?, fontSize? }] ... 吹き出し画像の上にゲーム内テキストを重ねる
//                （x/y/width は art 枠に対する % 、fontSize は cqw。誤字を直せる差し込み方式）。
//   }
// 制作規格の正本は asset_sources/loading-comics/README.md。新規の話は 1536x1024 の下敷きで描き、
// tools/loading_comic_cut.py で 1コマ=1ファイル（3:2・最大 1440x960 の WebP）に揃えて、region なしで
// 登録する（例: { src: imgFileUrl("loading/<id>-1.webp"), alt }）。下の2本は旧方式（シート＋region）の
// 登録で、作り直し不要（2026-10-29 オーナー決定）。表示枠は 3:2 のままレターボックスで収める。
const src = imgFileUrl("loading/adam-chaos.webp");
const batch1Src = imgFileUrl("loading/loading-batch1.webp");
export const LOADING_COMICS = [{
  id: "adam-menu-25",
  title: "メニュー改訂",
  contexts: ["craft"],
  minChapter: 1,
  note: "番外編のギャグ漫画です。左から右へお読みください。",
  caption: "番外編のギャグ漫画。アダムはリンゴ系の味に目がない。",
  panels: [
    { src, alt: "はじめ「他の味は？」。フルーツメニューを前にアダムが考え込む。",
      region: { x: 14, y: 110, width: 486, height: 307, sourceWidth: 1086, sourceHeight: 1448 } },
    { src, alt: "赤と緑のリンゴで埋まった宇宙。アダム「選び放題だ。」はじめ「どこが。」",
      region: { x: 510, y: 110, width: 565, height: 307, sourceWidth: 1086, sourceHeight: 1448 } },
  ],
}, {
  id: "sumi-charcoal-ear",
  title: "炭の耳",
  contexts: ["craft"],
  minChapter: 1,
  note: "番外編のギャグ漫画です。左から右へお読みください。",
  caption: "番外編のギャグ漫画。スミさんは炭の熾き具合を、音と色で見分ける。",
  panels: [
    { src: batch1Src, alt: "はじめ「炭の温度って、何で測るんですか？」。作業台のボウルにスミさんが耳を寄せている。",
      region: { x: 22, y: 135, width: 510, height: 399, sourceWidth: 1086, sourceHeight: 1448 } },
    { src: batch1Src, alt: "炭箱の中で小さな炭たちが一斉にざわめき、スミさんが真剣にメモを取る。はじめ「議事録とってる！？」",
      region: { x: 545, y: 135, width: 520, height: 399, sourceWidth: 1086, sourceHeight: 1448 } },
  ],
},
{
  "id": "sumi-reserved-seat",
  "title": "予約の正体",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "開店前の椅子を見ていたら、先客がいました。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-reserved-seat-1.webp"),
      "alt": "左: はじめが空の椅子にある小さな膨らみを指して「予約ですか？」。右のスミさんは「先客だ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-reserved-seat-2.webp"),
      "alt": " 椅子の座布団の下で寝ていた丸い三毛猫がふんぞり返り目を開ける。はじめはびっくり、スミさんが「常連の顔だ。」。猫は1匹だけ。"
    }
  ]
},
{
  "id": "sumi-cloth-fold",
  "title": "畳みの極意",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "掃除のあと、ふきんを畳む練習をしていたら。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-cloth-fold-1.webp"),
      "alt": "左: はじめが清潔な白いふきんを持ち「畳み方は？」。スミさんが「角をそろえろ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-cloth-fold-2.webp"),
      "alt": " はじめが折り紙の鶴そっくりに畳んだ白ふきんを手にして困惑「鶴になった。」。スミさんは無言で眼鏡をずらし驚く。布の鶴は飛ばない。"
    }
  ]
},
{
  "id": "sumi-recipe-scroll",
  "title": "一行の秘訣",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "聞いたことを丁寧にメモする、はじめの番外編。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-recipe-scroll-1.webp"),
      "alt": "左: スミさんが指一本を立て「コツは一行だ。」。はじめが小さなメモ帳と鉛筆を取り「メモします。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-recipe-scroll-2.webp"),
      "alt": " はじめが床まで長々と転がる巻物にメモをして困惑「巻物になった。」。スミさんが呆れて見守る。巻物は文字を描かず小さな線だけ。"
    }
  ]
},
{
  "id": "sumi-rain-concert",
  "title": "雨音の合奏",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "雨の日の店内は、いつもと少し違う音がします。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-rain-concert-1.webp"),
      "alt": "左: 窓の雨筋を見てはじめが「雨、強いですね。」スミさんが「いい音だ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-rain-concert-2.webp"),
      "alt": " はじめが椅子に座り目を丸くし「客席が最前列。」。スミさんが雨の窓を背景に鉛筆一本を指揮棒にして大げさに指揮、文字のない音符が2つ。雨漏りはなし。"
    }
  ]
},
{
  "id": "sumi-cushion-tower",
  "title": "座り心地派",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "くつろげる席を作ろうと、張り切るはじめ。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-cushion-tower-1.webp"),
      "alt": "左: はじめが椅子にクッションを二枚載せて「楽な席にします。」。スミさんが「ほどほどにな。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-cushion-tower-2.webp"),
      "alt": " はじめがふわふわのクッションを五枚ほど積んだ低い山に座り頭が天井すれすれで「天井が近い。」。スミさんは右であきれて見上げる。安全な柔らかいデフォルメ誇張、脚立なし。"
    }
  ]
},
{
  "id": "sumi-sign-reverse",
  "title": "看板の向き",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。",
  "caption": "開店の準備ができたら、入口の札も忘れずに。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-sign-reverse-1.webp"),
      "alt": "左: はじめが両手を腰に得意げで「準備できました！」。スミさんがドアの札を指し「札も返せよ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-sign-reverse-2.webp"),
      "alt": " はじめは背中をこちらへ向けて逆向きに立ち、顔だけ振り向いて困惑「俺が裏返った。」。スミさんは無言で額に手を当てる。ドアの札は無地、文字なし。"
    }
  ]
},
// 2026-11-02: 候補 PR #2246（49〜72話）と #2258（61〜90話）から採用した39話。同じ記録番号の別作品があるため、
// 番号ではなく id（＝候補の安定ID）で区別する。採否の理由は asset_sources/loading-comics/README.md §9。
{
  "id": "steeping-clock",
  "title": "蒸らしの時計",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:steeping-clock）",
  "caption": "蒸らしの一分は、待つほど長く感じます。",
  "panels": [
    {
      "src": imgFileUrl("loading/steeping-clock-1.webp"),
      "alt": "左: はじめがカウンターの小さなタイマーを見つめて「蒸らし、まだです？」。右のスミさんは「あと一分。」。"
    },
    {
      "src": imgFileUrl("loading/steeping-clock-2.webp"),
      "alt": "はじめが腕時計・置き時計・タイマーの三つを同時に見比べている。スミさんが呆れて「時計、増えた。」。"
    }
  ]
},
{
  "id": "mint-question",
  "title": "強めの確認",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:mint-question）",
  "caption": "「強め」にも、いろいろあるようです。",
  "panels": [
    {
      "src": imgFileUrl("loading/mint-question-1.webp"),
      "alt": "左: はじめがメニューを手に「ミント強めで。」。右のスミさんが身を乗り出して「どの強めだ？」。"
    },
    {
      "src": imgFileUrl("loading/mint-question-2.webp"),
      "alt": "スミさんが大きさの違うミントの葉の札を三枚きっちり並べる。はじめは少したじろいで「圧まで強い。」。"
    }
  ]
},
{
  "id": "scent-overtime",
  "title": "香りの残業",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:scent-overtime）",
  "caption": "閉店後も、香りはしばらく服に残ります。",
  "panels": [
    {
      "src": imgFileUrl("loading/scent-overtime-1.webp"),
      "alt": "左: はじめが布を畳んで「片付け終わりました。」。右のスミさんは「香りは残業だな。」。"
    },
    {
      "src": imgFileUrl("loading/scent-overtime-2.webp"),
      "alt": "はじめがパーカーの袖を嗅ぐと、リンゴとバニラの香りが浮かぶ。はじめ「服だけ営業中。」。スミさんは笑っている。"
    }
  ]
},
{
  "id": "apple-interview",
  "title": "個性派面接",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-interview）",
  "caption": "アダムの店の新人面接、のはずが。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-interview-1.webp"),
      "alt": "左: はじめが面接の机を見て「新人ですか？」。右のアダムが自信満々に「有望な二人だ。」。"
    },
    {
      "src": imgFileUrl("loading/apple-interview-2.webp"),
      "alt": "小さな椅子に座っているのは、ネクタイを付けた赤リンゴと青リンゴ。はじめ「まだ果物だ。」。"
    }
  ]
},
{
  "id": "apple-light",
  "title": "味変の限界",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-light）",
  "caption": "気分を変えたいとき、アダムが変えるのは。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-light-1.webp"),
      "alt": "左: はじめがリンゴの絵だけのメニューを持って「気分を変えたい。」。右のアダムが照明のスイッチに手を添えて「照明を変えよう。」。"
    },
    {
      "src": imgFileUrl("loading/apple-light-2.webp"),
      "alt": "店の照明が紫に変わっただけで、メニューは同じリンゴのまま。はじめ「味はそのまま。」。アダムは満足げ。"
    }
  ]
},
{
  "id": "apple-ratio",
  "title": "比率の大改革",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-ratio）",
  "caption": "ダブルアップルの配合にも、こだわりがあります。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-ratio-1.webp"),
      "alt": "左: はじめが赤リンゴと青リンゴの絵の札を指して「半々にします？」。右のアダムが真剣に「六対四もある。」。"
    },
    {
      "src": imgFileUrl("loading/apple-ratio-2.webp"),
      "alt": "アダムが赤リンゴの絵だけ少し大きい札を丁寧に置く。はじめが半笑いで「急に大改革。」。"
    }
  ]
},
{
  "id": "sweet-unit",
  "title": "甘さのものさし",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:sweet-unit）",
  "caption": "なるは、甘さをお菓子で考える作り手です。",
  "panels": [
    {
      "src": imgFileUrl("loading/sweet-unit-1.webp"),
      "alt": "左: はじめがメニューを持って「甘さ控えめで。」。右のなるが考えて「ケーキなら何口？」。"
    },
    {
      "src": imgFileUrl("loading/sweet-unit-2.webp"),
      "alt": "なるがショートケーキの一切れとフォークを示して好みを確かめる。はじめは苦笑いで「単位が独特。」。"
    }
  ]
},
{
  "id": "dessert-stomach",
  "title": "別腹の確認",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:dessert-stomach）",
  "caption": "デザート系の味を頼んだはずが。",
  "panels": [
    {
      "src": imgFileUrl("loading/dessert-stomach-1.webp"),
      "alt": "左: はじめがメニューを指して「デザート系で。」。右のなるが笑って「別腹は空いてる？」。"
    },
    {
      "src": imgFileUrl("loading/dessert-stomach-2.webp"),
      "alt": "なるが本物のショートケーキを一皿出してしまう。はじめがメニューを指して「吸う方ですよ。」。"
    }
  ]
},
{
  "id": "leave-it-to-you",
  "title": "おまかせの罠",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:leave-it-to-you）",
  "caption": "おまかせにも、好みの確認はつきものです。",
  "panels": [
    {
      "src": imgFileUrl("loading/leave-it-to-you-1.webp"),
      "alt": "左: はじめがメニューを閉じて「おまかせで。」。右のスミさんが穏やかに「苦手なのは？」。"
    },
    {
      "src": imgFileUrl("loading/leave-it-to-you-2.webp"),
      "alt": "はじめが急に真剣に悩み、メニューを開き直して「急に自分の番。」。スミさんは頬杖で待っている。"
    }
  ]
},
{
  "id": "all-favorites",
  "title": "感想の落とし穴",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:all-favorites）",
  "caption": "味の感想をメモする練習をしていたら。",
  "panels": [
    {
      "src": imgFileUrl("loading/all-favorites-1.webp"),
      "alt": "スミさんが「感想、書いたか？」。左のはじめがメモ帳を見せて明るく「全部、好きです。」。"
    },
    {
      "src": imgFileUrl("loading/all-favorites-2.webp"),
      "alt": "はじめのメモには三つの果物の絵と、同じ大きさの星が三つ。スミさんが困り笑いで「比較ができない。」。"
    }
  ]
},
{
  "id": "short-visit",
  "title": "少しだけの幅",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:short-visit）",
  "caption": "シーシャ屋では、時間がゆっくり流れます。",
  "panels": [
    {
      "src": imgFileUrl("loading/short-visit-1.webp"),
      "alt": "夕方の窓辺。左のはじめが席に着いて「少しだけ寄ります。」。右でスミさんが迎える。"
    },
    {
      "src": imgFileUrl("loading/short-visit-2.webp"),
      "alt": "窓の外はすっかり夜。スミさんが「そろそろ閉店だ。」。はじめが驚いて「少しの幅が広い。」。"
    }
  ]
},
{
  "id": "apple-study",
  "title": "他店の勉強",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-study）",
  "caption": "アダムは研究熱心。ただし、題材は一つ。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-study-1.webp"),
      "alt": "左: はじめがアダムの分厚い帳面を見て「他店も研究を？」。右のアダムが真剣に「もちろんだ。」。"
    },
    {
      "src": imgFileUrl("loading/apple-study-2.webp"),
      "alt": "開いた帳面は、赤リンゴと青リンゴの対の絵ばかり。はじめが苦笑いで「またダブルアップル。」。アダムは誇らしげ。"
    }
  ]
},
{
  "id": "apple-season",
  "title": "一年中の旬",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-season）",
  "caption": "アダムのおすすめは、季節を問いません。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-season-1.webp"),
      "alt": "左: はじめがメニューを持って「秋のおすすめは？」。右のアダムがリンゴの対の絵を指して「一年中、旬だ。」。"
    },
    {
      "src": imgFileUrl("loading/apple-season-2.webp"),
      "alt": "アダムが掲げた四季の札は、どれも同じリンゴの対。はじめが呆れ笑いで「便利な季節。」。"
    }
  ]
},
{
  "id": "apple-break",
  "title": "休憩も一筋",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:apple-break）",
  "caption": "アダムは休憩の飲み物も一筋です。",
  "panels": [
    {
      "src": imgFileUrl("loading/apple-break-1.webp"),
      "alt": "左: はじめが水差しとコップを持って「何か飲みます？」。右のアダムは「りんごジュース。」。"
    },
    {
      "src": imgFileUrl("loading/apple-break-2.webp"),
      "alt": "アダムがリンゴの紙パックとジュースを手に満足げ。はじめが笑って「休憩も一筋。」。"
    }
  ]
},
{
  "id": "sweet-name",
  "title": "名前で休憩",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:sweet-name）",
  "caption": "新しい味に、なるが名前を付けると。",
  "panels": [
    {
      "src": imgFileUrl("loading/sweet-name-1.webp"),
      "alt": "左: はじめが白い名札を持って「味に名前を。」。右のなるが考えて「苺の三時休み。」。"
    },
    {
      "src": imgFileUrl("loading/sweet-name-2.webp"),
      "alt": "はじめの頭にショートケーキと紅茶が浮かぶ。はじめ「もう休憩したい。」。なるは照れ笑い。"
    }
  ]
},
{
  "id": "not-sweet",
  "title": "甘くない注文",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:not-sweet）",
  "caption": "甘くない味も、なるはちゃんと作れます。",
  "panels": [
    {
      "src": imgFileUrl("loading/not-sweet-1.webp"),
      "alt": "左: はじめが「甘くないのも？」。右のなるが快く「もちろん作れる。」。"
    },
    {
      "src": imgFileUrl("loading/not-sweet-2.webp"),
      "alt": "なるが葉の絵の札を渡しながら、ケーキの絵の札を名残惜しそうに見る。はじめが苦笑いで「顔が少し寂しい。」。"
    }
  ]
},
{
  "id": "cake-lunch",
  "title": "研究の昼ご飯",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:cake-lunch）",
  "caption": "なるの研究は、昼ご飯の時間も続きます。",
  "panels": [
    {
      "src": imgFileUrl("loading/cake-lunch-1.webp"),
      "alt": "左: はじめがなるの前のケーキを見て「味見用ですか？」。右のなるがフォークを手に「これは俺の昼飯。」。"
    },
    {
      "src": imgFileUrl("loading/cake-lunch-2.webp"),
      "alt": "なるが幸せそうにケーキを一口。はじめが納得した顔で「研究が日常。」。"
    }
  ]
},
{
  "id": "mint-ranking",
  "title": "人気の一位",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:mint-ranking）",
  "caption": "ぺぱーみんとのキャストは、みんと一人です。",
  "panels": [
    {
      "src": imgFileUrl("loading/mint-ranking-1.webp"),
      "alt": "左: はじめがメニューを見て「人気一位は？」。右のみんとが自分を指して「みんとです♡」。"
    },
    {
      "src": imgFileUrl("loading/mint-ranking-2.webp"),
      "alt": "みんとはウインク。はじめがメニューのミントとチョコの絵を指して「味の方です。」。"
    }
  ]
},
{
  "id": "mint-service",
  "title": "甘さの接客",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:mint-service）",
  "caption": "みんとの店は、接客も楽しみのひとつ。",
  "panels": [
    {
      "src": imgFileUrl("loading/mint-service-1.webp"),
      "alt": "右のみんとが味のメニューを見せて「甘さ、足します？」。左のはじめが少し照れて「味の話ですよね？」。"
    },
    {
      "src": imgFileUrl("loading/mint-service-2.webp"),
      "alt": "みんとが頬に指を当てて営業スマイルで「接客も甘め♡」。はじめは照れ笑い。"
    }
  ]
},
{
  "id": "mint-photo",
  "title": "写真の主役",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2246:mint-photo）",
  "caption": "おすすめの味を、写真に残したかったのですが。",
  "panels": [
    {
      "src": imgFileUrl("loading/mint-photo-1.webp"),
      "alt": "左: はじめがスマホを手に「写真いいですか？」。右のみんとがすぐにポーズを取って「かわいく撮って♡」。"
    },
    {
      "src": imgFileUrl("loading/mint-photo-2.webp"),
      "alt": "はじめが卓上のメニュー立てを指して「メニューの方です。」。みんとは照れながら笑顔のまま。"
    }
  ]
},
{
  "id": "sumi-cold-tea",
  "title": "冷めた紅茶",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:sumi-cold-tea）",
  "caption": "シーシャの話になると、時間を忘れる二人。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-cold-tea-1.webp"),
      "alt": "左: はじめが冷めた紅茶を見て「お茶、冷めました。」。右のスミさんは頬杖で「話しすぎたな。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-cold-tea-2.webp"),
      "alt": "スミさんが指を立てて楽しそうに話を続け、はじめはノートを開く。はじめ「話はまだ熱い。」。"
    }
  ]
},
{
  "id": "sumi-memory-kitchen",
  "title": "香りの帰省",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:sumi-memory-kitchen）",
  "caption": "香りは、思い出を連れてくることがあります。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-memory-kitchen-1.webp"),
      "alt": "左: はじめが香りを考えて「何の香りです？」。右のスミさんがゆったりと「思い出してみろ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-memory-kitchen-2.webp"),
      "alt": "はじめの想像の中に、食卓のカレーの皿が浮かぶ。はじめが懐かしそうに「実家に着いた。」。"
    }
  ]
},
{
  "id": "sumi-clean-counter",
  "title": "磨きすぎ注意",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:sumi-clean-counter）",
  "caption": "掃除の仕上げは、ほどほどに。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-clean-counter-1.webp"),
      "alt": "左: はじめが布でカウンターを拭き終えて「机、拭きました！」。右のスミさんが感心して「きれいだな。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-clean-counter-2.webp"),
      "alt": "ぴかぴかの天板に、はじめとスミさんの顔がくっきり映る。はじめ「顔まで映った。」。"
    }
  ]
},
{
  "id": "sumi-coin-hunt",
  "title": "釣り銭探し",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:sumi-coin-hunt）",
  "caption": "会計の前に、十円玉が見当たりません。",
  "panels": [
    {
      "src": imgFileUrl("loading/sumi-coin-hunt-1.webp"),
      "alt": "左: はじめがコイントレーを探して「十円が見つかりません。」。右のスミさんがはじめの手を指して「そこを見ろ。」。"
    },
    {
      "src": imgFileUrl("loading/sumi-coin-hunt-2.webp"),
      "alt": "はじめが握っていた手を開くと、硬貨が一枚。赤くなって「俺の手にいた。」。スミさんは微笑む。"
    }
  ]
},
{
  "id": "adam-holiday-choice",
  "title": "休日の二択",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-holiday-choice）",
  "caption": "アダムに休日の過ごし方を聞いてみると。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-holiday-choice-1.webp"),
      "alt": "左: はじめが「休みは何します？」。右のアダムが裏向きの札を二枚持って自信満々に「気分で選ぶ。」。"
    },
    {
      "src": imgFileUrl("loading/adam-holiday-choice-2.webp"),
      "alt": "表に返した札は、赤リンゴと青リンゴの絵。はじめが半目で「また赤か緑だ。」。"
    }
  ]
},
{
  "id": "adam-lunch-dessert",
  "title": "昼飯の余白",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-lunch-dessert）",
  "caption": "アダムの言う「バランス」とは。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-lunch-dessert-1.webp"),
      "alt": "左: はじめが自分の定食を指して「昼は何食べます？」。右のアダムが真剣に「バランスが大事だ。」。"
    },
    {
      "src": imgFileUrl("loading/adam-lunch-dessert-2.webp"),
      "alt": "アダムの皿は小さなパン一つと、大きな赤リンゴと青リンゴ。はじめ「リンゴが主役だ。」。アダムは満足げ。"
    }
  ]
},
{
  "id": "adam-shopping-bag",
  "title": "買い物の内訳",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-shopping-bag）",
  "caption": "アダムの買い物袋の中身は。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-shopping-bag-1.webp"),
      "alt": "左: はじめが「買い忘れない？」。右のアダムが袋を二つ持って自信たっぷりに「全部そろった。」。"
    },
    {
      "src": imgFileUrl("loading/adam-shopping-bag-2.webp"),
      "alt": "袋の中は赤と青のリンゴだけ。はじめが空の皿を持って困った顔で「夕飯は未定だ。」。"
    }
  ]
},
{
  "id": "adam-alarm-clock",
  "title": "目覚ましの役目",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-alarm-clock）",
  "caption": "アダムは仕事以外では、少し抜けています。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-alarm-clock-1.webp"),
      "alt": "左: はじめが目覚まし時計を見せて「朝は起きられます？」。右の眠そうなアダムが「音には敏感だ。」。"
    },
    {
      "src": imgFileUrl("loading/adam-alarm-clock-2.webp"),
      "alt": "アダムの枕元には目覚ましの代わりに赤リンゴと青リンゴ。はじめが指して「リンゴは鳴らない。」。"
    }
  ]
},
{
  "id": "adam-napkin-fold",
  "title": "折り目の精度",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-napkin-fold）",
  "caption": "仕事は几帳面、私生活は少しうっかり。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-napkin-fold-1.webp"),
      "alt": "左: はじめが感心して「几帳面ですね。」。右のアダムが定規でナプキンの端を揃えて「一ミリも譲らない。」。"
    },
    {
      "src": imgFileUrl("loading/adam-napkin-fold-2.webp"),
      "alt": "はじめがアダムのシャツの外に出た洗濯タグを指して「服は裏返しだ。」。アダムは定規を持ったまま固まる。"
    }
  ]
},
{
  "id": "adam-weather-forecast",
  "title": "今日の予報",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-weather-forecast）",
  "caption": "出かける前に、アダムに天気を聞いたら。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-weather-forecast-1.webp"),
      "alt": "左: はじめが窓の晴れ空を指して「今日は晴れます？」。右のアダムが腕を組んで「色は見てきた。」。"
    },
    {
      "src": imgFileUrl("loading/adam-weather-forecast-2.webp"),
      "alt": "アダムは手元の赤リンゴと青リンゴを見比べていて、窓の外は雨。はじめが苦笑いで「空を見てない。」。"
    }
  ]
},
{
  "id": "adam-key-ring",
  "title": "鍵より目印",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:adam-key-ring）",
  "caption": "アダムは、よく鍵をなくします。",
  "panels": [
    {
      "src": imgFileUrl("loading/adam-key-ring-1.webp"),
      "alt": "左: はじめが「鍵、見つかります？」。右のアダムが鞄から小さな鍵をつまんで「目印がある。」。"
    },
    {
      "src": imgFileUrl("loading/adam-key-ring-2.webp"),
      "alt": "鍵には本物ほど大きなリンゴのキーホルダーが二つ。アダムの手が重さで下がり、はじめが驚いて「目印が重すぎる。」。"
    }
  ]
},
{
  "id": "naru-vanilla-break",
  "title": "休憩の香り",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-vanilla-break）",
  "caption": "なるの得意な味の軸は、バニラです。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-vanilla-break-1.webp"),
      "alt": "左: はじめがコーヒーと紅茶のカップを見せて「休憩はコーヒー？」。右のなるが紅茶を指して「今日は紅茶だ。」。"
    },
    {
      "src": imgFileUrl("loading/naru-vanilla-break-2.webp"),
      "alt": "なるは紅茶の横にバニラアイスを添えて満足げ。はじめが呆れ笑いで「バニラは譲らない。」。"
    }
  ]
},
{
  "id": "naru-recipe-notes",
  "title": "レシピの余白",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-recipe-notes）",
  "caption": "なるの口癖は「全部見てけ」。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-recipe-notes-1.webp"),
      "alt": "左: はじめが「メモ、見てもいい？」。右のなるがノートを手に気軽に「全部見てけ。」。"
    },
    {
      "src": imgFileUrl("loading/naru-recipe-notes-2.webp"),
      "alt": "ノートには味の色の丸が並び、余白はケーキやクッキーの落書きでいっぱい。はじめが笑顔で「余白までお菓子。」。"
    }
  ]
},
{
  "id": "naru-biscuit-measure",
  "title": "厚みのこだわり",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-biscuit-measure）",
  "caption": "お菓子の厚みにも、なるはこだわります。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-biscuit-measure-1.webp"),
      "alt": "左: はじめが皿のビスケットを見て「どれも同じです？」。右のなるが一枚を手に真剣に「厚みが違う。」。"
    },
    {
      "src": imgFileUrl("loading/naru-biscuit-measure-2.webp"),
      "alt": "はじめがビスケットを一口で食べてしまい「一口で消えます。」。なるはノギスを持ったまま固まる。"
    }
  ]
},
{
  "id": "naru-cake-compass",
  "title": "帰り道の寄り道",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-cake-compass）",
  "caption": "なるに駅までの道を聞いたら。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-cake-compass-1.webp"),
      "alt": "街角。左のはじめが「駅はどっちです？」。右のなるが自信を持って指さし「こっちだ。」。"
    },
    {
      "src": imgFileUrl("loading/naru-cake-compass-2.webp"),
      "alt": "二人が着いたのはケーキ屋のショーケースの前。なるは幸せそうで、はじめは半目で「ケーキ屋に着いた。」。"
    }
  ]
},
{
  "id": "naru-freezer-space",
  "title": "冷凍庫の陣地",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-freezer-space）",
  "caption": "なるの冷凍庫は、アイスが主役です。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-freezer-space-1.webp"),
      "alt": "左: はじめが製氷皿を持って「氷、入ります？」。右のなるが冷凍庫を開けて「少し空けた。」。"
    },
    {
      "src": imgFileUrl("loading/naru-freezer-space-2.webp"),
      "alt": "冷凍庫の真ん中に細い隙間が一つだけ。両端はアイスのカップがぎっしり。なるが得意げに「アイスが引っ越した。」。"
    }
  ]
},
{
  "id": "naru-spoon-choice",
  "title": "スプーン選び",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-spoon-choice）",
  "caption": "なるは、一口ずつ味わう派です。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-spoon-choice-1.webp"),
      "alt": "左: はじめが大小のスプーンを見せて「どっちを使う？」。右のなるが小さい方を指して「小さい方で。」。"
    },
    {
      "src": imgFileUrl("loading/naru-spoon-choice-2.webp"),
      "alt": "なるが小さなスプーンで大きなプリンを少しずつ食べながら「慎重に食べたい。」。はじめはもう食べ終えている。"
    }
  ]
},
{
  "id": "naru-flavor-dream",
  "title": "夢まで試作",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-flavor-dream）",
  "caption": "なるは、寝ても覚めても甘い味の研究中。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-flavor-dream-1.webp"),
      "alt": "左: はじめが「昨夜は眠れた？」。右のなるがうれしそうに「いい夢だった。」。"
    },
    {
      "src": imgFileUrl("loading/naru-flavor-dream-2.webp"),
      "alt": "なるの想像の中に大きなバニラアイスとスプーン。はじめが呆れ笑いで「夢でも味見か。」。"
    }
  ]
},
{
  "id": "naru-tiny-sample",
  "title": "小さな一口",
  "contexts": [
    "craft"
  ],
  "minChapter": 1,
  "note": "番外編のギャグ漫画です。左から右へお読みください。（候補 PR #2258:naru-tiny-sample）",
  "caption": "ひと口のつもりで頼んだら。",
  "panels": [
    {
      "src": imgFileUrl("loading/naru-tiny-sample-1.webp"),
      "alt": "左: はじめが手を差し出して「ひと口、ください。」。右のなるがケーキを切りながら「小さく切った。」。"
    },
    {
      "src": imgFileUrl("loading/naru-tiny-sample-2.webp"),
      "alt": "なるが差し出した大きな皿の真ん中に、ごく小さなケーキが一切れ。はじめが目を丸くして「皿だけ大きい。」。"
    }
  ]
}
];
