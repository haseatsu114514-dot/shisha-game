// 制作を見守る人。表情は操作結果に反応するだけで、審査票・能力・好感度は変えない。
import { el } from "../core/util.js";
import { displayName, portraitInfo, faceIconUrl } from "../core/data.js";
import { state } from "../core/state.js";

export function audienceFor(mode, chapter) {
  if (mode === "tournament") return chapter === 1 ? ["nagumo", "maezono", "dr_kemuri"] : [];
  return mode === "tutorial" || mode === "rehearsal" ? ["sumi"] : [];
}

const MOODS = {
  watch: { label: "手元を見守る", mark: "·" },
  nod: { label: "小さくうなずく", mark: "✓" },
  concern: { label: "手元を気にかける", mark: "!" },
  think: { label: "静かに考える", mark: "…" },
};

function faceFor(id, mood, kind) {
  // 南雲は最後まで票を温存する。制作中に勝利を示す笑顔は出さない。
  if (id === "nagumo") return mood === "think" ? "thinking" : "serious";
  if (mood === "nod") return id === "maezono" && (kind === "perfect" || kind === "just") ? "excited" : id === "dr_kemuri" ? "normal" : "smile";
  return mood === "concern" || mood === "think" ? "serious" : "normal";
}

export function buildAudience(cs) {
  const ids = cs.audienceIds || audienceFor(cs.mode, state.chapter);
  if (!ids.length) return null;
  const note = el("p.audience-note", { text: "手元を見守っている" });
  const people = ids.map((id) => {
    const name = displayName(id, state);
    const image = el("img", { alt: "", draggable: false, decoding: "async" });
    const mark = el("i.audience-mood", { "aria-hidden": "true" });
    const root = el("figure.audience-person", { dataset: { person: id }, role: "img" }, [
      el("div.audience-face", [image, mark]), el("figcaption", { text: name }),
    ]);
    let current = "", changedAt = -Infinity;
    const setMood = (mood, kind = "", force = false) => {
      if (!force && (mood === current || performance.now() - changedAt < 350)) return;
      current = mood; changedAt = performance.now();
      const portrait = portraitInfo(id, faceFor(id, mood, kind));
      if (portrait) {
        image.src = portrait.src;
        // 共通キャンバスの本体上端とアンカーで頭部を揃える。元画像は変更しない。
        image.style.width = "270px";
        image.style.left = `calc(50% - ${portrait.ax * 270}px)`;
        image.style.top = `${8 - (1 - portrait.h - portrait.b) * 270 / portrait.aspect}px`;
      } else {
        const fallback = faceIconUrl(id, state);
        image.hidden = !fallback;
        if (fallback) image.src = fallback;
        image.classList.add("audience-icon");
      }
      const info = MOODS[mood];
      root.dataset.mood = mood;
      root.title = `${name}：${info.label}`;
      root.setAttribute("aria-label", root.title);
      mark.textContent = info.mark;
    };
    setMood("watch", "", true);
    // 表情が切り替わる前に、実際に使う差分だけ読み込んでおく。
    for (const mood of ["nod", "concern", "think"]) {
      const p = portraitInfo(id, faceFor(id, mood, "perfect"));
      if (p) { const warm = new Image(); warm.src = p.src; }
    }
    return { id, root, setMood };
  });
  const root = el(`aside.bench-audience${ids.length === 1 ? ".audience-single" : ""}`, { "aria-label": cs.mode === "tournament" ? "見守る審査員" : "見守る人", dataset: { test: "craft-audience" } }, [
    el("div.audience-people", people.map((p) => p.root)), ids.length === 1 ? note : null,
  ]);
  return {
    root,
    setStep(hint) {
      people.forEach((p) => p.setMood("watch", "", true));
      note.textContent = cs.mode === "tutorial" && hint.startsWith("スミ「") ? hint.slice(3, -1) : "手元を見守っている";
    },
    react(kind, { judge = null, force = false } = {}) {
      const positive = ["just", "perfect", "great", "good"].includes(kind);
      const negative = ["bad", "miss", "close"].includes(kind);
      if (!positive && !negative && kind !== "watch") return;
      for (const p of people) {
        if (judge && p.id !== judge) continue;
        const mood = p.id === "nagumo" ? positive ? "think" : "watch" : positive ? "nod" : negative ? "concern" : "watch";
        p.setMood(mood, kind, force);
      }
    },
  };
}
