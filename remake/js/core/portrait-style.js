// data.js は状態モジュールを読み込まず、端末設定の読取関数だけを登録する。
let source = () => "classic";
export function setPortraitStyleSource(read) { source = read; }
export function portraitStyle() { return source() === "new" ? "new" : "classic"; }
