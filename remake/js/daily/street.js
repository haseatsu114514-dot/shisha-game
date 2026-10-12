// 既存ハリボテ試作を行き先選択として使う。同一オリジンのframe APIでIDだけを受け取る。
import { el, yen } from "../core/util.js";
import { state, timeOfDay } from "../core/state.js";
import { layers, showScreen, retire } from "../core/ui.js";
import { spotById, hasNewEvent } from "./spots.js";
import { spotAvailability, freeGuide } from "./spot-access.js";
import { mountReel } from "./reel.js";

export const STREET_DOORS = Object.freeze({ cafe: "cafe", peppermint: "minto", kemurikusa: "naru" });
export const WALK_STREET = Symbol("walk-street");
export const BACK_TO_MAP = Symbol("back-to-map");
export const canWalkStreet = ({ guide } = {}) => state.chapter === 1 && (!guide || Object.values(STREET_DOORS).includes(guide.pin));

export function openStreet(opts, setInterrupt) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      setInterrupt(null);
      frame.remove(); // frame内の入力・描画・タイマーも破棄する
      retire(root);
      resolve(value);
    };
    const info = (door) => {
      const s = spotById(STREET_DOORS[door]);
      if (!s) return { ok: false, label: "？？？", why: "まだ知らない場所" };
      const av = spotAvailability(s, opts);
      const known = !s.charId || !!state.met[s.charId];
      return { ...av, label: av.why === "locked" ? "？？？" : s.label,
        why: av.why === "locked" ? "まだ知らない場所" : av.why,
        tag: av.tag || (av.guided ? "案内の行き先ではない" : freeGuide(s, opts.guide) ? opts.guide.free : s.cost ? yen(s.cost) : "無料"),
        event: av.why !== "locked" && (opts.guide?.pin === s.id || opts.eventPin === s.id || known && av.ok && hasNewEvent(s)),
        guided: opts.guide?.pin === s.id };
    };
    const frame = el("iframe.street-frame", {
      title: "繁華街の通りを歩く", dataset: { test: "street-frame" },
      src: `../experiments/proto/street/index.html?stage=set&area=hankagai&embed=1${timeOfDay() === "night" ? "&night=1" : ""}`,
      onload: () => {
        const scene = frame.contentWindow?.streetScene;
        if (!scene || finished) return;
        scene.connect({
          info,
          visited: (door) => {
            const id = STREET_DOORS[door];
            return !!(state.visits[id] > 0 || state.spotVisits?.[id] > 0);
          },
          enter: (door) => { if (info(door).ok) finish(STREET_DOORS[door]); },
          back: () => finish(BACK_TO_MAP),
          paused: () => finished || !root.isConnected || root.classList.contains("done")
            || layers.modal.classList.contains("show") || layers.vn.classList.contains("active")
            || document.body.classList.contains("vn-open") || document.hidden,
        });
      },
    });
    const reelHost = el("div.street-reel");
    const root = el("div.street-selection", { dataset: { destinationSelection: "true" } }, [
      frame, reelHost,
      el("div.street-heading", [el("b", { text: "繁華街を歩く（仮導入）" }),
        el("span", { text: "歩行絵は仮素材です。主人公ははじめのままです。" }),
        opts.guide ? el("p", { text: opts.guide.text }) : null,
        opts.notice ? el("p", { text: opts.notice }) : null]),
      el("button.street-back", { text: "ピンマップへ戻る", dataset: { test: "street-back" }, onclick: () => finish(BACK_TO_MAP) }),
    ]);
    showScreen("street", root);
    setInterrupt(finish);
    mountReel(reelHost); // 抽選と報酬は従来どおり行動時。未提示結果を同じ筐体で見せる。
    opts.onShown?.();
  });
}
