// 日常の地図（行き先選び）。現行のピン（daily/map.js の .spot-pin）を読み、上画面に街の絵と四角い目印、
// 下画面に行き先の一覧と「◯◯ へ行く」を出す。選ぶ・行くは現行のピンへの click として中継する（1回目で選択、2回目で移動）。
import { el } from "../../core/util.js";
import { SCREEN_W, SCREEN_H } from "./shell.js";
import { readHud } from "./hud.js";

const STAGE_W = 1280, STAGE_H = 720;
const FACE = 24;
const text = (node) => node?.textContent?.trim() || "";

// 体力の印（7×6 ドットのハート）。絵文字に化けないよう図形で描く。
const HEART = '<svg viewBox="0 0 7 6" width="7" height="6" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/></svg>';

export function createMapScene(shell, painter) {
  const list = el("div.retro-list", { dataset: { test: "retro-list" } });
  const go = el("button.retro-go", { type: "button", dataset: { test: "retro-go" }, "aria-disabled": "true" });
  // 一覧が下画面に収まらない時の「まだ上／下にある」の印
  const moreUp = el("i.retro-more.retro-more-up", { hidden: true, "aria-hidden": "true" });
  const moreDown = el("i.retro-more.retro-more-down", { hidden: true, "aria-hidden": "true" });
  const pane = el("div.retro-pane.retro-map", { hidden: true, dataset: { test: "retro-map" } }, [list, moreUp, moreDown, go]);
  const updateMore = () => {
    moreUp.hidden = list.scrollTop <= 1;
    moreDown.hidden = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
  };
  list.addEventListener("scroll", updateMore, { passive: true });
  const label = el("div.retro-maplabel", { hidden: true });

  const headDay = el("span.retro-maphead-day"), headSlot = el("span.retro-maphead-slot"), headMoney = el("span.retro-maphead-money");
  const gaugeFill = el("b");
  const gauge = el("span.retro-gauge", { role: "img" }, [el("span", { html: HEART }), el("i", [gaugeFill])]);

  // 行き先の「用途」（バイト先・問屋街など）は台本側の定義から読む（読むだけ）。読めなければ出さない。
  // 地図が出た時には現行が読み込み済みのモジュールなので、追加の通信は起きない。
  let areaOf = () => "", areaRequested = false;
  function loadAreas() {
    if (areaRequested) return;
    areaRequested = true;
    import("../../daily/spots.js").then((spots) => {
      areaOf = (id) => { try { return spots.spotById(id)?.area || ""; } catch { return ""; } };
      rowSig = "";
    }).catch(() => {});
  }

  const liveMap = () => document.querySelector("#screen > .map:not(.done)");
  const livePin = (id) => [...(liveMap()?.querySelectorAll(".map-pins > .spot-pin") || [])].find((pin) => pin.dataset.spot === id);
  const selectPin = (id) => { const pin = livePin(id); if (pin && !pin.classList.contains("sel")) pin.click(); };

  go.addEventListener("click", () => {
    if (go.getAttribute("aria-disabled") === "true") return;
    const pin = [...(liveMap()?.querySelectorAll(".map-pins > .spot-pin.sel") || [])][0];
    pin?.click(); // 選択中のピンをもう一度押す＝現行の「行く」
  });

  // 地図の案内の箱にあるボタン（新版の縦持ち）: 第2章の配達メモ、駅の行き先・確認・キャンセル、第2章の初日の「行く」など。
  // 選んだ行き先へ「行く」1つだけのボタンは決定ボタンへ、それ以外は一覧の上に並べて、押したら現行のボタンを押す。
  const shown = (node) => node.getClientRects().length > 0;
  const infoButtons = (map) => [...(map?.querySelectorAll(".map-info button") || [])].filter(shown);
  const goButtonOf = (map, selected) => {
    const buttons = infoButtons(map);
    return selected && buttons.length === 1 && buttons[0].matches(".mi-go") ? buttons[0] : null;
  };
  const liveActions = () => {
    const map = liveMap();
    const selected = map?.querySelector(".map-pins > .spot-pin.sel");
    const goButton = goButtonOf(map, selected);
    return infoButtons(map).filter((button) => button !== goButton);
  };

  function readPins(map) {
    return [...map.querySelectorAll(".map-pins > .spot-pin")].filter((pin) => pin.style.visibility !== "hidden").map((pin) => {
      const locked = pin.classList.contains("pin-locked");
      const name = text(pin.querySelector(".sub-label"));
      return {
        id: pin.dataset.spot || "",
        name,
        cost: text(pin.querySelector(".pin-cost")),
        status: text(pin.querySelector(".pin-status")),
        badge: text(pin.querySelector(".evt-badge")),
        off: pin.classList.contains("off") || pin.classList.contains("guided-off"),
        sel: pin.classList.contains("sel"),
        locked,
        people: [...pin.querySelectorAll(".pin-people .pin-person")].map((person) => person.localName === "img" ? person.currentSrc || person.src : "?"),
        x: parseFloat(pin.style.left) || 0,
        y: parseFloat(pin.style.top) || 0,
        speech: pin.getAttribute("aria-label") || name,
      };
    });
  }

  /** 全ピンが入る 4:3 の窓（ステージ座標）。地図の高さいっぱい（幅 960）を基本に、足りなければ広げる。 */
  function viewFor(pins) {
    const xs = pins.map((pin) => pin.x / 100 * STAGE_W);
    const minX = xs.length ? Math.min(...xs) : STAGE_W / 2, maxX = xs.length ? Math.max(...xs) : STAGE_W / 2;
    const margin = 44; // 目印（選択中 16 ドット）が端で切れない余白
    const w = Math.min(STAGE_W * 1.2, Math.max(STAGE_H * 4 / 3, maxX - minX + margin * 2));
    const h = w * 3 / 4;
    const x = w >= STAGE_W ? (STAGE_W - w) / 2 : Math.max(0, Math.min(STAGE_W - w, (minX + maxX) / 2 - w / 2));
    return { x, y: (STAGE_H - h) / 2, w, h };
  }

  let rowSig = "", markerSig = "", headSig = "", view = viewFor([]), rainy = false;
  const faces = new Map(); // url → まだ描けていない canvas の一覧

  function faceNode(url) {
    if (url === "?") return el("span.retro-face", { text: "?" });
    const canvas = el("canvas", { width: FACE, height: FACE });
    if (!painter.drawIcon(canvas, url)) faces.set(canvas, url);
    return el("span.retro-face", [canvas]);
  }

  function sync() {
    const map = liveMap();
    if (!map) return;
    const pins = readPins(map);
    const selected = pins.find((pin) => pin.sel) || null;
    const info = map.querySelector(".map-info");
    const goButton = goButtonOf(map, selected);
    const canGo = !!selected && (info?.dataset.test === "map-go" || (!!goButton && !goButton.disabled));
    const actions = infoButtons(map).filter((button) => button !== goButton);

    // 下画面: 行き先の一覧
    // 行き先の「用途」は日常の地図（daily/map.js）の行き先だけ。第2章の初日の地図などは同じ id でも別の場所
    const daily = map.matches("[data-destination-selection]");
    const rows = pins.map((pin) => {
      const known = !pin.locked && !/^[？?]+$/.test(pin.name);
      const sub = pin.status || pin.cost || (known && daily ? areaOf(pin.id) : "");
      return { ...pin, sub };
    });
    const actionRows = actions.map((button) => [button.dataset.test || "", text(button), button.disabled, button.classList.contains("mi-go-alt")]);
    const sig = JSON.stringify([rows.map((row) => [row.id, row.name, row.sub, row.badge, row.off, row.sel, row.people]), actionRows]);
    if (sig !== rowSig) {
      const actionsChanged = !rowSig.includes(JSON.stringify(actionRows));
      rowSig = sig;
      const scroll = list.scrollTop;
      faces.clear();
      list.replaceChildren(...actionRows.map(([test, label, disabled, alt], index) => el(`button.retro-row.retro-row-action${alt ? ".alt" : ""}`, {
        type: "button", disabled, dataset: { test: `retro-action-${test || index}` },
        onclick: () => liveActions()[index]?.click(),
      }, [el("span.retro-row-name", { text: label })])), ...rows.map((row) => el("button.retro-row", {
        type: "button", "aria-pressed": String(row.sel), "aria-label": row.speech,
        dataset: { spot: row.id, off: String(row.off), test: `retro-row-${row.id}` },
        onclick: () => selectPin(row.id),
      }, [
        el("span.retro-row-faces", row.people.slice(0, 2).map(faceNode)),
        el("span.retro-row-name", { text: row.name }),
        row.sub ? el("span.retro-row-sub", { text: row.sub }) : null,
        row.badge ? el("i.retro-row-badge", { text: row.badge }) : null,
      ])));
      list.scrollTop = actionRows.length && actionsChanged ? 0 : scroll;
      list.querySelector('.retro-row[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest" });
    }
    updateMore();
    // 読み込み待ちだった顔を描く
    for (const [canvas, url] of faces) if (!canvas.isConnected || painter.drawIcon(canvas, url)) faces.delete(canvas);

    // 決定ボタン
    const reason = selected && !canGo ? (info?.getAttribute("aria-label") || "").split("・").slice(1).join("・") || text(info?.querySelector(".mi-desc")) : "";
    const goText = !selected ? "行き先を選ぶ" : canGo ? (goButton ? text(goButton) : `${selected.name} へ行く`) : reason || selected.status || "いまは行けない";
    if (go.textContent !== goText) go.textContent = goText;
    const disabled = String(!canGo);
    if (go.getAttribute("aria-disabled") !== disabled) go.setAttribute("aria-disabled", disabled);

    // 上画面: 目印（選択中は金）と店名
    view = viewFor(pins);
    rainy = map.dataset.rain === "true";
    const zoom = SCREEN_W / view.w;
    const marks = pins.map((pin) => ({
      id: pin.id, name: pin.name, off: pin.off, sel: pin.sel,
      x: Math.round((pin.x / 100 * STAGE_W - view.x) * zoom), y: Math.round((pin.y / 100 * STAGE_H - view.y) * zoom),
    }));
    const nextMarkerSig = JSON.stringify(marks);
    if (nextMarkerSig !== markerSig) {
      markerSig = nextMarkerSig;
      shell.markers.replaceChildren(...marks.map((mark) => el("button.retro-marker", {
        type: "button", tabindex: "-1", "aria-hidden": "true",
        dataset: { spot: mark.id, off: String(mark.off), sel: String(mark.sel) },
        style: { left: `calc(var(--d) * ${mark.x})`, top: `calc(var(--d) * ${mark.y})` },
        onclick: (event) => { event.stopPropagation(); selectPin(mark.id); },
      })), label);
      const sel = marks.find((mark) => mark.sel);
      label.hidden = !sel;
      if (sel) {
        label.textContent = sel.name;
        // 店名は目印の右へ。右端に収まらなければ左へ出す（1文字の幅は半角 6・全角 12 ドット）。
        const width = [...sel.name].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 6 : 12), 0) + 14;
        const right = sel.x + 12 + width <= SCREEN_W - 2;
        const y = Math.max(18, Math.min(SCREEN_H - 20, sel.y - 9));
        label.style.top = `calc(var(--d) * ${y})`;
        label.style.left = right ? `calc(var(--d) * ${sel.x + 12})` : "auto";
        label.style.right = right ? "auto" : `calc(var(--d) * ${SCREEN_W - sel.x + 12})`;
      }
    }

    // 上端の帯: DAY・昼夜と天気・体力・所持金
    const hud = readHud();
    const head = JSON.stringify(hud);
    if (head !== headSig) {
      headSig = head;
      headDay.textContent = hud?.day ? `DAY ${hud.day}${hud.finalDay}` : "";
      headSlot.textContent = hud?.phase || "";
      headMoney.textContent = hud?.money ? `¥${hud.money}` : "";
      gaugeFill.style.width = `${Math.max(0, Math.min(100, hud?.stamina ?? 0))}%`;
      gauge.dataset.health = hud?.health || "";
      gauge.setAttribute("aria-label", `体力 ${Math.round(hud?.stamina ?? 0)}%`);
      gauge.hidden = !hud?.hasStamina; // 第2章の初日の地図など、体力を出さない HUD もある
    }
    const guide = text(map.querySelector(".map-guide span"));
    const banner = text(info?.querySelector(".mi-banner"));
    shell.setStatus(guide && !selected ? banner || "どこへ行く？" : "どこへ行く？", hud?.moves ? `行動 あと${hud.moves}回` : hud?.phase || "");

    // 下端の一言: 案内・約束の知らせ・期限・明日の天気（行き先を選んでいる間は、現行と同じく案内と知らせだけ）
    // 案内の箱にボタンがある間（駅の行き先・配達メモなど）は、その箱の見出しと説明を出す
    if (actions.length) {
      shell.setCaption([...(info?.querySelectorAll(".mi-desc, p") || [])].map(text).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" "), banner);
    }
    // 知らせの札。見出しと中身が別の要素の札（第2章の初日の「進み具合」）は、間に区切りを入れて読む
    const notice = [...map.querySelectorAll(".map-notice")].map((node) => (node.children.length > 1
      ? [...node.children].map(text).filter(Boolean).join("：") : text(node))).filter(Boolean).join(" ");
    const lead = guide || notice;
    const reminder = selected ? "" : text(info?.querySelector(".mi-reminder"));
    const hint = selected || lead || reminder ? "" : text(info?.querySelector(".mi-desc"));
    const foot = selected ? "" : text(info?.querySelector(".mi-foot"));
    if (!actions.length) shell.setCaption([lead, reminder, hint, foot].filter(Boolean).join("　"), guide ? "GUIDE" : "");

    // 本体のボタン（HUD の LIME・MENU。章によって data-test が違うので、HUD の部品の名前で探す）
    const reel = map.querySelector(".reel-widget .rw-lamp-wrap");
    const hudButton = (name) => document.querySelector(`#hud .${name}`);
    shell.setKeys([
      ...(hudButton("hud-lime") ? [{ id: "lime", label: "LIME", badge: hud?.unread, name: hud?.unread ? `LIME（未読${hud.unread}件）` : "LIME", run: () => hudButton("hud-lime")?.click() }] : []),
      ...(hudButton("hud-menu") ? [{ id: "menu", label: "MENU", badge: hud?.hidane, run: () => hudButton("hud-menu")?.click() }] : []),
      ...(reel ? [{ id: "reel", label: "スロット", run: () => liveMap()?.querySelector(".reel-widget .rw-lamp-wrap")?.click() }] : []),
    ]);
  }

  return {
    pane,
    sync,
    paint: (now) => painter.paintMap(now, view, rainy),
    enter() {
      loadAreas();
      rowSig = markerSig = headSig = "";
      shell.maphead.replaceChildren(headDay, headSlot, gauge, headMoney);
      list.scrollTop = 0;
    },
    leave() {
      shell.markers.replaceChildren();
      shell.maphead.replaceChildren();
      faces.clear();
    },
  };
}
