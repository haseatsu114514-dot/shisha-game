// 会話エンジン — Godot 版 dialogue_box.gd と同じ JSON スキーマを解釈する。
// branch / choice の行は残りの行の前に挿入される（本家と同じ挙動）。
"use strict";

const STAT_KEYS = { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" };
const STAT_JA2EN = { 技術: "technique", センス: "sense", 根性: "guts", 魅力: "charm", 洞察: "insight" };

const SPEAKER_NAMES = {
  hajime: "はじめ", sumi: "スミさん", naru: "なる", adam: "アダム",
  minto: "緑川 栞（みんと）", mashiro: "ましろ", tsumugi: "つむぎ", tumugi: "つむぎ",
  hazime: "はじめ", pakki: "パッキー", salaryman: "サラリーマン",
  nagumo: "南雲修二", maezono: "前園壮一郎", kirishima: "霧島レン",
  staff_choizap: "チョイザップスタッフ", kako: "かこ", rira: "りら",
};
const SPEAKER_ID_ALIASES = { tumugi: "tsumugi", hazime: "hajime", takiguchi: "pakki", pakki: "packii" };

const SPEAKER_COLORS = {
  hajime: "#7ec8ff", sumi: "#d9a066", naru: "#ff8a65", adam: "#a5d6a7",
  minto: "#aed581", tsumugi: "#f48fb1", pakki: "#ffd54f", nagumo: "#b0bec5",
  maezono: "#ce93d8", salaryman: "#90a4ae",
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// [imp]/[warn]/[hint]/[red]/[blue]/[sub] タグを span に変換
function formatText(raw) {
  let t = escapeHtml(String(raw));
  const tags = { imp: "imp", warn: "warn", hint: "hint", red: "red", blue: "blue", sub: "sub" };
  for (const [tag, cls] of Object.entries(tags)) {
    t = t.replaceAll(`[${tag}]`, `<span class="tx-${cls}">`).replaceAll(`[/${tag}]`, "</span>");
  }
  return t.replace(/\n/g, "<br>");
}

class DialogueEngine {
  // ctx: { getStat(en), portraitFaces, charNames, onApply(line), onChoice(id, branchKey), onGameOver() }
  constructor(el, ctx) {
    this.el = el; // { bg, portraits, nameLabel, textLabel, box, choices, cg }
    this.ctx = ctx;
    this.queue = [];
    this.branches = {};
    this.dialogueId = "";
    this.onFinish = null;
    this.waitingChoice = false;
    this.finished = true;
    this.slots = {}; // speaker -> slot index (0:left 1:right)
  }

  start(dialogue, onFinish) {
    this.dialogueId = dialogue.dialogue_id || "";
    this.queue = (dialogue.lines || []).slice();
    this.branches = dialogue.branches || {};
    this.onFinish = onFinish || null;
    this.waitingChoice = false;
    this.finished = false;
    this.slots = {};
    this.el.portraits.innerHTML = "";
    const meta = dialogue.metadata || {};
    if (meta.bg) this.setBackground(meta.bg);
    this.next();
  }

  setBackground(path) {
    const rel = String(path).replace(/^res:\/\//, "../");
    this.el.bg.style.backgroundImage = `url('${rel}')`;
  }

  next() {
    if (this.finished || this.waitingChoice) return;
    const line = this.queue.shift();
    if (line === undefined) {
      this.finished = true;
      this.el.choices.innerHTML = "";
      if (this.onFinish) this.onFinish();
      return;
    }
    const type = String(line.type || "");
    if (type === "condition") return this.handleCondition(line);
    if (type === "choice") return this.showChoices(line);
    if (type === "jump") return this.next(); // 章をまたぐジャンプは web 版では使用しない
    if (type === "set_flag") { if (this.ctx.setFlag) this.ctx.setFlag(line.flag); return this.next(); }
    if (type === "show_cg") { this.showCg(line.cg_id); return this.next(); }
    if (type === "hide_cg") { this.hideCg(); return this.next(); }
    if (type === "game_over") { this.finished = true; if (this.ctx.onGameOver) this.ctx.onGameOver(); return; }
    if (type === "apply") { if (this.ctx.onApply) this.ctx.onApply(line); return this.next(); }
    this.showLine(line);
  }

  handleCondition(line) {
    const condType = String(line.condition_type || "stat");
    let val = 0;
    let threshold = Number(line.threshold || 0);
    if (condType === "stat") {
      let stat = String(line.stat || "");
      if (STAT_JA2EN[stat]) stat = STAT_JA2EN[stat];
      val = this.ctx.getStat ? this.ctx.getStat(stat) : 0;
    }
    const key = val >= threshold ? String(line.next_true || "") : String(line.next_false || "");
    if (key && this.branches[key]) this.queue.unshift(...this.branches[key]);
    this.next();
  }

  showChoices(line) {
    this.waitingChoice = true;
    this.el.choices.innerHTML = "";
    for (const c of line.choices || []) {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.innerHTML = formatText(c.text || "選択肢");
      btn.addEventListener("click", () => {
        this.waitingChoice = false;
        this.el.choices.innerHTML = "";
        const key = String(c.next || "");
        if (this.branches[key]) {
          this.queue.unshift(...this.branches[key]);
        } else if (c.next_id && this.ctx.findDialogue) {
          // 別ダイアログへの遷移（本家の next_id 挙動）
          const target = this.ctx.findDialogue(String(c.next_id));
          if (target) {
            this.queue = (target.lines || []).slice();
            this.branches = target.branches || {};
            const meta = target.metadata || {};
            if (meta.bg) this.setBackground(meta.bg);
          }
        }
        if (this.ctx.onChoice) this.ctx.onChoice(this.dialogueId, String(line.id || ""), key);
        this.next();
      });
      this.el.choices.appendChild(btn);
    }
  }

  showCg(cgId) {
    this.el.cg.style.backgroundImage = `url('../assets/cgs/${cgId}.png')`;
    this.el.cg.classList.add("visible");
  }
  hideCg() {
    this.el.cg.classList.remove("visible");
  }

  portraitSrc(speaker, face) {
    const folder = SPEAKER_ID_ALIASES[speaker] || speaker;
    const faces = (this.ctx.portraitFaces || {})[folder];
    if (!faces) return null;
    let f = face && faces.includes(face) ? face : null;
    if (!f && faces.includes("normal")) f = "normal";
    if (!f) f = faces[0];
    return `../assets/sprites/characters/${folder}/chr_${folder}_${f}.png`;
  }

  showLine(line) {
    const speaker = String(line.speaker || "");
    const face = String(line.face || "");
    // 名前ラベル
    if (speaker) {
      const name = SPEAKER_NAMES[speaker] || (this.ctx.charNames || {})[speaker] || speaker;
      this.el.nameLabel.textContent = name;
      this.el.nameLabel.style.display = "";
      this.el.nameLabel.style.color = SPEAKER_COLORS[speaker] || "#ffd878";
    } else {
      this.el.nameLabel.style.display = "none";
    }
    // 立ち絵（最大2スロット、発言者を明るく）
    if (speaker && this.portraitSrc(speaker, face)) {
      if (!(speaker in this.slots)) {
        const used = Object.values(this.slots);
        let slot = [0, 1].find((s) => !used.includes(s));
        if (slot === undefined) {
          // 一番古いスロットを奪う
          const oldest = Object.keys(this.slots)[0];
          slot = this.slots[oldest];
          delete this.slots[oldest];
          const oldImg = this.el.portraits.querySelector(`img[data-speaker="${oldest}"]`);
          if (oldImg) oldImg.remove();
        }
        this.slots[speaker] = slot;
        const img = document.createElement("img");
        img.dataset.speaker = speaker;
        img.className = `portrait slot-${slot}`;
        img.onerror = () => img.remove();
        this.el.portraits.appendChild(img);
      }
      const img = this.el.portraits.querySelector(`img[data-speaker="${speaker}"]`);
      if (img) img.src = this.portraitSrc(speaker, face);
    }
    for (const img of this.el.portraits.querySelectorAll("img")) {
      img.classList.toggle("active", img.dataset.speaker === speaker);
    }
    // テキスト（タイプライター表示）
    this.typeText(line.text || "");
    // テキスト内の報酬キューを通知
    if (this.ctx.onTextCue) this.ctx.onTextCue(String(line.text || ""), this.dialogueId);
  }

  typeText(raw) {
    const html = formatText(raw);
    const label = this.el.textLabel;
    label.innerHTML = html;
    const total = label.textContent.length;
    label.style.setProperty("--chars", total);
    label.classList.remove("typing");
    void label.offsetWidth; // アニメーション再始動
    label.classList.add("typing");
  }
}

window.DialogueEngine = DialogueEngine;
window.STAT_KEYS = STAT_KEYS;
window.formatText = formatText;
