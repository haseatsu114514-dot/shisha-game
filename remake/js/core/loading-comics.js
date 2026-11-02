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
}
];
