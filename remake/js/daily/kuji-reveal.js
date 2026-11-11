// シーシャくじの結果を見せる: ガラガラ（motions/garagara.js）を回し、賞の色の玉が出る → 賞の札が開く。
// 抽選と景品の受け渡し・保存は kuji.js が先に済ませている。ここは見せるだけで、状態は変えない。
// - 1回引き: ガラガラ → 光の中で札が開く。箱の最後の1枚なら、札を閉じたあとにもう一度回してラストワン賞（extras）。
// - 連続（5回・10回）: 玉が次々に出て玉置きに並ぶ → 玉の並んだ札を1枚ずつ開く。S賞・ラストワン賞は1枚ずつ大きく見せる。
// - SKIP 中とテストの高速送りでは回さずに札だけ出す（ラストワン賞はトーストで知らせる）。
import { el, sleep } from "../core/util.js";
import { layers, toast } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { vnTest } from "../vn/engine.js";
import { prizeArt } from "./kuji-prize-art.js";

/** 持っていた機材をお金（限定の台はくじ券）に替えた賞か。札に出す文は kuji.js が賞に添えている（dupText・dupShort） */
const isDupe = (prize) => prize.dupText != null;

const instant = () => vnTest.turbo || document.body.classList.contains("vn-skip");
const stillOnly = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const isTop = (rank) => rank === "S" || rank === "LAST";
const rankWord = (prize) => (prize.rank === "LAST" ? "ラストワン賞" : `${prize.rank}賞`);
const prizeName = (prize) => (prize.rank === "LAST" ? prize.name.replace(/^ラストワン賞・/, "") : prize.name);
const ORDER = ["LAST", "S", "A", "B", "C"];
const bestRank = (results) => ORDER.find((r) => results.some((p) => p.rank === r)) || "C";

// 演出の部品は引くときに読み込む（高速送りでは読まない）
const loadMotion = () => Promise.all([import("../motions/garagara.js"), import("../motions/kuji-fx.js"), import("../motions/garagara-stage.js")])
  .then(([g, f, s]) => ({ garagara: g.garagara, createFx: f.createFx, light: s.RANK_LIGHT }));

/** 景品名は「（50g）」などの括弧の途中で折らない（折るなら括弧の前で） */
const nameParts = (name) => name.split(/(（[^）]*）)/).filter(Boolean).map((part) => (part.startsWith("（") ? el("span.kj-nowrap", { text: part }) : part));

/** 賞の札。short は連続の結果に並べる小さい札（玉が載った伏せた札から開く） */
function prizeCard(prize, short = false) {
  const dupe = isDupe(prize);
  const card = el(`div.kuji-card.rank-${prize.rank}${short ? ".kuji-short" : ""}`, [
    ...(short ? [el("div.kj-ball", { "aria-hidden": "true" })] : prize.rank === "S" ? [el("div.kj-banner", { "aria-hidden": "true", text: "大当たり" })] : []),
    el("div.kj-art", { "aria-hidden": "true" }, [prizeArt(prize, short ? 112 : 232)]),
    el("div.kj-body", [
      el("div.kuji-rank", { text: rankWord(prize) }),
      el("div.kuji-name", nameParts(prizeName(prize))),
      ...(short ? [] : [el("div.kuji-desc", { text: prize.desc || "" })]),
      // 小さい札の重複は「同」バッジと買い取り額（限定の台はくじ券）だけにして、文字を詰めない（#2835）
      ...(!dupe ? [] : short ? [el("div.kuji-dupe", { title: `持っている → ${prize.dupShort}`, "aria-label": `持っている → ${prize.dupShort}` }, [
        el("span.kuji-dupe-badge", { text: "同" }),
        el("span", { text: prize.dupShort }),
      ])] : [el("div.kuji-dupe", { text: prize.dupText })]),
    ]),
    // 札全体のタップで閉じる。文の案内は置かず、右上の ✕ だけ見せる（#2835）
    ...(short ? [] : [el("button.kuji-close", { type: "button", text: "✕", "aria-label": "閉じる", dataset: { test: "kuji-close" } })]),
  ]);
  card.title = short ? prizeName(prize) : prize.desc || ""; // スマホでは説明を札に出さず、長押し・ポインタの title で読む（#2729）
  return card;
}

/** 札の後ろの光（賞の色の放射と明るみ） */
const backdrop = (rank, on = false) => el(`div.kj-backdrop${on ? ".on" : ""}`, { "aria-hidden": "true", dataset: { rank } }, [el("i.kj-rays"), el("i.kj-rays.kj-rays-b"), el("i.kj-halo")]);

function cardSound(rank) {
  SE.stamp();
  if (isTop(rank)) SE.fanfare();
  else if (rank === "A") SE.jingle();
  else if (rank === "B") SE.reelWin();
}

/** 札（中心 x,y・半分の大きさ w,h）のふちの上の、でたらめな一点 */
function rim(x, y, w, h) {
  const t = Math.random() * 4, k = (t % 1) * 2 - 1;
  return t < 1 ? [x + k * w, y - h] : t < 2 ? [x + w, y + k * h] : t < 3 ? [x + k * w, y + h] : [x - w, y + k * h];
}

/** 札が開いた瞬間の粒子（中心 x,y・札の半分の大きさ w,h）。上位ほど多く、S賞・ラストワン賞は紙吹雪 */
function celebrate(fx, light, rank, x = 640, y = 330, w = 440, h = 190) {
  const power = { S: 1, LAST: 1, A: 0.6, B: 0.3, C: 0.12 }[rank] ?? 0.12;
  const colors = light[rank] || light.C;
  fx.burst(x, y, { n: Math.round(14 + 80 * power), colors, speed: [160, 420 + 520 * power], spread: Math.PI, gravity: 240, life: [0.5, 1.2], size: [8, 22] });
  fx.burst(x, y, { n: Math.round(8 + 30 * power), colors: [colors[1], "#ffffff"], kind: "streak", speed: [320, 760], spread: Math.PI, gravity: 120, life: [0.25, 0.55], size: [1.6, 3] });
  const edge = (n, delay) => { for (let i = 0; i < n; i++) { const [ex, ey] = rim(x, y, w, h); fx.stars(ex, ey, { n: 1, colors: [colors[1], colors[0]], rx: 26, ry: 26, size: [10, 20 + 14 * power], delay }); } };
  edge(Math.round(2 + 12 * power), 0.7);
  if (isTop(rank)) fx.confetti([colors[0], colors[1], colors[2], "#ffffff", "#de3b22"], { seconds: 2.8, perSecond: 44 });
  fx.motes([colors[1], colors[0], "#ffffff"], 4 + 10 * power);
  // 札のふちのきらめき（上位ほど頻繁）
  const every = { S: 130, LAST: 130, A: 240, B: 520 }[rank];
  return every ? setInterval(() => edge(1, 0), every) : 0;
}

/** 1つの賞を引いて見せる。札が開いたら、片付け用の end() を持つ舞台を返す */
function revealOne(ov, prize, skip, prev) {
  return new Promise((done) => {
    const card = prizeCard(prize);
    const back = backdrop(prize.rank);
    let fx = null, twinkle = 0, shown = false;
    const stage = { end() { clearInterval(twinkle); fx?.destroy(); back.remove(); card.remove(); } };
    // 前の札が残っていれば、ガラガラが上に重なり切ってから外す（いきなり消えて背景だけになる間を作らない）
    if (prev) setTimeout(() => prev.end(), skip ? 0 : 360);
    SE.select();
    const show = (kit) => {
      if (shown) return;
      shown = true;
      prev?.end(); // すぐ SKIP した時も、前の札と重ねて出さない
      ov.dataset.rank = prize.rank;
      ov.prepend(back, card);
      card.classList.add("reveal");
      back.classList.add("on");
      cardSound(prize.rank);
      if (kit && !stillOnly()) {
        fx = kit.createFx(ov, { className: "kj-fx kj-fx-card" });
        twinkle = celebrate(fx, kit.light, prize.rank);
      }
      done(stage);
    };
    if (skip) { sleep(300).then(() => show(null)); return; }
    // ガラガラが消え始めたところで札を下で開き、重ねて受け渡す
    loadMotion().then((kit) => kit.garagara(ov, prize.rank, { onHandoff: () => show(kit) }).then(() => show(kit)))
      .catch((e) => { console.error(e); show(null); });
  });
}

/** 1回引きの演出。prize の札を閉じると extras（ラストワン賞）へ続き、全部閉じたら解決する */
export function reveal(prize, extras = []) {
  return new Promise((resolve) => {
    const ov = el("div.kuji-overlay", { dataset: { test: "kuji-reveal" } });
    layers.modal.replaceChildren(ov);
    layers.modal.classList.add("show");
    const skip = instant();
    const queue = skip ? [prize] : [prize, ...extras];
    let open = false, stage = null;
    const next = async () => {
      const p = queue.shift();
      if (!p) {
        stage?.end();
        layers.modal.classList.remove("show");
        layers.modal.replaceChildren();
        resolve();
        return;
      }
      stage = await revealOne(ov, p, skip, stage);
      open = true;
      if (skip) for (const ex of extras) {
        await sleep(500);
        toast(isDupe(ex) ? `${ex.name} は${ex.dupText}` : `${ex.name} を手に入れた！`, { kind: "good" });
      }
    };
    ov.onclick = () => {
      if (!open) return;
      open = false;
      SE.click();
      next();
    };
    next();
  });
}

/** 連続で引いた結果。results は引いた順の賞（ラストワン賞を含む）、count は引いた回数 */
export function revealMany(results, count) {
  return new Promise((resolve) => {
    const quick = instant();
    const best = bestRank(results);
    let fx = null, kit = null, timer = 0, twinkle = 0, flipping = !quick, closeShow = null, started = false, index = 0;
    const finish = () => {
      flipping = false;
      clearTimeout(timer); clearInterval(twinkle);
      fx?.destroy();
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      resolve();
    };
    const close = el("button.btn.kj-done", { text: "結果を閉じる", onclick: finish });
    const cards = results.map((prize, i) => {
      const card = prizeCard(prize, true);
      card.style.setProperty("--i", String(i));
      if (!quick) card.classList.add("kuji-facedown");
      return card;
    });
    const back = backdrop(best, quick);
    const panel = el("div.kuji-multi-panel", [
      el("h2", { text: `${count}回の結果` }),
      el("div.kuji-multi-cards", { dataset: { n: String(cards.length) } }, cards),
      el("div.kj-actions", [close]),
    ]);
    const ov = el("div.kuji-overlay.kuji-multi", { dataset: { test: "kuji-multi-reveal", rank: best } }, [back, panel]);
    layers.modal.replaceChildren(ov);
    layers.modal.classList.add("show");
    if (quick) return;

    /** 札の中心（ステージの座標） */
    const centerOf = (node) => {
      const r = node.getBoundingClientRect(), o = ov.getBoundingClientRect();
      const s = o.width / ov.offsetWidth || 1;
      return [(r.left + r.width / 2 - o.left) / s - (ov.offsetWidth - 1280) / 2, (r.top + r.height / 2 - o.top) / s];
    };
    const openCard = (i, loud) => {
      const card = cards[i], rank = results[i].rank;
      if (!card.classList.contains("kuji-facedown")) return;
      card.classList.remove("kuji-facedown");
      card.classList.add("kj-open");
      if (!loud) return;
      SE.kujiFlip();
      if (rank === "A") SE.perfect();
      if (!fx) return;
      const [x, y] = centerOf(card), colors = kit.light[rank] || kit.light.C;
      const power = { S: 1, LAST: 1, A: 0.7, B: 0.35, C: 0.15 }[rank] ?? 0.15;
      fx.burst(x, y, { n: Math.round(6 + 30 * power), colors, speed: [80, 220 + 320 * power], spread: Math.PI, gravity: 260, life: [0.35, 0.9], size: [8, 18] });
      if (rank !== "C") fx.stars(x, y, { n: Math.round(1 + 8 * power), colors: [colors[1], colors[0]], rx: 110, ry: 120, size: [8, 22], delay: 0.4 });
    };
    const complete = () => {
      flipping = false;
      flipBtn.remove();
      panel.classList.add("kj-complete");
      if (best !== "C" && best !== "B") SE.jingle();
    };
    /** S賞・ラストワン賞は1枚ずつ大きく見せる（タップで戻る） */
    const showcase = (prize) => new Promise((shownDone) => {
      const big = prizeCard(prize);
      big.classList.add("reveal");
      const layer = el("div.kj-showcase", { dataset: { rank: prize.rank, test: "kuji-showcase" } }, [backdrop(prize.rank, true), big]);
      const end = () => {
        if (!closeShow) return;
        closeShow = null;
        clearInterval(twinkle);
        layer.remove();
        shownDone();
      };
      layer.onclick = (e) => { e.stopPropagation(); SE.click(); end(); };
      closeShow = end;
      ov.append(layer);
      cardSound(prize.rank);
      if (fx) twinkle = celebrate(fx, kit.light, prize.rank);
    });
    const step = async () => {
      if (!flipping || !ov.isConnected) return;
      if (index >= cards.length) { complete(); return; }
      const i = index++, rank = results[i].rank;
      if (isTop(rank)) {
        await showcase(results[i]);
        if (!flipping) return;
      }
      openCard(i, true);
      timer = setTimeout(step, isTop(rank) ? 420 : rank === "A" ? 560 : 240);
    };
    const flipAll = () => {
      flipping = false;
      clearTimeout(timer);
      closeShow?.();
      cards.forEach((_, i) => openCard(i, false));
      complete();
    };
    const flipBtn = el("button.btn.small.kuji-flip-all", { text: "すべてめくる", dataset: { test: "kuji-flip-all" }, onclick: flipAll });
    close.before(flipBtn);
    panel.classList.add("kj-wait"); // ガラガラが終わるまで隠す
    /** 玉の並んだ札を配り、1枚ずつ開き始める */
    const start = (loaded) => {
      if (started || !ov.isConnected) return;
      started = true;
      kit = loaded;
      panel.classList.remove("kj-wait");
      panel.classList.add("kj-in");
      back.classList.add("on");
      if (kit && !stillOnly()) {
        fx = kit.createFx(ov, { className: "kj-fx kj-fx-card" });
        fx.motes(["#ffe9c4", "#d9c8ff", "#ffffff"], 6);
      }
      timer = setTimeout(step, stillOnly() ? 200 : 300 + cards.length * 45);
    };
    loadMotion().then((loaded) => loaded.garagara(ov, results.map((p) => p.rank), { onHandoff: () => start(loaded) }).then(() => start(loaded)))
      .catch((e) => { console.error(e); start(null); });
  });
}
