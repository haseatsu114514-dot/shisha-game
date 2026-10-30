// 本編の商店街を行き先選択として使う。同一オリジンのframe APIでIDだけを受け取る。
import { el, yen } from "../core/util.js";
import { state, timeOfDay } from "../core/state.js";
import { layers, showScreen, retire } from "../core/ui.js";
import { spotById, hasNewEvent } from "./spots.js";
import { spotAvailability, freeGuide } from "./spot-access.js";
import { cueTransition } from "../core/transitions.js";

export const STREET_DOORS = Object.freeze({ cafe: "cafe", peppermint: "minto", kemurikusa: "naru" });
export const WALK_STREET = Symbol("walk-street");
export const BACK_TO_MAP = Symbol("back-to-map");
export const canWalkStreet = ({ guide } = {}) => state.chapter === 1 && (!guide || Object.values(STREET_DOORS).includes(guide.pin));

const STREET_READY_TIMEOUT_MS = 10000;
const STREET_SLOW_TEXT = "読み込みに時間がかかっています。このまま待つか、ピンマップへ戻るで戻れます。";
const STREET_FAIL_TEXT = "準備に時間がかかっています／読み込みに失敗しました。ピンマップへ戻れます";

export function openStreet(opts, setInterrupt) {
  return new Promise((resolve) => {
    let finished = false;
    let entering = false;
    let loadError = false;
    const waiting = el("div.street-waiting", { text: "商店街を準備しています…", dataset: { test: "street-waiting" } });
    let readyTimer = 0;
    const showLoadFailure = () => {
      loadError = true;
      clearTimeout(readyTimer);
      waiting.hidden = false;
      waiting.textContent = STREET_FAIL_TEXT;
    };
    // 場面が応答しないときも戻れることを知らせる。成功したら案内は消す。
    readyTimer = setTimeout(() => { if (!loadError) waiting.textContent = STREET_SLOW_TEXT; }, STREET_READY_TIMEOUT_MS);
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(readyTimer);
      waiting.hidden = true;
      waiting.remove();
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
      title: "商店街の奥へ歩く", dataset: { test: "street-frame" },
      src: `street/index.html?embed=1${timeOfDay() === "night" ? "&night=1" : ""}`,
      onload: () => {
        const scene = frame.contentWindow?.streetScene;
        if (finished) return;
        if (!scene) { showLoadFailure(); return; }
        scene.connect({
          info,
          visited: (door) => {
            const id = STREET_DOORS[door];
            return !!(state.visits[id] > 0 || state.spotVisits?.[id] > 0);
          },
          enter: async (door) => {
            if (finished || entering || !info(door).ok) return;
            entering = true;
            try {
              const spot = spotById(STREET_DOORS[door]);
              if (opts.onBeforeGo && !(await opts.onBeforeGo(spot))) return;
              if (finished || !info(door).ok) return;
              cueTransition("place", { spotId: spot.id, label: spot.label, area: spot.area || "", glyph: spot.glyph || "" });
              finish(spot.id);
            } finally { entering = false; }
          },
          back: () => finish(BACK_TO_MAP),
          paused: () => finished || entering || !root.isConnected || root.classList.contains("done")
            || layers.modal.classList.contains("show") || layers.vn.classList.contains("active")
            || document.body.classList.contains("vn-open") || document.hidden,
          onReady: () => { clearTimeout(readyTimer); if (!loadError) waiting.remove(); },
          onLoadError: showLoadFailure,
        });
      },
    });
    const root = el("div.street-selection", { dataset: { destinationSelection: "true" } }, [
      frame,
      waiting,
      el("div.street-heading", [el("b", { text: "商店街を歩く" }),
        el("span", { text: "歩道や入口をタップして進めます。" }),
        opts.guide ? el("p", { text: opts.guide.text }) : null,
        opts.notice ? el("p", { text: opts.notice }) : null]),
      el("button.street-back", { text: "ピンマップへ戻る", dataset: { test: "street-back" }, onclick: () => finish(BACK_TO_MAP) }),
    ]);
    showScreen("street", root);
    setInterrupt(finish);
    // 街歩きでは筐体を起動しない。保留結果はピンマップへ戻ってから従来どおり提示する。
    opts.onShown?.();
  });
}
