// 縦画面C案「煙の舞台」の試作（2026-11-27・#4134・要望台帳 VPL03〜）。
// 第1章の場面（橙須の地図→入店→会話→返事／tonari の2人会話／シーシャ作り3工程）で、配置と動きを確かめる。
// 絵・立ち絵・台詞は本編の素材を読むだけ。本編の進行・判定・保存は呼ばない。
// 一覧（PC）: index.html?view=gallery　／　1台（スマホ）: index.html?view=play&scene=map|minto|tonari|pack|holes|pull
// 絵は本編が表示に使う WebP 版（remake/img/）を読む（元PNGを直接書くと公開物の軽量化から外れる）。

const REMAKE_IMG = new URL("../../img/", import.meta.url).href;
const NEW = `${REMAKE_IMG}sprites/character_variants/new/`;
const IMG = {
  map: `${REMAKE_IMG}backgrounds/bg_osu_map_day.webp`,
  shop: `${REMAKE_IMG}backgrounds/peppermint.webp`,
  tonari: `${REMAKE_IMG}backgrounds/bg_tonari_inside_day.webp`,
  minto_smile: `${NEW}minto/chr_minto_smile.webp`,
  minto_wink: `${NEW}minto/chr_minto_wink.webp`,
  minto_normal: `${NEW}minto/chr_minto_normal.webp`,
  sumi_normal: `${NEW}sumi/chr_sumi_normal.webp`,
  sumi_smile: `${NEW}sumi/chr_sumi_smile.webp`,
  tsumugi_normal: `${NEW}tsumugi/chr_tsumugi_normal.webp`,
  tsumugi_smile: `${NEW}tsumugi/chr_tsumugi_smile.webp`,
  faceMinto: `${REMAKE_IMG}ui/face_icons/new/face_minto.webp`,
  faceSumi: `${REMAKE_IMG}ui/face_icons/new/face_sumi.webp`,
  faceTsumugi: `${REMAKE_IMG}ui/face_icons/new/face_tsumugi.webp`,
  bowl_airy: `${REMAKE_IMG}ui/making/bowl_packed_airy.webp`,
  bowl_normal: `${REMAKE_IMG}ui/making/bowl_packed_normal.webp`,
  bowl_firm: `${REMAKE_IMG}ui/making/bowl_packed_firm.webp`,
  foil: `${REMAKE_IMG}ui/making/foil_interactive_top.webp`,
  pullActor: `${REMAKE_IMG}ui/making/hajime_craft_pull.webp`,
  leaf: `${REMAKE_IMG}ui/making/ui_mockup_flavor_leaf.webp`,
  smoke: `${REMAKE_IMG}ui/making/smoke_thick.webp`,
  thumbNaru: `${REMAKE_IMG}backgrounds/kemurikusa.webp`,
  thumbAdam: `${REMAKE_IMG}backgrounds/bg_eden_shop.webp`,
  thumbShop: `${REMAKE_IMG}backgrounds/bg_fookah_showroom.webp`,
  thumbHome: `${REMAKE_IMG}backgrounds/bg_home_day.webp`,
  ...(globalThis.PORTRAIT_STAGE_ASSETS || {}),
};

// 立ち絵の寸法（remake/data/manifest.json の portraitVariants.new と data/characters.json の spriteScale の写し）
// h=絵の高さに対する人物の高さ、b=足元の余白、ax=横の中心、scale=身長の比
const CAST = {
  minto: { name: "みんと", en: "MINTO", h: 0.9008, b: 0.0492, ax: 0.5, scale: 0.91 },
  sumi: { name: "スミさん", en: "SUMI", h: 0.9, b: 0.05, ax: 0.5004, scale: 1.05 },
  tsumugi: { name: "つむぎ", en: "TSUMUGI", h: 0.7242, b: 0.0217, ax: 0.4926, scale: 0.88 },
};
const ASPECT = 896 / 1200;

// 第1章 DAY5 昼の橙須（座標は remake/js/daily/spots.js と同じ。地図の絵に対する %）
const SPOTS = [
  { id: "tonari", label: "tonari", area: "バイト先", x: 86, y: 36, who: "スミさん 在店", fee: "バイト先", mark: true, face: "faceSumi", thumb: "tonari" },
  { id: "naru", label: "KEMURIKUSA", area: "商店街の外れ", x: 70, y: 24, who: "なる 在店", fee: "料金 ¥3,000", mark: true, thumb: "thumbNaru" },
  { id: "adam", label: "EDEN", area: "下町", x: 46, y: 48, who: "本日定休日", fee: "休み", closed: true, thumb: "thumbAdam" },
  { id: "minto", label: "PEPPERMINT", area: "繁華街", x: 32, y: 59, who: "みんと 在店", fee: "料金 ¥3,000", mark: true, face: "faceMinto", thumb: "shop" },
  { id: "shop", label: "Dr.fookah", area: "問屋街", x: 36, y: 30, who: "1階は時間消費なし", fee: "仕入れ", thumb: "thumbShop" },
  { id: "kannon", label: "観音堂", area: "古町", x: 18, y: 57, who: "盤は時間消費なし", fee: "心得の盤" },
  { id: "rest", label: "家", area: "自宅", x: 89, y: 44, who: "自宅で休む", fee: "体力回復", thumb: "thumbHome" },
];
const DEFAULT_SPOT = 3;
// 左右キー・点・一覧の並び。地図の左から右の順にして、右を押すと画面も右へ動くようにする
const ORDER = SPOTS.map((spot, i) => i).sort((a, b) => SPOTS[a].x - SPOTS[b].x);
const stepSpot = (index, by) => ORDER[(ORDER.indexOf(index) + by + ORDER.length) % ORDER.length];

// 会話の台本（data/dialogue/ch1_minto.json の ch1_minto_first、ch1_tsumugi.json の ch1_tsumugi_research から）
const TALKS = {
  minto: {
    place: ["PEPPERMINT", "繁華街"], bg: "shop", acc: "#8ff0c9",
    steps: [
      { kind: "narr", text: "店に入ると、レトロな内装と、常連客の声に包まれた。" },
      { kind: "inner", text: "（チェキ？ 推し？ ……tonariとは、ずいぶん違うな）" },
      { kind: "say", id: "minto", face: "smile", text: "あらためて♡ はじめくん、初ご来店ありがとっ！" },
      { kind: "say", id: "minto", face: "wink", text: "ご指名ありがとうございますっ♡ 今日はみんとに任せてね？" },
      { kind: "say", id: "minto", face: "smile", text: "はじめくん、どんなシーシャが好き？", choice: ["渋いの派です", "甘いのも、気になってます"] },
      { kind: "say", id: "minto", face: "wink", text: "初めてのお客様には、みんとイチ推しの『フラミンゴ・ピーチ』っ♡ 甘くてカワイイの！" },
    ],
  },
  tonari: {
    place: ["tonari", "バイト先"], bg: "tonari", acc: "#ffc978",
    steps: [
      { kind: "say", id: "tsumugi", face: "normal", text: "イラストのコンテストに出したくて。ここで過ごす時間を、一枚にしたいんです" },
      { kind: "player", text: "この店を選んでくれたんだ。スミさん、いいですよね？" },
      { kind: "say", id: "sumi", face: "normal", text: "構わん。客の顔を載せる時は、本人に聞けよ" },
      { kind: "say", id: "tsumugi", face: "normal", text: "はい。顔は描かずに、手元や座ってるところだけ" },
      { kind: "say", id: "tsumugi", face: "smile", text: "……ここがいいんです。ここが、好きなので" },
      { kind: "say", id: "sumi", face: "smile", text: "店の名前も入ってるな。いい宣伝だ" },
    ],
  },
};
const PACKS = [
  { id: "airy", name: "ふんわり", note: "空気を残す・軽い吸い心地" },
  { id: "normal", name: "ノーマル", note: "均等にならす・基本" },
  { id: "firm", name: "デンスパック", note: "心得の盤で習得", locked: true },
];
const CRAFT = {
  pack: { step: "詰め", coach: "詰め方を見比べて決めよう。迷ったらノーマル", hint: "十字キーの上下で見比べて、Aで決める" },
  holes: { step: "穴あけ", coach: "空気を通す穴。針が目印に重なったら押し込む", hint: "押している長さで穴の大きさが変わる" },
  pull: { step: "吸い出し", coach: "手元を見ているぞ。落ち着いていけ", hint: "針が白い帯に来たら「吸う」" },
};
const HOLE_COUNT = 10;

const SCENES = ["map", "minto", "tonari", "pack", "holes", "pull"];
const SCENE_LABEL = { map: "地図", minto: "1人", tonari: "2人", pack: "詰め", holes: "穴あけ", pull: "吸う" }; // 1台表示の下の切り替え
// 一覧（PC）に並べる場面
const GALLERY = [
  { scene: "map", caption: "地図（選んだ店へ画面が動く）" },
  { scene: "map", caption: "地図・行き先の一覧", list: true },
  { scene: "map", caption: "地図・全体を見る", overview: true },
  { scene: "minto", step: 0, caption: "地の文" },
  { scene: "minto", step: 3, caption: "会話（1人）" },
  { scene: "minto", step: 4, choice: true, caption: "返事を選ぶ" },
  { scene: "tonari", step: 2, caption: "会話（2人・スミさんが話す）" },
  { scene: "tonari", step: 3, caption: "会話（2人・つむぎが話す）" },
  { scene: "pack", caption: "作る・詰め" },
  { scene: "holes", caption: "作る・穴あけ" },
  { scene: "pull", caption: "作る・吸い出し" },
];

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tri = () => `<svg viewBox="0 0 24 24" aria-hidden="true" class="tri"><path d="M12 5l8 13H4z" fill="currentColor"/></svg>`;
const typed = (text, delay = 0) => `<span class="type" style="--d:${delay}ms">${[...text].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join("")}</span>`;
const TYPE_MS = 26;

/* ───────── 部品 ───────── */

function hudHtml(place) {
  return `<div class="hud">
    <div class="where"><b>${place[0]}</b><small>${place[1]}</small></div>
    <div class="stats"><span class="pill"><small>DAY</small><b>5</b><em>昼・雨</em></span><span class="pill"><span class="bar" style="--v:80%"><i></i></span><b>¥42,000</b></span></div>
  </div>`;
}

function dpadHtml(live, labels = {}) {
  const key = (dir, label) => `<button class="dp dp-${dir}${live.includes(dir) ? " live" : ""}" data-act="dir" data-dir="${dir}" aria-label="${labels[dir] || label}">${tri()}${labels[dir] ? `<span>${labels[dir]}</span>` : ""}</button>`;
  return `<div class="dpad" role="group" aria-label="十字キー">${key("up", "上")}${key("left", "左")}${key("right", "右")}${key("down", "下")}<i class="dp-core"></i></div>`;
}
const aHtml = (label, { disabled = false, cls = "" } = {}) => `<button class="btn-a ${cls}" data-act="a" ${disabled ? "disabled" : ""}><span class="t">${label}</span><span class="k">A</span></button>`;
const chipsHtml = (chips) => `<div class="chips">${chips.map(([id, label, badge, on]) => `<button class="chip${on ? " on" : ""}" data-act="fn" data-fn="${id}">${label}${badge ? `<em>${badge}</em>` : ""}</button>`).join("")}</div>`;

function meterHtml() {
  const C = 100, RO = 92, RI = 60;
  const pt = (t, r) => { const a = Math.PI * (1 - t); return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
  const band = (t0, t1, cls, style = "") => {
    const [x0, y0] = pt(t0, RO), [x1, y1] = pt(t1, RO), [x2, y2] = pt(t1, RI), [x3, y3] = pt(t0, RI);
    return `<path class="${cls}" ${style ? `style="${style}"` : ""} d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${RO} ${RO} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${RI} ${RI} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z"/>`;
  };
  const steps = (t0, t1, cls, n, from, to) => Array.from({ length: n }, (_, i) => band(t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n + 0.002, cls, `--mix:${Math.round(from + (to - from) * i / (n - 1))}%`)).join("");
  return `<svg class="meter" viewBox="-6 -2 212 112" role="img" aria-label="吸い出しのメーター">
    ${band(0, 0.13, "z z-cold")}${band(0.13, 0.2, "z z-keep")}${steps(0.2, 0.44, "z z-cool", 6, 100, 0)}
    ${band(0.44, 0.56, "z z-just")}${steps(0.56, 0.8, "z z-warm", 6, 0, 100)}${band(0.8, 0.87, "z z-keep")}${band(0.87, 1, "z z-hot")}
    <g class="needle"><path d="M100 10L103.2 96L96.8 96Z"/></g>
  </svg>`;
}

/* ───────── 1台ぶん ───────── */

class Phone {
  constructor(el, scene, { fixed = false, step = 0, list = false, overview = false, choice = false } = {}) {
    this.el = el;
    el.lang = "ja";
    this.fixed = fixed; // 一覧では場面を固定し、その場面の中の操作だけ動かす
    this.st = { scene, sel: DEFAULT_SPOT, step, choosing: choice, pick: 0, list, overview, auto: false, skip: false, pack: 1, holes: [], pulls: 0 };
    this.cam = null;      // 地図をドラッグした時の位置（選び直すと選んだ店へ戻る）
    this.t0 = performance.now();
    this.typedAt = 0;
    el.addEventListener("click", (event) => this.onClick(event));
    el.addEventListener("pointerdown", (event) => this.onDown(event));
    el.addEventListener("pointermove", (event) => this.onMove(event));
    el.addEventListener("pointerup", (event) => this.onUp(event));
    el.addEventListener("pointercancel", (event) => this.onUp(event));
    this.tick = this.tick.bind(this);
    this.render({ instant: fixed });
    requestAnimationFrame(this.tick);
  }

  get talk() { return TALKS[this.st.scene]; }
  get line() { return this.talk?.steps[this.st.step]; }

  /* ── 描画 ── */

  render({ instant = false, delay = 0 } = {}) {
    const { el, st } = this;
    el.dataset.scene = st.scene;
    el.dataset.kind = this.talk ? "talk" : st.scene === "map" ? "map" : "craft";
    el.style.setProperty("--acc", st.scene === "map" ? "#c3b0ff" : this.talk ? this.talk.acc : "#ffc978");
    if (st.scene === "map") el.innerHTML = this.mapHtml();
    else if (this.talk) el.innerHTML = this.talkHtml();
    else el.innerHTML = this.craftHtml();
    if (st.scene === "map") { this.cam = null; this.camera(false); this.syncMap(); }
    if (this.talk) { this.cast = {}; this.applyLine({ instant, delay }); }
    if (st.scene === "holes") this.drawHoles();
  }

  /* ── 地図 ── */

  mapHtml() {
    const { st } = this;
    return `
      <img class="amb" src="${IMG.map}" alt="">
      <div class="pic map${st.overview ? " overview" : ""}" data-map>
        <div class="map-pan"><img src="${IMG.map}" alt="橙須の地図" draggable="false">
          ${SPOTS.map((spot, i) => `<div class="pin${spot.closed ? " closed" : ""}" style="--mx:${spot.x}%;--my:${spot.y}%" data-spot="${i}">
            <i class="pin-ring"></i><i class="pin-dot">${spot.closed ? "休" : spot.mark ? "!" : ""}</i><span class="pin-flag">${esc(spot.label)}</span>
            <button class="pin-hit" data-act="spot" data-spot="${i}" aria-label="${esc(spot.label)}"></button></div>`).join("")}
        </div>
        <div class="beacons"></div>
      </div>
      <i class="veil"></i>
      ${hudHtml(["第1章", "橙須"])}
      <button class="mini${st.overview ? " far" : ""}" data-act="overview" aria-label="全体を見る・寄る"><img src="${IMG.map}" alt=""><i class="mini-view"></i>
        ${SPOTS.map((spot, i) => `<i class="mini-pin${spot.mark ? " mark" : ""}" style="left:${spot.x}%;top:${spot.y}%" data-spot="${i}"></i>`).join("")}<span>${st.overview ? "寄る" : "全体"}</span></button>
      <div class="body">
        <div class="telop" data-slot="telop">${this.destHtml()}</div>
        <div class="ctrl" data-slot="ctrl">${this.mapCtrlHtml()}</div>
      </div>
      <div class="sheet${st.list ? " open" : ""}" data-slot="sheet">${this.sheetHtml()}</div>`;
  }

  destHtml() {
    const spot = SPOTS[this.st.sel];
    return `<div class="name"><b>${esc(spot.label)}</b><span>${esc(spot.area)}</span></div>
      <div class="glass dest${spot.closed ? " closed" : ""}" data-swipe>
        <div class="who">${spot.face ? `<img src="${IMG[spot.face]}" alt="">` : `<i>${spot.closed ? "休" : esc(spot.label[0])}</i>`}<span>${esc(spot.who)}</span></div>
        <div class="fee"><b>${esc(spot.fee)}</b></div>
        <div class="dots">${ORDER.map((i) => `<button data-act="spot" data-spot="${i}" aria-current="${i === this.st.sel}" aria-label="${esc(SPOTS[i].label)}" class="${SPOTS[i].mark ? "mark" : ""}"></button>`).join("")}</div>
      </div>`;
  }

  mapCtrlHtml() {
    const { st } = this, spot = SPOTS[st.sel];
    const marks = SPOTS.filter((s) => s.mark).length;
    return `${chipsHtml([["lime", "LIME", "1"], ["menu", "MENU"], ["list", "一覧", "", st.list], ["next", `！の店 ${marks}`]])}
      ${dpadHtml(st.list ? "up down" : "up down left right", st.list ? {} : { up: st.overview ? "寄る" : "全体", down: "一覧" })}${aHtml(st.list ? "決定" : spot.closed ? "定休日" : "行く", { disabled: !st.list && spot.closed })}`;
  }

  sheetHtml() {
    return `<header><b>行き先</b><small>${SPOTS.length}か所</small><button data-act="list" aria-label="閉じる">閉じる</button></header>
      <div class="rows">${ORDER.map((i) => [SPOTS[i], i]).map(([spot, i]) => `<button class="row${spot.closed ? " closed" : ""}" data-act="spot-go" data-spot="${i}" aria-current="${i === this.st.sel}">
        <span class="thumb">${spot.face ? `<img src="${IMG[spot.face]}" alt="">` : spot.thumb ? `<img src="${IMG[spot.thumb]}" alt="">` : `<i>${esc(spot.label[0])}</i>`}</span>
        <span class="main"><b>${esc(spot.label)}</b><small>${esc(spot.area)}・${esc(spot.who)}</small></span>
        <span class="side">${spot.mark ? `<em>!</em>` : ""}<small>${esc(spot.fee)}</small></span></button>`).join("")}</div>`;
  }

  /** 選んだ店が見える位置へ地図を動かす（寄り）。全体表示では地図の幅を画面に合わせる。 */
  camera(animate = true) {
    const view = this.el.querySelector("[data-map]"), pan = view?.querySelector(".map-pan");
    if (!view || !pan) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    const mh = h * 1.12, mw = mh * 16 / 9; // 寄りの地図の大きさ
    pan.style.width = `${mw}px`; pan.style.height = `${mh}px`;
    const spot = SPOTS[this.st.sel];
    let x, y, scale = 1;
    if (this.st.overview) {
      scale = w / mw;
      x = 0; y = h * 0.47 - mh * scale / 2;
    } else if (this.cam) {
      ({ x, y } = this.cam);
    } else {
      x = w / 2 - mw * spot.x / 100;
      y = h * 0.4 - mh * spot.y / 100;
    }
    if (!this.st.overview) { x = Math.min(0, Math.max(w - mw, x)); y = Math.min(0, Math.max(h * 0.86 - mh, y)); }
    this.view = { x, y, scale, w, h, mw, mh };
    pan.classList.toggle("no-anim", !animate);
    pan.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    pan.style.setProperty("--inv", String(1 / scale));
    if (!animate) { pan.getBoundingClientRect(); pan.classList.remove("no-anim"); }
    this.syncMap();
  }

  /** ピンの選択・画面の外の「！」の案内・小さい全体図の枠を、今の地図の位置に合わせる。 */
  syncMap() {
    const { el, st, view } = this;
    el.querySelectorAll(".pin").forEach((pin) => pin.setAttribute("aria-current", String(Number(pin.dataset.spot) === st.sel)));
    el.querySelectorAll(".mini-pin").forEach((pin) => pin.classList.toggle("sel", Number(pin.dataset.spot) === st.sel));
    if (!view) return;
    const frame = el.querySelector(".mini-view");
    if (frame) {
      const { x, y, scale, w, h, mw, mh } = view;
      Object.assign(frame.style, { left: `${Math.max(0, -x / (mw * scale)) * 100}%`, top: `${Math.max(0, -y / (mh * scale)) * 100}%`,
        width: `${Math.min(1, w / (mw * scale)) * 100}%`, height: `${Math.min(1, h * 0.8 / (mh * scale)) * 100}%`, display: st.overview ? "none" : "" });
    }
    const layer = el.querySelector(".beacons");
    if (!layer) return;
    const { x, y, scale, w, h, mw, mh } = view, top = Math.max(h * 0.2, w * 0.215), bottom = h * 0.74;
    const list = [];
    if (!st.overview) SPOTS.forEach((spot, i) => {
      if (!spot.mark || i === st.sel) return;
      const px = x + mw * scale * spot.x / 100, py = y + mh * scale * spot.y / 100;
      if (px > 18 && px < w - 18 && py > top && py < bottom) return;
      const cx = Math.min(w - 14, Math.max(14, px)), cy = Math.min(bottom, Math.max(top, py));
      list.push({ i, spot, px, py, cx, cy, side: px < w / 2 ? "l" : "r" });
    });
    const gap = w * 0.102; // 案内1つぶんの高さ
    for (const side of ["l", "r"]) {
      const group = list.filter((b) => b.side === side).sort((a, b) => a.py - b.py);
      group.forEach((b, n) => { if (n && b.cy < group[n - 1].cy + gap) b.cy = group[n - 1].cy + gap; });
    }
    layer.innerHTML = list.map((b) => {
      const angle = Math.atan2(b.py - b.cy, b.px - b.cx) * 180 / Math.PI;
      return `<button class="beacon ${b.side}" data-act="spot" data-spot="${b.i}" style="left:${b.cx}px;top:${b.cy}px"><i style="transform:rotate(${angle.toFixed(0)}deg)"></i><span>${esc(b.spot.label)}</span><em>!</em></button>`;
    }).join("");
  }

  select(index, { keepList = false, keepView = false } = {}) {
    const { st } = this;
    st.sel = index;
    if (st.overview && !keepView) st.overview = false;
    if (!keepList) st.list = false;
    this.cam = null;
    this.patch();
    this.camera(true);
    this.syncView();
    const row = this.el.querySelector('.sheet .row[aria-current="true"]');
    row?.scrollIntoView?.({ block: "nearest" });
  }

  toggleOverview() {
    const { st } = this;
    st.overview = !st.overview; st.list = false; this.cam = null;
    this.syncView(); this.patch(); this.camera(true);
  }

  /** 寄り／全体の切り替えを、地図と小さい全体図の見た目へ反映する。 */
  syncView() {
    const { el, st } = this;
    el.querySelector("[data-map]")?.classList.toggle("overview", st.overview);
    const mini = el.querySelector(".mini");
    if (mini) { mini.classList.toggle("far", st.overview); mini.querySelector("span").textContent = st.overview ? "寄る" : "全体"; }
  }

  /** 場面の中の変化は、テロップ・操作・一覧だけ描き直す（絵は動きを見せるために残す）。 */
  patch() {
    const { el, st } = this;
    if (st.scene === "map") {
      el.querySelector('[data-slot="telop"]').innerHTML = this.destHtml();
      el.querySelector('[data-slot="ctrl"]').innerHTML = this.mapCtrlHtml();
      const sheet = el.querySelector('[data-slot="sheet"]');
      sheet.classList.toggle("open", st.list);
      sheet.querySelectorAll(".row").forEach((row) => row.setAttribute("aria-current", String(Number(row.dataset.spot) === st.sel)));
      this.syncMap();
    } else if (!this.talk) {
      el.querySelector('[data-slot="telop"]').innerHTML = this.craftTelopHtml();
      el.querySelector('[data-slot="ctrl"]').innerHTML = this.craftCtrlHtml();
      const bowl = el.querySelector(".bowl"); if (bowl) bowl.src = IMG[`bowl_${PACKS[st.pack].id}`];
    }
  }

  /* ── 会話 ── */

  talkHtml() {
    const talk = this.talk;
    return `
      <img class="amb" src="${IMG[talk.bg]}" alt="">
      <div class="pic stage"><img class="bg" src="${IMG[talk.bg]}" alt=""><div class="actors"></div></div>
      <i class="veil"></i><img class="smoke" src="${IMG.smoke}" alt="">
      ${hudHtml(talk.place)}
      <div class="body">
        <div class="telop" data-slot="telop"></div>
        <div class="ctrl" data-slot="ctrl"></div>
      </div>
      <div class="placecard"><b>${talk.place[0]}</b><small>${talk.place[1]}</small></div>`;
  }

  /** いまの行を画面へ: 立ち絵（登場・表情・話している側）、名前、テロップ、操作。 */
  applyLine({ instant = false, delay = 0 } = {}) {
    const { el, st } = this, line = this.line;
    // 一覧で途中の行から始める時は、それまでに登場した人を先に立たせる
    if (!Object.keys(this.cast).length) for (const prev of this.talk.steps.slice(0, st.step)) if (prev.id) this.cast[prev.id] = prev.face;
    const speaking = line.kind === "say" ? line.id : null;
    const entering = speaking && !(speaking in this.cast);
    if (speaking) this.cast[speaking] = line.face;
    this.layoutActors({ speaking, entering, instant });

    const who = line.kind === "say" ? CAST[line.id] : null;
    const name = line.kind === "say" ? `<div class="name"><b>${who.name}</b><span>${who.en}</span></div>`
      : line.kind === "player" ? `<div class="name player"><b>はじめ</b><span>HAJIME</span></div>`
      : line.kind === "inner" ? `<div class="name inner"><b>はじめ</b><span>心の声</span></div>` : `<div class="name narr"><span>—</span></div>`;
    const choosing = st.choosing && line.choice;
    el.querySelector('[data-slot="telop"]').innerHTML = `${name}
      <div class="glass${line.kind === "narr" ? " narr" : ""}${choosing ? " ask" : ""}"><p class="text ${line.kind}">${instant || choosing ? esc(line.text) : typed(line.text, delay)}</p>${choosing ? "" : `<i class="next"></i>`}</div>
      ${choosing ? `<div class="choices">${line.choice.map((text, i) => `<button class="choice" data-act="pick" data-pick="${i}" aria-current="${i === st.pick}" style="--i:${i}"><i></i>${esc(text)}</button>`).join("")}</div>` : ""}`;
    el.querySelector('[data-slot="ctrl"]').innerHTML = `${chipsHtml([["log", "LOG"], ["auto", "AUTO", "", st.auto], ["skip", "SKIP", "", st.skip], ["terms", "用語"], ["config", "設定"]])}
      ${dpadHtml(choosing ? "up down" : "")}${aHtml(choosing ? "決定" : "次へ")}`;
    this.typedAt = instant || choosing ? 0 : performance.now() + delay + [...line.text].length * TYPE_MS + 120;
    el.classList.toggle("typing", !!this.typedAt);
  }

  /** 立ち絵の位置と大きさ。1人は中央で少し寄り（身長差は半分だけ）、2人は左右で実際の身長差。話している側を手前に明るく。 */
  layoutActors({ speaking = null, entering = false, instant = false } = {}) {
    const box = this.el.querySelector(".actors");
    if (!box) return;
    const ids = Object.keys(this.cast);
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const pair = ids.length >= 2;
    const body = h * (pair ? 1.04 : 1.3);       // 身長比1.0の人の「頭の先〜足元」の長さ
    const feet = h * (pair ? 1.28 : 1.46);      // 足元の高さ（絵の下にはみ出す）
    const safeTop = h * (pair ? 0.185 : 0.085); // 頭がこれより上へ行かない（左右は上の表示の下、中央は表示の間）
    ids.forEach((id, index) => {
      const c = CAST[id];
      const scale = pair ? c.scale : 1 + (c.scale - 1) * 0.5;
      const content = body * scale, imgH = content / c.h, imgW = imgH * ASPECT;
      const head = Math.max(safeTop, feet - content);
      const top = head - (1 - c.b - c.h) * imgH;
      const slot = pair ? (index === 0 ? 0.27 : 0.73) : 0.5;
      let img = box.querySelector(`img[data-id="${id}"]`);
      const src = IMG[`${id}_${this.cast[id]}`];
      if (!img) {
        img = document.createElement("img");
        img.className = "actor"; img.dataset.id = id; img.alt = c.name; img.draggable = false; img.src = src;
        if (entering && id === speaking && !instant) img.classList.add("enter");
        box.append(img);
      } else if (img.getAttribute("src") !== src) {
        img.src = src;
        if (!instant) { img.classList.remove("hop"); void img.offsetWidth; img.classList.add("hop"); }
      }
      Object.assign(img.style, { height: `${imgH}px`, left: `${w * slot - imgW * c.ax}px`, top: `${top}px` });
      const active = id === speaking;
      img.classList.toggle("active", active);
      img.classList.toggle("back", pair && speaking !== null && !active);
      img.classList.toggle("hush", speaking === null); // 地の文・心の声・はじめの台詞の間は少し落とす
      if (img.classList.contains("enter")) requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
    });
  }

  /* ── シーシャ作り ── */

  craftHtml() {
    const { st } = this, info = CRAFT[st.scene];
    const pic = st.scene === "pack" ? `<img class="bg" src="${IMG.tonari}" alt=""><img class="bowl" src="${IMG[`bowl_${PACKS[st.pack].id}`]}" alt="">`
      : st.scene === "holes" ? `<img class="bg" src="${IMG.tonari}" alt=""><div class="foil"><img src="${IMG.foil}" alt=""><svg viewBox="-100 -100 200 200" class="foil-marks"></svg></div>`
      : `<img class="bg" src="${IMG.tonari}" alt=""><img class="pull-actor" src="${IMG.pullActor}" alt=""><img class="puff" src="${IMG.smoke}" alt="">
         <div class="thermo"><small>温度帯</small><span><i></i></span></div>`;
    return `
      <img class="amb" src="${IMG.tonari}" alt="">
      <div class="pic craft craft-${st.scene}">${pic}</div>
      <i class="veil"></i>
      ${hudHtml(["tonari", "練習"])}
      <div class="stepchip"><small>LESSON</small><b>${info.step}</b></div>
      <div class="body">
        <div class="telop" data-slot="telop">${this.craftTelopHtml()}</div>
        <div class="ctrl craft" data-slot="ctrl">${this.craftCtrlHtml()}</div>
      </div>`;
  }

  craftTelopHtml() {
    const { st } = this, info = CRAFT[st.scene];
    const options = st.scene === "pack" ? `<div class="choices packs">${PACKS.map((p, i) => `<button class="choice${p.locked ? " locked" : ""}" data-act="pack" data-pack="${i}" aria-current="${i === st.pack}" style="--i:${i}"><i></i><span><b>${p.name}</b><small>${p.note}</small></span></button>`).join("")}</div>` : "";
    return `<div class="name"><img src="${IMG.faceSumi}" alt=""><b>スミさん</b><span>SUMI</span></div>
      <div class="glass${st.scene === "pack" ? " ask" : ""}"><p class="text">${esc(info.coach)}</p>${st.scene === "pack" ? "" : `<div class="hint"><b>${info.step}</b><span>${info.hint}</span></div>`}</div>${options}`;
  }

  craftCtrlHtml() {
    const { st } = this;
    if (st.scene === "pack") {
      return `${chipsHtml([["help", "説明"], ["menu", "MENU"]])}${dpadHtml("up down")}${aHtml("決める", { disabled: !!PACKS[st.pack].locked })}`;
    }
    if (st.scene === "holes") {
      const done = st.holes.length, good = st.holes.filter((hole) => hole.good).length;
      return `${chipsHtml([["help", "説明"], ["menu", "MENU"]])}
        <div class="dial" style="--fill:0"><svg viewBox="0 0 100 100"><circle class="dial-bg" cx="50" cy="50" r="42"/><circle class="dial-just" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-40"/><circle class="dial-fill" cx="50" cy="50" r="42" pathLength="100"/></svg>
          <b>${done}<small>/${HOLE_COUNT}</small></b><span>穴の大きさ</span><em>ぴったり ${good}</em></div>
        ${aHtml("刺す", { cls: "hold" })}`;
    }
    return `${chipsHtml([["help", "説明"], ["menu", "MENU"]])}
      <button class="serve" data-act="serve"><b>提供する</b><small>あと2口</small></button>
      <div class="gauge"><span class="lab l">下げ吸い</span><span class="lab r">上げ吸い</span>${meterHtml()}</div>
      <div class="lamps"><span><small>フレーバーの持ち</small><span class="leaves">${`<img src="${IMG.leaf}" alt="">`.repeat(5)}</span></span>
        <span><small>吸い出し</small><span class="pulls">${Array.from({ length: 5 }, (_, i) => `<i class="${i < st.pulls ? "on" : ""}"></i>`).join("")}<b>${st.pulls}/5</b></span></span></div>
      ${aHtml("吸う", { cls: "center" })}`;
  }

  /** 穴あけ: 目印（ひし形）・開けた穴・針先（水色の輪）を描く。 */
  drawHoles() {
    const svg = this.el.querySelector(".foil-marks");
    if (!svg) return;
    const at = (deg, r = 62) => [r * Math.cos((deg - 90) * Math.PI / 180), r * Math.sin((deg - 90) * Math.PI / 180)];
    const step = 360 / HOLE_COUNT, next = this.st.holes.length;
    const marks = Array.from({ length: HOLE_COUNT }, (_, i) => {
      const [x, y] = at(i * step);
      if (i < next) return "";
      return i === next ? `<g class="target" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(45)"><rect x="-6.5" y="-6.5" width="13" height="13"/><rect x="-3.6" y="-3.6" width="7.2" height="7.2"/></g>`
        : `<circle class="todo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2"/>`;
    }).join("");
    const holes = this.st.holes.map((hole) => { const [x, y] = at(hole.deg); return `<circle class="hole${hole.good ? " good" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hole.r.toFixed(1)}"/>`; }).join("");
    svg.innerHTML = `${holes}${marks}<circle class="tip" r="7"/>`;
  }

  /* ── 入力 ── */

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (this.dragged) { this.dragged = false; return; }
    if (!hit || !this.el.contains(hit)) {
      if (this.talk && event.target.closest('[data-slot="telop"]')) this.pressA();
      return;
    }
    const act = hit.dataset.act, { st } = this;
    if (act === "dir") this.move(hit.dataset.dir);
    else if (act === "spot") this.select(Number(hit.dataset.spot), { keepList: false });
    else if (act === "spot-go") this.select(Number(hit.dataset.spot));
    else if (act === "overview") this.toggleOverview();
    else if (act === "list") { st.list = !st.list; this.patch(); }
    else if (act === "pick") { const same = st.pick === Number(hit.dataset.pick); st.pick = Number(hit.dataset.pick); this.applyLine({ instant: true }); if (same) this.pressA(); }
    else if (act === "pack") { st.pack = Number(hit.dataset.pack); this.patch(); }
    else if (act === "a") { if (st.scene !== "holes") this.pressA(); }
    else if (act === "serve") { if (!this.fixed) this.setScene("map"); }
    else if (act === "fn") {
      const id = hit.dataset.fn;
      if (id === "list") { st.list = !st.list; this.patch(); }
      else if (id === "next") { // 「！」の付いた店を順に回る
        const marks = ORDER.filter((i) => SPOTS[i].mark), after = marks.find((i) => ORDER.indexOf(i) > ORDER.indexOf(st.sel));
        this.select(after ?? marks[0]);
      } else if (id === "auto" || id === "skip") { st[id] = !st[id]; hit.classList.toggle("on", st[id]); }
    }
  }

  onDown(event) {
    const { st } = this;
    if (st.scene === "holes" && event.target.closest('.btn-a[data-act="a"]')) { this.holdAt = performance.now(); event.target.closest(".btn-a").setPointerCapture?.(event.pointerId); return; }
    const map = event.target.closest("[data-map]");
    if (map && !st.overview && this.view) { this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: this.view.x, oy: this.view.y, moved: false }; return; }
    const card = event.target.closest("[data-swipe]");
    if (card) this.swipe = { x: event.clientX };
  }

  onMove(event) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    this.cam = { x: drag.ox + dx, y: drag.oy + dy };
    this.camera(false);
  }

  onUp(event) {
    if (this.holdAt) { const held = performance.now() - this.holdAt; this.holdAt = 0; this.punch(held); return; }
    if (this.drag) { this.dragged = this.drag.moved; this.drag = null; if (this.dragged) setTimeout(() => { this.dragged = false; }, 0); return; }
    if (this.swipe) {
      const dx = event.clientX - this.swipe.x; this.swipe = null;
      if (Math.abs(dx) > 36) { this.dragged = true; setTimeout(() => { this.dragged = false; }, 0); this.select(stepSpot(this.st.sel, dx < 0 ? 1 : -1)); }
    }
  }

  move(dir) {
    const { st } = this, line = this.line;
    if (st.scene === "map") {
      if (st.list) { if (dir === "up" || dir === "down") this.select(stepSpot(st.sel, dir === "down" ? 1 : -1), { keepList: true }); return; }
      // 左右で隣の店へ順に送る（地図の左から右の順。端まで行くと反対の端へ）。上は全体／寄る、下は一覧。
      if (dir === "left" || dir === "right") this.select(stepSpot(st.sel, dir === "right" ? 1 : -1), { keepView: true });
      else if (dir === "up") this.toggleOverview();
      else { st.list = true; this.patch(); }
    } else if (this.talk && st.choosing && line.choice && (dir === "up" || dir === "down")) {
      st.pick = (st.pick + (dir === "down" ? 1 : line.choice.length - 1)) % line.choice.length; this.applyLine({ instant: true });
    } else if (st.scene === "pack" && (dir === "up" || dir === "down")) {
      st.pack = (st.pack + (dir === "down" ? 1 : PACKS.length - 1)) % PACKS.length; this.patch();
    }
  }

  pressA() {
    const { st, el } = this;
    if (st.scene === "map") {
      if (st.list) { st.list = false; this.patch(); return; }
      if (SPOTS[st.sel].closed || this.fixed) return;
      const scene = { tonari: "tonari", minto: "minto" }[SPOTS[st.sel].id];
      if (scene) this.enterShop(scene); else this.toast("この試作で入れるのは PEPPERMINT と tonari です");
      return;
    }
    if (this.talk) {
      const line = this.line;
      if (this.typedAt && performance.now() < this.typedAt) { // 文字送りの途中なら全文を出す
        this.typedAt = 0; el.classList.remove("typing"); el.querySelector(".type")?.classList.add("all"); return;
      }
      if (line.choice && !st.choosing) { st.choosing = true; st.pick = 0; this.applyLine({ instant: true }); return; }
      st.choosing = false;
      if (st.step + 1 < this.talk.steps.length) { st.step += 1; this.applyLine(); }
      else if (this.fixed) { st.step = 0; this.render(); }
      else this.setScene(st.scene === "minto" ? "tonari" : "pack");
      return;
    }
    if (st.scene === "pack") { if (!PACKS[st.pack].locked && !this.fixed) this.setScene("holes"); return; }
    if (st.scene === "pull") {
      if (this.hold) return;
      st.pulls = Math.min(5, st.pulls + 1);
      this.hold = performance.now();
      el.classList.remove("puffing"); void el.offsetWidth; el.classList.add("puffing");
      this.patch();
      setTimeout(() => { this.hold = 0; if (st.pulls >= 5) { if (this.fixed) { st.pulls = 0; this.patch(); } else this.setScene("map"); } }, 700);
    }
  }

  toast(text) {
    this.el.querySelector(".toast")?.remove();
    const note = document.createElement("div");
    note.className = "toast"; note.textContent = text;
    this.el.append(note);
    setTimeout(() => note.remove(), 2200);
  }

  /** 穴あけ: 押していた長さで穴の大きさ、針先の位置で当たりを決める。 */
  punch(heldMs) {
    const { st } = this;
    if (st.scene !== "holes" || st.holes.length >= HOLE_COUNT) return;
    const target = st.holes.length * 360 / HOLE_COUNT;
    const size = Math.min(1, heldMs / 900);
    st.holes.push({ deg: this.tipDeg ?? target, r: 2.2 + size * 4.2, good: Math.abs((this.tipDeg ?? target) - target) < 5 && size > 0.3 && size < 0.62 });
    this.el.querySelector(".dial")?.style.setProperty("--fill", "0");
    this.patch(); this.drawHoles();
    if (st.holes.length >= HOLE_COUNT) setTimeout(() => { if (this.fixed) { st.holes = []; this.patch(); this.drawHoles(); } else this.setScene("pull"); }, 900);
  }

  /** 地図から店へ: 選んだ店へ寄ってから、煙の幕で店内へ替える。 */
  enterShop(scene) {
    const { el } = this;
    const pan = el.querySelector(".map-pan");
    if (pan && this.view) {
      const { w, h, mw, mh } = this.view, spot = SPOTS[this.st.sel], s = 1.7;
      pan.style.transform = `translate(${w / 2 - mw * s * spot.x / 100}px, ${h * 0.4 - mh * s * spot.y / 100}px) scale(${s})`;
    }
    el.classList.add("leaving");
    setTimeout(() => { el.classList.remove("leaving"); this.setScene(scene, { arrive: true }); }, 620);
  }

  setScene(scene, { arrive = false } = {}) {
    Object.assign(this.st, { scene, step: 0, choosing: false, pick: 0, list: false, overview: false, holes: [], pulls: 0, pack: 1 });
    this.render({ delay: arrive ? 1200 : 0 }); // 店に着いた時は、店名の札が出てから文字を送る
    if (arrive) { this.el.classList.add("arriving"); setTimeout(() => this.el.classList.remove("arriving"), 1500); }
    this.onScene?.(scene);
  }

  tick(now) {
    const { st, el } = this;
    if (st.scene === "pull" && !this.hold) el.querySelector(".meter")?.style.setProperty("--needle", `${(Math.sin((now - this.t0) / 620) * 76).toFixed(1)}deg`);
    if (st.scene === "holes") {
      const target = st.holes.length * 360 / HOLE_COUNT;
      this.tipDeg = target + Math.sin((now - this.t0) / 430) * 15;
      const tip = el.querySelector(".foil-marks .tip");
      if (tip && st.holes.length < HOLE_COUNT) {
        const a = (this.tipDeg - 90) * Math.PI / 180;
        tip.setAttribute("cx", (62 * Math.cos(a)).toFixed(2)); tip.setAttribute("cy", (62 * Math.sin(a)).toFixed(2));
      }
      if (this.holdAt) el.querySelector(".dial")?.style.setProperty("--fill", String(Math.min(1, (now - this.holdAt) / 900)));
    }
    if (this.talk && this.typedAt && now >= this.typedAt) { this.typedAt = 0; el.classList.remove("typing"); }
    requestAnimationFrame(this.tick);
  }

  relayout() {
    if (this.st.scene === "map") this.camera(false);
    else if (this.talk) this.layoutActors({ speaking: this.line.kind === "say" ? this.line.id : null, instant: true });
  }
}

/* ───────── ページ ───────── */

const params = new URLSearchParams(location.search);
const app = document.getElementById("app");
const root = document.documentElement;
let current = null;
const phones = [];

function showGallery() {
  current = null; phones.length = 0;
  root.dataset.view = "gallery";
  root.style.fontSize = "";
  app.innerHTML = `<main class="gallery">
    <h1 class="g-title">縦画面「煙の舞台」 第1章の場面</h1>
    <p class="g-lead">C案を第1章の場面で詰めた試作です。パッドを大きくしてテロップを少し上げ、立ち絵の位置と地図の動きを作り直しました。どの画面も十字キーとAを押せます。</p>
    <ul class="g-points">
      <li><b>立ち位置</b>1人は中央で少し寄り、2人は左右で身長差そのまま。話している側が手前で明るい</li>
      <li><b>地図</b>左右キーで隣の店へ画面が送られる。上で全体、下で一覧。指でずらす・「！」の店へ飛ぶ</li>
      <li><b>パッド</b>輪の十字キーとAを大きく（幅の約半分と1/3強）。作る場面は工程ごとの操作に替わる</li>
    </ul>
    <p class="g-note">絵・立ち絵・台詞は本編の素材、配置と動きが今回の案です。本編の進行や保存には触れません。<a href="?view=play" data-go="play">1台で通して触る</a></p>
    <div class="g-grid">${GALLERY.map((item, i) => `<figure class="g-cell"><article class="phone" data-i="${i}"></article><figcaption>${item.caption}</figcaption></figure>`).join("")}</div>
  </main>`;
  app.querySelectorAll(".phone").forEach((el) => { const item = GALLERY[Number(el.dataset.i)]; phones.push(new Phone(el, item.scene, { fixed: true, ...item })); });
  scrollTo(0, 0);
}

/** 1台を画面いっぱいに。幅 39rem・高さ 66rem 以上が入るよう、html の文字の大きさを画面に合わせる。 */
function fit() {
  if (current) {
    const box = app.getBoundingClientRect();
    const rem = Math.min(box.width / 39, box.height / 66);
    root.style.fontSize = `${rem}px`;
    current.el.style.height = `${Math.min(box.height, rem * 92)}px`;
    current.relayout();
  } else phones.forEach((phone) => phone.relayout());
}

function showPlay(scene = "map") {
  root.dataset.view = "play"; phones.length = 0;
  const bare = params.has("bare");
  app.innerHTML = `<div class="frame"><article class="phone"></article>${bare ? "" : `<nav class="switch" aria-label="場面の切り替え">
    ${SCENES.map((id) => `<button data-scene="${id}" aria-pressed="${id === scene}">${SCENE_LABEL[id]}</button>`).join("")}<a href="?view=gallery" data-go="gallery">一覧</a></nav>`}</div>`;
  const el = app.querySelector(".phone");
  // 先に大きさを決めてから描く（立ち絵と地図の位置は絵の大きさから決まる）
  const box = app.getBoundingClientRect(), rem = Math.min(box.width / 39, box.height / 66);
  root.style.fontSize = `${rem}px`; el.style.height = `${Math.min(box.height, rem * 92)}px`;
  current = new Phone(el, scene, { step: Number(params.get("step")) || 0, list: params.has("list"), overview: params.has("overview"), choice: params.has("choice") });
  const nav = app.querySelector(".switch");
  if (!nav) return;
  current.onScene = (id) => nav.querySelectorAll("[data-scene]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scene === id)));
  let idle;
  const wake = () => { nav.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => nav.classList.add("idle"), 3200); };
  wake();
  nav.addEventListener("pointerdown", wake);
  nav.addEventListener("click", (event) => { const button = event.target.closest("button[data-scene]"); if (button && current) current.setScene(button.dataset.scene); });
}

app.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (!go) return;
  event.preventDefault();
  if (go.dataset.go === "play") showPlay(); else showGallery();
});
addEventListener("keydown", (event) => {
  if (!current) return;
  const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (dir) { event.preventDefault(); current.move(dir); }
  else if (event.key === "Enter" || event.key === " " || event.key === "z") { event.preventDefault(); if (current.st.scene === "holes") current.punch(400); else current.pressA(); }
});
addEventListener("resize", fit);
addEventListener("load", fit);

const wantPlay = params.get("view") === "play" || (params.get("view") !== "gallery" && matchMedia("(max-width: 720px)").matches);
if (wantPlay) showPlay(SCENES.includes(params.get("scene")) ? params.get("scene") : "map"); else showGallery();
