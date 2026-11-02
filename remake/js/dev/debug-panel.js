// デバッグ用の道具（2026-11-02 オーナー「デバッグ用に役立つ機能入れたい。何倍速とかシーシャ作りパートスキップとか。
// リリースするときは消すけど」）。URL に ?debug=1 を付けると左下に「DBG」が出る（?debug=0 で消える。端末に覚える）。
// - 速さ: ×1／×2／×4／×8（time-warp.js。音は変えない）
// - シーシャ作り: 自分で／自動で成功／自動で失敗（検査用の craftTest.auto を使う。各工程が操作なしで進む）
// - 便利: 体力を満タン・お金＋10万円・経験値＋200・火種＋6
// - 今の状態（章・日・時間帯・体力・お金）
// 会話の早送りは、会話の操作バーの SKIP（設定で未読も飛ばせる）を使う。
// リリース前に消す: remake/js/dev/ のフォルダと、main.js の「デバッグ用の道具」の1行（remake/README.md）。
import { state } from "../core/state.js";
import { addStamina, addMoney, maxStamina } from "../core/stats.js";
import { craftTest } from "../craft/session.js";
import { growthEnabled, gainExp, ensureGrowth } from "../core/growth.js";
import { emit } from "../core/bus.js";
import { installTimeWarp, setSpeed, getSpeed, SPEEDS, realTime } from "./time-warp.js";

const SPEED_KEY = "suien_debug_speed";
const CRAFT_KEY = "suien_debug_craft";
const CRAFT_MODES = Object.freeze([
  { value: "", label: "自分で" },
  { value: "good", label: "自動で成功" },
  { value: "bad", label: "自動で失敗" },
]);
const store = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
};

const STYLE = `
.dbg-toggle{position:fixed;left:8px;bottom:8px;z-index:2147483000;font:700 12px/1 system-ui,sans-serif;padding:8px 10px;border-radius:8px;
  border:1px solid #f5c26b;background:rgba(20,16,30,.82);color:#f5c26b;cursor:pointer;letter-spacing:.06em}
.dbg-toggle[data-speed]:not([data-speed="1"])::after{content:" ×" attr(data-speed)}
.dbg-panel{position:fixed;left:8px;bottom:48px;z-index:2147483000;width:min(300px,calc(100vw - 16px));max-height:calc(100vh - 64px);overflow:auto;
  background:rgba(20,16,30,.94);color:#f4ede0;border:1px solid #f5c26b;border-radius:10px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;
  box-shadow:0 8px 24px rgba(0,0,0,.5)}
.dbg-panel[hidden]{display:none}
.dbg-panel h4{margin:8px 0 4px;font-size:12px;color:#f5c26b;font-weight:700}
.dbg-panel h4:first-child{margin-top:0}
.dbg-row{display:flex;flex-wrap:wrap;gap:6px}
.dbg-panel button{font:600 12px/1 system-ui,sans-serif;padding:7px 9px;border-radius:6px;border:1px solid #6b5a8a;background:#2b2340;color:#f4ede0;cursor:pointer}
.dbg-panel button[aria-pressed="true"]{background:#f5c26b;border-color:#f5c26b;color:#1c1626}
.dbg-state{font:12px/1.5 ui-monospace,monospace;color:#cfc6b6;white-space:pre-wrap}
.dbg-note{font-size:11px;color:#9d93a8;margin-top:6px}
`;

function el(tag, { dataset = {}, ...props } = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value;
  node.append(...children);
  return node;
}
const SLOT = ["昼", "夜", "就寝"];
function stateText() {
  const s = state;
  if (!s) return "（ゲーム開始前）";
  const money = typeof s.money === "number" ? `${s.money.toLocaleString("ja-JP")}円` : "-";
  return `第${s.chapter ?? "-"}章 DAY${s.day ?? "-"} ${SLOT[s.slot] ?? "-"}（${s.phase ?? "-"}）\n体力 ${s.stamina ?? "-"}／${state ? maxStamina() : "-"}  お金 ${money}`;
}

let mounted = false;
/** 左下に DBG ボタンとパネルを出す（一度だけ）。保存した速さ・シーシャ作りの設定を当てる。 */
export function mountDebugPanel() {
  if (mounted) return;
  mounted = true;
  installTimeWarp();
  setSpeed(Number(store.get(SPEED_KEY)) || 1);
  craftTest.auto = CRAFT_MODES.some(mode => mode.value && mode.value === store.get(CRAFT_KEY)) ? store.get(CRAFT_KEY) : null;

  document.head.append(el("style", { id: "dbg-style", textContent: STYLE }));
  const toggle = el("button", { className: "dbg-toggle", type: "button", textContent: "DBG", title: "デバッグ用の道具（` キーでも開閉）",
    dataset: { test: "debug-toggle", speed: String(getSpeed()) } });
  const panel = el("div", { className: "dbg-panel", hidden: true, dataset: { test: "debug-panel" } });
  const status = el("div", { className: "dbg-state", dataset: { test: "debug-state" } });

  const pressed = (row, value) => { for (const b of row.children) b.setAttribute("aria-pressed", String(b.dataset.value === String(value))); };
  const speedRow = el("div", { className: "dbg-row" }, SPEEDS.map(speed => el("button", { type: "button", textContent: `×${speed}`,
    dataset: { value: String(speed), test: `debug-speed-${speed}` },
    onclick: () => { store.set(SPEED_KEY, String(setSpeed(speed))); toggle.dataset.speed = String(getSpeed()); pressed(speedRow, getSpeed()); } })));
  const craftRow = el("div", { className: "dbg-row" }, CRAFT_MODES.map(mode => el("button", { type: "button", textContent: mode.label,
    dataset: { value: mode.value, test: `debug-craft-${mode.value || "manual"}` },
    onclick: () => { craftTest.auto = mode.value || null; store.set(CRAFT_KEY, mode.value); pressed(craftRow, mode.value); } })));
  const action = (label, test, run) => el("button", { type: "button", textContent: label, dataset: { test },
    onclick: () => { if (!state) return; run(); emit("hud"); status.textContent = stateText(); } });
  const tools = el("div", { className: "dbg-row" }, [
    action("体力を満タン", "debug-stamina", () => addStamina(maxStamina() - (state.stamina || 0))),
    action("お金＋10万円", "debug-money", () => addMoney(100000)),
    action("経験値＋200", "debug-exp", () => { if (growthEnabled()) gainExp(200); }),
    action("火種＋6", "debug-hidane", () => { if (growthEnabled()) { const g = ensureGrowth(); g.hidane.any = (g.hidane.any || 0) + 6; } }),
  ]);
  pressed(speedRow, getSpeed());
  pressed(craftRow, craftTest.auto || "");
  panel.append(
    el("h4", { textContent: "速さ（音は変わらない）" }), speedRow,
    el("h4", { textContent: "シーシャ作り" }), craftRow,
    el("h4", { textContent: "便利" }), tools,
    el("h4", { textContent: "今の状態" }), status,
    el("div", { className: "dbg-note", textContent: "会話の早送りは、会話の SKIP。経験値は寝ると精算される。" }),
    el("div", { className: "dbg-note", textContent: "この道具を消す: URL に ?debug=0。リリース前には remake/js/dev/ を消す。" }),
  );
  const open = show => { panel.hidden = !show; if (show) status.textContent = stateText(); };
  toggle.addEventListener("click", () => open(panel.hidden));
  document.addEventListener("keydown", event => {
    if (event.key === "`" && !event.repeat && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) open(panel.hidden);
  });
  realTime.setInterval(() => { if (!panel.hidden) status.textContent = stateText(); }, 500);
  document.body.append(panel, toggle);
}
