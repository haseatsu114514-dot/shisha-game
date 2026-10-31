// 大会「生中継」フレームの見本（設計書 docs/design/tournament-craft-redesign-20261031.md）。
// 本編のモジュールは読み込まず、保存データにも触れない。素材は img/ui/tournament-preview/ と既存の顔アイコン・立ち絵。
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs === "string") { children = attrs; attrs = {}; }
  const [name, ...classes] = tag.split(".");
  const node = document.createElement(name || "div");
  if (classes.length) node.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style") for (const [prop, val] of Object.entries(v)) prop.startsWith("--") ? node.style.setProperty(prop, val) : (node.style[prop] = val);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 顔アイコンは assets の原画 PNG を直接使う（このcheckoutでは remake/img の WebP が LFS の未取得ポインタのため）。
const face = (id) => `../assets/ui/face_icons/face_${id}.png`;
const sprite = (id, f = "normal") => `img/sprites/characters/${id}/chr_${id}_${f}.webp`;
const img = (src) => el("img.tb-face", { src, alt: "", decoding: "async" });

const PEOPLE = {
  hajime: { name: "はじめ", c: "#ffd27a" },
  naru: { name: "なる", c: "#f0d8a0" },
  adam: { name: "アダム", c: "#c9463a" },
  minto: { name: "みんと", c: "#7fe0c2" },
};
const JUDGES = [
  { id: "maezono", name: "上園", c: "#ff8db4", used: 3 },
  { id: "dr_kemuri", name: "チャコール博士", short: "博士", c: "#5fe2cf", used: 0 },
  { id: "nagumo", name: "南雲", c: "#f6c95e", used: 0, held: true },
];
const NICO = {
  calm: ["穴の間隔きれい", "はじめ君がんばれ", "なる速いな", "アダムの炭もう赤い", "静かな会場", "初出場って本当？", "外周から丁寧"],
  hot: ["うおおお", "揃ってる揃ってる", "これは◎来るぞ", "南雲さんまだ動かない", "はじめ！はじめ！", "アルミの音が気持ちいい", "キター", "鳥肌"],
  max: ["MAX HEAT!!", "会場やばい", "全員立ってる", "伝説になる", "南雲さん目を開けた", "ここで決める！", "！！！！"],
};
const RIVAL_EVENTS = [
  { id: "adam", text: "炭を取りすぎ！ 白煙が上がる", nico: ["アダムの台すごい煙", "それ焼きすぎじゃ", "豪快すぎる"], heavy: true, step: "炭焼き" },
  { id: "naru", text: "もう蒸らしに入った。速い", nico: ["なる速い", "さすが常連", "もう蒸らし？"], step: "蒸らし" },
  { id: "minto", text: "アルミを一度はがしてやり直し", nico: ["みんと慎重", "やり直した", "丁寧だなあ"], step: "穴あけ" },
];

const stage = $("#tb-stage");
const viewport = $(".viewport");
const reduce = () => $("#reduce").checked;
let scene = "live";
let live = null;

// ---------------------------------------------------------------- 拡大縮小
function fit() {
  const w = viewport.clientWidth;
  const base = viewport.classList.contains("phone") ? 844 : 1280;
  stage.style.transform = `scale(${w / base})`;
}
window.addEventListener("resize", fit);

// ---------------------------------------------------------------- ① 生中継の作業台
function buildLive() {
  const root = el("div.tb-scene.live", { dataset: { stage: "1" } });
  const lights = el("div.lights");
  const chips = el("div.chips", Object.entries(PEOPLE).map(([id, p], i) => el(`div.chip${id === "hajime" ? ".me" : ""}`, { style: { "--c": p.c, "--p": ["46%", "58%", "40%", "33%"][i] }, dataset: { id } }, [
    el("div.pf", [img(face(id))]),
    el("div", [el("div.nm", { text: p.name }), el("div.tb-st", { text: ["穴あけ 7/12", "炭焼き", "詰め", "穴あけ"][i] })]),
    el("div.bar", [el("i")]),
  ])));
  const judges = el("div.judges", JUDGES.map((j) => el(`div.jchip${j.held ? ".held" : ""}`, { style: { "--c": j.c }, dataset: { id: j.id } }, [
    el("div.pf", [img(face(j.id))]),
    el("div", [el("div.nm", { text: j.held ? "南雲 10点保留" : `${j.short || j.name} 投入${j.used}／残り${10 - j.used}` }), el("div.pips", Array.from({ length: 10 }, (_, i) => el(`b${i < j.used ? ".on" : ""}`)))]),
  ])));
  const clock = el("div.clock", { html: '<small>MATCH TIME</small>23:18' });
  const top = el("div.top", [
    el("div.brand", [el("i.tournament-live", { text: "LIVE" }), el("b", { text: "SMOKE CROWN CUP" }), el("small", { text: "｜ 大会" }), el("span.round", { text: "ROUND 1 — A 仕込み" })]),
    chips, clock, judges,
  ]);
  const say = el("div.say", [el("div.pf", [img(face("dr_kemuri"))]), el("div", [el("div.who", { text: "チャコール博士　穴あけ" }), el("div.txt", { text: "外周は熱の広がり。等間隔で、ゆっくりで良いです" })])]);
  const left = el("div.tb-left", [el("div.scene-img"), el("div.tag", { text: "SMOKE CROWN CUP" }), say]);
  const foil = el("div.foil", [
    ...Array.from({ length: 12 }, (_, i) => el(`div.mk${i < 7 ? ".open" : i === 7 ? ".is-target" : ""}`, { style: { "--a": `${i * 30 - 90}deg` } })),
    el("div.cur"),
  ]);
  const info = el("div.info", { html: '<small>外周12穴＋中周12穴</small><b>外周（7/12）</b><small>熱の広がり・安定感</small><div class="cnt">EXCELLENT 5 · GOOD 2 · MISS 0</div>' });
  const center = el("div.center", [foil, info, el("div.tb-btn", { text: "穴を開ける" }), el("div.mini", { text: "◇ 次の目標　○ 動く光　● 開いた穴（現行の工程パネルはそのまま）" })]);
  const seats = el("div.seats", ["naru", "adam", "minto"].map((id, i) => el(`div.seat${i < 2 ? ".smoking" : ""}`, { style: { "--c": PEOPLE[id].c }, dataset: { id } }, [
    el("div.head", [el("div.pf", [img(face(id))]), el("div.nm", { text: PEOPLE[id].name })]),
    el("span.step", { text: ["炭焼き", "詰め", "穴あけ"][i] }),
    el("div.bubble"),
    el("div.tb-smoke"),
    el("div.rig", { html: `<svg viewBox="0 0 60 92" fill="none" stroke="${PEOPLE[id].c}" stroke-width="2"><path d="M30 6v10M22 16h16M26 16v28M34 16v28" opacity=".9"/><ellipse cx="30" cy="10" rx="7" ry="4" fill="${PEOPLE[id].c}" fill-opacity=".35"/><path d="M26 44c-10 6-14 16-14 26 0 10 8 18 18 18s18-8 18-18c0-10-4-20-14-26" fill="${PEOPLE[id].c}" fill-opacity=".18"/><path d="M38 60c10 0 14 8 10 20" opacity=".6"/></svg>` }),
  ])));
  const heat = el("div.heat", { dataset: { stage: "1" } }, [el("div.fill"), el("div.stg", { text: "ざわめき" }), el("div.lab", { text: "会場の熱 CROWD HEAT" }), el("div.val", { text: "46" })]);
  const lane = el("div.lane");
  const bottom = el("div.bottom", [heat, lane]);
  const fx = el("div.fx");
  root.append(lights, top, left, center, seats, bottom, fx);
  const l = { root, chips, judges, clock, say, foil, info, seats, heat, lane, fx, hype: 46, hits: 7, excellent: 5, seconds: 23 * 60 + 18, timers: new Set() };
  // 試合時計: 工程時計が動いている間だけ進む（見本では常に進む）
  const tick = setInterval(() => {
    if (!root.isConnected) return clearInterval(tick);
    l.seconds++;
    clock.innerHTML = `<small>MATCH TIME</small>${String(Math.floor(l.seconds / 60)).padStart(2, "0")}:${String(l.seconds % 60).padStart(2, "0")}`;
  }, 1000);
  // 流れるコメント: 熱の段階で密度が変わる
  const spawn = () => {
    if (!root.isConnected) return;
    const stageN = Number(root.dataset.stage);
    const pool = stageN >= 3 ? NICO.max : stageN >= 2 ? NICO.hot : NICO.calm;
    comment(l, pick(pool), stageN >= 3 ? "hot" : stageN >= 2 && Math.random() < .5 ? "good" : "");
    setTimeout(spawn, (stageN >= 3 ? 420 : stageN >= 2 ? 800 : stageN >= 1 ? 1500 : 2600) * (0.7 + Math.random() * 0.6));
  };
  setTimeout(spawn, 400);
  setHype(l, 46);
  return l;
}
function comment(l, text, cls = "") {
  const rows = viewport.classList.contains("phone") ? 2 : 4;
  const row = Math.floor(Math.random() * rows);
  const node = el(`div.nico${cls ? "." + cls : ""}`, { text, style: { top: `${6 + row * (viewport.classList.contains("phone") ? 14 : 20)}px`, "--d": `${reduce() ? 0.01 : 6 + Math.random() * 3}s` } });
  l.lane.append(node);
  setTimeout(() => node.remove(), 9500);
}
function setHype(l, v) {
  l.hype = Math.max(0, Math.min(100, Math.round(v)));
  const stageN = l.hype >= 95 ? 3 : l.hype >= 70 ? 2 : l.hype >= 40 ? 1 : 0;
  const prev = Number(l.root.dataset.stage);
  l.root.dataset.stage = String(stageN);
  l.heat.dataset.stage = String(stageN);
  l.heat.style.setProperty("--h", String(l.hype / 100));
  $(".val", l.heat).textContent = String(l.hype);
  $(".stg", l.heat).textContent = ["静か", "ざわめき", "沸騰", "MAX HEAT"][stageN];
  $("#hype").value = String(l.hype); $("#hype-val").textContent = String(l.hype);
  if (stageN > prev && stageN >= 2) comment(l, stageN === 3 ? "MAX HEAT!!" : "会場が沸いてきた", "hot");
}
function hit(l) {
  if (l.hits >= 12) { l.hits = 0; l.excellent = 0; l.foil.querySelectorAll(".mk").forEach((m) => m.classList.remove("open", "is-target")); }
  const marks = [...l.foil.querySelectorAll(".mk")];
  marks[l.hits]?.classList.add("open"); marks[l.hits]?.classList.remove("is-target");
  l.hits++; l.excellent++;
  marks[l.hits]?.classList.add("is-target");
  const word = l.excellent % 3 === 0 ? "BEAUTIFUL RING" : "EXCELLENT";
  l.foil.append(el("div.tb-pop", { text: word }));
  $("b", l.info).textContent = `外周（${l.hits}/12）`;
  $(".cnt", l.info).textContent = `EXCELLENT ${l.excellent} · GOOD 2 · MISS 0`;
  $(".chip.me .bar i", l.root).style.width = `${30 + l.hits * 3}%`;
  setHype(l, l.hype + 1);
  if (l.excellent % 3 === 0) comment(l, pick(["揃ってる！", "外周きれい", "リズムいい"]), "good");
  setTimeout(() => l.foil.querySelector(".tb-pop")?.remove(), 900);
}
async function verdict(l, kind) {
  const spec = {
    great: { mark: "◎", who: "チャコール博士　穴あけ", line: "いいぞ。空気の通り道が揃ってる", delta: "会場の熱 ＋12", face: "smile", c: "#5fe2cf", d: 12 },
    good: { mark: "○", who: "チャコール博士　穴あけ", line: "穴は開いたな。間隔を揃えるともっといい", delta: "会場の熱 ＋6", face: "normal", c: "#5fe2cf", d: 6 },
    bad: { mark: "△", who: "チャコール博士　穴あけ", line: "少し偏ったな。次は外周を丁寧に", delta: "会場の熱 −8", face: "serious", c: "#5fe2cf", d: -8 },
  }[kind];
  const card = el(`div.verdict.${kind}`, { style: { "--c": spec.c } }, [
    el("div.ring", [el("div.burst"), el("b", { text: spec.mark })]),
    el("div.body", [el("div.pf", [img(face("dr_kemuri"))]), el("div", [el("div.who", { text: spec.who }), el("div.line", { text: spec.line })]), el("div.delta", { text: spec.delta })]),
  ]);
  l.fx.append(card);
  await sleep(30); card.classList.add("show");
  if (kind === "great") for (let i = 0; i < 3; i++) setTimeout(() => comment(l, pick(["◎キター", "揃ってる揃ってる", "これは強い", "うおおお"]), "good"), i * 220);
  setHype(l, l.hype + spec.d);
  $(".txt", l.say).textContent = spec.line; $(".txt", l.say).classList.toggle("bright", kind === "great");
  await sleep(reduce() ? 600 : 1500);
  card.classList.remove("show");
  await sleep(300); card.remove();
}
async function quad(l) {
  const panels = [
    { id: "maezono", f: "excited", small: "上園", word: "キワドい！" },
    { id: "dr_kemuri", f: "surprise", small: "チャコール博士", word: "でも、" },
    { id: "pakki", f: "excited", small: "パッキー", word: "香っている！" },
    { id: "nagumo", f: "thinking", small: "南雲", word: "……", silent: true },
  ];
  const q = el("div.quad", panels.map((p) => el(`div.qp${p.silent ? ".silent" : ""}`, [
    el("div.frame"), el("div.art", { style: { backgroundImage: `url(${sprite(p.id, p.f)})` } }),
    el("div.word", [el("small", { text: p.small }), p.word]),
  ])).concat(el("div.sync", { text: "FLAVOR SYNC!!" })));
  l.fx.append(q);
  await sleep(30); q.classList.add("show");
  for (let i = 0; i < 6; i++) setTimeout(() => comment(l, pick(NICO.hot), "hot"), i * 180);
  await sleep(reduce() ? 1200 : 3400);
  q.classList.remove("show"); await sleep(250); q.remove();
}
async function plate(l, big = "ROUND 1 — B", small = "火入れ　配置・炭焼き・蒸らし") {
  const p = el("div.plate", [el("b", [big, el("small", { text: small })])]);
  l.fx.append(p); await sleep(30); p.classList.add("show");
  await sleep(reduce() ? 600 : 1300);
  p.classList.remove("show"); await sleep(300); p.remove();
}
async function rivalEvent(l, ev = pick(RIVAL_EVENTS)) {
  const seat = l.seats.querySelector(`[data-id="${ev.id}"]`);
  $(".bubble", seat).textContent = ev.text;
  $(".step", seat).textContent = ev.step;
  seat.classList.add("event", "smoking"); if (ev.heavy) seat.classList.add("heavy");
  const chip = l.chips.querySelector(`[data-id="${ev.id}"] .tb-st`); if (chip) chip.textContent = ev.step;
  ev.nico.forEach((t, i) => setTimeout(() => comment(l, t, "cool"), i * 260));
  setHype(l, l.hype + 3);
  await sleep(reduce() ? 1000 : 3200);
  seat.classList.remove("event", "heavy");
}
async function playLive(l) {
  await plate(l, "ROUND 1 — A", "仕込み　機材・水・配合・詰め・穴あけ");
  for (let i = 0; i < 3; i++) { hit(l); await sleep(reduce() ? 100 : 520); }
  await rivalEvent(l, RIVAL_EVENTS[0]);
  await verdict(l, "great");
  if (l.hype < 70) setHype(l, 72);
  await sleep(300);
  await quad(l);
  await plate(l, "ROUND 1 — B", "火入れ　配置・炭焼き・蒸らし");
}

// ---------------------------------------------------------------- ② 中間投票
function buildVotes() {
  const root = el("div.tb-scene.votes");
  const order = ["naru", "hajime", "adam", "minto"];
  const pts = { naru: 2, hajime: 1, adam: 1, minto: 1 };
  const rows = el("div.vrows", order.map((id, i) => el(`div.vrow${id === "hajime" ? ".me" : ""}`, { dataset: { id, rank: String(i === 0 ? 1 : 2) } }, [
    el("span.rank-medal", { text: String(i === 0 ? 1 : 2) }),
    el("div.pf", [img(face(id))]),
    el("span.nm", { text: PEOPLE[id].name }),
    el("div.vote-stack", [el("b", { style: { "--c": "#ff8db4", width: `${pts[id] / 30 * 100}%` }, dataset: { j: "maezono" } }), el("b", { style: { "--c": "#5fe2cf", width: "0%" }, dataset: { j: "dr_kemuri" } })]),
    el("b.pt", [String(pts[id]), el("small", { text: "pt" })]),
  ])));
  const judges = el("div.vjudges", JUDGES.map((j) => el(`div.vj${j.held ? ".held" : ""}`, { style: { "--c": j.c }, dataset: { id: j.id } }, [
    el("div.pf", [img(face(j.id))]), el("div.nm", { text: j.name }),
    el("div.pips", Array.from({ length: 10 }, (_, i) => el(`b${i < (j.id === "maezono" ? 5 : 0) ? ".on" : ""}`))),
    el("div.rest", { text: j.held ? "10点を保留中" : `投入 ${j.id === "maezono" ? 5 : 0}／残り ${j.id === "maezono" ? 5 : 10}` }),
  ])));
  root.append(el("div.board", [
    el("div.eyebrow", { html: '<i class="tournament-live">LIVE</i> SMOKE CROWN CUP ／ ROUND 1' }),
    el("h1", { text: "中間投票" }),
    el("p.sub", { text: "審査員3人の持ち点（各10点）。実際に投入された票だけが並ぶ。南雲審査員長は、まだ1点も入れていない。" }),
    el("div.vmain", [rows, judges]),
    el("div.vstatus", [el("span", { text: "ここまでの制作" }), el("b", { text: "◎" }), el("span", { text: "穴あけ◎・炭焼き○ → 上園が2点、博士が2点を入れる（実績連動 §3.4 B）" })]),
    el("div.vfeed", [el("div.tag", { text: "速報" }), el("div.lines", { html: "上園、はじめに2点追加投入！<br>チャコール博士、ここで初めて動く——はじめに2点" })]),
  ]));
  return { root, rows, judges, pts };
}
async function flyToken(v, judgeId, targetId, color, hue) {
  const from = v.judges.querySelector(`[data-id="${judgeId}"] .pf`).getBoundingClientRect();
  const to = v.rows.querySelector(`[data-id="${targetId}"] .pt`).getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const scale = s.width / (viewport.classList.contains("phone") ? 844 : 1280);
  const t = el("div.token", { style: { "--c": color, "--hue": `${hue}deg`, left: `${(from.left - s.left) / scale + 6}px`, top: `${(from.top - s.top) / scale + 6}px` } });
  v.root.append(t);
  await sleep(30);
  t.style.left = `${(to.left - s.left) / scale + 10}px`; t.style.top = `${(to.top - s.top) / scale}px`; t.style.opacity = "0";
  await sleep(reduce() ? 50 : 720);
  t.remove();
}
async function playVotes(v) {
  const plan = [["maezono", "hajime", "#ff8db4", 0, 2], ["dr_kemuri", "hajime", "#5fe2cf", 120, 2], ["dr_kemuri", "adam", "#5fe2cf", 120, 1]];
  const used = { maezono: 5, dr_kemuri: 0 };
  for (const [j, target, color, hue, n] of plan) {
    for (let i = 0; i < n; i++) {
      await flyToken(v, j, target, color, hue);
      v.pts[target]++; used[j]++;
      const row = v.rows.querySelector(`[data-id="${target}"]`);
      $(".pt", row).firstChild.textContent = String(v.pts[target]);
      row.classList.remove("hit"); void row.offsetWidth; row.classList.add("hit");
      $(`.vote-stack [data-j="${j}"]`, row).style.width = `${(j === "maezono" ? (target === "hajime" ? 1 + i + 1 : v.pts[target]) : i + 1) / 30 * 100}%`;
      const jc = v.judges.querySelector(`[data-id="${j}"]`);
      jc.querySelectorAll(".pips b")[used[j] - 1].classList.add("on");
      $(".rest", jc).textContent = `投入 ${used[j]}／残り ${10 - used[j]}`;
      await sleep(reduce() ? 50 : 180);
    }
    await sleep(reduce() ? 100 : 500);
  }
  // 並べ替え（はじめが首位へ）
  const order = Object.entries(v.pts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const tops = new Map([...v.rows.children].map((r) => [r, r.getBoundingClientRect().top]));
  order.forEach((id, i) => {
    const r = v.rows.querySelector(`[data-id="${id}"]`);
    r.style.order = String(i);
    const rank = 1 + order.filter((o) => v.pts[o] > v.pts[id]).length;
    r.dataset.rank = String(rank); $(".rank-medal", r).textContent = String(rank);
  });
  if (!reduce()) for (const r of v.rows.children) {
    const dy = tops.get(r) - r.getBoundingClientRect().top;
    if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
}

// ---------------------------------------------------------------- ③ 結果発表 2.0
function buildResult() {
  const root = el("div.tb-scene.result");
  root.append(el("div.dim"), el("div.spot"), el("div.head", { html: '<small>SMOKE CROWN CUP / FINAL JUDGING</small><h1>結果発表</h1><p>最後の10点が、動く。</p>' }),
    el("div.cards", Object.entries(PEOPLE).map(([id, p]) => el(`div.card${id === "hajime" ? ".me" : ""}`, { style: { "--c": p.c } }, [el("div.pf", [img(face(id))]), el("div", [el("div.nm", { text: p.name }), el("div.bar")])]))),
    el("div.tb-flash"), el("div.smokewhite"));
  return { root };
}
async function playResult(r) {
  r.root.querySelectorAll(".tb-count, .tb-reveal, .champ, .award, .cut, .confetti, .next").forEach((n) => n.remove());
  r.root.classList.remove("dark", "spotlight");
  $(".head", r.root).style.opacity = "1"; $(".cards", r.root).style.opacity = "1";
  const count = el("div.tb-count", { html: '<svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="110"/><circle class="p" cx="120" cy="120" r="110"/></svg>' });
  const num = el("div.num"); count.append(num); r.root.append(count);
  const cuts = ["img/ui/making/foil_interactive_top.webp", "img/ui/making/coal_just.webp", "img/ui/making/bowl_packed_normal.webp", "img/ui/making/hajime_craft_pull.webp"];
  const tick = reduce() ? 80 : 620;
  for (let n = 10; n >= 0; n--) {
    num.textContent = String(n); num.style.animation = "none"; void num.offsetWidth; num.style.animation = "";
    count.style.setProperty("--c", String(n / 10));
    if (n > 0 && n <= 9 && n % 2 === 1) {
      const c = el("div.cut", { style: { left: `${8 + Math.random() * 60}%`, top: `${12 + Math.random() * 55}%`, "--r": `${-8 + Math.random() * 16}deg`, backgroundImage: `url(${cuts[(10 - n) % cuts.length]})` } });
      r.root.append(c); setTimeout(() => c.remove(), 1000);
    }
    if (n === 3) break; // フライングプチュン（超高評価）
    await sleep(tick);
  }
  $(".tb-flash", r.root).classList.add("go"); $(".smokewhite", r.root).classList.add("go");
  await sleep(reduce() ? 200 : 1500);
  $(".tb-flash", r.root).classList.remove("go"); $(".smokewhite", r.root).classList.remove("go");
  count.remove(); $(".cards", r.root).style.opacity = "0";
  // 順位発表: 4位 → 3位 → 2位 → 溜め → 1位
  $(".head h1", r.root).textContent = "順位発表"; $(".head p", r.root).textContent = "南雲の10点は、先頭のはじめへ。";
  const final = [["minto", 3, "上園2・博士1・南雲0"], ["adam", 5, "上園2・博士3・南雲0"], ["naru", 5, "上園2・博士3・南雲0"]];
  const reveal = el("div.tb-reveal"); r.root.append(reveal);
  let rank = 4;
  for (const [id, pt, note] of final) {
    const row = el(`div.rrow`, { dataset: { rank: String(rank) } }, [el("span.rank-medal", { text: String(rank) }), el("div.pf", [img(face(id))]), el("div.nm", [PEOPLE[id].name, el("small", { text: note })]), el("div.pt", { text: `${pt} pt` })]);
    reveal.prepend(row); await sleep(30); row.classList.add("show");
    await sleep(reduce() ? 150 : 1400);
    rank = rank === 4 ? 3 : 2;
  }
  r.root.classList.add("dark"); await sleep(reduce() ? 150 : 900);
  r.root.classList.remove("dark"); r.root.classList.add("spotlight");
  const champ = el("div.champ", [el("div.crown"), el("b", { text: "CHAMPION" }), el("span", { text: "蒸野 はじめ　17 pt（上園4・博士3・南雲10）" }), el("div.pf", [img(face("hajime"))])]);
  r.root.append(champ); await sleep(30); champ.classList.add("show");
  $(".head", r.root).style.opacity = "0"; reveal.style.opacity = "0";
  if (!reduce()) for (let i = 0; i < 60; i++) {
    const c = el("i.confetti", { style: { left: `${Math.random() * 100}%`, background: ["#ffc24a", "#38f0ff", "#ff3fa4", "#ffffff"][i % 4], animationDelay: `${Math.random() * .8}s`, "--x": `${-120 + Math.random() * 240}px`, "--r": `${-720 + Math.random() * 1440}deg` } });
    r.root.append(c); setTimeout(() => c.remove(), 3400);
  }
  await sleep(reduce() ? 300 : 2600);
  // 表彰
  champ.classList.remove("show"); reveal.remove(); r.root.classList.remove("spotlight");
  await sleep(400); champ.remove();
  const marks = [["穴あけ", "◎", "とても良い"], ["炭焼き", "○", "良い"], ["完成品", "◎", "とても良い"], ["調整1回目", "○", "良い"], ["調整2回目", "◎", "とても良い"], ["総合", "◎", "南雲の基準を超えた"]];
  const award = el("div.award", [
    el("div.tb-panel", [
      el("h3", { text: "あなたの一台" }),
      el("div.marks", marks.map(([k, m, s]) => el(`div.mark${m === "△" ? ".bad" : ""}`, [el("div", [k, el("small", { text: s })]), el("b", { text: m })]))),
      el("h3", { text: "ハイライト", style: { marginTop: "14px" } }),
      el("div.hl", [
        el("div.hlc", { style: { backgroundImage: "url(img/ui/making/coal_just.webp)" } }, [el("i", { text: "R1" }), el("span", { text: "ジャスト炭。全面が赤くなった瞬間に取った" })]),
        el("div.hlc", { style: { backgroundImage: "url(img/ui/making/foil_interactive_top.webp)" } }, [el("i", { text: "R1" }), el("span", { text: "外周12穴が揃った（EXCELLENT 10）" })]),
        el("div.hlc", { style: { backgroundImage: "url(img/ui/making/hajime_craft_pull.webp)", backgroundPosition: "center 30%" } }, [el("i", { text: "R4" }), el("span", { text: "最高の熱 97。調整2回目で帯の中央へ" })]),
      ]),
    ]),
    el("div.tb-panel", [
      el("h3", { text: "審査員の一言" }),
      el("div.one", { style: { "--c": "#ff8db4" } }, [el("div.pf", [img(face("maezono"))]), el("div.q", [el("small", { text: "上園" }), "いいねえ。レモンが最後まで逃げなかった。次は温度をもっと揃えたいね"])]),
      el("div.one", { style: { "--c": "#5fe2cf" } }, [el("div.pf", [img(face("dr_kemuri"))]), el("div.q", [el("small", { text: "チャコール博士" }), "炭の取り頃が正確でした。外周の穴が熱を均していましたね"])]),
      el("div.one", { style: { "--c": "#f6c95e" } }, [el("div.pf", [img(face("nagumo"))]), el("div.q", [el("small", { text: "南雲" }), "……もう一口、吸いたかった"])]),
      el("div.prize", [el("div.ttl", [el("i"), el("div", [el("b", { text: "SMOKE CROWN CUP 優勝" }), el("span", { text: "　称号をギャラリーの「大会の記録」に残した" })])]), el("div", [el("b", { text: "賞金 ¥50,000" }), el("span", { text: "　自己ベスト更新" })])]),
    ]),
  ]);
  r.root.append(award, el("div.tb-next", { text: "表彰のあとへ" }));
  await sleep(30); award.classList.add("show");
}

// ---------------------------------------------------------------- 場面の切替
let current = null;
function show(name) {
  scene = name;
  stage.replaceChildren();
  document.querySelectorAll("[data-scene]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scene === name)));
  document.querySelectorAll(".scene-actions").forEach((a) => a.classList.toggle("on", a.dataset.for === name));
  current = name === "live" ? (live = buildLive()) : name === "votes" ? buildVotes() : buildResult();
  stage.append(current.root);
  fit();
  if (name === "result") playResult(current);
}
document.querySelectorAll("[data-scene]").forEach((b) => b.addEventListener("click", () => show(b.dataset.scene)));
$("#replay").addEventListener("click", () => { if (scene === "live") playLive(live); else if (scene === "votes") { show("votes"); setTimeout(() => playVotes(current), 600); } else playResult(current); });
document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
  const act = b.dataset.act;
  if (act === "hit") hit(live);
  else if (act.startsWith("verdict-")) verdict(live, act.slice(8));
  else if (act === "quad") quad(live);
  else if (act === "plate") plate(live);
  else if (act === "rival") rivalEvent(live);
}));
$("#hype").addEventListener("input", (e) => setHype(live, Number(e.target.value)));
$("#phone").addEventListener("change", (e) => { viewport.classList.toggle("phone", e.target.checked); show(scene); });
$("#reduce").addEventListener("change", (e) => stage.classList.toggle("reduce", e.target.checked));
show("live");
