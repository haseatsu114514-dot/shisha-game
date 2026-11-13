// data.js は状態モジュールを読み込まず、端末設定の読取関数だけを登録する。
let source = () => "new";
export function setPortraitStyleSource(read) { source = read; }
// 廃止した画風や不明な値は採用済みの新版へ。現行は明示選択した時だけ使う。
export function portraitStyle() { return source() === "classic" ? "classic" : "new"; }

