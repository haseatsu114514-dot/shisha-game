// カードゲーム「一台勝負」の相手の一言（#3244 項目3）。台詞は data/dialogue/ichidai_lines.json。
// 規則の出来事（ichidai-rules.js の G.events）から場面を決め、候補から1つ選んで、相手の顔の近くに吹き出しで出す。
// 吹き出しは待たない（対戦の進行を止めない）。早送りとCPU自動（テスト）では出さない。卓の並びには入れず重ねるだけで、
// しばらくすると消えるので、手札・炭・ボタンの場所を恒常的に狭くしない。
// 読み込むだけでは画面に触れない（場面の決め方と選び方は remake/test/ichidai_lines.mjs がブラウザ無しで確かめる）。
import { CARD } from "./ichidai-data.js";

export const LINES_URL = new URL("../../../data/dialogue/ichidai_lines.json", import.meta.url).href;
const SHOW_MS = 2200;

/** 台本の形 { dialogues:[{ dialogue_id, lines }] } を { 場面ID: 候補 } にする */
export function indexLines(data) {
  const out = {};
  for (const d of data?.dialogues || []) if (typeof d?.dialogue_id === "string" && Array.isArray(d.lines)) out[d.dialogue_id] = d.lines.filter((l) => typeof l?.text === "string" && l.text);
  return out;
}

let cache = null;
/** 台詞を一度だけ読む。読めなければ空（一言が出ないだけで遊べる） */
export function loadIchidaiLines(url = LINES_URL) {
  cache ||= fetch(url).then((r) => (r.ok ? r.json() : null)).then(indexLines).catch(() => ({}));
  return cache;
}

/**
 * 出来事 → 場面の候補（先にあるほど優先。台詞が無い場面は飛ばす）。一言にしない出来事は []
 * play は相手が使ったときだけ。score は焦げ → ジャスト → 一票の順に、相手の一口を先に見る。
 */
export function triggersOf(ev, foe = 1) {
  if (!ev) return [];
  if (ev.t === "play") {
    const c = CARD[ev.id];
    return ev.p === foe && c && c.type !== "coal" ? [`play_card_${ev.id}`, `play_${c.type}`] : [];
  }
  if (ev.t === "score") {
    const me = 1 - foe, mine = ev.res?.[me], his = ev.res?.[foe], out = [];
    if (his?.zone === "scorch") out.push("foe_scorch");
    if (mine?.zone === "scorch") out.push("hajime_scorch");
    if (his?.zone === "just") out.push("foe_just");
    if (mine?.zone === "just") out.push("hajime_just");
    if (ev.voter === foe) out.push("foe_vote"); else if (ev.voter === me) out.push("hajime_vote");
    return out;
  }
  if (ev.t === "end") { const w = ev.result?.winner; return [w === foe ? "foe_win" : w === 1 - foe ? "foe_lose" : "draw"]; }
  if (ev.t === "start") return ["start"];
  return [];
}

/** 相手 charId の場面の候補から1つ選ぶ。{ id（場面ID）, speaker, face, text } か null */
export function pickLine(lines, charId, triggers, rnd = Math.random) {
  if (!lines || !charId) return null;
  for (const t of triggers) {
    const id = `ichidai_${charId}_${t}`, list = lines[id];
    if (list?.length) return { id, ...list[Math.min(list.length - 1, Math.floor(rnd() * list.length))] };
  }
  return null;
}

/**
 * 対戦の画面に一言を付ける。runIchidai の中で一度呼び、出来事を渡す。
 *   root   … .ichi-game（吹き出しを重ねる先）
 *   charId … 相手のキャラID（foe.id）。台詞の無い相手なら何も出さない
 *   quick  … 早送り・CPU自動なら true を返す関数（そのときは出さない）
 *   onLine … 一言を出したときに呼ぶ（表情の切り替え用。line.face に表情）
 * 戻り値: { event(ev), clear() }。event は待たずに返る
 */
export function attachIchidaiLines({ root, charId, foe = 1, quick = () => false, onLine = null, rnd = Math.random, lines = null } = {}) {
  let data = lines, node = null, timer = 0, gone = false;
  if (!data && charId) loadIchidaiLines().then((x) => { data = x; });
  const clear = () => { clearTimeout(timer); node?.remove(); node = null; };
  function event(ev) {
    if (gone || !data || !root?.isConnected || quick()) return null;
    // カードの一言は、ほかの一言が出ている間は重ねない（審査と勝敗は差し替える）
    if (ev?.t === "play" && node) return null;
    const line = pickLine(data, charId, triggersOf(ev, foe), rnd);
    if (!line) return null;
    clear();
    node = document.createElement("div");
    node.className = "ichi-say is-foe";
    node.dataset.test = "ichi-say";
    node.dataset.line = line.id;
    node.dataset.face = line.face || "";
    node.setAttribute("aria-live", "polite");
    node.textContent = line.text;
    // 相手の顔の左横に、顔へ向けて出す（右横は熱の計りと早送りボタンがあるので空けておく）
    const anchor = root.querySelector(".ichi-leader.is-foe .ichi-leader-ring") || root.querySelector(".ichi-leader.is-foe");
    if (anchor) {
      const a = anchor.getBoundingClientRect(), r = root.getBoundingClientRect(), k = r.width ? root.offsetWidth / r.width : 1;
      node.style.right = `${Math.round((r.right - a.left) * k) + 12}px`;
      node.style.top = `${Math.round((a.top + a.height / 2 - r.top) * k)}px`;
      node.classList.add("is-anchored");
    }
    root.append(node);
    const mine = node;
    timer = setTimeout(() => { if (node === mine) clear(); }, SHOW_MS);
    try { onLine?.(line); } catch { /* 表情が変えられなくても一言は出す */ }
    return line;
  }
  return { event, clear: () => { gone = true; clear(); } };
}
