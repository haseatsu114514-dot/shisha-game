// 複数の審査員がいても、いま話す一人だけを左下に表示する。
import { el } from "../core/util.js";
import { displayName, portraitInfo, faceIconUrl } from "../core/data.js";
import { state } from "../core/state.js";
import { evaluationOf, feedbackLine, commentaryLine, tutorialGuide } from "./feedback.js";

export function audienceFor(mode, chapter) {
  if (mode === "tournament") return chapter === 1 ? ["nagumo", "maezono", "dr_kemuri"] : [];
  return mode === "tutorial" || mode === "rehearsal" ? ["sumi"] : [];
}

const STEP_JUDGE = { setup: "dr_kemuri", concept: "nagumo", mix: "maezono", pack: "dr_kemuri", holes: "dr_kemuri", heat: "dr_kemuri", place: "dr_kemuri", steam: "maezono", pull: "maezono", care: "dr_kemuri", trial: "nagumo" };
const MOODS = { watch: "手元を見守る", nod: "小さくうなずく", concern: "手元を気にかける", think: "静かに考える" };
const faceFor = (id, mood, kind) => id === "nagumo" ? mood === "think" ? "thinking" : "serious"
  : mood === "nod" ? id === "maezono" && ["perfect", "just"].includes(kind) ? "excited" : id === "dr_kemuri" ? "normal" : "smile"
    : mood === "concern" || mood === "think" ? "serious" : "normal";

export function buildAudience(cs) {
  const ids = cs.audienceIds || audienceFor(cs.mode, state.chapter);
  if (!ids.length) return null;
  const image = el("img", { alt: "", draggable: false, decoding: "async" });
  const name = el("figcaption");
  const person = el("figure.audience-person", { role: "img" }, [el("div.audience-face", [image]), name]);
  const mark = el("b.audience-rating", { hidden: true, dataset: { test: "craft-rating" } });
  const caption = el("span.audience-caption");
  const note = el("p.audience-note", { text: "手元を見守っている", dataset: { test: "craft-feedback" } });
  const root = el("aside.bench-audience.audience-single", { "aria-label": cs.mode === "tournament" ? "話している審査員" : "見守る人", dataset: { test: "craft-audience" } }, [
    el("div.audience-people", [person]), el("div.audience-speech", { "aria-live": "polite" }, [el("div.audience-heading", [mark, caption]), note]),
  ]);
  let active = ids[0], step = "", current = "", changedAt = -Infinity;
  const showPerson = (id, mood, kind = "") => {
    active = id; current = mood; changedAt = performance.now();
    const label = displayName(id, state), portrait = portraitInfo(id, faceFor(id, mood, kind));
    name.textContent = label; person.dataset.person = id; person.dataset.mood = mood; root.dataset.speaker = id;
    person.title = `${label}：${MOODS[mood]}`; person.setAttribute("aria-label", person.title);
    if (portrait) {
      image.hidden = false; image.classList.remove("audience-icon"); image.src = portrait.src;
      const width = 240;
      image.style.width = `${width}px`;
      image.style.left = `calc(50% - ${portrait.ax * width}px)`;
      image.style.top = `${6 - (1 - portrait.h - portrait.b) * width / portrait.aspect}px`;
    } else {
      const fallback = faceIconUrl(id, state); image.hidden = !fallback;
      if (fallback) image.src = fallback;
      image.classList.add("audience-icon");
    }
  };
  for (const id of ids) for (const mood of ["watch", "nod", "concern", "think"]) {
    const p = portraitInfo(id, faceFor(id, mood, "just"));
    if (p) { const warm = new Image(); warm.src = p.src; }
  }
  showPerson(active, "watch");
  return {
    root,
    setStep(hint, id) {
      step = id;
      showPerson(ids.includes(STEP_JUDGE[id]) ? STEP_JUDGE[id] : ids[0], "watch");
      mark.hidden = true; caption.textContent = ""; delete root.dataset.tone;
      note.textContent = cs.mode === "tutorial" && active === "sumi"
        ? (hint.startsWith("スミ「") ? hint.slice(3, -1) : tutorialGuide(step) || "手元を見守っている")
        : "手元を見守っている";
    },
    react(kind, { judge = null, force = false, score = null, text = "", title = "", final = false } = {}) {
      const id = ids.includes(judge) ? judge : active;
      const positive = ["just", "perfect", "great", "good"].includes(kind), negative = ["bad", "miss", "close"].includes(kind);
      if (!positive && !negative && kind !== "watch") return;
      const mood = id === "nagumo" ? positive ? "think" : "watch" : positive ? "nod" : negative ? "concern" : "watch";
      if (!force && id === active && (mood === current || performance.now() - changedAt < 350)) return;
      showPerson(id, mood, kind);
      if (!final) {
        mark.hidden = true; caption.textContent = ""; delete root.dataset.tone;
        note.textContent = text || (kind === "watch" ? "手元を見守っている" : commentaryLine(id, step, positive, { tutorial: cs.mode === "tutorial" }));
      } else {
        const evaluation = evaluationOf(score ?? (kind === "just" || kind === "perfect" ? 100 : positive ? 75 : 40));
        mark.hidden = false; mark.textContent = evaluation.mark;
        mark.setAttribute("aria-label", evaluation.label); root.dataset.tone = evaluation.tone;
        caption.textContent = title ? title.replace(/\s*結果$/, "") : "";
        note.textContent = text || feedbackLine(id, step, evaluation);
      }
    },
  };
}
