// 審査員・大会実況・自主練の心の声を、いま話す一人だけ左下に表示する。
import { el } from "../core/util.js";
import { displayName, portraitInfo, faceIconUrl } from "../core/data.js";
import { state } from "../core/state.js";
import { evaluationOf, feedbackLine, commentaryLine, tutorialGuide, innerVoiceLine, watchLine } from "./feedback.js";
import { autoWrap } from "../vn/text.js";
import { imageReady } from "../core/ui.js";

/**
 * 吹き出しと同じ文節単位の改行で、枠の幅に合わせて折る（TH91: 「見なが／ら」のような語の途中の改行を防ぐ）。
 * <br>は textContent に入らないので、読み上げ・判定用の本文はそのまま。
 */
function wrapNote(note) {
  const raw = note.dataset.raw ?? note.textContent;
  const size = parseFloat(getComputedStyle(note).fontSize) || 16;
  if (!note.clientWidth) return;
  const limit = Math.max(6, Math.floor(note.clientWidth / size));
  if (note.dataset.limit === String(limit) && note.dataset.wrapped === raw) return;
  note.dataset.limit = String(limit); note.dataset.wrapped = raw;
  let lines = autoWrap(raw, limit).split("\n");
  // 2行に収まる短い一言は、両側が枠に入るなら最後の読点・句点で折る（「少しずつ／整えよう」より「見ながら、／少しずつ」）。
  if (lines.length === 2 && !raw.includes("\n")) {
    const at = Math.max(...["、", "。", "！", "？"].map((p) => raw.lastIndexOf(p, limit - 1)));
    if (at > 0 && at < raw.length - 1 && raw.length - at - 1 <= limit) lines = [raw.slice(0, at + 1), raw.slice(at + 1)];
  }
  note.replaceChildren(...lines.flatMap((line, i) => (i ? [el("br"), line] : [line])));
}

export function audienceFor(mode, chapter) {
  if (mode === "tournament") return chapter === 3 ? ["nagumo", "emil", "dr_kemuri"]
    : chapter === 4 ? ["nagumo", "emil", "da_silva"]
    : [1, 2].includes(chapter) ? ["nagumo", "maezono", "dr_kemuri"] : [];
  if (mode === "drill") return ["hajime"];
  return mode === "tutorial" || mode === "rehearsal" ? ["sumi"] : [];
}

const STEP_JUDGE = { setup: "dr_kemuri", mix: "maezono", pack: "dr_kemuri", holes: "dr_kemuri", heat: "dr_kemuri", place: "dr_kemuri", steam: "maezono", pull: "maezono", care: "dr_kemuri" };
const STEP_JUDGE_CH3 = { ...STEP_JUDGE, mix: "emil", steam: "emil", pull: "emil", care: "nagumo" };
// 第4章 GRAND SMOKE: 博士の席（手元の技術）をゲスト審査員ダ・シルヴァが見る。
const STEP_JUDGE_CH4 = { ...STEP_JUDGE_CH3, setup: "da_silva", pack: "da_silva", holes: "da_silva", heat: "da_silva", place: "da_silva" };
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

/** 今この一台を見ている人と実況の、実際に使う表情だけ。 */
export function audienceAssetUrls(cs) {
  const ids = cs.audienceIds || audienceFor(cs.mode, cs.chapter ?? state.chapter);
  if (!ids.length) return [];
  return [...new Set([...ids, ...(cs.mode === "tournament" ? ["pakki"] : [])].flatMap(id =>
    ["watch", "nod", "concern", "think"].flatMap(mood => ["just", "good"].map(kind =>
      portraitInfo(id, faceFor(id, mood, kind))?.src))).filter(Boolean))];
}

export function buildAudience(cs) {
  const ids = cs.audienceIds || audienceFor(cs.mode, cs.chapter ?? state.chapter);
  if (!ids.length) return null;
  const image = el("img", { alt: "", draggable: false, decoding: "async" });
  const fallbackName = el("span.audience-face-label", { hidden: true });
  const name = el("figcaption");
  const speaker = el("b.audience-name");
  const person = el("figure.audience-person", { role: "img" }, [el("div.audience-face", [image, fallbackName]), name]);
  const mark = el("b.audience-rating", { hidden: true, dataset: { test: "craft-rating" } });
  const caption = el("span.audience-caption", { text: ids[0] === "hajime" ? "心の声" : "" });
  const note = el("p.audience-note", { dataset: { test: "craft-feedback" } });
  const setNote = (text) => { note.dataset.raw = text; delete note.dataset.wrapped; note.textContent = text; wrapNote(note); };
  setNote(ids[0] === "hajime" ? innerVoiceLine("default", "watch") : watchLine(ids[0], "default"));
  if (typeof ResizeObserver === "function") new ResizeObserver(() => wrapNote(note)).observe(note);
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
      fallbackName.hidden = true;
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
      fallbackName.hidden = !!fallback;
      fallbackName.textContent = label;
    }
  };
  audienceAssetUrls(cs).forEach(url => imageReady(url, 15000, { keep: true }));
  showPerson(active, "watch");
  return {
    root,
    setStep(hint, id) {
      step = id;
      const judge = cs.chapter === 4 ? STEP_JUDGE_CH4[id] : cs.chapter === 3 ? STEP_JUDGE_CH3[id] : STEP_JUDGE[id];
      primary = ids.includes(judge) ? judge : ids[0];
      showPerson(primary, "watch");
      mark.hidden = true; caption.textContent = active === "hajime" ? "心の声" : ""; delete root.dataset.tone;
      setNote(active === "hajime" ? innerVoiceLine(step, "watch") : cs.mode === "tutorial" && active === "sumi"
        ? (hint.startsWith("スミ「") ? hint.slice(3, -1) : tutorialGuide(step) || watchLine("sumi", step))
        : watchLine(active, step));
    },
    say(text) {
      if (cs.mode !== "tournament") return;
      showPerson("pakki", "nod", "good");
      mark.hidden = true; caption.textContent = "実況"; delete root.dataset.tone;
      setNote(text.replace(/^パッキー「([\s\S]*)」$/, "$1"));
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
        setNote(text || (kind === "watch" ? id === "hajime" ? innerVoiceLine(step, "watch") : watchLine(id, step) : commentaryLine(id, step, positive, { tutorial: cs.mode === "tutorial" })));
      } else {
        const evaluation = evaluationOf(score ?? (kind === "just" || kind === "perfect" ? 100 : positive ? 75 : 40));
        mark.hidden = false; mark.textContent = evaluation.mark;
        mark.setAttribute("aria-label", evaluation.label); root.dataset.tone = evaluation.tone;
        caption.textContent = [id === "hajime" ? "心の声" : "", title.replace(/\s*結果$/, "")].filter(Boolean).join("・");
        setNote(text || feedbackLine(id, step, evaluation));
      }
    },
  };
}
