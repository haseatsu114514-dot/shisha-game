// LIME（スマホ）。朝に届くメッセージ・返信の選択肢・誘い。
// ルール: 同じ相手からは1日1話題まで（小分けの連投はOK）／連絡先を交換した相手だけ（master_spec #7/#26）
// 見た目は旧版の LIME（ノッチ付きの端末・緑のヘッダー・白と黄緑の吹き出し・明るい返信欄）を踏襲する。
import { el, sleep } from "../core/util.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { layers } from "../core/ui.js";
import { state } from "../core/state.js";
import { gainAffinity, affinityLevel, applyStats, bond } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { hooks } from "../vn/engine.js";
import { formatHtml } from "../vn/text.js";
import { hasContact } from "./spots.js";
import { loverMessages, isLover } from "./romance.js";

const HEROINES_ENCOURAGE = ["tsumugi", "minto", "rin"];
// 目上の相手への返信は敬語（旧版 F6）。友達口調は同世代の相手だけ
const POLITE = new Set(["sumi", "nagumo", "maezono"]);

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

/**
 * 今朝届くメッセージ（1人1話題・最大3通）。恋人からの LIME（記念日・デートの誘い・朝のひとこと）を優先する
 * @param opts.tournamentDay 大会当日の朝か / opts.fixedNight (day) => 夜の固定イベントがあるか
 */
export function morningMessages(opts = {}) {
  const out = [];
  const senders = new Set();
  for (const m of loverMessages(opts)) {
    if (out.length >= 3 || senders.has(m.sender)) continue;
    out.push(m);
    senders.add(m.sender);
  }
  for (const m of DB.lime) {
    if (out.length >= 3) break;
    if (senders.has(m.sender) || !eligible(m, opts)) continue;
    // 夜の誘いは前日にもう約束がある日は来ない
    if (m.type === "invitation" && (state.pendingInvite || out.some((x) => x.type === "invitation"))) continue;
    out.push(m);
    senders.add(m.sender);
  }
  return out;
}

/** 顔ドット絵のアイコン。名乗る前の相手・絵の無い相手は頭文字の丸にする（正体を明かさない） */
function avatar(sender, small = false) {
  const cls = `lime-face${small ? ".sm" : ""}`;
  const known = sender && sender !== "???" && (state.met[sender] || sender === "sumi");
  const url = known ? faceIconUrl(sender) : null;
  if (url) return el(`img.${cls}`, { src: url, alt: "" });
  const name = known ? displayName(sender, state) : "？";
  return el(`span.${cls}.blank`, { text: [...name][0] || "？" });
}

const text = (raw) => formatHtml(hooks.interpolate ? hooks.interpolate(String(raw)) : String(raw));

/**
 * スマホを開いてメッセージを順に読ませる。
 * 戻り値: 受けた誘い [{event, sender, slot}]
 */
export async function openPhone(messages, { title = null, time = "AM 8:12" } = {}) {
  const accepted = [];
  const chat = el("div.lime-chat");
  const peer = el("div.lime-peer");
  const unread = el("span.lime-unread");
  const actions = el("div.lime-actions");
  const phone = el("div.phone", [
    el("div.phone-notch"),
    el("div.phone-status", [
      el("span", { text: time }),
      el("span", { text: title || (state.phase === "tournament" ? "大会当日" : `DAY ${state.day}`) }),
      el("span.phone-batt", { text: "●●●▱" }),
    ]),
    el("div.lime-header", [el("span.lime-logo", { text: "LIME" }), peer, unread]),
    chat,
    actions,
  ]);
  const overlay = el("div.phone-overlay", [phone]);
  layers.modal.replaceChildren(overlay);
  layers.modal.classList.add("show");
  requestAnimationFrame(() => overlay.classList.add("show"));
  await sleep(420);

  let lastSide = null;
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  const bubble = async (raw, mine = false, sender = null) => {
    if (!mine) {
      // 相手が打っている気配（…）を一瞬見せてから吹き出しにする
      const typing = el("div.lime-row.peer.typing", [lastSide === "peer" ? el("span.lime-face.sm.gap") : avatar(sender, true), el("div.lime-bubble", [el("i"), el("i"), el("i")])]);
      chat.append(typing);
      scroll();
      await sleep(300);
      typing.remove();
    }
    const side = mine ? "me" : "peer";
    const face = mine ? null : lastSide === "peer" ? el("span.lime-face.sm.gap") : avatar(sender, true);
    const b = el("div.lime-bubble");
    b.innerHTML = text(raw);
    chat.append(el(`div.lime-row.${side}`, [face, b]));
    lastSide = side;
    scroll();
    SE.phone();
    await sleep(mine ? 260 : 380);
  };
  const note = (t) => {
    chat.append(el("div.lime-note", { text: t }));
    lastSide = null;
    scroll();
  };
  const choose = (options, hint = null) => new Promise((resolve) => {
    actions.replaceChildren(...[
      hint ? el("div.lime-hint", { text: hint }) : null,
      ...options.map((o, i) =>
        el("button.lime-reply", { text: o.label || o.text, dataset: { test: `reply-${i}` }, onclick: () => { SE.select(); actions.replaceChildren(); resolve(o); } })),
    ].filter(Boolean));
  });

  for (const m of messages) {
    state.limeRead.push(m.id);
    chat.replaceChildren();
    actions.replaceChildren();
    lastSide = null;
    const left = messages.length - 1 - messages.indexOf(m);
    peer.replaceChildren(avatar(m.sender), el("span.lime-name", { text: m.sender === "???" ? "？？？" : displayName(m.sender, state) }));
    unread.textContent = left ? `未読 ${left}` : "";
    for (const msg of m.messages || []) await bubble(typeof msg === "string" ? msg : msg.text, false, m.sender);

    if (m.type === "invitation" && m.accept_event) {
      const polite = POLITE.has(m.sender);
      const go = polite ? "行きます！" : "行く！";
      const no = polite ? "すみません、今日は難しいです……" : "ごめん、今日は難しい";
      const first = !state.flags._hint_invite;
      state.flags._hint_invite = true;
      const pick = await choose(
        [{ label: `${go}（行動を1回使う）`, text: go, go: true }, { text: no, go: false }],
        first ? "誘いに乗ると行動を1回使う。そのぶん、ふつうに会いに行くより仲が深まりやすい。断っても嫌われたりはしない" : null,
      );
      await bubble(pick.text, true);
      state.flags[`_invited_${m.id}`] = true;
      if (pick.go) {
        const night = m.time_slot === "night";
        accepted.push({ event: m.accept_event, sender: m.sender, slot: night ? 1 : 0 });
        note(night ? "今夜の約束ができた" : "このあと向かうことにした");
      } else {
        if (m.decline_response) await bubble(m.decline_response.text, false, m.sender);
        gainAffinity(m.sender, 1);
      }
    } else if (m.replies && m.replies.length) {
      const r = await choose(m.replies);
      await bubble(r.text, true);
      if (r.response) await bubble(r.response, false, m.sender);
      bond.private = isLover(m.sender); // 恋人とのやりとりは絆として積もる
      gainAffinity(m.sender, (r.affinity || 1) * 3);
      bond.private = false;
    } else if (m.type === "rumor") {
      applyStats({ insight: 2 }); // 噂は読むだけで洞察が伸びる
    } else if (m.sender !== "???" && m.sender !== "sumi") {
      gainAffinity(m.sender, 2);
    }
    await new Promise((resolve) => {
      const last = messages.at(-1) === m;
      actions.replaceChildren(el("button.lime-reply.ghost", {
        text: m.close_label || (last ? "スマホを閉じる" : "次のトーク ▸"),
        dataset: { test: "phone-next" },
        onclick: () => { SE.click(); resolve(); },
      }));
    });
  }
  overlay.classList.remove("show");
  await sleep(300);
  layers.modal.classList.remove("show");
  layers.modal.replaceChildren();
  return accepted;
}
