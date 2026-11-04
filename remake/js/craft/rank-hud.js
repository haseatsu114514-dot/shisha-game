// 表示だけを扱う部品。採点・閾値・勝敗・保存には接続しない。
// 本編への自動取付けはしない。接続時は mountCraftRank(top, snapshot) を呼び、
// snapshot.grade に計算側で確定した D/C/B/A/S/SS/SSS を渡す。
// 画像は採用済みの透過素材だけを渡す（wide=全文、compact=ランクの文字だけ）。
import { el } from "../core/util.js";

export const CRAFT_GRADES = Object.freeze(["D", "C", "B", "A", "S", "SS", "SSS"]);

/** Seven strictly increasing grade floors, in CRAFT_GRADES order; no gameplay defaults. */
export function craftRankProgress(score, thresholds) {
  if (!Number.isFinite(score)) throw new TypeError("Craft rank score must be finite");
  if (!Array.isArray(thresholds) || thresholds.length !== CRAFT_GRADES.length
    || Array.from(thresholds).some((floor, index) => !Number.isFinite(floor)
      || (index > 0 && floor <= thresholds[index - 1]))) {
    throw new TypeError("Craft rank thresholds must be seven finite increasing floors");
  }
  let index = 0;
  while (index < thresholds.length - 1 && score >= thresholds[index + 1]) index++;
  if (index === thresholds.length - 1) return { grade: CRAFT_GRADES[index], progress: 1 };
  const span = thresholds[index + 1] - thresholds[index];
  const fraction = Number.isFinite(span)
    ? (score - thresholds[index]) / span
    : (score / 2 - thresholds[index] / 2) / (thresholds[index + 1] / 2 - thresholds[index] / 2);
  const progress = Math.max(0, Math.min(1, fraction));
  return { grade: CRAFT_GRADES[index], progress };
}

function readSnapshot(input) {
  const value = input ?? {};
  const grade = value.grade ?? null;
  if (grade !== null && !CRAFT_GRADES.includes(grade)) throw new TypeError("Unknown craft rank");
  const progress = value.progress ?? null;
  if (progress !== null && (!Number.isFinite(progress) || progress < 0 || progress > 1)) {
    throw new RangeError("Craft rank progress must be between 0 and 1");
  }
  const label = grade !== null && typeof value.label === "string" ? value.label.trim() : "";
  const artwork = value.artwork ?? {};
  // 相対URLか同じ配信元だけ。表示部品から外部へ通信しない。
  const url = key => {
    if (!artwork[key]) return "";
    const resolved = new URL(artwork[key], document.baseURI);
    if (resolved.origin !== new URL(document.baseURI).origin || !["http:", "https:"].includes(resolved.protocol)) {
      throw new TypeError("Craft rank artwork must use the same origin");
    }
    return resolved.href;
  };
  return { grade, progress: grade === null ? null : grade === "SSS" ? 1 : progress, label, wide: url("wide"), compact: url("compact") };
}

/**
 * 未計測は「—」。存在しないランクや進捗を作らない。
 * label は任意の補助名で、正式な英語名が決まるまでは省略できる。
 * 呼出し側は工程の切替えではなく、一台の終わりに dispose() する。
 */
export function buildCraftRank(initial = null) {
  const full = el("span.craft-rank-wide", { "aria-hidden": "true" });
  const compact = el("span.craft-rank-compact", { "aria-hidden": "true" });
  const meter = el("span.craft-rank-meter", { hidden: true, role: "meter", "aria-label": "ランク進捗", "aria-valuemin": "0", "aria-valuemax": "100" }, [el("i")]);
  const status = el("span.craft-rank-status", { role: "status", "aria-live": "polite", "aria-atomic": "true", dataset: { test: "craft-rank-status" } });
  const root = el("div.craft-rank", { role: "group", "aria-label": "制作ランク", dataset: { test: "craft-rank" } }, [
    el("span.craft-rank-caption", { text: "RANK", "aria-hidden": "true" }), full, compact, meter, status,
  ]);
  let current = null, disposed = false, timer = null, generation = 0;
  const stopMotion = () => { clearTimeout(timer); timer = null; delete root.dataset.change; };
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => motion?.matches ?? false;
  const motionChanged = () => { if (reduced()) stopMotion(); };
  motion?.addEventListener?.("change", motionChanged);
  const draw = (host, value, art, token, isCompact) => {
    const mark = el("b.craft-rank-grade", { text: value.grade ?? "—" });
    const fallback = el("span.craft-rank-fallback", [mark]);
    const continuation = value.grade && value.label.startsWith(value.grade) ? value.label.slice(value.grade.length) : value.label;
    if (!isCompact && continuation) fallback.append(el("small", { text: continuation }));
    host.replaceChildren(fallback);
    if (!art || !value.grade) return;
    const picture = el("img", { alt: "", draggable: false, decoding: "async" });
    const valid = () => !disposed && token === generation && picture.parentNode === host;
    picture.addEventListener("load", () => { if (valid() && picture.naturalWidth > 0) host.dataset.artReady = "true"; });
    picture.addEventListener("error", () => { if (valid()) delete host.dataset.artReady; });
    host.append(picture);
    picture.src = art;
  };
  const update = (input, { animate = true, announce = true } = {}) => {
    if (disposed) return false;
    const next = readSnapshot(input); // 検証を終えてからDOMを変更する。
    const before = current;
    const rankChanged = before?.grade !== next.grade;
    const pictureChanged = !before || ["grade", "label", "wide", "compact"].some(key => before[key] !== next[key]);
    current = next;
    root.dataset.grade = next.grade ?? "unavailable";
    root.dataset.emphasis = next.grade?.startsWith("S") ? next.grade.toLowerCase() : "base";
    root.dataset.maxed = String(next.grade === "SSS");
    root.title = next.grade ? `制作ランク ${next.grade}${next.label ? `：${next.label}` : ""}` : "制作ランクは未計測";
    if (root.getAttribute("aria-label") !== root.title) root.setAttribute("aria-label", root.title);
    if (pictureChanged) {
      const token = ++generation;
      delete full.dataset.artReady; delete compact.dataset.artReady;
      draw(full, next, next.wide, token, false);
      draw(compact, next, next.compact, token, true);
    }
    meter.hidden = next.progress === null;
    if (next.progress === null) {
      meter.removeAttribute("aria-valuenow");
      meter.removeAttribute("aria-valuetext");
      meter.firstElementChild.style.width = "0%";
    } else {
      const value = Math.round(next.progress * 100);
      meter.setAttribute("aria-valuenow", String(value));
      const nextGrade = CRAFT_GRADES[CRAFT_GRADES.indexOf(next.grade) + 1];
      meter.setAttribute("aria-valuetext", nextGrade ? `ランク内 ${value}%、次は${nextGrade}` : "最高ランク");
      meter.firstElementChild.style.width = `${next.progress * 100}%`;
    }
    if (rankChanged || !before || before.label !== next.label) {
      // 進捗の毎フレーム更新は読み上げない。
      status.textContent = announce ? root.title : "";
    }
    if (rankChanged) {
      stopMotion();
      if (animate && before && next.grade && root.isConnected && !document.hidden && !reduced()) {
        const change = !before.grade ? "enter" : CRAFT_GRADES.indexOf(next.grade) > CRAFT_GRADES.indexOf(before.grade) ? "up" : "down";
        // 頻度の低い昇降格時だけ再始動する。進捗更新では再配置しない。
        void root.offsetWidth;
        root.dataset.change = change;
        timer = setTimeout(() => { timer = null; delete root.dataset.change; }, change === "down" ? 150 : change === "enter" ? 240 : 360);
      }
    }
    return true;
  };
  update(initial, { animate: false });
  return { root, update, dispose() {
    if (disposed) return;
    disposed = true; generation++; stopMotion(); motion?.removeEventListener?.("change", motionChanged); root.remove();
  } };
}

/** モード名の位置を置換。進行パネルや他の上帯ボタンには触れない。 */
export function mountCraftRank(top, initial = null) {
  if (!top?.classList?.contains("bench-top")) throw new TypeError("A bench-top element is required");
  if (top.querySelector(".craft-rank")) throw new Error("Craft rank is already mounted");
  const rank = buildCraftRank(initial);
  const mode = top.querySelector(".bench-mode");
  const next = mode?.nextSibling ?? top.firstChild;
  if (mode) mode.replaceWith(rank.root);
  else top.prepend(rank.root);
  let disposed = false;
  return { root: rank.root, update: rank.update, dispose() {
    if (disposed) return;
    disposed = true;
    if (mode && rank.root.parentNode === top) rank.root.replaceWith(mode);
    else if (mode && top.isConnected && !top.querySelector(".bench-mode")) top.insertBefore(mode, next?.parentNode === top ? next : top.firstChild);
    rank.dispose();
  } };
}
