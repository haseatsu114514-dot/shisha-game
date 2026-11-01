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
}];
