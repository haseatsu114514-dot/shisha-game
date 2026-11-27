import { ryujiGreetingDue, kuraudoGreetingDue, visitStamp as visitorStamp } from "../core/ryuji-visit.js";
import { state, save } from "../core/state.js";
import { chapterDay } from "../core/chapter-clock.js";
import { buyKeepsake } from "../core/keepsakes.js";
import { addMoney } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { DB, displayName } from "../core/data.js";
import { purikuraPhoto } from "../core/purikura-photo.js";
import { PURIKURA_PHOTOS } from "../core/purikura-data.js";
import { modal } from "../core/ui.js";
import { spotPeople } from "../daily/spot-people.js";
import { play } from "../vn/engine.js";

const REVISIT_FEE = 400;
const active = new WeakSet();
const visitStamp = () => `${state.chapter}:${state.day}:${state.slot}`;

// 店の初回だけ無料。モード・相手で無料枠を作り直さず、行動消費は増やさない。
export async function offerAgehaPurikura(background, spot = { id: "ch2_ageha", kind: "rival", charId: "ageha" }, { signal } = {}) {
  const owner = state, stamp = visitStamp(), phase = state.phase;
  if (signal?.aborted || active.has(owner)) return false;
  const live = () => state === owner && visitStamp() === stamp && state.phase === phase && !signal?.aborted;
  const read = async id => {
    const result = await play(id, { bg: background, signal });
    return live() && !!result && !result.cancelled;
  };
  active.add(owner);
  try {
    if (ryujiGreetingDue(state)) {
      if (!await read("remake_ch2_ryuji_melty_greeting")) return false;
      state.flags._ryuji_melty_greeting = true;
      state.flags._ryuji_melty_visit = visitorStamp(state);
      save();
    } else if (kuraudoGreetingDue(state)) {
      // クラウドの挨拶回（#3468 A案）。二人で撮る場面まで台本の中。料金・思い出の品・好感度は動かさない。
      if (!await read("remake_ch2_kuraudo_melty_greeting")) return false;
      state.flags._kuraudo_melty_greeting = state.day;
      save();
    }
    if (state.flags._ageha_first_purikura) return await revisitPurikura(background, spot, { live, read, stamp });
    if (!await read("remake_ch2_ageha_purikura")) return false;
    if (!buyKeepsake("ageha_first_purikura")) return false;
    state.flags._ageha_first_purikura = true;
    state.flags._ageha_purikura_offer = stamp;
    save();
    return true;
  } finally { active.delete(owner); }
}

/**
 * 撮った相手の写真（core/purikura-data.js）から、まだ撮っていない1枚。そろった後は同じ相手の写真から（PFC18）。
 * 絵の無い相手（審査員など）は null で、立ち絵の顔を並べた写真のまま。撮った絵は履歴の cg に残り、ギャラリーにも出る。
 */
export function pickPurikuraPhoto(partner, { rand = Math.random, save: s = state } = {}) {
  const pool = PURIKURA_PHOTOS.filter(p => p.with === partner && (p.slot === undefined || p.slot === s.slot));
  if (!pool.length) return null;
  const taken = new Set((s.flags?._ageha_purikura_history || []).map(h => h?.cg).filter(Boolean));
  const fresh = pool.filter(p => !taken.has(p.cg));
  const from = fresh.length ? fresh : pool;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}

export const purikuraGuests = spot => spotPeople(spot).filter(person => person.role === "guest" && person.known
  && person.id !== "ageha" && !!DB.characters[person.id]);

async function revisitPurikura(background, spot, { live, read, stamp }) {
  if (state.flags._ageha_purikura_offer === stamp) return true;
  // 呼出し元は写真の後に店代を確定する。帰りの運賃と、その店代は写真に使わない。
  const available = () => Math.max(0, spendableMoney(state) - Math.max(0, Number(spot.cost) || 0));
  const canPay = () => available() >= REVISIT_FEE;
  const shortage = async () => {
    await modal({ title: "プリクラは400円", body: `撮影に使えるお金が足りません（${available()}円）。店の利用料と帰りの運賃は別に残します。今日は撮影しません。`, options: [
      { label: "戻る", value: true, test: "purikura-insufficient" },
    ] });
    return live();
  };
  if (!canPay()) return shortage();
  if (!await read("remake_ch2_purikura_invite")) return false;
  const guests = purikuraGuests(spot);
  const mode = await modal({ title: "プリクラ、撮っていく？", body: "2回目からは1回400円。撮影・落書き・シール込みです。追加の行動・体力は使いません。", options: [
    { label: "一人で撮る（400円）", value: "solo", test: "purikura-solo" },
    { label: "あげはと撮る（400円）", value: "pair", test: "purikura-pair" },
    ...guests.length ? [{ label: "相席した人と撮る（400円）", value: "guest", test: "purikura-guest" }] : [],
    { label: "今日は撮らない", value: null, test: "purikura-skip" },
  ] });
  if (!live()) return false;
  let people = ["hajime"];
  if (mode === "pair") people.push("ageha");
  if (mode === "guest") {
    const guest = await modal({ title: "誰と撮る？", body: "今、相席している相手。撮影は二人で400円です。", options: [
      ...guests.map(person => ({ label: person.name, value: person.id, test: `purikura-with-${person.id}` })),
      { label: "今日は撮らない", value: null, test: "purikura-guest-back" },
    ] });
    if (!live()) return false;
    if (!guest) { state.flags._ageha_purikura_offer = stamp; save(); return true; }
    if (!purikuraGuests(spot).some(person => person.id === guest)) return false;
    people.push(guest);
  }
  if (mode) {
    if (!["solo", "pair", "guest"].includes(mode)) return false;
    if (!canPay()) return shortage();
    // 神崎と初めて撮る回は、職人プリ（記念品）の場面。2回目からは、神崎の写真（あげはが入る3人の一枚も）から選ぶ。
    const ryuji = people.includes("kumicho") && !(state.keepsakes || []).includes("ryuji_purikura");
    const pick = ryuji ? null : pickPurikuraPhoto(mode === "solo" ? "solo" : people[1]);
    const scene = ryuji ? "remake_ch2_purikura_ryuji" : pick?.trio ? "remake_ch2_purikura_trio" : `remake_ch2_purikura_${mode}`;
    if (!await read(scene)) return false;
    const cg = ryuji ? "cg_ryuji_purikura" : pick?.cg || null;
    const received = await modal({ title: mode === "solo" ? "一人で初挑戦！" : pick?.trio ? "3人ぷり☆" : "今日のプリクラ", body: purikuraPhoto(cg, people, mode, id => displayName(id, state)), options: [
      { label: "受け取る（400円）", value: true, test: "purikura-receive", primary: true },
    ] });
    if (!live() || received !== true) return false;
    if (mode === "guest" && !purikuraGuests(spot).some(person => person.id === people[1])) return false;
    if (!canPay()) return shortage();
    if (ryuji && !buyKeepsake("ryuji_purikura")) return false;
    addMoney(-REVISIT_FEE);
    const history = state.flags._ageha_purikura_history ||= [];
    history.push({ chapter: state.chapter, day: state.day, chapterDay: chapterDay(state), slot: state.slot, people, mode, ...(cg ? { cg } : {}) });
  }
  state.flags._ageha_purikura_offer = stamp;
  save();
  return true;
}
