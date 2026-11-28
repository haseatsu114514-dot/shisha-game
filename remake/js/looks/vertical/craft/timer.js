// 縦画面の作る場面: 蒸らし時間を決めるタイマー（試作の timer・VPL105・VPL127〜VPL130）。上の絵＝縦長のキッチンタイマー（液晶の数字と
// 4つの物理ボタンを重ねる。数字は絵に焼き込まない）、右＝蒸らし後の温度の目安（温度計の針と幅）、下＝早見の 3分・5分・8分 とリセット、
// いちばん下＝分（＋1分）・秒（＋10秒）・スタート。
// 本編の runSteamTimer（craft/timer.js）の画面を読んで描き（液晶の時間・押せるか・目安の幅・雑念回避の長さ）、押した操作は本編のボタン
// （data-test timer-minute-up／timer-second-up／timer-reset／timer-start／timer-preset-N・steam-shorten）へ中継する。
// 時間の刻み・上限・最短・目安の計算は本編のまま（ここでは数えない）。
import { el } from "../../../core/util.js";
import { textOf } from "../frame.js";

const ART = new URL("../../../../img/ui/vertical-craft/", import.meta.url).href;
// 縦長のキッチンタイマーの絵（試作の KTIMER）。液晶＝左・上・幅・高さ（絵に対する %）、ボタン＝中心の横・縦・幅・高さ（%）・字の大きさ（cqw）
const KTIMER = { ar: [885, 1207], lcd: [12.54, 12.84, 74.58, 29.16],
  keys: { min: [29.49, 58.74, 33.0, 13.58, 8.4], sec: [69.04, 58.91, 32.54, 13.25, 8.4], reset: [29.27, 77.97, 32.55, 13.59, 5], start: [68.81, 77.8, 32.09, 13.25, 4.6] } };
const KEY_TEXT = { min: ["分"], sec: ["秒"], start: ["スタート", "＆ストップ"], reset: ["リセット"] };
// 本編のボタン
const LIVE = { min: "timer-minute-up", sec: "timer-second-up", start: "timer-start", reset: "timer-reset", shorten: "steam-shorten" };
const PRESETS = [3, 5, 8];
// 液晶の7つの区画（本編 craft/digital-clock.js と同じ形）
const SEG_DIGITS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const SEG_PATHS = { a: "M6 2h28l4 4-4 4H6L2 6Z", b: "m38 8 4 4v20l-4 4-4-4V12Z", c: "m38 38 4 4v20l-4 4-4-4V42Z", d: "M6 64h28l4 4-4 4H6l-4-4Z",
  e: "m2 38 4 4v20l-4 4-4-4V42Z", f: "m2 8 4 4v20l-4 4-4-4V12Z", g: "M6 33h28l4 4-4 4H6l-4-4Z" };
const lcdSvg = (digits) => `<svg viewBox="-4 -2 223 80" aria-hidden="true">${[2, 52, 122, 172].map((x, i) => `<g transform="translate(${x} 0)">${
  Object.entries(SEG_PATHS).map(([k, p]) => `<path class="${SEG_DIGITS[Number(digits[i])]?.includes(k) ? "on" : ""}" d="${p}"/>`).join("")}</g>`).join("")
}<circle class="on" cx="108" cy="25" r="3"/><circle class="on" cx="108" cy="50" r="3"/></svg>`;
const pc = (v) => `${v}%`;

export const timerView = {
  id: "timer",
  step: "steam", // 本編は蒸らしの工程の中で時間を決める（パネルの工程は steam のまま）
  match: (panel) => !!panel.querySelector(`.steam-timer [data-test="${LIVE.start}"]`),
  intro: true, // runSteamTimer はタイマーを出す前に初回の説明を開く（雑念回避の説明は場を出してから）
  create({ relay }) {
    let panel = null, sig = "", started = false;
    const lcd = el("output.vtc-lcd", { "aria-live": "polite", dataset: { test: "vt-timer-lcd" },
      style: { left: pc(KTIMER.lcd[0]), top: pc(KTIMER.lcd[1]), width: pc(KTIMER.lcd[2]), height: pc(KTIMER.lcd[3]) } });
    const keys = {};
    for (const [id, [x, y, w, h, fs]] of Object.entries(KTIMER.keys)) {
      keys[id] = el(`button.vtc-kt.vtc-kt-${id}`, { type: "button", dataset: { key: id, test: `vt-timer-key-${id}` },
        style: { left: pc(x), top: pc(y), width: pc(w), height: pc(h), fontSize: `${fs}cqw` } },
        KEY_TEXT[id].flatMap((line, i) => (i ? [el("br"), line] : [line])));
    }
    const ktimer = el("div.vtc-ktimer", { style: { "--ar": String(KTIMER.ar[0] / KTIMER.ar[1]), aspectRatio: `${KTIMER.ar[0]} / ${KTIMER.ar[1]}` } }, [
      el("img", { src: `${ART}ui-ktimer-tall.webp`, alt: "", draggable: "false" }), lcd, ...Object.values(keys),
    ]);
    const shorten = el("button.vtc-shorten", { type: "button", hidden: true, dataset: { test: "vt-timer-shorten" } });
    const stage = el("div.vtc-timer", [ktimer]);
    const pic = el("div.vtc-timer-pic", [stage, shorten]);
    const presets = PRESETS.map((m) => el("button.vtc-preset", { type: "button", text: `${m}分`, dataset: { key: `p${m}`, test: `vt-timer-preset-${m}` } }));
    const presetReset = el("button.vtc-preset.reset", { type: "button", text: "リセット", dataset: { key: "reset", test: "vt-timer-preset-reset" } });
    const round = (cls, key, label, text, lab) => el(`button.vtc-ok.${cls}`, { type: "button", "aria-label": label, dataset: { key, test: `vt-timer-${key}` } }, [
      el("span.vtc-ok-t", { text }), lab ? el("small.vtc-lab", { text: lab }) : null,
    ]);
    const tMin = round("vtc-t-min", "min", "1分足す", "分", "＋1分");
    const tSec = round("vtc-t-sec", "sec", "10秒足す", "秒", "＋10秒");
    const tStart = round("vtc-t-start", "start", "スタート", "スタート");
    const ctrl = el("div.vtc-timer-ctrl", [el("div.vtc-presets", [...presets, presetReset]), tMin, tSec, tStart]);

    const liveOf = (key) => panel?.querySelector(`[data-test="${key.startsWith("p") ? `timer-preset-${key.slice(1)}` : LIVE[key]}"]`);
    /** 押した印（絵の物理ボタンが一瞬沈む）。下の段の分・秒・スタート・リセットも同じボタンを押したことにする */
    const hit = (key) => {
      const kt = keys[key];
      if (!kt) return;
      kt.classList.remove("hit"); void kt.offsetWidth; kt.classList.add("hit");
    };
    function press(key) {
      if (started) return; // スタートを押した後は、本編が次の工程へ移るまで受けない
      const live = liveOf(key);
      if (!live || live.disabled) return;
      hit(key);
      if (key === "start") { started = true; stage.classList.add("go"); }
      relay(live);
    }
    for (const button of [...Object.values(keys), ...presets, presetReset, tMin, tSec, tStart]) {
      button.addEventListener("click", () => press(button.dataset.key));
    }
    shorten.addEventListener("click", () => { const live = liveOf("shorten"); if (live && !started) relay(live); });

    return {
      pic, ctrl,
      // 大会とリハーサルは、本編も練習の決まった時間を案内しない（craft/session.js の explainStepOnce）
      coach: (bench) => ["tournament", "rehearsal"].includes(bench.dataset.mode) ? "時間を決めたら、スタートだ" : "時間を決めろ。迷ったら5分",
      thermo: (bench) => {
        const node = panel?.querySelector(".thermo.steam-temperature") || bench.querySelector(".thermo.steam-temperature");
        const range = textOf(panel?.querySelector('[data-test="steam-forecast-text"]'));
        const dodge = textOf(panel?.querySelector('[data-test="steam-duration-hint"] .steam-duration-main'));
        const set = !!node?.querySelector(".thermo-range:not([hidden])");
        return { node, mode: "forecast", note: "目安", label: set ? `蒸らし後の温度の目安 ${range}。${dodge}` : "蒸らし後の温度の目安" };
      },
      sync(livePanel) {
        panel = livePanel;
        const clock = textOf(panel.querySelector('[data-test="timer-display"] .clock-value')) || "00:00";
        const [mm, ss] = clock.split(":").map(Number);
        const seconds = (mm || 0) * 60 + (ss || 0);
        const shortLive = liveOf("shorten");
        const state = Object.fromEntries(["min", "sec", "start", "reset"].map((key) => [key, !liveOf(key) || liveOf(key).disabled]));
        const next = JSON.stringify([clock, state, shortLive ? shortLive.getAttribute("aria-pressed") : null, started]);
        if (next === sig) return;
        sig = next;
        lcd.innerHTML = lcdSvg(clock.replace(":", "").padStart(4, "0"));
        lcd.setAttribute("aria-label", `蒸らし時間 ${Math.floor(seconds / 60)}分${seconds % 60}秒`);
        for (const button of presets) button.setAttribute("aria-pressed", String(seconds === Number(button.dataset.key.slice(1)) * 60));
        for (const [key, off] of Object.entries(state)) {
          keys[key].disabled = off || started;
          const round = { min: tMin, sec: tSec, start: tStart }[key];
          if (round) round.disabled = off || started;
        }
        presetReset.disabled = state.reset || started;
        for (const button of presets) button.disabled = started;
        // 慣れた人だけの「雑念回避を短めにする」（本編の steam-shorten。初回・チュートリアルには無い）
        shorten.hidden = !shortLive;
        if (shortLive) {
          const on = shortLive.getAttribute("aria-pressed") === "true";
          shorten.setAttribute("aria-pressed", String(on));
          shorten.textContent = on ? "雑念回避：短め" : "雑念回避を短く";
          shorten.disabled = started;
        }
      },
      leave() { panel = null; },
    };
  },
};
