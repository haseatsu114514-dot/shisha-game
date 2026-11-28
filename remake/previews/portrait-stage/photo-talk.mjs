// 縦画面C案「煙の舞台」: チェキ（cheki.mjs）とプリクラ（purikura.mjs）の前後の台詞を、正本の台本から読んで下の帯に出す部品（要望台帳 VPS03・VPS04）。
// 台詞は data/dialogue/*.json をそのまま読む（文は写していない。台本を直せば、この試作にもそのまま効く）。
// 帯は本編と同じ組版で、表示する箱の実際の幅と書体で測って2行ずつに分ける（VPL29・js/vn/layout.js の paginateForBox）。
// 帯のどこを押しても次へ進む。返事は帯の下に大きな札で並べる（十字キーと丸ボタンは置かない）。

const DIALOGUE = new URL("../../../data/dialogue/", import.meta.url).href;
const files = new Map();
/** 台本のファイル（例 "ch1_minto"）を一度だけ読む */
export const loadDialogue = (file) => {
  if (!files.has(file)) files.set(file, fetch(`${DIALOGUE}${file}.json`).then((res) => { if (!res.ok) throw new Error(`${file}.json: HTTP ${res.status}`); return res.json(); }));
  return files.get(file);
};
export const findDialogue = (data, id) => data?.dialogues?.find((d) => d.dialogue_id === id) || null;
// 帯の名前（data/characters.json の表示名。地の文は名前なし）
const NAMES = { minto: "みんと", hajime: "はじめ", ageha: "あげは", rio: "凛想", customer: "客" };
/** 台本の1行が、帯に出す台詞か（地の文・台詞。演出・分岐・記録の行は出さない） */
export const isSpeech = (line) => !line.type && typeof line.text === "string" && line.text.length > 0;

export class Telop {
  /**
   * @param node 帯（.pt-telop）。中に .pt-name・.pt-text・.pt-more を置く
   * @param kit app.mjs の部品（esc・paginateForBox）
   */
  constructor(node, kit, { instant = false, names = null } = {}) {
    Object.assign(this, { node, kit, instant, names, waiting: null }); // names: 帯の名前の表（無ければ下の NAMES。スチルの場面は data/characters.json から作って渡す）
    this.name = node.querySelector(".pt-name");
    this.text = node.querySelector(".pt-text");
  }

  /** 1行を出す。2行に収まらない文はページに分け、押すたびに次のページ。wait=false なら出すだけ */
  async say(line, { wait = true } = {}) {
    const who = line.speaker || "";
    this.node.dataset.who = who || "narr";
    this.node.classList.toggle("inner", who === "hajime" && /^（.*）$/.test(line.text));
    const label = this.names?.[who] || NAMES[who] || "";
    this.name.textContent = label;
    this.name.hidden = !label;
    this.node.classList.remove("off");
    const pages = this.kit.paginateForBox(line.text, this.text);
    for (let i = 0; i < pages.length; i++) {
      this.text.innerHTML = String(pages[i]).split("\n").map(this.kit.esc).join("<br>");
      this.node.classList.remove("in"); void this.node.offsetWidth; this.node.classList.add("in");
      this.node.classList.toggle("pt-wait", wait);
      if (wait && !this.instant) await this.tapped();
    }
  }

  /** 帯を押すまで待つ */
  tapped() { return new Promise((resolve) => { this.waiting = resolve; }); }

  /** 帯が押された（app.mjs の onClick から） */
  tap() { const resolve = this.waiting; this.waiting = null; resolve?.(); return !!resolve; }

  /** 帯を消す（場所は残し、上の画面の大きさを変えない） */
  hide() { this.node.classList.add("off"); this.node.classList.remove("pt-wait"); }

  stop() { this.waiting = null; }
}
