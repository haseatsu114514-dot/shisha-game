import { imgFileUrl } from "./img-file.js";

// Approved for loading screens by the owner's request to use existing repository comics.
// The source sheet stays intact; regions display only episode 25, left -> right.
//
// Comic data format (see remake/README.md ＞ ロード画面):
//   id / title / minChapter (required), contexts? (default: any), note? (素材台帳メモ),
//   caption?  : 初心者向けの一行解説（コマの下に表示。省略可）。
//   panels[2] : { src, alt,
//     region?  : { x, y, width, height, sourceWidth, sourceHeight } で原画の一部を切り出す。
//     bubbles? : [{ text, x, y, width?, fontSize? }] ... 吹き出し画像の上にゲーム内テキストを重ねる
//                （x/y/width は art 枠に対する % 、fontSize は cqw。誤字を直せる差し込み方式）。
//   }
// 1コマの作画サイズは 1920x1080 基準で 860x573（3:2）固定。原画が 3:2 以外でも、
// 表示枠は 3:2 のままレターボックスで収めるので、作画は 3:2 を推奨する。
const src = imgFileUrl("loading/adam-chaos.webp");
const batch1Src = imgFileUrl("loading/loading-batch1.webp");
const batch2Src = imgFileUrl("loading/loading-batch2.webp");
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
}, {
  id: "mashiro-body-clock",
  title: "体内時計",
  contexts: ["craft"],
  minChapter: 3,
  note: "番外編のギャグ漫画です。左から右へお読みください。",
  caption: "番外編のギャグ漫画。ましろの体内時計は砂時計と同調している。",
  panels: [
    { src: batch2Src, alt: "はじめ「蒸らしって、何分待てばいいの？」。頬杖をついたましろが眠そうに答える。「砂時計ひとつ分。……僕は寝て待つ。」",
      region: { x: 78, y: 110, width: 460, height: 307, sourceWidth: 1086, sourceHeight: 1448 } },
    { src: batch2Src, alt: "砂時計の砂が落ちきり、うたた寝していたましろが目を開ける。「……落ちた。」はじめ「目覚ましより正確！？」",
      region: { x: 548, y: 110, width: 460, height: 307, sourceWidth: 1086, sourceHeight: 1448 } },
  ],
}];
