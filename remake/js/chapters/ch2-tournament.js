// HAZE: OPEN CLOUD。一試合の制作と、各工程の確定済み状態だけを保存する。
import { DB, bgUrl, displayName, faceIconUrl, portraitInfo, CHAPTER_DIALOGUE_FILES } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, markMet, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play } from "../vn/engine.js";
import { openPhone, openLime } from "../daily/phone.js";
import { playBgm } from "../core/audio.js";
import { newSession, openBench, waitBenchReady, benchRoot } from "../craft/session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull, runCare } from "../craft/pull.js";
import { computeShisha, finalize } from "../craft/score.js";
import { CRAFT_STEPS } from "../craft/practice.js";
import * as broadcast from "../craft/broadcast.js";
import { readDialogues } from "./ch2-city-data.js";
import { JUDGES, CONTESTANTS, tournamentProgress, restoreResources,
  startAttempt, recoverStep, beginStep, finishStep, castVotes, standings, recordResult } from "./ch2-tournament-state.js";

const REQUIRED = ["lobby", "entrance", "rules", "farewell", "tasteless"].map(id => `ch2_tournament_${id}`);
const STEPS = [stepSetup, stepMix, stepPack, runHoles, stepPlace, runHeat,
  stepSteamTime, runSteamDodge, runPull, cs => runCare(cs, { round: 1 }), cs => runCare(cs, { round: 2 })];
const STEP_IDS = ["setup", "mix", "pack", "foil", "place", "coalfire", "steam", "steam", "pull", "adjust", "adjust"];
const MILESTONES = new Map([[8, 0], [9, 1], [10, 2], [11, 3]]);
const clone = value => JSON.parse(JSON.stringify(value));
const id = name => `ch2-tournament-${name}`;
let session;
const live = owner => session === owner && owner.active && owner.state === state;
const progress = () => tournamentProgress(state);

function button(owner, text, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
    dataset: { test: id(name) }, onclick: () => perform(owner, action) });
}
async function perform(owner, action) {
  if (!live(owner) || owner.busy) return;
  owner.busy = true;
  try { await action(); }
  catch (error) { if (live(owner)) { console.error("[ch2 tournament]", error); renderError(owner); } }
  finally { owner.busy = false; }
}
function menuButton(owner) {
  return el("button.btn.ch2-tournament-menu", { type: "button", text: "MENU", dataset: { test: id("menu") }, onclick: () => openMenu(owner) });
}
async function openMenu(owner) {
  if (!live(owner) || owner.menuBusy) return;
  owner.menuBusy = true;
  try {
    const choice = await modal({ title: "県大会 MENU", body: "途中の工程は、その工程の始めから再開できます。", options: [
      { label: "セーブ", value: "save", test: id("save") },
      { label: "ロード", value: "load", test: id("load") },
      { label: "タイトルへ戻る", value: "title", test: id("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!live(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "load") {
      const key = await loadFlow({ inGame: true });
      if (key && loadFromSlot(key)) { owner.active = false; owner.controller?.abort(); requestResumeOnBoot(); location.reload(); }
    }
    if (choice === "title") { save(); owner.active = false; owner.controller?.abort(); location.reload(); }
  } finally { owner.menuBusy = false; }
}
function hud(owner, visible = false) {
  layers.hud.replaceChildren(...(visible ? [el("div.ch2-tournament-vn-menu", [menuButton(owner)])] : []));
  layers.hud.classList.toggle("show", visible);
}
function card(owner, name, title, description, actions = [], extra = []) {
  hud(owner);
  showScreen("ch2-tournament", el("main.ch2-contest", { dataset: { test: id(name) } }, [
    el("header.ch2-contest-header", [el("div", [el("p", { text: "第二章・DAY14 ／ HAZE: OPEN CLOUD" }), el("h1", { text: title })]), menuButton(owner)]),
    el("p.ch2-contest-description", { text: description }), ...extra,
    el("div.ch2-contest-actions", actions),
  ]));
}
async function read(owner, name) {
  if (!live(owner)) return false;
  const key = `ch2_tournament_${name}`;
  if (!DB.dialogues[key]) throw new Error(`台本がありません: ${key}`);
  showScreen("none", null); hud(owner, true);
  const controller = new AbortController(); owner.controller = controller;
  const result = await play(key, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  return live(owner) && !!result && !result.cancelled;
}
async function message(owner, suffix, lines) {
  hud(owner);
  const key = `ch2_tournament_sumi_${suffix}`;
  const old = state.inbox.find(item => item.id === key);
  if (old?.done) return true;
  if (old) await openLime({ sender: "sumi" });
  else await openPhone([{ id: key, sender: "sumi", type: "message", messages: lines, afterClose: [] }], { title: "スミさん", time: suffix === "morning" ? "大会当日の朝" : "大会の夜" });
  if (!live(owner)) return false;
  save();
  return !!state.inbox.find(item => item.id === key)?.done;
}
function checkpoint(stage) { progress().stage = stage; save(); }

export async function runChapterTwoTournament() {
  if (session) { session.active = false; session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, cs: null };
  document.body.classList.remove("ch2-city");
  document.body.classList.add("ch2-tournament");
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); }, { once: true });
  await perform(owner, async () => {
    // 全場面が揃うまでDAY14の保存や在庫を変更しない。
    const dialogues = await readDialogues(CHAPTER_DIALOGUE_FILES.ch2Tournament, REQUIRED);
    if (!live(owner)) return;
    Object.assign(DB.dialogues, Object.fromEntries(REQUIRED.map(key => [key, dialogues[key]])));
    recoverStep(state);
    save();
    await setBg(bgUrl("bg_tournament_stage", "day"), { instant: true });
    if (live(owner)) await drive(owner);
  });
}

function renderEntry(owner) {
  card(owner, "entry", "県大会の朝。", "はじめ・あげは・神崎竜二・REI。4人一斉、一台を仕上げる一発勝負。", [
    button(owner, "LIMEを読んで会場へ", "start", async () => { checkpoint("morning"); await drive(owner); }, true),
  ], [el("p.ch2-contest-note", { text: "課題はストロベリー。必要な葉は主催者支給。制作から提供、その後の調整まで同じ一台で行います。" })]);
}
function renderReady(owner) {
  card(owner, "ready", "一台で、最後まで。", "予選・準決勝はありません。提供後も、客席で吸われた一台を2回調整します。", [
    button(owner, "制作を始める", "craft-start", async () => {
      const p = progress();
      if (p.entry) restoreResources(state, p.entry);
      owner.cs = newSession("tournament");
      owner.cs.eventTitle = "HAZE: OPEN CLOUD";
      startAttempt(state, owner.cs); save();
      await drive(owner);
    }, true),
  ]);
}
function partialQuality(cs, round) {
  if (round === 3) return finalize(cs).total;
  const parts = [cs.holes.score, cs.heat.score];
  if (round >= 1) parts.push(computeShisha(cs).craftQuality);
  if (round >= 2) parts.push(cs.careHistory[0].score);
  return parts.reduce((sum, value) => sum + value, 0) / parts.length;
}
function contestantAvatar(who) {
  const icon = faceIconUrl(who), portrait = portraitInfo(who, "normal");
  const image = el("img", { src: icon || portrait?.src, alt: "" });
  // 顔アイコン未制作の2人も、既存立ち絵の頭部を同じ枠に収める。
  if (!icon && portrait) Object.assign(image.style, { width: "171px", height: "auto",
    left: `${18 - portrait.ax * 171}px`, top: `${2.7 - (1 - portrait.h - portrait.b) * 171 / portrait.aspect}px`, position: "absolute" });
  return el("span.ch2-contest-avatar", [image]);
}
function renderVotes(owner, final = false) {
  const p = progress(), rows = final ? p.result.rows : standings(p);
  const row = value => el("li.ch2-contest-rival", { dataset: { contestant: value.id } }, [
    el("b", { text: String(value.rank) }), contestantAvatar(value.id),
    el("span", { text: displayName(value.id, state) }), el("strong", { text: `${value.points} pt` }),
  ]);
  const judges = el("div.ch2-contest-judges", JUDGES.map(judge => {
    const spent = Object.values(p.votes[judge]).reduce((sum, n) => sum + n, 0);
    return el("div", { dataset: { judge, spent } }, [el("b", { text: displayName(judge, state) }),
      el("span", { text: `投入 ${spent} ／ 保留 ${10 - spent}` }),
      el("small", { text: CONTESTANTS.map(c => `${displayName(c, state)} ${p.votes[judge][c]}`).join(" ・ ") })]);
  }));
  card(owner, final ? "result" : "votes", final ? "県大会の結果" : "いま、動いた持ち点。",
    final ? `はじめは${p.result.rank}位。審査員3人、それぞれの10点が出揃いました。` : ["制作が終わり、次は吸い出しと提供。", "提供を終えた一台。次は客席での調整。", "一度目の調整を終え、同じ一台をもう一度確かめます。"][p.voted - 1], [
      button(owner, final ? "結果を受け止める" : "続きを作る", "continue", async () => {
        checkpoint(final ? p.result.rank === 1 ? "farewell" : "defeat" : "craft"); await drive(owner);
      }, true),
    ], [el("ol.ch2-contest-ranking", rows.map(row)), judges,
      el("p.ch2-contest-note", { text: "投入された点は戻りません。同点の場合は制作の総合評価で順位を決めます。" })]);
}
function renderDefeat(owner) {
  const p = progress(); broadcast.clearComments();
  card(owner, "defeat", p.failure ? "一台を、作り直そう。" : "県代表には届かなかった。",
    p.failure ? "提供できる状態を保てませんでした。大会に持ち込んだ材料と体力から、もう一度挑戦できます。" : "同じ大会の最初から再挑戦できます。失敗した挑戦の消費は持ち越しません。", [
      button(owner, "大会に再挑戦", "retry", async () => { checkpoint("ready"); renderReady(owner); }, true),
    ]);
}
function renderComplete(owner) {
  card(owner, "complete", "第二章・完", "優勝トロフィーと、東京行きの切符。味のしない舌は、そのままだった。", [
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], [el("p.ch2-contest-note", { text: "出会い、約束、恋人と過ごした日々は、記録に残っています。" })]);
}
function renderError(owner) {
  broadcast.clearComments();
  card(owner, "error", "県大会を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。確定した工程から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => runChapterTwoTournament(), true),
  ]);
}
async function drive(owner) {
  while (live(owner)) {
    const p = progress();
    if (p.stage === "entry") { renderEntry(owner); return; }
    if (p.stage === "morning") {
      if (!await message(owner, "morning", [
        state.flags._ch2_no_audience ? "今日は来ないでくれ、って話は聞いた。店で見てる" : "応援は届いてる。返事は終わってからでいい",
        "手順を確かめろ。無理なら止めていい。帰ったら飯にするぞ",
      ])) { if (live(owner)) renderEntry(owner); return; }
      checkpoint("lobby");
    } else if (p.stage === "lobby") {
      if (!await read(owner, "lobby")) return;
      markMet("ageha"); checkpoint("entrance");
    } else if (p.stage === "entrance") {
      if (!await read(owner, "entrance")) return;
      for (const who of ["kumicho", "rei", ...JUDGES]) markMet(who);
      state.flags._ch2_kumicho_public_reveal = true;
      checkpoint("rules");
    } else if (p.stage === "rules") {
      if (!await read(owner, "rules")) return;
      checkpoint("ready");
    } else if (p.stage === "ready") { renderReady(owner); return; }
    else if (p.stage === "craft") {
      owner.cs ||= clone(p.craft);
      const cs = owner.cs;
      playBgm("bgm_tournament_craft");
      hud(owner); openBench(cs, { steps: CRAFT_STEPS }); await waitBenchReady(cs);
      if (!live(owner)) return;
      const top = benchRoot(cs)?.querySelector(".bench-top");
      if (!top?.querySelector(`[data-test="${id("menu")}"]`)) top?.append(menuButton(owner));
      beginStep(state); save();
      broadcast.block(cs, STEP_IDS[p.step]);
      await STEPS[p.step](cs);
      if (!live(owner)) return;
      finishStep(state, cs);
      if (cs.failed) { save(); continue; }
      if (MILESTONES.has(p.step)) {
        broadcast.clearComments();
        const round = MILESTONES.get(p.step), quality = partialQuality(cs, round);
        // finalizeの完成品と2回のcareを同じcsに残し、追加投票だけを確定する。
        p.craft = clone(cs); castVotes(p, round, quality);
        p.stage = p.step === STEPS.length ? "result" : "votes";
        if (p.stage === "result") recordResult(state, cs.total);
      }
      save();
    } else if (p.stage === "votes") { renderVotes(owner); return; }
    else if (p.stage === "result") { playBgm("bgm_tournament_wait"); renderVotes(owner, true); return; }
    else if (p.stage === "defeat") { renderDefeat(owner); return; }
    else if (p.stage === "farewell") {
      state.phase = "aftermath"; state.slot = 1; save();
      if (!await read(owner, "farewell")) return;
      checkpoint("tasteless");
    } else if (p.stage === "tasteless") {
      if (!await read(owner, "tasteless")) return;
      state.flags._ch2_taste_distant = true;
      checkpoint("tokyo");
    } else if (p.stage === "tokyo") {
      if (!await message(owner, "tokyo", ["東京に行ったら、mukaiのムカイさんを頼れ", "──それと、飯はちゃんと食え"])) { if (live(owner)) card(owner, "tokyo", "東京への連絡", "スミさんからのLIMEを読んで、次の行き先を確かめよう。", [button(owner, "LIMEを開く", "tokyo-message", () => drive(owner), true)]); return; }
      state.flags._ch2_cleared = true; state.flags._ch2_tokyo_invitation = true;
      state.phase = "cleared"; checkpoint("complete");
    } else if (p.stage === "complete") { renderComplete(owner); return; }
    else throw new Error(`不明な県大会の保存地点: ${p.stage}`);
  }
}
