// 縦画面の作る場面: 水入れ（試作の water・VPL36・VPL46・VPL81・VPL92・VPL101・VPL111〜VPL113・VPL119）。
// 上の絵＝流し台と蛇口の下で、口の開いたボトルを少し傾けて満たす（水面は画面に水平で揺れ、蛇口から水が落ちる）。外側の破線と中央の細い帯が目安。
// 下＝同じ大きさの丸いボタンを1段に「こぼす」（左）・「注ぐ」（真ん中）・「決定」（右）。こぼす・注ぐは押している間だけ水が動く。
// 本編の stepWater（craft/water-view.js の mountWater）の画面を読んで描く: 水量はメーター（data-test water-meter の aria-valuenow）を
// 毎フレーム読み、浸かり具合は status の data-band、注いでいる・こぼしているは .craft-water の data-flow。押す操作は本編のボタン
// （water-pour・water-drain は長押しのまま pointerdown／pointerup、water-confirm はタップ）へ中継する。水量の増え方・目安・判定は本編のまま。
// 目安の線の高さは本編の値（craft/water.js の WATER の各境界）。ボトルの形・水面の揺れ・水流は試作の絵の動き（見た目だけ）。
// 説明の間（チュートリアルの初回の説明は本編が部品を出す前、「？」は本編が作業台を止めている）は、説明が指すボタンを押せる形で見せる
// （押しても本編へは届かない）。説明のスポットライト（craft/tutorial.js・VPN32）は、ボトル→目安の線→注ぐ・こぼす→決定の順に明るく抜く。
import { imgFileUrl } from "../../../core/img-file.js";
import { el } from "../../../core/util.js";
import { WATER } from "../../../craft/water.js";
import { TUTORIAL_STEP_HELP } from "../../../craft/bench-ui.js";
import { speech } from "./tutorial.js";

const ART = imgFileUrl("ui/vertical-craft/");
// ボトルの絵（ui-bottle-open.webp 540×800）の中の形。inner＝ガラスの内側（底 y=755 から受け口のすぐ下 y=209 まで）。
// rest＝ふだんの傾き、drain＝こぼす間の傾き（度）。rim＝受け口の穴の手前の縁（水流はここから下は受け口の陰）
const BOTTLE = { w: 540, h: 800, cx: 270, base: 755, top: 209, pivot: [270, 790], mouth: [270, 32], rim: 50, rest: 8, drain: 17,
  inner: "M185 209 L187 223 L186 237 L183 251 L179 265 L173 279 L166 293 L157 307 L146 321 L135 335 L123 349 L114 363 L105 377 L99 391 L93 405 L89 419 L86 433 L84 447 L83 461 L83 475 L83 489 L83 503 L83 517 L82 531 L81 545 L79 559 L77 573 L72 587 L66 601 L58 615 L45 629 L30 643 L20 657 L21 671 L19 685 L20 699 L24 713 L31 727 L44 741 L63 755 L477 755 L496 741 L508 727 L515 713 L519 699 L520 685 L518 671 L520 657 L509 643 L495 629 L482 615 L473 601 L467 587 L463 573 L460 559 L458 545 L457 531 L457 517 L457 503 L457 489 L457 475 L456 461 L455 447 L453 433 L450 419 L446 405 L441 391 L434 377 L426 363 L416 349 L405 335 L393 321 L383 307 L373 293 L366 279 L360 265 L356 251 L354 237 L353 223 L354 209Z" };
// 水量（本編の 0〜1）→ 絵の中の水面の高さ。肩の上（水量 0.8）で受け口の下まで満ちる（試作と同じ見せ方）
const waterY = (w) => BOTTLE.base - w * (BOTTLE.base - BOTTLE.top) * 1.2;
// ボトルを ang 度傾けた時の、絵の中の点（x, y）の画面上の位置
const tiltPoint = (x, y, ang) => { const r = ang * Math.PI / 180, [px, py] = BOTTLE.pivot, dx = x - px, dy = y - py; return [px + dx * Math.cos(r) - dy * Math.sin(r), py + dx * Math.sin(r) + dy * Math.cos(r)]; };
// 内側の左右の壁（高さ y での x）。水面の波を壁で跳ね返すのに使う
const BOTTLE_WALL = (() => {
  const pts = BOTTLE.inner.slice(1, -1).split(" L").map((p) => p.split(" ").map(Number)), n = pts.length / 2;
  const left = pts.slice(0, n), right = pts.slice(n).reverse();
  const at = (side, y) => { let i = 1; while (i < n - 1 && side[i][1] < y) i++; const [x0, y0] = side[i - 1], [x1, y1] = side[i]; return x0 + (x1 - x0) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0))); };
  return (y) => [at(left, y), at(right, y)];
})();
// 蛇口の吐水口: 少し傾けたボトルの口の真上 60 の所（蛇口は流し台の絵に描いてあり、ここに来るよう CSS で置く）
const FAUCET = (() => { const [mx, my] = tiltPoint(...BOTTLE.mouth, BOTTLE.rest); return { nx: mx, ny: my - 60 }; })();
// ボタンの白い図形（試作の TOOL_SVG.pour・drain。ボタンいっぱいの 100×100）
const BOTTLE_PATH = "M41 53C41 59 21 64 19 78C18 88 26 96 50 96C74 96 82 88 81 78C79 64 59 59 59 53";
const BOTTLE_ICON = `<rect x="38" y="44" width="24" height="9" rx="2"/><path class="vtc-gl-glass" d="${BOTTLE_PATH}"/>`;
const BOTTLE_WATER = `<path d="M21.5 76H78.5C79.5 85 73 92.5 50 92.5C27 92.5 20.5 85 21.5 76Z"/><path class="vtc-gl-glass thin" d="M29 65.5C26.5 68.5 25 71.5 24.5 74.5"/>`;
const POUR_SVG = `<svg class="vtc-tool vtc-tool-pour" viewBox="0 0 100 100" aria-hidden="true">
  <path class="vtc-gl-pipe" d="M18 8H40Q50 8 50 17V18"/><rect x="43.5" y="17" width="13" height="7" rx="2"/>
  <g class="vtc-gl-drops"><circle cx="50" cy="30.5" r="2.6"/><circle cx="50" cy="37.5" r="2.9"/></g>${BOTTLE_ICON}${BOTTLE_WATER}</svg>`;
const DRAIN_SVG = `<svg class="vtc-tool vtc-tool-drain" viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(100 0) scale(-1 1)"><defs><clipPath id="vtc-drain-in"><path transform="translate(58 56) rotate(-40) translate(-50 -75)" d="${BOTTLE_PATH}Z"/></clipPath></defs>
  <rect x="0" y="60" width="100" height="40" clip-path="url(#vtc-drain-in)"/><g transform="translate(58 56) rotate(-40) translate(-50 -75)">${BOTTLE_ICON}</g>
  <g class="vtc-gl-drop"><path d="M25 46C25 46 19.5 53.5 19.5 56.5A5.5 5.5 0 0 0 30.5 56.5C30.5 53.5 25 46 25 46Z"/><path d="M22 66C22 66 17.5 71.5 17.5 74A4.5 4.5 0 0 0 26.5 74C26.5 71.5 22 66 22 66Z"/></g></g></svg>`;
const LIVE = { pour: '[data-test="water-pour"]', drain: '[data-test="water-drain"]', ok: '[data-test="water-confirm"]' };
let uid = 0;
// 本編の説明（チュートリアルの初回と「？」。TUTORIAL_STEP_HELP.water）。この文の時は段を分けて、指す所を決める
const WATER_HELP = speech(TUTORIAL_STEP_HELP.water.detail);
// ほかの文（チュートリアル以外の「？」の本文と、本編が足す補足）は、話している部品を指す。決定を指す段は最後に回す
const AIM = [[/目安|線/, "band"], [/長押し|押して|注|こぼ|離す/, "hold"], [/決め|進む/, "ok"]];
const aimOf = (say) => AIM.find(([pattern]) => pattern.test(say))?.[1] || "bottle";

export const waterView = {
  id: "water",
  step: "setup", // 本編は機材と水入れを同じ setup の工程で出す（水入れの部品があるかで見分ける）
  match: (panel) => !!panel.querySelector('[data-test="water-step"] [data-test="water-pour"]'),
  // チュートリアルは、水入れの部品を出す前に初回の説明を開く（機材の初回の説明とは作業台の見出しで見分ける）
  intro: (bench) => bench.querySelector(".bench-title")?.textContent.trim() === "水入れ",
  // 説明のスポットライトの段（craft/tutorial.js）。本編の説明の文を段に分け、ボトル・目安の線・注ぐとこぼす・決定を順に指す
  tutorial: ({ text, lines, extras }) => {
    if (text === WATER_HELP) return [
      { target: "bottle", say: "煙は水をくぐって冷える" }, // 本編の文のまま
      { target: "band", say: "量で吸い心地が変わるから、まずは目安に合わせろ" }, // 本編の文のまま
      { target: "hold", say: "注ぐときは長押し。こぼして戻してもいい" },
      { target: "ok", say: "細い帯なら高得点。水位を合わせたら決定だ" },
    ];
    const steps = [...lines.map((say) => ({ say })), ...extras].map((line) => ({ ...line, target: aimOf(line.say) }));
    return [...steps.filter((step) => step.target !== "ok"), ...steps.filter((step) => step.target === "ok")];
  },
  create({ hold, relay }) {
    const id = `vtcw${++uid}`, { w, h, inner } = BOTTLE;
    const lowY = waterY(WATER.low), highY = waterY(WATER.high), midY = (lowY + highY) / 2;
    const preciseTop = waterY(WATER.preciseHigh), preciseBottom = waterY(WATER.preciseLow);
    const bottle = el("div.vtc-bottle", { html: `<img class="vtc-sink" src="${ART}ui-sink-faucet.webp" alt="" draggable="false">
      <svg class="vtc-bottle-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><clipPath id="${id}"><path class="vtc-w-clip" d="${inner}"/></clipPath>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe6fa"/><stop offset="0.16" stop-color="#3fb4e6"/><stop offset="1" stop-color="#1757a6"/></linearGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fd8f5" stop-opacity="0.7"/><stop offset="0.4" stop-color="#ffffff" stop-opacity="1"/><stop offset="1" stop-color="#6fc4ee" stop-opacity="0.75"/></linearGradient></defs>
        <g clip-path="url(#${id})"><path class="vtc-w-body" fill="url(#${id}g)" d=""/><path class="vtc-w-deep" d=""/>
          <g class="vtc-w-bubbles">${"<circle r=\"0\"/>".repeat(12)}</g>
          <path class="vtc-w-stream in" fill="url(#${id}s)" d=""/><path class="vtc-w-surf" d=""/></g></svg>
      <img class="vtc-glass" src="${ART}ui-bottle-open.webp" alt="" draggable="false">
      <svg class="vtc-bottle-svg fx" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><clipPath id="${id}f"><rect class="vtc-w-fxclip" x="-400" y="-900" width="${w + 800}" height="0"/></clipPath></defs>
        <g clip-path="url(#${id}f)"><path class="vtc-w-stream" fill="url(#${id}s)" d=""/></g><path class="vtc-w-spill" d=""/>
        <defs><clipPath id="${id}guide"><path d="${BOTTLE.inner}"/></clipPath></defs>
        <g class="vtc-w-guide"><g clip-path="url(#${id}guide)">
          <path class="vtc-w-band" d="M0 ${highY}H${w}V${lowY}H0Z"/>
          <path class="vtc-w-precise" d="M0 ${preciseTop}H${w}V${preciseBottom}H0Z"/>
          <path class="vtc-w-line2" d="M-40 ${lowY}H${w + 40}M-40 ${highY}H${w + 40}"/></g>
          <g class="vtc-w-mark" transform="translate(${BOTTLE_WALL(midY)[1] + 34} ${midY})"><rect x="0" y="-26" width="92" height="52" rx="26"/><text x="46" y="12">目安</text></g></g>
        <g clip-path="url(#${id})"><g class="vtc-w-drops">${"<circle r=\"0\"/>".repeat(7)}</g></g></svg>
      <img class="vtc-sink front" src="${ART}ui-sink-faucet.webp" alt="" draggable="false"><i class="vtc-cabinet"></i>` });
    const pic = el("div.vtc-water-pic", { dataset: { test: "vt-water-pic", zone: "empty" }, role: "img", "aria-label": "ボトルの水量" }, [bottle]);
    const round = (cls, key, label, inner, lab) => el(`button.vtc-ok.${cls}`, { type: "button", "aria-label": label, dataset: { key, test: `vt-water-${key}` } }, [
      el("span.vtc-ok-t.vtc-tool-t", { html: inner }), lab ? el("small.vtc-lab", { text: lab }) : null,
    ]);
    const drain = round("vtc-hold.vtc-w-drain", "drain", "少しこぼす（長押し）", DRAIN_SVG, "こぼす");
    const pour = round("vtc-hold.vtc-w-pour", "pour", "注ぐ（長押し）", POUR_SVG, "注ぐ");
    const ok = el("button.vtc-ok.vtc-w-ok", { type: "button", "aria-label": "この水量で進む", dataset: { key: "ok", test: "vt-water-ok" } }, [el("span.vtc-ok-t", { text: "決定" })]);
    const ctrl = el("div.vtc-water-ctrl", [drain, pour, ok]);
    let panel = null, sig = "";
    const liveOf = (key) => panel?.querySelector(LIVE[key]) || null;
    // 作業台の支度中（本編の作業台が inert）は押せない
    const usable = (key) => { const live = liveOf(key); return live && !live.disabled && !live.closest("[inert]") ? live : null; };
    hold(pour, () => usable("pour"));
    hold(drain, () => usable("drain"));
    ok.addEventListener("click", () => { const live = usable("ok"); if (live) relay(live); });

    // ---- 水の揺れ（試作の stepWater と同じ動き。水量と注ぐ・こぼすは本編の画面から毎フレーム読む）
    const q = (c) => bottle.querySelector(c);
    const S = { h: new Float32Array(28), v: new Float32Array(28), ang: BOTTLE.rest, angV: 0, slope: 0, slopeV: 0, head: null, tail: null, bub: [], drops: [], spawn: 0, kick: 0, was: false,
      glass: q(".vtc-glass"), clip: q(".vtc-w-clip"), body: q(".vtc-w-body"), deep: q(".vtc-w-deep"), surf: q(".vtc-w-surf"), stream: q(".fx .vtc-w-stream"), streamIn: q(".vtc-w-stream.in"),
      spill: q(".vtc-w-spill"), fxClip: q(".vtc-w-fxclip"), band: q(".vtc-w-band"), guide: q(".vtc-w-guide"), mark: q(".vtc-w-mark"),
      bubEls: [...bottle.querySelectorAll(".vtc-w-bubbles circle")], dropEls: [...bottle.querySelectorAll(".vtc-w-drops circle")] };
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let raf = 0, last = 0;
    /** 本編の今の水量（0〜1）と、注いでいる・こぼしているか。 */
    function readLive() {
      const meter = panel?.querySelector('[data-test="water-meter"]');
      const level = Math.max(0, Math.min(1, Number(meter?.getAttribute("aria-valuenow")) / 100 || 0));
      const flow = panel?.querySelector('[data-test="water-step"]')?.dataset.flow || "stopped";
      const band = panel?.querySelector('[data-test="water-status"]')?.dataset.band || "none";
      return { level, flow, zone: level <= 0 ? "empty" : band };
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      const live = readLive();
      if (pic.dataset.zone !== live.zone) pic.dataset.zone = live.zone;
      const label = `ボトルの水量 ${Math.round(live.level * 100)}%。外の帯が目安、内側の細い帯は高得点`;
      if (pic.getAttribute("aria-label") !== label) pic.setAttribute("aria-label", label);
      pic.classList.toggle("pouring", live.flow === "pour");
      pic.classList.toggle("draining", live.flow === "drain");
      ok.classList.toggle("hot", live.zone === "ideal");
      step(dt, now, live);
    }
    function step(dt, now, { level: wl, flow }) {
      const N = 28, DX = BOTTLE.w / (N - 1), still = !!motion?.matches;
      const pouring = flow === "pour", draining = flow === "drain";
      // ボトルの傾き（こぼす間は大きく傾ける）
      const target = draining ? BOTTLE.drain : BOTTLE.rest, av0 = S.angV;
      S.angV += ((target - S.ang) * 70 - S.angV * 15) * dt; S.ang += S.angV * dt;
      const ang = S.ang;
      const yLocal = waterY(wl), [axisX, level] = tiltPoint(BOTTLE.cx, yLocal, ang);
      const [wallL, wallR] = BOTTLE_WALL(Math.max(BOTTLE.top, Math.min(BOTTLE.base, yLocal)));
      const xl = tiltPoint(wallL, yLocal, ang)[0], xr = tiltPoint(wallR, yLocal, ang)[0];
      const iL = Math.max(0, Math.floor(xl / DX)), iR = Math.min(N - 1, Math.ceil(xr / DX));
      // 蛇口の水: 注ぎはじめは吐水口から落ちていき、止めると上から切れて落ちる
      const F = FAUCET, iS = Math.round(F.nx / DX);
      const land = wl > 0 ? level + S.slope * (F.nx - axisX) + S.h[iS] : tiltPoint(F.nx, BOTTLE.base, 0)[1];
      if (pouring) { S.head = Math.min(land, (S.head ?? F.ny) + 2600 * dt); S.tail = F.ny; }
      else if (S.head != null) { S.tail = (S.tail ?? F.ny) + 2600 * dt; S.head = Math.min(land, S.head + 2600 * dt); if (S.tail >= S.head) S.head = S.tail = null; }
      const hitting = S.head != null && S.head >= land - 2 && wl > 0;
      if (hitting !== S.was) { S.slopeV += (hitting ? 0.5 : -0.35) * (still ? 0.2 : 1); S.was = hitting; }
      if (hitting && !still) {
        S.kick += dt;
        while (S.kick > 0.04) {
          S.kick -= 0.04;
          S.v[iS] += 190 + Math.random() * 190;
          for (const j of [iS - 1, iS + 1]) if (j >= iL && j <= iR) S.v[j] -= 90 + Math.random() * 150;
          for (const j of [iS - 2, iS + 2]) if (j >= iL && j <= iR) S.v[j] += (Math.random() - 0.5) * 170;
        }
      }
      const steps = Math.max(1, Math.ceil(dt / (1 / 240))), d = dt / steps;
      for (let k = 0; k < steps; k++) {
        S.slopeV += (-S.slope * 46 - S.slopeV * 1.5) * d + (S.angV - av0) / steps * 0.016;
        if (hitting && !still) S.slopeV += (Math.random() - 0.5) * 1.6 * d;
        S.slope += S.slopeV * d;
        for (let i = iL; i <= iR; i++) {
          const hl = S.h[i > iL ? i - 1 : i], hr = S.h[i < iR ? i + 1 : i];
          S.v[i] += ((hl + hr - 2 * S.h[i]) * 620 - S.h[i] * 16 - S.v[i] * 1.7) * d;
        }
        if (hitting && !still) S.v[iS] += 1800 * d;
        for (let i = iL; i <= iR; i++) S.h[i] = Math.max(-16, Math.min(16, S.h[i] + S.v[i] * d));
      }
      for (let i = 0; i < N; i++) if (i < iL || i > iR) { S.h[i] = S.h[i < iL ? iL : iR]; S.v[i] = 0; }
      S.slope = Math.max(-0.16, Math.min(0.16, S.slope));
      // 描く: 傾けたボトルの絵と切り抜き、水面、目安の線
      S.glass.style.transform = `rotate(${ang.toFixed(2)}deg)`;
      const rotation = `rotate(${ang.toFixed(2)} ${BOTTLE.pivot[0]} ${BOTTLE.pivot[1]})`;
      S.clip.setAttribute("transform", rotation);
      S.guide.setAttribute("transform", rotation);
      const y = (i) => level + S.slope * (i * DX - axisX) + S.h[i];
      let top = `M${-DX} ${y(0).toFixed(1)} L0 ${y(0).toFixed(1)}`;
      for (let i = 1; i < N; i++) { const xm = (i - 0.5) * DX, ym = (y(i - 1) + y(i)) / 2; top += ` Q${((i - 1) * DX).toFixed(1)} ${y(i - 1).toFixed(1)} ${xm.toFixed(1)} ${ym.toFixed(1)}`; }
      top += ` L${BOTTLE.w} ${y(N - 1).toFixed(1)} L${BOTTLE.w + DX} ${y(N - 1).toFixed(1)}`;
      const shown = wl > 0;
      S.body.setAttribute("d", shown ? `${top} V${BOTTLE.h + 260} H${-DX} Z` : "");
      S.deep.setAttribute("d", shown ? `${top} V${BOTTLE.h + 260} H${-DX} Z` : "");
      S.deep.setAttribute("transform", "translate(0 18)");
      S.surf.setAttribute("d", shown ? top : "");
      // 水流（上が少し太く、下へ細る。わずかに揺れる）
      if (S.head != null && S.head - S.tail > 4) {
        const t = now / 1000, wob = (yy) => Math.sin(t * 19 + yy * 0.045) * 1.6 + Math.sin(t * 31 + yy * 0.09) * 0.8, y0 = S.tail, y1 = S.head, seg = 6;
        let lft = "", rgt = "";
        for (let k = 0; k <= seg; k++) { const yy = y0 + (y1 - y0) * k / seg, half = 13 - 4.5 * k / seg + Math.sin(t * 23 + k) * 0.7, cx = F.nx + (still ? 0 : wob(yy)); lft += `${k ? "L" : "M"}${(cx - half).toFixed(1)} ${yy.toFixed(1)} `; rgt = `L${(cx + half).toFixed(1)} ${yy.toFixed(1)} ` + rgt; }
        S.stream.setAttribute("d", `${lft}${rgt}Z`); S.streamIn.setAttribute("d", `${lft}${rgt}Z`);
      } else { S.stream.setAttribute("d", ""); S.streamIn.setAttribute("d", ""); }
      S.fxClip.setAttribute("height", (tiltPoint(BOTTLE.mouth[0], BOTTLE.rim, ang)[1] + 900).toFixed(1));
      // こぼす間は、傾けたボトルの口の右の縁から、流し台の底へ水が流れ落ちる
      if (draining && wl > 0.02 && ang > BOTTLE.rest + 4) {
        const [lx, ly] = tiltPoint(BOTTLE.mouth[0] + 100, BOTTLE.rim - 12, ang), floor = BOTTLE.pivot[1] + 4, t = now / 1000;
        const wob = (yy) => still ? 0 : Math.sin(t * 17 + yy * 0.05) * 1.8;
        const x1 = lx + 22, mid = (ly + floor) / 2;
        S.spill.setAttribute("d", `M${lx.toFixed(1)} ${ly.toFixed(1)} Q${(lx + 16).toFixed(1)} ${(ly + 6).toFixed(1)} ${(x1 + wob(mid) - 4).toFixed(1)} ${mid.toFixed(1)} L${(x1 + wob(floor) - 3).toFixed(1)} ${floor} L${(x1 + wob(floor) + 3).toFixed(1)} ${floor} L${(x1 + wob(mid) + 4).toFixed(1)} ${mid.toFixed(1)} Q${(lx + 22).toFixed(1)} ${(ly + 2).toFixed(1)} ${(lx + 6).toFixed(1)} ${(ly - 4).toFixed(1)}Z`);
      } else S.spill.setAttribute("d", "");
      // 泡としぶき
      if (hitting && !still) {
        S.spawn += dt;
        while (S.spawn > 0.035) {
          S.spawn -= 0.035;
          if (S.bub.length < S.bubEls.length) S.bub.push({ x: F.nx + (Math.random() - 0.5) * 34, y: land + 14 + Math.random() * 70, r: 2.5 + Math.random() * 5, vy: -(70 + Math.random() * 120), vx: (Math.random() - 0.5) * 50, life: 0.45 + Math.random() * 0.5, t: 0 });
          if (S.drops.length < S.dropEls.length && Math.random() < 0.6) S.drops.push({ x: F.nx + (Math.random() - 0.5) * 12, y: land - 2, r: 2 + Math.random() * 2.6, vx: (Math.random() - 0.5) * 260, vy: -(150 + Math.random() * 230), t: 0 });
        }
      }
      S.bub = S.bub.filter((b) => { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; return b.t < b.life && b.y > level - 4; });
      S.bubEls.forEach((node, i) => { const b = S.bub[i]; if (b) { node.setAttribute("cx", b.x.toFixed(1)); node.setAttribute("cy", b.y.toFixed(1)); node.setAttribute("r", b.r.toFixed(1)); node.style.opacity = (0.75 * (1 - b.t / b.life)).toFixed(2); } else node.setAttribute("r", "0"); });
      S.drops = S.drops.filter((p) => { p.t += dt; p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < 0.7 && (p.vy < 0 || p.y < level + 4); });
      S.dropEls.forEach((node, i) => { const p = S.drops[i]; if (p) { node.setAttribute("cx", p.x.toFixed(1)); node.setAttribute("cy", p.y.toFixed(1)); node.setAttribute("r", p.r.toFixed(1)); } else node.setAttribute("r", "0"); });
    }
    raf = requestAnimationFrame(frame);

    return {
      pic, ctrl,
      spots: { bottle, band: [S.band, S.mark], hold: [drain, pour], ok },
      coach: () => "外の帯が目安。細い帯なら高得点だ",
      thermo: () => null, // 試作の水入れは温度計を出さない（加熱前の帯は配合・詰め方で見る）
      sync(livePanel, bench) {
        panel = livePanel;
        // 説明の間は、説明が指すボタンを押せる形で見せる（本編のボタンが無い・止まっているので、押しても何も起きない）
        const explaining = !!bench?.querySelector(".bench-guide")?.open;
        const state = Object.keys(LIVE).map((key) => !explaining && !usable(key));
        const next = JSON.stringify(state);
        if (next === sig) return;
        sig = next;
        [pour, drain, ok].forEach((button, i) => { button.disabled = state[i]; });
      },
      leave() { cancelAnimationFrame(raf); raf = 0; panel = null; },
    };
  },
};
