// 縦画面C案「煙の舞台」: LIME（メッセージ）を縦へ移す試作（要望台帳 VPM06）。中身はこれから作る（いまは名札だけ）。
export class LimeScene {
  static META = {
    id: "lime", label: "LIME", acc: "#7fe0a0",
    gallery: { title: "LIME（メッセージ）", note: "準備中。", shots: [{ caption: "準備中" }] },
  };

  constructor(phone, kit) { Object.assign(this, { phone, kit, el: phone.el }); }
  html() { return `<div class="body"><div class="telop"><div class="glass"><p class="text">LIME（メッセージ）（準備中）</p></div></div></div>`; }
  mount() {}
  onClick() { return false; }
  move() {}
  pressA() {}
  tick() {}
  relayout() {}
  destroy() {}
}
