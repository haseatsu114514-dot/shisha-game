// 縦画面C案「煙の舞台」: 心得の盤（能力盤）を縦へ移す試作（要望台帳 VPM04）。中身はこれから作る（いまは名札だけ）。
export class GrowthScene {
  static META = {
    id: "growth", label: "盤", acc: "#c3b0ff",
    gallery: { title: "心得の盤（能力盤）", note: "準備中。", shots: [{ caption: "準備中" }] },
  };

  constructor(phone, kit) { Object.assign(this, { phone, kit, el: phone.el }); }
  html() { return `<div class="body"><div class="telop"><div class="glass"><p class="text">心得の盤（能力盤）（準備中）</p></div></div></div>`; }
  mount() {}
  onClick() { return false; }
  move() {}
  pressA() {}
  tick() {}
  relayout() {}
  destroy() {}
}
