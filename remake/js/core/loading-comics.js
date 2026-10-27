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
// 1コマの作画サイズは 1920x1080 基準で 860x500（43:25）固定。原画が 43:25 以外でも、
// 表示枠は 43:25 のままレターボックスで収めるので、作画は 43:25 を推奨する。
const src = "img/loading/adam-chaos.webp";
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
}];
