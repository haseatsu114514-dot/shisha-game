// 審査員・大会実況・自主練の心の声を、いま話す一人だけ左下に表示する。
import { el } from "../core/util.js";
import { displayName, portraitInfo, faceIconUrl } from "../core/data.js";
import { state } from "../core/state.js";
import { evaluationOf, feedbackLine, commentaryLine, tutorialGuide, innerVoiceLine } from "./feedback.js";

export function audienceFor(mode, chapter) {
  if (mode === "tournament") return chapter === 1 ? ["nagumo", "maezono", "dr_kemuri"] : [];
  if (mode === "drill") return ["hajime"];
  return mode === "tutorial" || mode === "rehearsal" ? ["sumi"] : [];
}

const STEP_JUDGE = { setup: "dr_kemuri", concept: "nagumo", mix: "maezono", pack: "dr_kemuri", holes: "dr_kemuri", heat: "dr_kemuri", place: "dr_kemuri", steam: "maezono", pull: "maezono", care: "dr_kemuri", trial: "nagumo" };
const MOODS = { watch: "手元を見守る", nod: "小さくうなずく", concern: "手元を気にかける", think: "静かに考える" };
// 採用済みの顔アイコンと同じ頭部の切り取り（tools/make_face_icons.py の face_box）。
// 通常絵の x / y / 辺を画像幅で正規化。胴体の中心へ寄せず、表情差分の原画をこの枠へ表示する。
const FACE_CROPS = {
  hajime: [.48661, .17746, .21205], sumi: [.37835, .09933, .21763],
  nagumo: [.35379, .06362, .20871], maezono: [.32589, .02679, .26674],
  dr_kemuri: [.33259, .07589, .21094], pakki: [.23549, .40848, .62388],
};
const faceFor = (id, mood, kind) => id === "nagumo" ? mood === "think" ? "thinking" : "serious"
  : mood === "nod" ? id === "maezono" && ["perfect", "just"].includes(kind) ? "excited" : id === "dr_kemuri" ? "normal" : "smile"
    : mood === "concern" || mood === "think" ? "serious" : "normal";

export function buildAudience(cs) {
  const ids = cs.audienceIds || audienceFor(cs.mode, state.chapter);
  if (!ids.length) return null;
  const image = el("img", { alt: "", draggable: false, decoding: "async" });
  const name = el("figcaption");
  const speaker = el("b.audience-name");
  const person = el("figure.audience-person", { role: "img" }, [el("div.audience-face", [image]), name]);
  const mark = el("b.audience-rating", { hidden: true, dataset: { test: "craft-rating" } });
  const caption = el("span.audience-caption", { text: ids[0] === "hajime" ? "心の声" : "" });
  const note = el("p.audience-note", { text: ids[0] === "hajime" ? innerVoiceLine("default", "watch") : "手元を見守っている", dataset: { test: "craft-feedback" } });
  const root = el("aside.bench-audience.audience-single", { "aria-label": cs.mode === "drill" ? "はじめの心の声" : cs.mode === "tournament" ? "審査員と大会実況" : "見守る人", dataset: { test: "craft-audience" } }, [
    el("div.audience-people", [person]), el("div.audience-speech", { "aria-live": "polite" }, [el("div.audience-heading", [mark, speaker, caption]), note]),
  ]);
  let primary = ids[0], active = primary, step = "", current = "", changedAt = -Infinity;
  const showPerson = (id, mood, kind = "") => {
    active = id; current = mood; changedAt = performance.now();
    const label = displayName(id, state), portrait = portraitInfo(id, faceFor(id, mood, kind));
    name.textContent = speaker.textContent = label; person.dataset.person = id; person.dataset.mood = mood; root.dataset.speaker = id;
    root.dataset.voice = id === "hajime" ? "inner" : id === "pakki" ? "mc" : "audience";
    person.title = `${label}：${MOODS[mood]}`; person.setAttribute("aria-label", person.title);
    if (portrait) {
      image.hidden = false; image.classList.remove("audience-icon"); image.src = portrait.src;
      const crop = FACE_CROPS[portrait.folder];
      const width = crop ? 80 / crop[2] : 380;
      image.style.width = `${width}px`;
      image.style.left = crop ? `${-crop[0] * width}px` : `calc(50% - ${portrait.ax * width}px)`;
      image.style.top = crop ? `${-crop[1] * width}px` : `${6 - (1 - portrait.h - portrait.b) * width / portrait.aspect}px`;
    } else {
      const fallback = faceIconUrl(id, state); image.hidden = !fallback;
      if (fallback) image.src = fallback;
      image.classList.add("audience-icon");
    }
  };
  for (const id of [...ids, ...(cs.mode === "tournament" ? ["pakki"] : [])]) for (const mood of ["watch", "nod", "concern", "think"]) {
    const p = portraitInfo(id, faceFor(id, mood, "just"));
    if (p) { const warm = new Image(); warm.src = p.src; }
  }
  showPerson(active, "watch");
  return {
    root,
    setStep(hint, id) {
      step = id;
      primary = ids.includes(STEP_JUDGE[id]) ? STEP_JUDGE[id] : ids[0];
      showPerson(primary, "watch");
      mark.hidden = true; caption.textContent = active === "hajime" ? "心の声" : ""; delete root.dataset.tone;
      note.textContent = active === "hajime" ? innerVoiceLine(step, "watch") : cs.mode === "tutorial" && active === "sumi"
        ? (hint.startsWith("スミ「") ? hint.slice(3, -1) : tutorialGuide(step) || "手元を見守っている")
        : "手元を見守っている";
    },
    say(text) {
      if (cs.mode !== "tournament") return;
      showPerson("pakki", "nod", "good");
      mark.hidden = true; caption.textContent = "実況"; delete root.dataset.tone;
      note.textContent = text.replace(/^パッキー「([\s\S]*)」$/, "$1");
    },
    react(kind, { judge = null, force = false, score = null, text = "", title = "", final = false } = {}) {
      const id = ids.includes(judge) ? judge : ids.includes(active) ? active : primary;
      const positive = ["just", "perfect", "great", "good"].includes(kind), negative = ["bad", "miss", "close"].includes(kind);
      if (!positive && !negative && kind !== "watch") return;
      const mood = id === "nagumo" ? positive ? "think" : "watch" : positive ? "nod" : negative ? "concern" : "watch";
      if (!force && id === active && (mood === current || performance.now() - changedAt < 350)) return;
      showPerson(id, mood, kind);
      if (!final) {
        mark.hidden = true; caption.textContent = id === "hajime" ? "心の声" : ""; delete root.dataset.tone;
        note.textContent = text || (kind === "watch" ? id === "hajime" ? innerVoiceLine(step, "watch") : "手元を見守っている" : commentaryLine(id, step, positive, { tutorial: cs.mode === "tutorial" }));
      } else {
        const evaluation = evaluationOf(score ?? (kind === "just" || kind === "perfect" ? 100 : positive ? 75 : 40));
        mark.hidden = false; mark.textContent = evaluation.mark;
        mark.setAttribute("aria-label", evaluation.label); root.dataset.tone = evaluation.tone;
        caption.textContent = [id === "hajime" ? "心の声" : "", title.replace(/\s*結果$/, "")].filter(Boolean).join("・");
        note.textContent = text || feedbackLine(id, step, evaluation);
      }
    },
  };
}
