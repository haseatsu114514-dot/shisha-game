// 新版（現行の画面を磨き上げた様式・LK02）。見た目は css/look-neo.css、ここは絵の光・動きなど CSS だけでは足りない分。
// setActive(false) では、足した要素・監視・クラスをすべて片付けて現行へ戻す。
let active = false;

export function setActive(on) {
  if (active === !!on) return;
  active = !!on;
}
