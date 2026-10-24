import { ryujiGreetingDue, visitStamp as visitorStamp } from "../core/ryuji-visit.js";
import { state, save } from "../core/state.js";
import { buyKeepsake } from "../core/keepsakes.js";
import { DB, displayName } from "../core/data.js";
import { stickerPhoto } from "../core/purikura-photo.js";
import { modal } from "../core/ui.js";
import { spotPeople } from "../daily/spot-people.js";
import { play } from "../vn/engine.js";

// 初来店の一回だけ無料。交流段階・恋人関係・追加の行動消費は付けない。
export async function offerAgehaPurikura(background, spot = { id: "ch2_ageha", kind: "rival", charId: "ageha" }) {
  if (ryujiGreetingDue(state)) {
    const owner = state;
    const greeting = await play("remake_ch2_ryuji_melty_greeting", { bg: background });
    if (state !== owner || !greeting || greeting.cancelled) return false;
    state.flags._ryuji_melty_greeting = true;
    state.flags._ryuji_melty_visit = visitorStamp(state);
    save();
  }
  if (state.flags._ageha_first_purikura) return revisitPurikura(background, spot);
  const owner = state;
  const result = await play("remake_ch2_ageha_purikura", { bg: background });
  if (state !== owner || !result || result.cancelled) return false;
  buyKeepsake("ageha_first_purikura");
  state.flags._ageha_first_purikura = true;
  state.flags._ageha_purikura_offer = visitStamp();
  save();
  return true;
}

const visitStamp = () => `${state.chapter}:${state.day}:${state.slot}`;
export const purikuraGuests = spot => spotPeople(spot).filter(person => person.role === "guest" && person.known
  && person.id !== "ageha" && !!DB.characters[person.id]);

async function revisitPurikura(background, spot) {
  const owner = state, stamp = visitStamp();
  if (state.flags._ageha_purikura_offer === stamp) return true;
  const invitation = await play("remake_ch2_purikura_invite", { bg: background });
  if (state !== owner || !invitation || invitation.cancelled) return false;
  const guests = purikuraGuests(spot);
  const mode = await modal({ title: "プリクラ、撮っていく？", body: "撮影と落書きは来店のおまけ。追加の代金・行動は使いません。", options: [
    { label: "一人で撮る", value: "solo", test: "purikura-solo" },
    { label: "あげはと撮る", value: "pair", test: "purikura-pair" },
    ...guests.length ? [{ label: "相席した人と撮る", value: "guest", test: "purikura-guest" }] : [],
    { label: "今日は撮らない", value: null, test: "purikura-skip" },
  ] });
  if (state !== owner) return false;
  let people = ["hajime"];
  if (mode === "pair") people.push("ageha");
  if (mode === "guest") {
    const guest = await modal({ title: "誰と撮る？", body: "今、相席している相手", options: [
      ...guests.map(person => ({ label: person.name, value: person.id, test: `purikura-with-${person.id}` })),
      { label: "今日は撮らない", value: null, test: "purikura-guest-back" },
    ] });
    if (state !== owner) return false;
    if (!guest) { state.flags._ageha_purikura_offer = stamp; save(); return true; }
    if (!purikuraGuests(spot).some(person => person.id === guest)) return false;
    people.push(guest);
  }
  if (mode) {
    const ryuji = people.includes("kumicho");
    const scene = await play(ryuji ? "remake_ch2_purikura_ryuji" : `remake_ch2_purikura_${mode}`, { bg: background });
    if (state !== owner || !scene || scene.cancelled) return false;
    await modal({ title: mode === "solo" ? "一人で初挑戦！" : "今日のプリクラ", body: stickerPhoto(people, mode, id => displayName(id, state)), options: [
      { label: "受け取る", value: true, test: "purikura-receive", primary: true },
    ] });
    if (state !== owner) return false;
    const history = state.flags._ageha_purikura_history ||= [];
    if (ryuji) buyKeepsake("ryuji_purikura");
    history.push({ chapter: state.chapter, day: state.day, slot: state.slot, people, mode });
  }
  state.flags._ageha_purikura_offer = stamp;
  save();
  return true;
}
