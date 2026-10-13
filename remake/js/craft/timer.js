// 生成した小物の液晶・物理ボタンに、実際の表示と操作を重ねる。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { stepPanel } from "./session.js";
import { autoSkill } from "./common.js";
import { artImg } from "./art.js";
import { buildDigitalClock } from "./digital-clock.js";
import { MAX_STEAM_SECONDS, normalizeSteamSeconds } from "./steam-time.js";
import { buildSteamTemperature, buildSteamForecast } from "./steam-forecast.js";

export function runSteamTimer(cs) {
  const panel = stepPanel("steam", "蒸らし", "", { brief: "", lessonStep: "timer" });
  let seconds = normalizeSteamSeconds(cs.steamSeconds ?? 0);
  const clock = buildDigitalClock("timer-display", { live: true, test: "timer-display" });
  const thermometer = buildSteamTemperature(cs);
  const forecast = buildSteamForecast(cs, thermometer);
  let start;
  const render = () => {
    clock.update(seconds);
    forecast.update(seconds);
    start.disabled = seconds === 0;
    panel.querySelectorAll("[data-test='timer-minute-up'], [data-test='timer-second-up']").forEach((b) => { b.disabled = seconds >= MAX_STEAM_SECONDS; });
  };
  return new Promise((resolve) => {
    const addMinute = () => { SE.click(); seconds = normalizeSteamSeconds(seconds + 60); render(); };
    const addSecond = () => { SE.click(); seconds = normalizeSteamSeconds(seconds + 10); render(); };
    const button = (label, test, column, action) => el("button.timer-button", {
      text: label, dataset: { test }, style: { left: `${[15, 34, 60, 85][column - 1]}%` }, onclick: action,
    });
    start = button("", "timer-start", 3, () => {
      if (!seconds) return;
      SE.select(); cs.steamSeconds = seconds; cs.steamMin = seconds / 60;
      resolve();
    });
    start.classList.add("timer-start");
    start.setAttribute("aria-label", "スタート＆ストップ");
    start.append(el("span", { text: "スタート" }), el("span", { text: "＆ストップ" }));
    panel.append(el("div.steam-timer", [
      el("div.steam-clock", { dataset: { test: "kitchen-timer" } }, [
        artImg("kitchen_timer.png", 520, "steam-clock-skin", { h: 348 }), clock.root,
        button("分", "timer-minute-up", 1, addMinute),
        button("秒", "timer-second-up", 2, addSecond), start,
        button("リセット", "timer-reset", 4, () => { SE.click(); seconds = 0; render(); }),
      ]), forecast.root, thermometer.root,
    ]));
    render();
    if (autoSkill()) { seconds = 300; render(); setTimeout(() => start.click(), 40); }
  });
}
