import { el } from "../core/util.js";
import { bgUrl } from "../core/data.js";
import { chapterThreeMapModel } from "./ch3-map-model.js";
import { hasStoreLogo, storeLogo } from "../core/store-logos.js";

let activeMap = null;

/**
 * 地図の閲覧と選択のみ。'gym' か { action: id } を返した後の消耗・読了・精算はcallerが担う。
 */
export function openChapterThreeMap(value, scenes, options = {}) {
  const model = chapterThreeMapModel(value, scenes, options);
  if (!model || activeMap) return Promise.resolve(null);
  return new Promise(resolve => {
    const trigger = document.activeElement;
    const owner = {};
    activeMap = owner;
    let closed = false;
    const dialog = el("dialog.ch3-map-dialog", {
      "aria-label": "東京の街", dataset: { test: "ch3-map" },
    });
    const close = result => {
      if (closed) return;
      closed = true;
      if (activeMap === owner) activeMap = null;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      resolve(result);
    };
    const closeButton = el("button.btn.ch3-map-close", {
      type: "button", text: "閉じる", dataset: { test: "ch3-map-close" }, onclick: () => close(null),
    });
    const details = el("div.ch3-map-details", { "aria-live": "polite", dataset: { test: "ch3-map-details" } });
    const list = el("div.ch3-map-list", { "aria-label": "地図の地点" });
    const markers = el("div.ch3-map-markers");
    const note = el("p.ch3-map-note", { text: model.note });
    const imageError = el("p.ch3-map-image-error", {
      hidden: true, role: "status", text: "地図を読み込めませんでした。地点の一覧は利用できます。",
      dataset: { test: "ch3-map-image-error" },
    });
    const art = el("img.ch3-map-art", {
      alt: "高架と路地、公園と動物園のある東京の街", draggable: "false",
      dataset: { test: "ch3-map-image" },
      onerror: () => { art.hidden = true; imageError.hidden = false; },
    });
    const imageUrl = bgUrl(model.background, model.mode);
    if (imageUrl) art.src = imageUrl;
    else { art.hidden = true; imageError.hidden = false; }

    function select(pin) {
      for (const node of dialog.querySelectorAll("button[data-place]")) {
        node.setAttribute("aria-pressed", String(node.dataset.place === pin.id));
      }
      const status = pin.gym
        ? model.member ? "いつもの会員証で全国の店舗を利用できます。追加の入会費はかかりません。"
          : "利用には会員登録が必要です。"
        : pin.actions?.length ? "行き先" : pin.current ? "今の場面の場所" : "訪ねた場所";
      const actions = (pin.actions || []).map(action => el("div.ch3-map-action", [
        el("p.ch3-map-reason", { text: action.reasonText || "" }),
        action.ok ? el(`button.btn${action.consumes === false ? "" : ".primary"}`, {
          type: "button", text: `${action.label}${action.consumes === false ? "（予定は進まない）" : "（1行動）"}`,
          dataset: { test: `ch3-map-action-${action.id}` }, onclick: () => close({ action: action.id }),
        }) : el("p", { text: action.why || "今は選べません。" }),
      ]));
      details.replaceChildren(
        ...(hasStoreLogo(`ch3_${pin.id}`) ? [storeLogo(`ch3_${pin.id}`, { width: 180, height: 104 })] : []),
        el("h3", { text: pin.label }), el("p", { text: status }), ...actions,
        ...(pin.gym && model.canTrain ? [el("button.btn.primary.ch3-map-gym", {
          type: "button", text: "トレーニングする（1行動）", dataset: { test: "ch3-map-gym" }, onclick: () => close("gym"),
        })] : []),
        ...(pin.gym && model.member && !model.canTrain
          ? [el("p", { text: model.freeTime ? "今日は休んで次の予定に備えよう。" : "自由時間に利用できます。" })] : []));
    }
    for (const [index, pin] of model.pins.entries()) {
      const mark = pin.gym ? "筋" : String(index + 1);
      const attrs = {
        type: "button", "aria-label": pin.label, "aria-pressed": "false",
        dataset: { place: pin.id }, onclick: () => select(pin),
      };
      markers.append(el(`button.ch3-map-pin${pin.current ? ".current" : ""}${pin.gym ? ".gym" : ""}`, {
        ...attrs, text: mark, style: { left: `${pin.x}%`, top: `${pin.y}%` },
        dataset: { ...attrs.dataset, test: `ch3-map-pin-${pin.id}` },
      }));
      list.append(el("button.ch3-map-place", {
        ...attrs, dataset: { ...attrs.dataset, test: `ch3-map-place-${pin.id}` },
      }, [el("span.ch3-map-place-number", { text: mark }), el("span", { text: pin.label }),
        pin.current ? el("small", { text: "今" }) : null]));
    }
    for (const landmark of model.landmarks) markers.append(el("span.ch3-map-landmark", {
      text: landmark.label, style: { left: `${landmark.x}%`, top: `${landmark.y}%` },
      dataset: { landmark: landmark.id },
    }));
    dialog.append(el("header.ch3-map-header", [
      el("div", [el("h2", { text: "東京の街" }), el("p", { text: model.mode === "night" ? "夜の街" : "昼の街" })]),
      closeButton,
    ]), el("div.ch3-map-content", [
      el("div.ch3-map-canvas", { dataset: { test: "ch3-map-canvas" } }, [art, imageError, markers]),
      el("aside.ch3-map-sidebar", [details, list]),
    ]), note);
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(null); });
    dialog.addEventListener("close", () => close(null));
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(null); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button:not(:disabled), [tabindex='0']")]
        .filter(node => node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) return;
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.body.append(dialog);
    dialog.showModal();
    select(model.canTrain ? model.pins.find(pin => pin.gym)
      : model.pins.find(pin => pin.actions?.length) || model.pins.find(pin => pin.current) || model.pins[0]);
    closeButton.focus({ preventScroll: true });
  });
}
