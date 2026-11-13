// TRPGの試遊（TRF21）: 本編（index.html）から起動する。本編のボドゲカフェと同じ本棚（campaign-view）と卓を、
// 使い捨ての状態で開く。本編のセーブ・設定は読み書きしない（状態はこのモジュールの中だけに持つ）。
// 入口は main.js の `?trial=trpg` と、デバッグの道具（dev/minigame-launcher.js）。
import { newState } from "../core/state.js";
import { el } from "../core/util.js";
import { mountTrpgCampaign } from "./campaign-view.js";
import { mountTrpgRecruitment } from "./club-view.js";
import { loadTrpgClubResources } from "./index.js";
import { TRPG_TRIAL_PRESETS, trpgTrialState } from "./trial-state.js";

export { TRPG_TRIAL_PRESETS, trpgTrialState };

/**
 * 試遊を host に出す。本棚の「試遊の設定へ」で始め方を選び直せ、卓を遊び終えたら次の夜の本棚へ進む。
 * exitLabel を渡すと、設定の画面に「タイトルへ戻る」などの出口を出す（押すと finished が解決する）。
 */
export function mountTrpgTrial(host, { preset = "ready", exitLabel = "", signal = null, resources: supplied = null } = {}) {
  let controller = null, state = null, resources = supplied, disposed = false, resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  function destroy() {
    if (disposed) return;
    disposed = true; controller?.destroy(); host.replaceChildren();
    signal?.removeEventListener("abort", destroy);
    resolveFinished({ exited: true });
  }
  if (signal?.aborted) destroy(); else signal?.addEventListener("abort", destroy, { once: true });

  function open(id) {
    if (disposed) return;
    state = trpgTrialState(newState(), resources.catalog, id);
    shelf();
  }
  function shelf() {
    if (disposed) return;
    controller?.destroy();
    const owner = state;
    // 本編では街で会って誘う。試遊では、まだ誘っていない人がいる時だけ、本棚から会いに行ける。
    const canRecruit = resources.catalog.participants.some(person => person.interested === true && !owner.trpg.club.members[person.id]);
    controller = mountTrpgCampaign(host, {
      getState: () => owner, save: () => true, closeLabel: "試遊の設定へ", signal, resources: null,
      visitMember: canRecruit ? async (personId, shared, visitSignal) =>
        mountTrpgRecruitment(host, { getState: () => owner, personId, ...shared, save: () => true, signal: visitSignal }).finished : null,
    });
    controller.finished.then(result => {
      if (disposed || state !== owner) return;
      // 卓を遊び終えた夜は、本編と同じく終わる。試遊では、そのまま次の夜の本棚へ。
      if (result?.completed) { owner.day++; owner.slot = 1; shelf(); } else setup();
    });
  }
  function setup() {
    if (disposed) return;
    controller?.destroy(); controller = null;
    const choose = entry => el("button.trpg-button.trpg-tryout-preset", { type: "button", dataset: { test: "trpg-tryout-" + entry.id }, onclick: () => open(entry.id) },
      [el("strong", { text: entry.label }), el("small", { text: entry.note })]);
    host.replaceChildren(el("section.trpg-root.trpg-campaign.trpg-tryout-setup", { tabindex: "-1", dataset: { test: "trpg-tryout-setup" } }, [
      el("span.trpg-kicker", { text: "ボドゲカフェ / 試遊" }),
      el("h1", { text: "どこから試す？" }),
      el("p.trpg-campaign-notice", { text: "本編と同じ本棚と卓です。本編のセーブは読み書きしません。閉じると最初に戻ります。" }),
      el("div.trpg-tryout-presets", TRPG_TRIAL_PRESETS.map(choose)),
      el("div.trpg-tryout-actions", [
        state ? el("button.trpg-button", { type: "button", text: "本棚へ戻る", dataset: { test: "trpg-tryout-shelf" }, onclick: () => shelf() }) : null,
        exitLabel ? el("button.trpg-button", { type: "button", text: exitLabel, dataset: { test: "trpg-tryout-exit" }, onclick: destroy }) : null,
      ].filter(Boolean)),
    ]));
    host.querySelector(".trpg-tryout-setup")?.focus({ preventScroll: true });
  }

  // ready は、最初の本棚が画面に出た時に解決する。
  const ready = (async () => {
    resources ||= await loadTrpgClubResources({ signal });
    if (disposed) return;
    open(preset);
    await controller?.ready;
  })();
  ready.catch(() => { if (!disposed) { host.replaceChildren(el("p.trpg-loading", { text: "試遊を準備できませんでした。読み込み直してください。" })); } });
  return { ready, finished, destroy, snapshot: () => state && structuredClone(state) };
}
