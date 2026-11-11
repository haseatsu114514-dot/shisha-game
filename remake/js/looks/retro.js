// DS風（上下2画面・256×192 のレトロな様式・LK03）。見た目は css/look-retro.css。
// 現行の画面（#stage）は動かしたまま隠し、その内容を低い解像度の2画面へ写して操作を中継する。進行・判定・セーブには触れない。
// setActive(false) では、足した要素・監視・クラスをすべて片付けて現行へ戻す。
let active = false;

export function setActive(on) {
  if (active === !!on) return;
  active = !!on;
}
