// LIME（スマホ）。朝に届くメッセージ・返信の選択肢・誘い。
// ルール: 同じ相手からは1日1話題まで（小分けの連投はOK）／連絡先を交換した相手だけ（master_spec #7/#26）
import { el, sleep } from "../core/util.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { layers } from "../core/ui.js";
import { state } from "../core/state.js";
import { gainAffinity, affinityLevel, applyStats } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { hasContact } from "./spots.js";

const HEROINES_ENCOURAGE = ["tsumugi", "minto", "rin"];

function eligible(m, { tournamentDay = false } = {}) {
  if (state.limeRead.includes(m.id)) return false;
  if (m.chapter && m.chapter !== state.chapter) return false;
  if (["ageha"].includes(m.sender)) return false; // ch1 ではまだ連絡先を知らない
  const cond = m.trigger_condition;
  if (cond === "tournament_day") return tournamentDay && HEROINES_ENCOURAGE.includes(m.sender) && hasContact(m.sender);
  if (tournamentDay) return false;
  if (!hasContact(m.sender)) return false;
  if (cond === "lime_exchanged") return m.trigger_day <= state.day && state.day - m.trigger_day <= 1;
  if (cond === "affinity_level") return affinityLevel(m.sender) >= (m.trigger_value || 3) && !state.flags[`_invited_${m.id}`];
  if (cond === "flag") return !!state.flags[m.trigger_flag];
  return false;
}

/** 今朝届くメッセージ（1人1話題・最大3通） */
export function morningMessages(opts = {}) {
  const out = [];
  const senders = new Set();
  for (const m of DB.lime) {
    if (out.length >= 3) break;
    if (senders.has(m.sender) || !eligible(m, opts)) continue;
    // 夜の誘いは前日にもう約束がある日は来ない
    if (m.type === "invitation" && state.pendingInvite) continue;
    out.push(m);
    senders.add(m.sender);
  }
  return out;
}

/**
 * スマホを開いてメッセージを順に読ませる。
 * 戻り値: 受けた誘い [{event, sender, slot}]
 */
export async function openPhone(messages, { title = "LIME", time = "AM 8:12" } = {}) {
  const accepted = [];
  const thread = el("div.phone-thread");
  const who = el("div.phone-who");
  const actions = el("div.phone-actions");
  const phone = el("div.phone", [
    el("div.phone-top", [el("span", { text: time }), el("span", { text: title })]),
    who,
    thread,
    actions,
  ]);
  const overlay = el("div.phone-overlay", [phone]);
  layers.modal.replaceChildren(overlay);
  layers.modal.classList.add("show");
  requestAnimationFrame(() => overlay.classList.add("show"));

  const bubble = async (text, mine = false, sender = null) => {
    // 名乗る前の相手はアイコンでも正体を明かさない
    const face = !mine && sender && (state.met[sender] || sender === "sumi") ? faceIconUrl(sender) : null;
    const b = el(`div.bubble${mine ? ".mine" : ""}`, [
      face ? el("img.bubble-face", { src: face, alt: "" }) : null,
      el("span", { text }),
    ]);
    thread.append(b);
    thread.scrollTop = thread.scrollHeight;
    SE.phone();
    await sleep(mine ? 250 : 520);
  };
  const choose = (options) => new Promise((resolve) => {
    actions.replaceChildren(...options.map((o, i) =>
      el("button.phone-reply", { text: o.text, dataset: { test: `reply-${i}` }, onclick: () => { SE.select(); actions.replaceChildren(); resolve(o); } })));
  });

  for (const m of messages) {
    state.limeRead.push(m.id);
    thread.replaceChildren();
    who.textContent = m.sender === "???" ? "？？？" : displayName(m.sender, state);
    for (const msg of m.messages || []) {
      const text = typeof msg === "string" ? msg : msg.text;
      await bubble(text, false, m.sender);
    }
    if (m.type === "invitation" && m.accept_event) {
      const pick = await choose([{ text: "行く", go: true }, { text: "ごめん、今日は無理", go: false }]);
      await bubble(pick.text, true);
      if (pick.go) {
        accepted.push({ event: m.accept_event, sender: m.sender, slot: m.time_slot === "night" ? 1 : 0 });
        state.flags[`_invited_${m.id}`] = true;
      } else {
        state.flags[`_invited_${m.id}`] = true;
        if (m.decline_response) await bubble(m.decline_response.text, false, m.sender);
        gainAffinity(m.sender, 1);
      }
    } else if (m.replies && m.replies.length) {
      const r = await choose(m.replies);
      await bubble(r.text, true);
      if (r.response) await bubble(r.response, false, m.sender);
      gainAffinity(m.sender, (r.affinity || 1) * 3);
    } else if (m.type === "rumor") {
      applyStats({ insight: 2 }); // 噂は読むだけで洞察が伸びる
    } else if (m.sender !== "???" && m.sender !== "sumi") {
      gainAffinity(m.sender, 2);
    }
    await new Promise((resolve) => {
      actions.replaceChildren(el("button.phone-reply.close", { text: m.close_label || (messages.at(-1) === m ? "スマホを閉じる" : "次のメッセージ"), dataset: { test: "phone-next" }, onclick: () => { SE.click(); resolve(); } }));
    });
  }
  overlay.classList.remove("show");
  await sleep(250);
  layers.modal.classList.remove("show");
  layers.modal.replaceChildren();
  return accepted;
}
