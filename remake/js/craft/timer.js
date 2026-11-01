// 生成した小物の液晶・物理ボタンに、実際の表示と操作を重ねる。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { stepPanel } from "./session.js";
import { autoSkill } from "./common.js";
import { artImg } from "./art.js";
import { buildDigitalClock } from "./digital-clock.js";
import { MAX_STEAM_SECONDS, normalizeSteamSeconds, steamPlaySeconds, SHORT_DODGE_SECONDS } from "./steam-time.js";
import { buildSteamTemperature, buildSteamForecast } from "./steam-forecast.js";
import { state } from "../core/state.js";
import { growthLesson } from "../core/growth-effects.js";
import { basicsExperienced } from "./practice-history.js";

export function runSteamTimer(cs) {
  const panel = stepPanel("steam", "蒸らし", "分・秒ボタンで蒸らし時間を設定し、スタートで開始する", { brief: "", lessonStep: "timer" });
  let seconds = normalizeSteamSeconds(cs.steamSeconds ?? 0);
  const canZero = cs.mode !== "tutorial" && growthLesson(state,"M-W4");
  const minimumSeconds = cs.mode === "tutorial" ? 180 : canZero ? 0 : 10;
  // B08: 制作と提供を一度終えた既習プレイヤーだけ、繰り返す雑念回避を任意で短くできる。初回・チュートリアルは従来どおり。
  const canShorten = cs.mode !== "tutorial" && basicsExperienced();
  const clock = buildDigitalClock("timer-display", { live: true, test: "timer-display" });
  const thermometer = buildSteamTemperature(cs);
  const forecast = buildSteamForecast(cs, thermometer);
  const durationHint = el("p", { role: "status", "aria-live": "polite", dataset: { test: "steam-duration-hint" } });
  const shorten = canShorten ? el("button.btn.steam-shorten", {
    type: "button",
    dataset: { test: "steam-shorten" },
    "aria-pressed": String(!!cs.steamShorten),
    style: { marginTop: "0.4em" },
    onclick: () => { SE.click(); cs.steamShorten = !cs.steamShorten; render(); },
  }) : null;
  let start;
  const render = () => {
    clock.update(seconds);
    forecast.update(seconds);
    const playSeconds = steamPlaySeconds(seconds) * (cs.mode === "tutorial" ? 0.7 : 1);
    const shortened = canShorten && cs.steamShorten;
    const effective = shortened ? Math.min(playSeconds, SHORT_DODGE_SECONDS) : playSeconds;
    durationHint.textContent = seconds < minimumSeconds
      ? "時間を設定すると、雑念回避の長さが分かります。"
      : shortened
        ? `雑念回避は約${Math.ceil(effective)}秒に短縮。蒸らし時間・温度・採点はそのままです。`
        : `雑念回避は約${Math.ceil(effective)}秒。選んだ蒸らし時間をこの長さに縮めて遊びます。`;
    if (shorten) {
      shorten.setAttribute("aria-pressed", String(!!cs.steamShorten));
      shorten.textContent = cs.steamShorten ? "雑念回避：短め（押すと元に戻す）" : "慣れたので雑念回避を短めにする";
    }
    start.disabled = seconds < minimumSeconds;
    panel.querySelectorAll("[data-test='timer-minute-up'], [data-test='timer-second-up']").forEach((b) => { b.disabled = seconds >= MAX_STEAM_SECONDS; });
  };
  return new Promise((resolve) => {
    const addMinute = () => { SE.click(); seconds = normalizeSteamSeconds(seconds + 60); render(); };
    const addSecond = () => { SE.click(); seconds = normalizeSteamSeconds(seconds + 10); render(); };
    const button = (label, test, column, action) => el("button.timer-button", {
      text: label, dataset: { test }, style: { left: `${[15, 34, 60, 85][column - 1]}%` }, onclick: action,
    });
    start = button("", "timer-start", 3, () => {
      if (seconds < minimumSeconds) return;
      SE.select(); if(canZero&&seconds===0)cs.zeroSteam=true;else delete cs.zeroSteam; cs.steamSeconds = seconds; cs.steamMin = seconds / 60;
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
      ]), durationHint, shorten, forecast.root, thermometer.root,
    ]));
    render();
    if (autoSkill()) { seconds = 300; render(); setTimeout(() => start.click(), 40); }
  });
}
