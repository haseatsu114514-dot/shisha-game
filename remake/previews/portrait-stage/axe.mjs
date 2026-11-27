// 縦画面C案「煙の舞台」: 斧投げを縦へ移す試作（要望台帳 VPM05）。中身はこれから作る（いまは名札だけ）。
export class AxeScene {
  static META = {
    id: "axe", label: "斧投げ", acc: "#ffb45a",
    gallery: { title: "斧投げ", note: "準備中。", shots: [{ caption: "準備中" }] },
  };

  constructor(phone, kit) { Object.assign(this, { phone, kit, el: phone.el }); }
  html() { return `<div class="body"><div class="telop"><div class="glass"><p class="text">斧投げ（準備中）</p></div></div></div>`; }
  mount() {}
  onClick() { return false; }
  move() {}
  pressA() {}
  tick() {}
  relayout() {}
  destroy() {}
}
