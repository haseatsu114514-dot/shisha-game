// 縦画面C案「煙の舞台」: シーシャくじ（福引きのガラガラ）を縦へ移した試作（要望台帳 VPS02）。
// 本編のくじ（remake/js/daily/kuji.js の kujiRows・draw・drawMany と、kuji-reveal.js の賞の札）の流れをそのまま縦にした:
//   棚（残り枚数と景品の並び）→ ×1・×5・×10 で引く → ガラガラが回って賞の色の玉が出る → 賞の札が開く（連続は小さな札が並ぶ）→ 棚へ戻る。
// ガラガラの演出は本編の motions/garagara.js をそのまま呼ぶ（1280×720 の舞台を、抽選器と受け皿のまわりだけ上の画面に大きく写す）。
//   本編の演出は音の仕組み（core/audio.js）もそのまま使う。「引く」を押した後に回すので、合成の効果音（溜め・回す・止まる・賞の音）は鳴り、
//   録音の効果音（玉の転がる音・紙吹雪の拍手など）は鳴らない（試作では録音の効果音を読み込む解禁をしていない）。止まっている時の抽選器は、同じ部品（garagara-stage.js）で組む。
// くじの中身・値段・抽選器の見た目は正本の data/kuji.json をそのまま読む（地元の本店の「シーシャくじ（1回500円）」）。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝店内のカウンターの抽選器、真ん中＝凛想のひとこと、下（親指の届く所）＝景品の並びと引く札、結果の札。
// 箱は試作だけ（shop-data.mjs の WALLET。並びはページを開いた時に一度だけ混ぜる）。本編の箱・所持金・持ち物・保存には触れない。
import { garagara } from "../../js/motions/garagara.js";
import { stageParts, ballPart, AX, REST } from "../../js/motions/garagara-stage.js";
import { warmKujiArt } from "../../js/motions/kuji-art.js";
import { WALLET, yen, addStock, loadShopData, productArtHtml, hasEquipArt, FLAVOR_BOX_GRAMS } from "./shop-data.mjs";

// ── 本編の値と言葉の写し（出どころ） ──
export const RANK_NAME = { S: "S賞", A: "A賞", B: "B賞", C: "C賞", LAST: "ラストワン賞" }; // kuji.js
const DRY_STREAK = 10;                                       // kuji.js の KUJI_DRY_STREAK
const HIGH = new Set(["S", "A"]);
// 棚の前の凛想のひとこと（kuji.js の kujiRows の初回と kujiClerkLine。地元の本店に凛想が居る時）
const RIO_LINES = {
  first: "これ、実は在庫しょぶ……なんでもない。引きは引き。直感で行きなさい",
  last_one: "最後の一枚、持っていったね。箱、空っぽ……ちょっと寂しいね",
  top: "……出たね。引いた時の顔、試香の時より正直だった",
  dry: "十回続けて、上の賞なし。統計的には、そろそろ……統計は、慰めにならないけど",
};
// 抽選器の舞台（本編の 1280×720）のうち、縦の上の画面に写す範囲。抽選器・受け皿・係の人の鐘が入る幅
const VIEW = { x: 340, w: 700, cy: 404 };
const STAGE = { w: 1280, h: 720 };
const HANDLE_AT = 148; // garagara.js: 止まったときのハンドルの向き
const STILL = { zoom: 1.04, zx: AX, zy: 600, dx: 30, dy: -6 }; // garagara.js の1回引きの抽選器の置き方

/** その店（地元の本店）の、第1章で引けるくじ（kuji.js の grades） */
export const kujiGrade = (data) => Object.entries(data?.kuji?.grades || {}).map(([id, g]) => ({ id, ...g }))
  .find((g) => (g.shop || "home") === "home" && (g.chapterMin || 1) <= 1 && 1 <= (g.chapterMax || Infinity)) || null;
const shuffle = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
/** 箱（kuji.js の newBox と同じ形。並びは作った時に決まり、引くたびに先頭から出す）。目利きの盤のスキル（K26）は試作では使わない */
function newBox(g) {
  const order = [];
  g.prizes.forEach((p, i) => { for (let k = 0; k < p.count; k++) order.push(i); });
  return { id: g.id, order: shuffle(order), drawn: 0, price: g.price, prizes: structuredClone(g.prizes), lastOne: structuredClone(g.lastOne), seen: false };
}
export function kujiBox(data) {
  const g = kujiGrade(data);
  if (!g) return null;
  if (!WALLET.kuji || WALLET.kuji.id !== g.id) WALLET.kuji = newBox(g);
  return WALLET.kuji;
}
/** 景品ごとの残り枚数 */
export const kujiLeft = (box) => { const left = box.prizes.map(() => 0); for (const i of box.order.slice(box.drawn)) left[i] += 1; return left; };
const drawnPrizes = (box) => box.order.slice(0, box.drawn).map((i) => box.prizes[i]);
const dryStreak = (box) => { const d = drawnPrizes(box); let n = 0; for (let i = d.length - 1; i >= 0 && !HIGH.has(d[i].rank); i--) n++; return n; };
const prizeName = (p) => (p.rank === "LAST" ? p.name.replace(/^ラストワン賞・/, "") : p.name);
/** 景品の絵（本編 kuji-prize-art.js と同じ考え: 採用済みの商品の絵。詰め合わせは中身を重ね、絵の無い小物は景品の包み） */
export function prizeArtHtml(prize, data, size) {
  if (prize.flavorId) return productArtHtml("flavor", prize.flavorId, data, size);
  if (prize.flavors?.length) return `<span class="kjp-fan" style="--s:${size}rem">${prize.flavors.slice(0, 2).map((f) => productArtHtml("flavor", f.id, data, size * 0.78)).join("")}</span>`;
  if (prize.equipId && hasEquipArt(prize.equipId, data)) return productArtHtml("equip", prize.equipId, data, size);
  return `<span class="sp-art kjp-gift" style="--s:${size}rem"></span>`;
}

const ICONS = {
  kjBack: '<path d="M14.500 5l-7 7 7 7"/>',
  kjSkip: '<path d="M4 6v12l8-6zM13 6v12l8-6z" class="f"/>',
  kjX: '<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>',
};

export class KujiScene {
  static META = {
    id: "kuji", label: "福引", acc: "#f2c14a",
    options: { name: "box", label: "くじの箱", default: "full", values: { full: "新しい箱", last: "残り2枚" } },
    gallery: {
      title: "シーシャくじ（福引きのガラガラ）",
      note: "本編のシーシャくじを縦へ。ガラガラの演出は本編（motions/garagara.js）をそのまま呼び、抽選器と受け皿のまわりだけを上の画面に大きく写す（玉が出る前の溜め・賞の色の光・上位の鐘も本編のまま）。中身と値段は本編のデータ（data/kuji.json）。音は本編の合成の効果音だけ鳴る（録音の効果音は鳴らない）。下に凛想のひとことと景品の並び、親指の届く所に ×1・×5・×10 の札。引くと上でガラガラが回り、下に賞の札が開く（連続は小さな札が並ぶ）。箱は試作だけで、本編の箱・所持金・保存には触れない。",
      shots: [
        { caption: "くじの棚（引く前）" },
        { caption: "1回引いた（A賞の札）", result: "A" },
        { caption: "10連の結果", result: "10" },
        { caption: "ラストワン賞（箱を引き切った）", result: "LAST" },
        { caption: "ガラガラを回している所（S賞・くり返し）", demo: "S" },
      ],
    },
  };

  /** @param opts box＝"last" なら残り2枚の箱から、result＝一覧（PC）に並べる結果の札（"A"・"10"・"LAST"）、demo＝一覧でくり返し回す賞 */
  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, opts: { ...opts } });
    Object.assign(kit.ICONS, ICONS);
    Object.assign(this, { data: null, mode: "shelf", queue: [], results: null, busy: false, timers: new Set(), line: null });
    if (!phone.fixed) { phone.extOpts.result = null; phone.extOpts.demo = null; }
  }

  /* ── 骨組み ── */

  html() {
    const { icon } = this.kit;
    return `
      <div class="kjp-app">
        <section class="kjp-stage" data-slot="stage"><div class="kjp-host" data-slot="host"></div><i class="kjp-fade" aria-hidden="true"></i>
          <header class="kjp-head"><button class="kjp-back" data-kj="back" aria-label="売り場へ戻る">${icon("kjBack")}</button>
            <span class="kjp-title"><b>シーシャくじ</b><small data-slot="left"></small></span>
            <span class="kjp-money"><small>所持金</small><b data-slot="money"></b></span></header>
        </section>
        <p class="kjp-clerk" data-slot="clerk" hidden><img src="${this.kit.REMAKE_IMG}ui/face_icons/new/face_rio.webp" alt=""><span></span></p>
        <section class="kjp-panel" data-slot="panel"></section>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = Object.fromEntries(["stage", "host", "left", "money", "clerk", "panel"].map((k) => [k, q(`[data-slot="${k}"]`)]));
    this.relayout();
    loadShopData().then((data) => {
      if (this.dead) return;
      this.data = data;
      this.grade = kujiGrade(data);
      if (!this.grade) { this.refs.panel.innerHTML = `<p class="kjp-empty">今はくじが置いてない</p>`; return; }
      this.machine = { look: this.grade.machine || "walnut", title: String(this.grade.label || "シーシャくじ").replace(/（.*$/, "") };
      warmKujiArt(this.machine.look);
      const { opts } = this;
      // 一覧（PC）の見本は自分だけの箱（財布の箱は動かさない）。「残り2枚」は、ラストワン賞を確かめるために箱の終わりまで進めておく
      this.box = this.phone.fixed || opts.result || opts.demo ? newBox(this.grade) : kujiBox(data);
      if (opts.box === "last" && this.box.drawn < this.box.order.length - 2) this.box.drawn = this.box.order.length - 2;
      this.still();
      if (!this.box.seen) { this.box.seen = true; this.say(RIO_LINES.first); }
      if (opts.result) this.showPreview(opts.result);
      else this.showShelf();
      if (opts.demo) this.later(() => this.demo(opts.demo), 700);
    }).catch((error) => {
      if (this.dead) return;
      console.warn("くじのデータを読めませんでした:", error);
      this.refs.panel.innerHTML = `<p class="kjp-empty">くじを読み込めませんでした</p>`;
    });
  }

  destroy() {
    this.dead = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    // 回している途中で場面を離れたら、演出を飛ばして片付ける
    this.refs?.host.querySelectorAll(".kj-skip").forEach((b) => b.click());
  }

  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); if (!this.dead) fn(); }, ms); this.timers.add(id); }

  /* ── 上の画面: 抽選器 ── */

  /** 1280×720 の舞台を、抽選器のまわり（VIEW）が上の画面の幅いっぱいに入るよう縮めて置く */
  relayout() {
    const { stage, host } = this.refs || {};
    if (!stage) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const s = w / VIEW.w;
    const ty = Math.min(0, Math.max(h - STAGE.h * s, h / 2 - VIEW.cy * s));
    host.style.transform = `translate(${(-VIEW.x * s).toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`;
  }

  /** 店内の写真を、抽選器の後ろの景色にする（本編は今の場面の背景を写す。試作には背景の層が無いので、店の写真を入れる） */
  dress(node) {
    node.querySelectorAll(".kj-bg:not(.dressed)").forEach((bg) => {
      bg.classList.add("dressed");
      const img = document.createElement("i");
      img.className = "kj-bg-img";
      img.style.backgroundImage = `url("${this.kit.REMAKE_IMG}backgrounds/bg_shop.webp")`;
      bg.append(img);
    });
  }

  /** 止まっている抽選器（本編の1回引きと同じ置き方）。rank があれば、その玉を受け皿に置いておく */
  still(rank = null) {
    const { host } = this.refs;
    host.querySelector(".kjp-still")?.remove();
    const set = stageParts(this.machine);
    const machine = document.createElement("div");
    machine.className = "kj-machine";
    Object.assign(machine.style, { transformOrigin: `${STILL.zx}px ${STILL.zy}px`, transform: `translate(${STILL.dx}px, ${STILL.dy}px) scale(${STILL.zoom})` });
    machine.append(...set.machine);
    if (rank) {
      const ball = ballPart(rank);
      ball.node.style.transform = `translate(${REST[0] - 17}px, ${REST[1] - 17}px)`;
      ball.node.style.opacity = "1";
      ball.halo.style.opacity = rank === "C" ? "0.1" : "0.5";
      machine.append(ball.node);
    }
    set.drum.style.setProperty("--th", "0deg");
    set.handle.style.transform = `rotate(${HANDLE_AT}deg)`;
    set.spot(1);
    const cam = document.createElement("div");
    cam.className = "kj-cam";
    cam.append(...set.scene, ...set.lights, machine);
    const node = document.createElement("div");
    node.className = "mo-garagara kjp-still";
    node.dataset.look = set.look;
    node.append(cam, ...set.overlays);
    host.prepend(node);
    this.dress(node);
  }

  /* ── 下の画面: 棚・結果 ── */

  say(text) {
    const { clerk } = this.refs;
    this.line = text;
    clerk.hidden = !text;
    if (text) { clerk.querySelector("span").textContent = `凛想「${text}」`; clerk.classList.remove("in"); void clerk.offsetWidth; clerk.classList.add("in"); }
  }

  syncHead() {
    const { box } = this;
    this.refs.money.textContent = yen(WALLET.money);
    this.refs.left.textContent = box ? `残り ${box.order.length - box.drawn} / ${box.order.length} 枚` : "";
  }

  showShelf() {
    const { esc } = this.kit;
    const { box, grade } = this;
    this.mode = "shelf";
    this.el.dataset.kjMode = "shelf";
    this.syncHead();
    const left = kujiLeft(box), remain = box.order.length - box.drawn, price = box.price ?? grade.price;
    const rows = box.prizes.map((p, i) => ({ rank: p.rank, name: p.name, left: left[i], count: p.count, art: this.artOf(p, 4.4) }));
    if (box.lastOne) rows.push({ rank: "LAST", name: "最後の1枚に付く・中身は秘密", left: remain > 0 ? 1 : 0, count: 1, art: `<span class="sp-art sp-art-text secret" style="--s:4.4rem"><span>？</span></span>` });
    const counts = [1, ...[5, 10].map((t) => Math.min(t, remain)).filter((n, i) => n >= 2 && !(i === 1 && n <= 5))];
    this.refs.panel.innerHTML = `
      <ul class="kjp-lineup">${rows.map((r) => `<li data-rank="${r.rank}"${r.left ? "" : ' data-out="1"'}><i class="kjp-ball" aria-hidden="true"></i>${r.art}
        <span class="kjp-lineup-main"><b>${RANK_NAME[r.rank]}</b><span>${esc(r.name)}</span></span><small>${r.left ? `残り ${r.left}` : "なし"}</small></li>`).join("")}</ul>
      ${remain === 1 ? `<p class="kjp-secret">次が最後の1枚！ ラストワン賞・シークレットつき</p>` : ""}
      <div class="kjp-draws">${remain <= 0 ? `<button disabled><b>売り切れ</b><small>新しい箱は3日後</small></button>`
        : counts.map((n) => `<button data-kj="draw" data-n="${n}"${WALLET.money < price * n ? " disabled" : ""}><b>×${n}</b><small>${yen(price * n)}</small></button>`).join("")}</div>`;
  }

  artOf(prize, size) { return prizeArtHtml(prize, this.data, size); }

  /** 1枚の賞の札（本編の prizeCard の縦の大きさ。札の絵は本編の card-*.webp） */
  cardHtml(p) {
    const { esc, icon } = this.kit;
    return `<article class="kjp-card" data-rank="${p.rank}">
      <span class="kjp-card-art">${this.artOf(p, 11)}</span>
      <div class="kjp-card-body">${p.rank === "S" ? `<i class="kjp-banner">大当たり</i>` : ""}
        <b class="kjp-rank">${RANK_NAME[p.rank]}</b>
        <span class="kjp-name">${esc(prizeName(p))}</span>
        <p class="kjp-desc">${esc(p.desc || "")}</p>
        ${p.dupText ? `<p class="kjp-dupe">${esc(p.dupText)}</p>` : ""}
      </div>
      <button class="kjp-close" data-kj="close" aria-label="閉じる">${icon("kjX")}</button>
    </article>`;
  }

  showCard(p) {
    this.mode = "card";
    this.el.dataset.kjMode = "card";
    this.syncHead();
    const more = this.queue.length;
    this.refs.panel.innerHTML = `${this.cardHtml(p)}<button class="kjp-next" data-kj="close">${more ? "続けて見る（ラストワン賞）" : "棚に戻る"}</button>`;
    this.refs.panel.querySelector(".kjp-card")?.classList.add("reveal");
  }

  showMany(results) {
    const { esc } = this.kit;
    this.mode = "many";
    this.el.dataset.kjMode = "many";
    this.syncHead();
    const best = ["LAST", "S", "A", "B", "C"].find((r) => results.some((p) => p.rank === r)) || "C";
    this.refs.panel.innerHTML = `<header class="kjp-many-head" data-rank="${best}"><b>${results.length}枚の結果</b><span>いちばん上は <em>${RANK_NAME[best]}</em></span></header>
      <ul class="kjp-many">${results.map((p, i) => `<li data-rank="${p.rank}" style="--i:${i}"><i class="kjp-ball" aria-hidden="true"></i>${this.artOf(p, 3.8)}
        <span><b>${RANK_NAME[p.rank]}</b><small>${esc(prizeName(p))}</small></span>${p.dupShort ? `<em class="kjp-dupe-s">同 ${esc(p.dupShort)}</em>` : ""}</li>`).join("")}</ul>
      <button class="kjp-next" data-kj="close">棚に戻る</button>`;
  }

  /* ── 引く（本編 takeTicket・grant・draw・drawMany と同じ順。財布だけ試作のもの） ── */

  grant(prize) {
    const { data } = this;
    if (prize.equipId) {
      if (!WALLET.owned.includes(prize.equipId)) { WALLET.owned.push(prize.equipId); return prize; }
      const gear = data.equipById[prize.equipId];
      const cash = gear && !gear.unsellable && gear.sell_price > 0 ? gear.sell_price : Math.round((prize.sell || 0) * 0.5);
      if (cash) WALLET.money += cash;
      return { ...prize, dupText: `持っているので、中古買い取りの${yen(cash)}を受け取った`, dupShort: yen(cash) };
    }
    if (prize.type === "flavor" && prize.flavorId) addStock(prize.flavorId, prize.grams ?? FLAVOR_BOX_GRAMS);
    else if (prize.type === "flavor" && prize.flavors) prize.flavors.forEach((f) => addStock(f.id, f.grams));
    else if ((prize.type === "goods" || prize.type === "stand") && prize.sell) WALLET.goods.push({ name: prize.name, sell: prize.sell });
    return prize;
  }

  take() {
    const { box } = this;
    if (box.drawn >= box.order.length) return null;
    const prize = box.prizes[box.order[box.drawn]];
    box.drawn += 1;
    const out = [this.grant(prize)];
    if (box.drawn >= box.order.length && box.lastOne) out.push(this.grant(box.lastOne));
    return out;
  }

  async draw(count) {
    const { box, grade } = this;
    const price = box.price ?? grade.price, n = Math.min(count, box.order.length - box.drawn);
    if (this.busy || n < 1 || WALLET.money < price * n) return;
    WALLET.money -= price * n;
    const results = [];
    for (let i = 0; i < n; i++) { const got = this.take(); if (!got) break; results.push(...got); }
    if (n === 1) { this.queue = results.slice(1); await this.spin(results[0].rank, () => this.showCard(results[0])); }
    else await this.spin(results.map((p) => p.rank), () => this.showMany(results));
    // 引いた後のひとこと（kujiClerkLine と同じ順: 引き切った → S賞 → 外れ続き）
    const last = drawnPrizes(box).at(-1);
    if (box.drawn >= box.order.length && box.lastOne) this.say(RIO_LINES.last_one);
    else if (last?.rank === "S" || results.some((p) => p.rank === "S")) this.say(RIO_LINES.top);
    else if (dryStreak(box) >= DRY_STREAK) this.say(RIO_LINES.dry);
    else this.say(null);
  }

  /** ガラガラを回す（本編の演出）。消え始めに onShow で下の札を開く */
  async spin(ranks, onShow) {
    const { host } = this.refs;
    this.busy = true;
    this.el.dataset.kjMode = "spin";
    this.say(null);
    this.refs.panel.innerHTML = `<div class="kjp-spinning"><span>ガラガラ…</span><button data-kj="skip">${this.kit.icon("kjSkip")}<span>とばす</span></button></div>`;
    let shown = false;
    const show = () => { if (shown || this.dead) return; shown = true; onShow(); };
    const top = [].concat(ranks).at(-1);
    try {
      const run = garagara(host, ranks, { ...this.machine, onHandoff: show });
      this.dress(host);
      await run;
    } catch (error) { console.warn("ガラガラの演出を出せませんでした:", error); }
    if (this.dead) return;
    this.busy = false;
    this.still(top);
    show();
  }

  closeCard() {
    if (this.queue.length) { const next = this.queue.shift(); this.spin(next.rank, () => this.showCard(next)); return; }
    this.showShelf();
  }

  /** 一覧（PC）の見本: 箱から決まった賞を出して、札だけ見せる（財布は動かさない） */
  showPreview(kind) {
    const { box } = this;
    const pick = (rank) => box.prizes.find((p) => p.rank === rank);
    if (kind === "LAST") { box.drawn = box.order.length; this.still("LAST"); this.say(RIO_LINES.last_one); this.showCard(box.lastOne); return; }
    const n = Number(kind);
    if (n > 1) {
      const results = box.order.slice(0, n).map((i) => box.prizes[i]);
      if (!results.some((p) => p.rank === "A")) results[3] = pick("A");
      box.drawn = n;
      this.still(results.at(-1).rank);
      this.showMany(results);
      return;
    }
    const p = pick(kind) || box.prizes[0];
    box.drawn = 1;
    this.still(p.rank);
    this.showCard(p);
  }

  /** 一覧（PC）の見本: 決まった賞で、くり返し回す */
  demo(rank) {
    if (this.dead || !this.el.isConnected) return;
    const p = this.box.prizes.find((x) => x.rank === rank) || this.box.prizes[0];
    this.spin(rank, () => this.showCard(p)).then(() => this.later(() => { this.showShelf(); this.later(() => this.demo(rank), 1400); }, 2600));
  }

  /* ── 入力 ── */

  onClick(event) {
    const hit = event.target.closest("[data-kj]");
    if (!hit || !this.el.contains(hit)) return false;
    const act = hit.dataset.kj;
    if (act === "draw") this.draw(Number(hit.dataset.n));
    else if (act === "skip") this.refs.host.querySelectorAll(".kj-skip").forEach((b) => b.click());
    else if (act === "close") { if (!this.busy) this.closeCard(); }
    else if (act === "back") {
      if (this.busy) return true;
      if (this.phone.fixed) { this.showShelf(); return true; }
      this.phone.extOpts.tab = "kuji";
      this.phone.setScene("shop");
    }
    return true;
  }

  move() {}

  pressA() {
    if (this.busy) { this.refs.host.querySelectorAll(".kj-skip").forEach((b) => b.click()); return; }
    if (this.mode === "shelf") this.draw(1); else this.closeCard();
  }

  tick() {}
}
