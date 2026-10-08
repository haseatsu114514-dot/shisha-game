// 生成した小物の液晶・物理ボタンに、実際の表示と操作を重ねる。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { stepPanel } from "./session.js";
import { autoSkill } from "./common.js";
import { artImg } from "./art.js";
import { buildDigitalClock } from "./digital-clock.js";

export function runSteamTimer(cs, hint) {
  const panel = stepPanel("steam", "蒸らし時間", hint, { brief: "秒は10秒ずつ。5〜8分が目安" });
  let seconds = cs.steamSeconds ?? 0;
  const clock = buildDigitalClock("timer-display", { live: true, test: "timer-display" });
  const advice = el("p.timer-advice");
  let start;
  const render = () => {
    clock.update(seconds);
    start.disabled = seconds === 0;
    advice.textContent = !seconds ? "ボタンで時間を設定しよう" : seconds < 300 ? "短めの蒸らし。吸い出しで熱を入れる"
      : seconds < 450 ? "香りの輪郭を残す。吸い出しは低めの温度から"
      : seconds < 600 ? "じっくり熱を入れる。吸い出しに余裕ができる" : "長めの蒸らし。焦げに気をつけたい";
  };
  return new Promise((resolve) => {
    const addMinute = () => { SE.click(); seconds = ((Math.floor(seconds / 60) + 1) % 100) * 60 + seconds % 60; render(); };
    const addSecond = () => { SE.click(); seconds = Math.floor(seconds / 60) * 60 + (seconds % 60 + 10) % 60; render(); };
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
      ]), advice,
    ]));
    render();
    if (autoSkill()) { seconds = 300; render(); setTimeout(() => start.click(), 40); }
  });
}
