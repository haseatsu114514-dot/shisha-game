// カードゲーム「一台勝負」の画面。規則は ichidai-rules.js、CPUは ichidai-ai.js、カードは ichidai-data.js。
// 本編の #stage（1280×720）か、試遊ページの host に重ねて開く。本編の保存・進行・体力にはここでは触らない
// （結果を返すだけ。記録は呼び出し側が確定する）。
//
// 画面の作り（上から）: 相手（手札の裏・顔と点・のせた炭・炭焼き場）／審査の山・案内・ボタン／
// 自分の一台（熱の計り・ボウルとHMD・のせた炭・炭焼き場・山札）／自分の顔と点・手札。
// 卓に出すのは「いま打つ手に要るもの」だけ。詰めた葉・セッティングの文・審査カードの内訳・相手の葉は、
// それぞれの絵をタップして開く札に入れる（2026-11-11 オーナー指示: ピックした葉は出さない・狭くしない）。
// 操作はタップだけ（カードや炭を選ぶ → 出てくるボタンを押す）。遊び方は「？」から開く。
// 絵は ichidai-art.js が引く（このゲーム用の絵 → 本編の正規の絵 → 仮の線画の順）。
import { el } from "../core/util.js";
import { DB, faceFrame, portraitInfo } from "../core/data.js";
import { portraitAsset } from "../core/portrait-resolver.js";
import { SE, unlockAudio } from "../core/audio.js";
import { KINDS, FLAVOR, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENTS, KITS, KIT, TYPE_LABEL, WHEN_LABEL } from "./ichidai-data.js";
import { RULES, ZONE_LABEL, createGame, act, heatOf, leavesOf, firepower, sidesOf, slotsOf, roundsOf, sessionOf,
  judgedHeat, rawZone, scorchLineOf, scorePuff, puffPreview, unseenPuffs, packLimit,
  canPlay, canCharge, canPlace, canPutOn, canAsh, canPack, canSteam } from "./ichidai-rules.js";
import { aiAct } from "./ichidai-ai.js";
import { artUrl, flavorArt, cardArt, faceUrl, coalSprite, STOVE_ART, bowlArt, hmdArt, JUDGE_FACE } from "./ichidai-art.js";
import { HELP_PAGES } from "./ichidai-help.js";

export const ICHIDAI_TITLE = "一台勝負";
export const LEVELS = Object.freeze([{ id: 0, name: "やさしい" }, { id: 1, name: "ふつう" }, { id: 2, name: "つよい" }]);
const active = new WeakMap();
const sfx = (name) => { try { SE[name]?.(); } catch { /* 音は無くても遊べる */ } };
const sleep = (ms, signal) => new Promise((resolve) => { const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });
const ME = 0, CPU = 1;
const dhText = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
const zoneCls = (z) => (z === "offLo" || z === "offHi" ? "off" : z);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// ───────── 小さな部品 ─────────
/** 温度の帯（0〜10）を色だけで並べる。now に熱を渡すと、その位置に印を付ける */
function strip(flavorId, { now = null, line = null } = {}) {
  const f = FLAVOR[flavorId];
  return el("span.ichi-strip", { "aria-hidden": "true" }, Array.from({ length: 11 }, (_, h) =>
    el(`i.z-${zoneCls(rawZone(f, h, line ?? f.s))}`, { dataset: { now: h === now ? "1" : null } })));
}
const kindBadge = (kind) => el(`span.ichi-kind.k-${kind}`, { text: KINDS[kind].k, title: KINDS[kind].name });
/** 絵を置く。箱絵（mode:"box"）は元画像の中の箱の範囲だけを出す */
function artNode(art) {
  if (!art) return null;
  if (art.mode === "box") {
    const [iw, ih] = art.size, [x, y, w, h] = art.box;
    return el("span.ichi-boxart", { "aria-hidden": "true", style: { aspectRatio: `${w} / ${h}`, backgroundImage: `url("${art.url}")`,
      backgroundSize: `${(iw / w) * 100}% ${(ih / h) * 100}%`, backgroundPosition: `${iw === w ? 0 : (x / (iw - w)) * 100}% ${ih === h ? 0 : (y / (ih - h)) * 100}%` } });
  }
  return el(`img.ichi-artimg.m-${art.mode}`, { src: art.url, alt: "", draggable: "false", onerror: (e) => { e.currentTarget.style.visibility = "hidden"; } });
}
const flavorIcon = (id) => artNode(flavorArt(id)) || kindBadge(FLAVOR[id].kind);
/** 手札・詳細・相手が使った札に出す、デッキのカード */
function cardFace(id, { big = false } = {}) {
  const c = CARD[id], coal = c.type === "coal", art = cardArt(id);
  return el(`div.ichi-card.t-${c.type}${c.when === "puff" ? ".w-puff" : ""}${big ? ".is-big" : ""}`, { dataset: { card: id } }, [
    el(`div.ichi-card-art.m-${art?.mode || "none"}`, artNode(art) || el("span.ichi-glyph", { text: TYPE_LABEL[c.type].slice(0, 1) })),
    coal ? null : el(`span.ichi-gem${c.burn ? ".is-burn" : ""}`, { title: c.burn ? `燃焼${c.burn}` : `火力${c.cost}` }, el("b", { text: String(c.burn ?? c.cost) })),
    el("b.ichi-card-name", { text: c.name }),
    el("span.ichi-card-foot", coal ? [el("span.ichi-tag.is-ig", { text: `着火${c.ig}` }), el("span.ichi-tag.is-heat", { text: `熱${c.heat}` })]
      : [el("span.ichi-tag.is-type", { text: TYPE_LABEL[c.type] }), el(`span.ichi-tag.w-${c.when}`, { text: WHEN_LABEL[c.when] })]),
    big ? el("p.ichi-card-text", { text: c.tx }) : null,
  ]);
}
/** 炭ゾーンにのっている炭（表向き＝炭カード、裏向き＝種火） */
function coalNode(c, { tapped = false } = {}) {
  const cube = c.up && CARD[c.id].heat === 2;
  return el(`i.ichi-coal${c.up ? (cube ? ".is-cube" : ".is-flat") : ".is-ember"}${tapped ? ".is-tapped" : ""}`, { title: c.up ? `${CARD[c.id].name}（熱${CARD[c.id].heat}）` : "種火（熱1）" }, [
    el("img", { src: c.up ? coalSprite(cube ? "cube" : "flat", "hot") : coalSprite("flat", "warm"), alt: "", draggable: "false" }),
    cube ? el("b", { text: "2" }) : null]);
}
function faceNode(charId, name, cls = "") {
  const url = faceUrl(charId);
  const blank = () => el(`span.ichi-face.is-blank${cls}`, { text: name.slice(0, 1) });
  return url ? el(`img.ichi-face${cls}`, { src: url, alt: "", draggable: "false", onerror: (e) => { e.currentTarget.replaceWith(blank()); } }) : blank();
}

/**
 * @param host 重ねる要素（既定: #stage）
 * @param config 対戦の設定 { kit, opponentKit, tournament, level }。省くと設定の画面から始まる
 * @param opponent 相手の見せ方 { id（顔アイコンのキャラID）, name }
 * @param tutorial はじめに遊び方を開くか
 * @param pilot テスト・デモ用: "cpu" にすると自分の席もCPUが打つ
 * @param speed CPUの手と演出の早回し
 * 戻り値: { completed, cancelled, games:[{ winner（0=自分/1=相手/null=引き分け）, scores, votes, tournament, kit, level }], last }
 */
export function runIchidai({ host = document.getElementById("stage"), signal = null, seed = null, config = null, opponent = null,
  tutorial = false, pilot = null, speed = 1, allowRetry = true } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const games = [];
  const summary = (completed) => ({ completed, cancelled: !completed, games: games.map((g) => ({ ...g })), last: games.length ? { ...games.at(-1) } : null });
  if (signal?.aborted) return Promise.resolve(summary(false));
  let finish;
  const promise = new Promise((resolve) => { finish = resolve; });
  active.set(host, promise);

  const previousFocus = document.activeElement;
  const ctrl = new AbortController();
  const dead = () => ctrl.signal.aborted;
  let G = null, cfg = config ? { ...config } : null;
  let pending = null;            // 人の入力を待つ Promise の resolve
  const ui = { sel: null, picks: new Set(), counts: {}, note: "", toast: "", fast: false, sheet: null, peek: null, lastLog: 0, turnKey: null, foeMood: "normal" };
  const foe = { id: opponent?.id || null, name: opponent?.name || "相手" };

  const root = el("section.ichi-game", { role: "dialog", "aria-modal": "true", "aria-label": ICHIDAI_TITLE, tabindex: "-1", dataset: { test: "ichi-game", phase: "setup" } });
  const table = el("div.ichi-table");
  const sheet = el("div.ichi-sheet", { hidden: true });
  const live = el("p.ichi-live", { role: "status", "aria-live": "polite" });
  const fastBtn = el("button.ichi-round-btn.ichi-fast", { type: "button", hidden: true, "aria-label": "早送り", title: "早送り", "aria-pressed": "false", dataset: { test: "ichi-fast" },
    onclick: () => { ui.fast = !ui.fast; fastBtn.setAttribute("aria-pressed", String(ui.fast)); sfx("click"); } }, el("span", { text: "▶▶" }));
  const head = el("div.ichi-head-buttons", [fastBtn,
    el("button.ichi-round-btn", { type: "button", "aria-label": "遊び方", dataset: { test: "ichi-help" }, onclick: () => { sfx("select"); openHelp(); } }, el("span", { text: "？" })),
    el("button.ichi-round-btn", { type: "button", "aria-label": "やめる", dataset: { test: "ichi-close" }, onclick: () => { sfx("cancel"); askQuit(); } }, el("span", { text: "✕" })),
  ]);
  root.append(table, head, sheet, live);
  host.append(root);
  const arm = () => unlockAudio();
  root.addEventListener("pointerdown", arm); root.addEventListener("keydown", arm);
  // このゲーム用の卓・裏面の絵があれば差し替える（無ければ CSS の既定＝本編の夜紫UIの部品）
  for (const [name, kind, id] of [["--ichi-mat", "table", "mat"], ["--ichi-back-art", "back", "deck"], ["--ichi-judge-back-art", "back", "judge"]]) {
    const url = artUrl(kind, id);
    if (url) root.style.setProperty(name, `url("${url}")`);
  }

  function close(completed) {
    if (dead()) return;
    ctrl.abort(); pending?.(null);
    root.remove(); active.delete(host);
    if (window.__ichidai === hook) delete window.__ichidai;
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* 元の要素が無ければそのまま */ }
    finish(summary(completed));
  }
  signal?.addEventListener("abort", () => close(false), { once: true });
  window.addEventListener("pagehide", () => close(false), { once: true, signal: ctrl.signal });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); if (!sheet.hidden && (ui.sheet === "help" || ui.sheet === "info")) closeSheet(); else askQuit(); } });

  const submit = (action) => { const r = pending; pending = null; r?.(action); };
  // テスト・デモ用の入口: 自分の席もCPUに打たせて早回しする（ほかのミニゲームの window.__desertRide と同じ使い方）
  const hook = { autoplay: (fast = 12) => { pilot = "cpu"; speed = fast; if (pending && G && !G.over) submit(aiAct(G, G.wait.player)); else if (ui.sheet === "score") sheet.querySelector('[data-test="ichi-next"]')?.click(); },
    get game() { return G; } };
  window.__ichidai = hook;
  const human = (i) => i === ME && pilot !== "cpu";
  const say = (text) => { ui.toast = text; live.textContent = text; };
  // 試遊ページは本編の loadAll を通らない。立ち絵の測定値だけ同じ manifest から読む。
  const portraitReady = DB.manifest.faceFrames ? Promise.resolve() : fetch("data/manifest.json")
    .then((res) => { if (!res.ok) throw new Error(`manifest ${res.status}`); return res.json(); })
    .then((manifest) => { if (!dead() && !DB.manifest.faceFrames) DB.manifest = manifest; })
    .catch(() => {}); // 素材が無い場合は従来の顔アイコンを維持する
  function foePortrait() {
    if (!foe.id) return null;
    const faces = DB.manifest.portraits?.[foe.id]?.faces || [];
    const mood = [ui.foeMood, "normal"].find((f) => faces.includes(f));
    if (!mood) return null;
    const portrait = DB.characters[foe.id] ? portraitInfo(foe.id, mood, "classic") : portraitAsset(DB.manifest, foe.id, mood, "classic");
    const frame = portrait && faceFrame(portrait.folder, portrait.style);
    return frame?.eye && frame?.unit ? { portrait, frame } : null;
  }
  function foeBust(name) {
    const found = foePortrait();
    if (!found) return el("span.ichi-leader-ring", faceNode(foe.id, name));
    const { portrait, frame } = found;
    const scale = 0.46;
    return el("span.ichi-foe-bust", { dataset: { test: "ichi-foe-bust", face: portrait.face }, "aria-hidden": "true" },
      el("img", { src: portrait.src, alt: "", draggable: "false", style: {
        width: `${896 * scale}px`, left: `${108 - frame.eye[0] * scale}px`, top: `${27 - frame.eye[1] * scale}px`,
      }, onerror: (e) => { e.currentTarget.parentElement.replaceWith(el("span.ichi-leader-ring", faceNode(foe.id, name))); } }));
  }
  function setFoeMood(...choices) {
    const faces = DB.manifest.portraits?.[foe.id]?.faces || [];
    ui.foeMood = choices.find((f) => faces.includes(f)) || "normal";
  }

  // ───────── 設定の画面 ─────────
  function showSetup() {
    root.dataset.phase = "setup";
    const pick = { kit: cfg?.kit || "a", tournament: cfg?.tournament || "practice", level: cfg?.level ?? 1 };
    const draw = () => {
      const kits = KITS.map((k) => el(`button.ichi-pick.ichi-kit${pick.kit === k.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-kit-${k.id}` }, "aria-pressed": String(pick.kit === k.id),
        onclick: () => { pick.kit = k.id; sfx("select"); draw(); } }, [
        el("b", { text: k.name }),
        el("span.ichi-kit-art", [el("img", { src: bowlArt(k.bowl, true), alt: "" }), el("img", { src: hmdArt(k.hmd), alt: "" }), ...k.plan.map(([id]) => flavorIcon(id))]),
        el("span.ichi-kit-leaf", k.plan.map(([id, n]) => el("span", [kindBadge(FLAVOR[id].kind), `${FLAVOR[id].name} ${n}`]))),
        el("small", { text: `${BOWL[k.bowl].name} ＋ ${HMD[k.hmd].name}` }),
        el("span.ichi-kit-blurb", { text: k.blurb }),
      ]));
      const tours = TOURNAMENTS.map((t) => el(`button.ichi-pick.ichi-tour${pick.tournament === t.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-tour-${t.id}` }, "aria-pressed": String(pick.tournament === t.id),
        onclick: () => { pick.tournament = t.id; sfx("select"); draw(); } }, [el("b", { text: t.name }), el("small", { text: `${t.sessions * 3}ラウンド` }), el("span", { text: t.blurb })]));
      const levels = LEVELS.map((l) => el(`button.ichi-pick.ichi-level${pick.level === l.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-level-${l.id}` }, "aria-pressed": String(pick.level === l.id),
        onclick: () => { pick.level = l.id; sfx("select"); draw(); } }, [el("b", { text: l.name })]));
      table.replaceChildren(el("div.ichi-setup", [
        el("header.ichi-setup-head", [el("h1", { text: ICHIDAI_TITLE }), el("p", { text: "葉を詰め、炭で熱を保ち、審査員の一口を競う" })]),
        el("section", [el("h2", { text: "自分の一式" }), el("div.ichi-picks.is-kits", kits)]),
        el("section", [el("h2", { text: "大会" }), el("div.ichi-picks.is-tours", tours)]),
        el("section.ichi-setup-foot", [el("h2", { text: `${foe.name}の強さ` }), el("div.ichi-picks.is-levels", levels),
          el("button.ichi-btn.is-primary.ichi-start", { type: "button", text: "対戦をはじめる", dataset: { test: "ichi-start" }, onclick: () => { sfx("select"); cfg = { ...pick }; startGame(); } })]),
      ]));
    };
    draw();
    root.focus({ preventScroll: true });
  }
  // ───────── 対戦 ─────────
  async function startGame() {
    await portraitReady;
    if (dead()) return;
    const others = KITS.map((k) => k.id).filter((id) => id !== cfg.kit);
    const s = (seed ?? (Date.now() ^ (Math.random() * 0xffffffff))) >>> 0;
    const foeKit = cfg.opponentKit || others[s % others.length];
    G = createGame({ seed: s + games.length * 7919, tournament: cfg.tournament, market: cfg.market,
      players: [{ name: "はじめ", kit: cfg.kit, level: 2 }, { name: foe.name, kit: foeKit, ai: true, level: cfg.level }] });
    Object.assign(ui, { sel: null, picks: new Set(), counts: {}, note: "", toast: "", sheet: null, peek: null, lastLog: 0, turnKey: null, foeMood: "normal" });
    closeSheet(); root.dataset.phase = "play";
    if (tutorial && !games.length) { openHelp(); }
    await loop();
  }
  async function loop() {
    const mine = G;
    while (!dead() && G === mine) {
      render();
      if (G.over) { await showEnd(); return; }
      const w = G.wait;
      announceTurn(w);
      let action;
      if (human(w.player)) { action = await new Promise((resolve) => { pending = resolve; }); if (!action) return; }
      else { await sleep(cpuDelay(w), ctrl.signal); if (dead() || G !== mine) return; action = aiAct(G, w.player); }
      const before = G.log.length, priorScores = G.P.map((p) => p.score), r = act(G, action);
      if (!r.ok) { if (human(w.player)) { say(r.reason); sfx("cancel"); } else { console.error("ichidai: CPUの入力が通らない", action, r.reason); close(false); return; } continue; }
      ui.sel = null; ui.picks = new Set(); ui.counts = {}; ui.toast = "";
      if (!human(w.player) && G.log.length > before) ui.note = G.log.at(-1).text;
      await playEvents(priorScores);
    }
  }
  const cpuDelay = (w) => (ui.fast || pilot === "cpu" ? 40 : w.type === "embers" || w.type === "wear" || w.type === "discard" ? 260 : 620) / speed;
  const quick = () => ui.fast || pilot === "cpu";

  /** ターンが替わったら、卓の中央に帯を一度だけ流す（だれの番かを目で分かるように） */
  function announceTurn(w) {
    if (!w || !(w.type === "prep" || w.type === "cool" || w.type === "main")) return;
    const key = `${G.phase}:${G.prepTurn}:${G.round}:${G.serveStep}:${w.player}`;
    if (ui.turnKey === key) return;
    ui.turnKey = key;
    if (quick()) return;
    const mine = human(w.player);
    flash(mine ? "あなたのターン" : `${G.P[w.player].name}のターン`, mine ? "is-me" : "is-foe");
    if (mine) sfx("select");
  }
  function flash(text, cls) {
    root.querySelector(".ichi-banner")?.remove();
    const node = el(`div.ichi-banner.${cls}`, { "aria-hidden": "true" }, el("b", { text }));
    root.append(node);
    setTimeout(() => node.remove(), 1150);
  }
  /** 点が入ったところに、数字を浮かせる */
  function floatText(who, text) {
    const node = el(`div.ichi-float.is-${who}`, { "aria-hidden": "true", text });
    root.append(node);
    setTimeout(() => node.remove(), 1500);
  }

  function pulseTarget(selector, cls) {
    if (quick() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = root.querySelector(selector);
    if (!target) return;
    target.classList.remove(cls); void target.offsetWidth; target.classList.add(cls);
    setTimeout(() => target.classList.remove(cls), 650);
  }
  function flyCard(ev) {
    if (quick() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = el(`div.ichi-card-flight.is-${ev.p === ME ? "me" : "foe"}`, { "aria-hidden": "true" }, cardFace(ev.id));
    root.append(node); setTimeout(() => node.remove(), 650);
  }
  async function playEvents(priorScores) {
    const evs = G.events.splice(0);
    for (const ev of evs) {
      if (dead()) return;
      if (ev.t === "reveal") { sfx("card"); render(); await showReveal(ev.puff); }
      else if (ev.t === "score") {
        const foeResult = ev.res[CPU], swing = priorScores[CPU] <= priorScores[ME] && G.P[CPU].score > G.P[ME].score;
        setFoeMood(...(foeResult.zone === "scorch" ? ["sad", "shock", "serious"] : swing ? ["surprise", "excited", "smile"]
          : foeResult.zone === "just" ? ["excited", "smile", "surprise"] : ev.voter === CPU ? ["smile", "smug"]
            : ev.voter === ME ? ["sad", "serious"] : foeResult.pts > ev.res[ME].pts ? ["smile", "smug"] : ["serious", "normal"]));
        render(); await showScore(ev);
      }
      else if (ev.t === "peek" && human(ev.p)) { ui.peek = ev.puff; sfx("card"); }
      else if (ev.t === "play") { sfx("card"); render(); flyCard(ev); if (!human(ev.p)) await showPlayed(ev); }
      else if (ev.t === "charge" || ev.t === "puton") sfx("click");
      if (["puton", "flip", "ash", "place"].includes(ev.t)) { render(); pulseTarget(ev.t === "place" ? `.ichi-stove${ev.p === CPU ? ".is-small" : ":not(.is-small)"}` : ev.p === CPU ? ".ichi-foe-rig" : ".ichi-zone", `fx-${ev.t}`); }
    }
  }
  /** 相手が使ったカードを、卓の中央に大きく見せる */
  async function showPlayed(ev) {
    if (quick()) return;
    const node = el("div.ichi-played", { dataset: { test: "ichi-played" } }, [el("small", { text: `${G.P[ev.p].name}が使った` }), cardFace(ev.id, { big: true })]);
    root.append(node);
    await wait(1150);
    node.remove();
  }

  // ───────── 描画 ─────────
  function render() {
    if (!G || dead()) return;
    const w = G.wait, me = G.P[ME], op = G.P[CPU], myTurn = !!w && human(w.player);
    root.dataset.phase = G.over ? "end" : G.phase;
    root.dataset.wait = w ? w.type : "";
    root.dataset.turn = w ? (w.player === ME ? "me" : "foe") : "";
    fastBtn.hidden = G.over || pilot === "cpu"; fastBtn.setAttribute("aria-pressed", String(ui.fast));
    table.replaceChildren(...[foeZone(op), midRow(me, op, w), prepMarket(me, w, myTurn), myZone(me, w, myTurn), handRow(me, w, myTurn)].filter(Boolean));
  }

  /** 顔・名前・点・票。タップでその人の一台（葉・セッティング・出しているカード）を開く */
  function leader(p, who) {
    const mine = who === "me";
    return el(`button.ichi-leader.is-${who}${G.active === p.index && !G.over ? ".is-active" : ""}`, { type: "button", dataset: { test: `ichi-score-${who}`, score: String(p.score), votes: String(p.votes) },
      "aria-label": `${mine ? "あなた" : p.name} ${p.score}点 票${p.votes}。一台を見る`, onclick: () => { sfx("select"); openRig(p, mine); } }, [
      mine ? el("span.ichi-leader-ring", faceNode("hajime", p.name)) : foeBust(p.name),
      el("span.ichi-leader-plate", [
        el("span.ichi-leader-name", { text: mine ? "あなた" : p.name }),
        el("span.ichi-leader-score", [el("b", { text: String(p.score) }), el("small", { text: "点" })]),
        el("span.ichi-leader-votes", [el("i.ichi-medal"), el("b", { text: `票 ${p.votes}` })]),
      ]),
    ]);
  }
  /** 出している器具・人物（小さな札）。数字は風防の残り */
  function permanents(p, mine) {
    const list = [...p.tools.map((id) => ({ id, n: id === "windguard" ? p.wind : null })), ...(p.person ? [{ id: p.person, n: null }] : [])];
    return list.map(({ id, n }) => el(`button.ichi-perm.t-${CARD[id].type}`, { type: "button", "aria-label": `${CARD[id].name}：${CARD[id].tx}`, title: `${CARD[id].name}：${CARD[id].tx}`,
      onclick: () => { sfx("select"); openRig(p, mine); } }, [artNode(cardArt(id)), n != null ? el("b", { text: String(n) }) : null]));
  }
  const modChips = (p) => [
    p.pend ? el("span.ichi-chip.is-warn", { text: `次の一口 ${dhText(p.pend)}` }) : null,
    p.sessMod ? el("span.ichi-chip", { text: `寄せ ${dhText(p.sessMod)}` }) : null,
  ];

  // 相手
  function foeZone(op) {
    const tapped = Math.min(op.spent, op.zone.length), n = op.hand.length, h = heatOf(op);
    return el("div.ichi-foe", { dataset: { test: "ichi-foe" } }, [
      el("div.ichi-foe-left", [
        el("div.ichi-foe-hand", { title: `相手の手札 ${n}枚` }, [...Array.from({ length: Math.min(n, 8) }, () => el("i.ichi-back")), el("b.ichi-count", { text: String(n) })]),
        el("div.ichi-perms", permanents(op, false)),
        el("div.ichi-mods", modChips(op)),
      ]),
      leader(op, "foe"),
      el("div.ichi-foe-right", [
        el("div.ichi-foe-rig", [
          el("div.ichi-foe-heat", [el("small", { text: "熱" }), el("b", { text: String(h) }), op.main ? strip(op.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(op) }) : null]),
          el("div.ichi-coals.is-small", op.zone.map((c, i) => coalNode(c, { tapped: i < tapped }))),
        ]),
        stoveBox(op, false),
      ]),
    ]);
  }
  /** 炭焼き場（コンロの上に4つまで）。自分の焼けた炭はタップでのせる */
  function stoveBox(p, mine) {
    const cells = Array.from({ length: slotsOf(p) }, (_, i) => {
      const c = p.stove[i];
      if (!c) return el("i.ichi-slot");
      const ready = c.stage === 2, cube = CARD[c.id].heat === 2, left = 2 - c.stage;
      const can = mine && G.wait && human(G.wait.player) && canPutOn(G, p, i).ok;
      return el(`button.ichi-stove-coal${ready ? ".is-ready" : ""}${can ? ".can" : ""}`, { type: "button", disabled: !can, title: `${CARD[c.id].name}：${ready ? "焼けた" : `あと${left}ターン`}`,
        dataset: { test: mine ? `ichi-stove-${i}` : null }, onclick: () => { if (can) { sfx("click"); submit({ type: "puton", stove: i }); } } }, [
        el("img", { src: coalSprite(cube ? "cube" : "flat", ready ? "hot" : c.stage === 1 ? "warm" : "cold"), alt: "", draggable: "false" }),
        mine ? el("small", { text: ready ? "のせる" : `あと${left}` }) : null]);
    });
    return el(`div.ichi-stove${mine ? "" : ".is-small"}`, { dataset: { test: mine ? "ichi-stove" : "ichi-foe-stove", count: String(p.stove.length) } }, [
      el("img.ichi-stove-art", { src: STOVE_ART, alt: "", draggable: "false" }), el("div.ichi-stove-grid", cells), mine ? el("small.ichi-label", { text: "炭焼き場" }) : null]);
  }

  // 中央: 審査の山・案内・ボタン
  function midRow(me, op, w) {
    const rounds = roundsOf(G), serve = G.phase === "serve", judges = G.tour.judges;
    const phaseName = G.phase === "embers" ? "最初の火" : G.phase === "prep" ? `準備 ${w ? w.n ?? "" : ""}/${RULES.prepTurns}` : `ラウンド ${Math.min(G.round + 1, rounds)}/${rounds}`;
    const pips = serve ? el("span.ichi-pips", { "aria-hidden": "true" }, Array.from({ length: rounds }, (_, i) => el(`i${i < G.round ? ".is-done" : i === G.round ? ".is-now" : ""}${i % 3 === 2 ? ".is-gap" : ""}`))) : null;
    const pile = !serve ? null : el("button.ichi-pile", { type: "button", dataset: { test: "ichi-pile", left: String(judges.length ? G.pile.length : 0) }, "aria-label": "審査カードの残りと審査員を見る",
      onclick: () => { sfx("select"); openJudges(); } }, [
      el("i.ichi-back.is-judge"), judges.length ? el("b.ichi-count", { text: String(G.pile.length) }) : null, el("small", { text: judges.length ? "審査の山" : "練習" })]);
    const peek = ui.peek && serve && !G.judge ? el("span.ichi-peek", { dataset: { test: "ichi-peek" } }, [el("small", { text: "読んだ" }), el("b", { text: `${ui.peek.style} ${dhText(ui.peek.dh)}` })]) : null;
    const { lines, buttons } = guide(me, op, w);
    return el("div.ichi-mid", [
      el("div.ichi-judge", [pile, el("div.ichi-clock", [
        el("b", { text: phaseName, dataset: { test: "ichi-phase" } }), pips,
        el("small", { text: serve ? `${G.order?.[0] === ME ? "あなた" : op.name}が先手` : G.tour.name }),
        judges.length ? el("span.ichi-judges", judges.map((id) => faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"))) : null,
        peek,
      ])]),
      el("div.ichi-guide", { dataset: { test: "ichi-guide" } }, lines),
      el("div.ichi-actions", buttons),
    ]);
  }

  /** いま何をすればよいか（短い一文）と、できることのボタン */
  function guide(me, op, w) {
    const lines = [], buttons = [];
    const btn = (text, action, { primary = false, test = null, disabled = false, title = null } = {}) =>
      buttons.push(el(`button.ichi-btn${primary ? ".is-primary" : ""}`, { type: "button", text, disabled, title, dataset: { test }, onclick: () => { sfx("select"); typeof action === "function" ? action() : submit(action); } }));
    if (!w) return { lines, buttons };
    if (!human(w.player)) {
      lines.push(el("b", { text: `${op.name}の番` })); if (ui.note) lines.push(el("span", { text: ui.note }));
    } else if (w.type === "embers") {
      lines.push(el("b", { text: "最初の火" }), el("span", { text: `手札から${RULES.startEmbers}枚選んで種火にする（${ui.picks.size}/${RULES.startEmbers}）` }));
      btn("種火にする", { type: "embers", picks: [...ui.picks] }, { primary: true, test: "ichi-embers", disabled: ui.picks.size !== RULES.startEmbers });
    } else if (w.type === "prep") {
      const mode = me.turn.mode, total = sum(ui.counts);
      if (!mode) {
        const cp = canPack(G, me), cs = canSteam(G, me);
        lines.push(el("b", { text: "準備：詰めるか、蒸らすか" }), el("span", { text: cp.ok ? `葉を選ぶ（${total}/${packLimit(G, me)}枚・2種類まで）` : cp.reason }));
        btn(`詰める${total ? `（${total}枚）` : ""}`, { type: "pack", picks: { ...ui.counts } }, { primary: true, test: "ichi-pack", disabled: !cp.ok || !total });
        btn("蒸らす", { type: "steam" }, { test: "ichi-steam", disabled: !cs.ok, title: cs.ok ? "1枚引いて、炭に触れる" : cs.reason });
        if (!cp.ok && !cs.ok) btn("ターンを終える", { type: "end" }, { test: "ichi-end" });
      } else {
        lines.push(el("b", { text: mode === "steam" ? "蒸らす：炭を置く・のせる・チャージ" : "詰めた" }), el("span", { text: mode === "steam" ? `熱${heatOf(me)}。終わったらターンを終える` : "カードを使うか、ターンを終える" }));
        btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
      }
    } else if (w.type === "cool") {
      lines.push(el("b", { text: `冷める：弱める炭を選ぶ（あと${w.left}）` }), el("span", { text: "炭カードは裏返る・種火は灰になる" }));
      if (me.wind > 0) btn(`風防で受ける（残り${me.wind}）`, { type: "cool", wind: true }, { test: "ichi-wind" });
    } else if (w.type === "main") {
      lines.push(el("b", { text: "あなたのターン" }), el("span", { text: "炭とカードで熱を整えたら、ターンを終える" }), outlook(me));
      btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
    } else if (w.type === "discard") {
      const need = me.hand.length - RULES.handMax;
      lines.push(el("b", { text: "手札は7枚まで" }), el("span", { text: `灰にする${need}枚を選ぶ（${ui.picks.size}/${need}）` }));
      btn("灰にする", { type: "discard", picks: [...ui.picks] }, { primary: true, test: "ichi-discard", disabled: ui.picks.size !== need });
    } else if (w.type === "react") {
      const pv = puffPreview(G, me);
      lines.push(el("b", { text: "審査：一口の技を使える" }), el("span.ichi-preview", { dataset: { test: "ichi-preview", zone: pv.zone } }, [`判定熱 ${pv.h} → `, el(`i.z-${pv.zone}`, { text: ZONE_LABEL[pv.zone] }), ` ${pv.pts}点`]));
      btn("このまま受ける", { type: "pass" }, { primary: true, test: "ichi-pass" });
    } else if (w.type === "wear") {
      const total = sum(ui.counts);
      lines.push(el("b", { text: `セッションの区切り：葉を${w.n}枚減らす（${total}/${w.n}）` }), wearPicker(me, w, total));
      btn("減らす", { type: "wear", picks: { ...ui.counts } }, { primary: true, test: "ichi-wear", disabled: total !== w.n });
    } else if (w.type === "weaken") {
      lines.push(el("b", { text: "すきま風" }), el("span", { text: "弱める炭を1つ選ぶ" }));
    }
    if (ui.toast) lines.push(el("em.ichi-toast", { text: ui.toast, dataset: { test: "ichi-toast" } }));
    return { lines, buttons };
  }
  /** セッションの区切りに減らす葉を選ぶ（詰めた葉はふだん卓に出さないので、ここでだけ並べる） */
  function wearPicker(me, w, total) {
    const sd = sidesOf(me);
    return el("span.ichi-wear", { dataset: { test: "ichi-wear-picker" } }, Object.entries(me.bowl).sort((a, b) => (a[0] === me.main ? -1 : b[0] === me.main ? 1 : b[1] - a[1])).map(([id, n]) => {
      const cut = ui.counts[id] || 0;
      return el(`button.ichi-leaf.can.k-${FLAVOR[id].kind}`, { type: "button", dataset: { test: `ichi-leaf-${id}` }, "aria-label": `${FLAVOR[id].name} ${n - cut}枚。1枚減らす`,
        onclick: () => { ui.counts[id] = total >= w.n || cut >= n ? 0 : cut + 1; sfx("click"); render(); } },
        [flavorIcon(id), el("span", { text: `${FLAVOR[id].name} ×${n - cut}` }), cut ? el("b", { text: `−${cut}` }) : null, id === me.main ? el("small", { text: "主役" }) : sd.includes(id) ? el("small", { text: "脇役" }) : null]);
    }));
  }

  /** いまの熱のまま審査を受けたら、吸い方ごとにどの帯になるか（読んだカードがあればそれだけ） */
  function outlook(me) {
    if (!me.main) return null;
    const seen = new Map();
    for (const q of (ui.peek ? [ui.peek] : unseenPuffs(G))) if (!seen.has(q.id)) seen.set(q.id, q);
    const chips = [...seen.values()].sort((a, b) => a.dh - b.dh).map((q) => {
      const h = judgedHeat(me, q), s = scorePuff(me, h, q, {});
      return el(`i.ichi-outlook-chip.z-${s.zone}`, { title: `${q.style}：判定熱${h}・${ZONE_LABEL[s.zone]}・${s.pts}点` }, [el("b", { text: q.style.replace("に吸う", "").replace("吸う", "") }), `${ZONE_LABEL[s.zone]}${s.pts}`]);
    });
    return el("span.ichi-outlook", { dataset: { test: "ichi-outlook" } }, [el("small", { text: "このままなら" }), ...chips]);
  }

  // 自分の一台
  function myZone(me, w, myTurn) {
    const h = heatOf(me), f = me.main ? FLAVOR[me.main] : null, serve = G.phase === "serve";
    const judged = G.judge && me.puff ? judgedHeat(me, G.judge, me.puff.tk) : null;
    // セッティングやカードでいつも足される分（アマバースト・寄せ・煽り）を入れた、ふつうに吸われたときの判定熱
    const base = judgedHeat(me, PUFFS.normal);
    const line = scorchLineOf(me);
    const thermo = el("div.ichi-thermo", { dataset: { test: "ichi-pillar", heat: String(h) }, "aria-label": `熱 ${h}` }, [
      el("div.ichi-thermo-body", [
        el("div.ichi-thermo-tube", Array.from({ length: 11 }, (_, k) => {
          const v = 10 - k, z = f ? zoneCls(rawZone(f, v, line)) : "cold";
          return el(`i.z-${z}${v === h ? ".is-now" : ""}${v === base && base !== h && judged === null ? ".is-base" : ""}${v === judged ? ".is-judged" : ""}`, { text: f && z === "just" ? "★" : String(v) });
        })),
        el("i.ichi-thermo-frame"),
      ]),
      el("div.ichi-thermo-read", [el("small", { text: "熱" }), el("b", { text: String(h) }), base !== h ? el("small.ichi-thermo-base", { text: `判定 ${base}` }) : null, el("small", { text: `火力 ${firepower(me)}` })]),
    ]);
    const grams = leavesOf(me);
    const rig = el("button.ichi-rig", { type: "button", dataset: { test: "ichi-bowl", leaves: Object.entries(me.bowl).map(([id, n]) => `${id}:${n}`).join(",") },
      "aria-label": "自分の一台（葉とセッティング）を見る", onclick: () => { sfx("select"); openRig(me, true); } }, [
      el("img.ichi-rig-bowl", { src: bowlArt(me.bowlId, grams > 0), alt: "", draggable: "false" }),
      el("img.ichi-rig-hmd", { src: hmdArt(me.hmd), alt: "", draggable: "false" }),
      el("b.ichi-grams", { text: serve ? `${grams}g` : `${grams}/${BOWL[me.bowlId].cap}g` }),
      // 準備のあいだだけ、詰めた葉を小さく並べる（次に何を足すか決めるのに要る）。提供に入ったら出さない
      !serve && grams ? el("span.ichi-packed", Object.entries(me.bowl).map(([id, n]) => el("span", { title: `${FLAVOR[id].name} ×${n}` }, [flavorIcon(id), el("b", { text: `×${n}` })]))) : null,
    ]);
    const coolPick = myTurn && (w.type === "cool" || w.type === "weaken"), ashPick = myTurn && w.type === "main";
    const tapped = Math.min(me.spent, me.zone.length);
    const zone = el("div.ichi-zone", { dataset: { test: "ichi-zone" } }, [
      el("div.ichi-coals", me.zone.map((c, i) => el(`button.ichi-coal-btn${coolPick ? ".can" : ""}${ui.sel?.type === "zone" && ui.sel.i === i ? ".is-sel" : ""}`, { type: "button", disabled: !(coolPick || ashPick), dataset: { test: `ichi-coal-${i}`, up: c.up ? "1" : "0" },
        onclick: () => {
          if (coolPick) { sfx("click"); submit({ type: w.type, zone: i }); }
          else if (ashPick) { ui.sel = ui.sel?.type === "zone" && ui.sel.i === i ? null : { type: "zone", i }; sfx("click"); render(); }
        } }, coalNode(c, { tapped: i < tapped })))),
      el("small.ichi-label", { text: "炭ゾーン" }),
    ]);
    const side = el("div.ichi-side", [
      el("div.ichi-deck", { title: `山札 ${me.deck.length}枚` }, [el("i.ichi-back"), el("b.ichi-count", { text: String(me.deck.length) }), el("small", { text: "山札" })]),
      el("div.ichi-perms", permanents(me, true)),
      el("div.ichi-mods", modChips(me)),
    ]);
    return el("div.ichi-mine", [thermo, el("div.ichi-fire", [rig, zone]), stoveBox(me, true), side]);
  }
  // 準備: フレーバー場
  function prepMarket(me, w, myTurn) {
    if (G.phase !== "prep" && G.phase !== "embers") return null;
    const canPick = myTurn && w.type === "prep" && !me.turn.mode && canPack(G, me).ok;
    const total = sum(ui.counts), kinds = Object.keys(ui.counts).filter((k) => ui.counts[k] > 0);
    return el("div.ichi-market", { dataset: { test: "ichi-market" } }, G.market.map((id) => {
      const f = FLAVOR[id], left = G.supply[id] - (ui.counts[id] || 0), n = ui.counts[id] || 0;
      const can = canPick && left > 0 && total < packLimit(G, me) && (n > 0 || kinds.length < 2);
      return el(`div.ichi-pile-card.k-${f.kind}${n ? ".is-on" : ""}`, { dataset: { test: `ichi-market-${id}` } }, [
        el("button.ichi-pile-main", { type: "button", disabled: !can, title: f.ab || f.name,
          onclick: () => { ui.counts[id] = n + 1; sfx("click"); render(); } }, [
          el("span.ichi-pile-art", artNode(flavorArt(id)) || el("span.ichi-glyph", { text: KINDS[f.kind].k })),
          el("b.ichi-pile-name", { text: f.name }),
          strip(id),
          el("span.ichi-pile-foot", [kindBadge(f.kind), el("span.ichi-taste", [el("small", { text: "味" }), String(f.t)]), el("small", { text: `適温${f.lo}〜${f.hi}` })]),
          el("span.ichi-pile-foot", [el("small", { text: `残${left}` }), f.pair !== "none" ? el("small.ichi-pair", ["相性", kindBadge(f.pair)]) : null]),
        ]),
        n ? el("button.ichi-pile-minus", { type: "button", "aria-label": `${f.name}を1枚戻す`, text: `${n}枚 −`, onclick: () => { ui.counts[id] = n - 1; sfx("click"); render(); } }) : null,
      ]);
    }));
  }

  // 自分の顔と点・手札
  function handRow(me, w, myTurn) {
    const multi = myTurn && (w.type === "embers" || w.type === "discard");
    const sel = ui.sel?.type === "hand" ? ui.sel.i : -1;
    const n = me.hand.length, room = 728, cardW = 112, gap = 8;
    const overlap = n > 1 && n * cardW + (n - 1) * gap > room ? Math.ceil((n * cardW - room) / (n - 1)) : -gap;
    const cards = me.hand.map((id, i) => {
      const coal = CARD[id].type === "coal";
      const usable = myTurn && (coal ? canPlace(G, me, id).ok : canPlay(G, me, id).ok);
      const on = multi ? ui.picks.has(i) : sel === i;
      return el(`button.ichi-hand-card${on ? ".is-sel" : ""}${usable ? ".can" : ""}`, { type: "button", disabled: !myTurn, style: { marginLeft: i ? `${-overlap}px` : null }, dataset: { test: `ichi-hand-${i}`, card: id },
        "aria-label": `${CARD[id].name}：${CARD[id].tx}`,
        onclick: () => {
          if (multi) { ui.picks.has(i) ? ui.picks.delete(i) : ui.picks.add(i); }
          else ui.sel = sel === i ? null : { type: "hand", i };
          sfx("click"); render();
        } }, cardFace(id));
    });
    return el("div.ichi-hand-row", [leader(me, "me"), el("div.ichi-hand", { dataset: { test: "ichi-hand" } }, cards), detail(me, w, myTurn)]);
  }
  /** 選んだカード・炭の詳しい文と、できること */
  function detail(me, w, myTurn) {
    if (!ui.sel || !myTurn) return null;
    const buttons = [];
    const btn = (text, action, ok, { primary = false, test = null } = {}) => buttons.push(el(`button.ichi-btn.is-small${primary ? ".is-primary" : ""}`, { type: "button", text, disabled: !ok.ok, title: ok.ok ? null : ok.reason, dataset: { test },
      onclick: () => { sfx("select"); submit(action); } }));
    if (ui.sel.type === "zone") {
      const c = me.zone[ui.sel.i]; if (!c) return null;
      btn("灰にする（熱を下げる）", { type: "ash", zone: ui.sel.i }, canAsh(G, me), { test: "ichi-do-ash" });
      return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [el("div.ichi-detail-text", [el("b", { text: c.up ? CARD[c.id].name : "種火" }), el("p", { text: c.up ? CARD[c.id].tx : "裏向きの炭。熱1。冷めるときに選ぶと灰になる。" })]), el("div.ichi-detail-buttons", buttons)]);
    }
    const i = ui.sel.i, id = me.hand[i]; if (!id) return null;
    const c = CARD[id], coal = c.type === "coal";
    const reasons = [];
    if (coal) { const r = canPlace(G, me, id); btn("炭焼き場に置く", { type: "place", hand: i }, r, { primary: true, test: "ichi-do-place" }); if (!r.ok) reasons.push(r.reason); }
    else { const r = canPlay(G, me, id); btn(c.burn ? `使う（燃焼${c.burn}）` : `使う（火力${c.cost}）`, { type: "play", hand: i }, r, { primary: true, test: "ichi-do-play" }); if (!r.ok) reasons.push(r.reason); }
    if (w.type === "main" || w.type === "prep") btn("チャージ（熱+1）", { type: "charge", hand: i }, canCharge(G, me), { test: "ichi-do-charge" });
    return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [
      el("div.ichi-detail-text", [el("b", { text: c.name }), el("small", { text: coal ? `炭・着火${c.ig}ターン・熱${c.heat}` : `${TYPE_LABEL[c.type]}・${WHEN_LABEL[c.when]}・${c.burn ? `燃焼${c.burn}` : `火力${c.cost}`}` }), el("p", { text: c.tx }),
        reasons.length ? el("em", { text: reasons[0] }) : null]),
      el("div.ichi-detail-buttons", buttons),
    ]);
  }

  // ───────── 重ねる札（一台・審査員・審査・結果・遊び方・やめる） ─────────
  function openSheet(kind, node) { ui.sheet = kind; sheet.replaceChildren(node); sheet.hidden = false; sheet.dataset.kind = kind; }
  function closeSheet() { ui.sheet = null; sheet.hidden = true; sheet.replaceChildren(); }
  const wait = (ms) => quick() ? Promise.resolve() : sleep(ms / speed, ctrl.signal);
  const closeInfo = () => el("button.ichi-btn.is-primary", { type: "button", text: "とじる", dataset: { test: "ichi-info-close" }, onclick: () => { sfx("select"); if (ui.sheet === "info") closeSheet(); } });
  /** その人の一台: セッティング・詰めた葉・出しているカード（卓には出していない細かい情報） */
  function openRig(p, mine) {
    if (ui.sheet && ui.sheet !== "info") return; // 審査・結果・遊び方の上には重ねない
    const sd = sidesOf(p), f = p.main ? FLAVOR[p.main] : null, h = heatOf(p);
    const leaves = Object.entries(p.bowl).sort((a, b) => (a[0] === p.main ? -1 : b[0] === p.main ? 1 : b[1] - a[1]));
    const perms = [...p.tools, ...(p.person ? [p.person] : [])];
    openSheet("info", el("div.ichi-info", { dataset: { test: "ichi-info-sheet", who: mine ? "me" : "foe" } }, [
      el("header", [faceNode(mine ? "hajime" : foe.id, p.name), el("div", [el("h2", { text: mine ? "あなたの一台" : `${p.name}の一台` }), el("small", { text: KIT[p.kit]?.name || "" })])]),
      el("div.ichi-info-set", [
        el("div", [el("img", { src: bowlArt(p.bowlId, leavesOf(p) > 0), alt: "" }), el("div", [el("b", { text: `${BOWL[p.bowlId].name}（${leavesOf(p)}/${BOWL[p.bowlId].cap}g）` }), el("p", { text: BOWL[p.bowlId].ab })])]),
        el("div", [el("img", { src: hmdArt(p.hmd), alt: "" }), el("div", [el("b", { text: HMD[p.hmd].name }), el("p", { text: HMD[p.hmd].ab })])]),
      ]),
      f ? el("div.ichi-info-main", [el("b", { text: `主役 ${f.name}` }), el("span.ichi-taste", [el("small", { text: "味" }), String(f.t)]),
        el("small", { text: `適温${f.lo}〜${f.hi}・ジャスト${f.j.join("・") || "なし"}・焦げ${scorchLineOf(p) > 10 ? "なし" : `${scorchLineOf(p)}以上`}` }),
        strip(p.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(p) })]) : el("p.ichi-empty", { text: "葉はまだ詰めていない" }),
      leaves.length ? el("div.ichi-info-leaves", leaves.map(([id, n]) => el(`span.ichi-leaf.k-${FLAVOR[id].kind}`, { title: FLAVOR[id].ab || FLAVOR[id].name }, [flavorIcon(id), el("span", { text: `${FLAVOR[id].name} ×${n}` }),
        id === p.main ? el("small", { text: "主役" }) : sd.includes(id) ? el("small", { text: "脇役" }) : null]))) : null,
      perms.length ? el("ul.ichi-info-perms", perms.map((id) => el("li", [artNode(cardArt(id)), el("b", { text: CARD[id].name + (id === "windguard" ? `（残り${p.wind}）` : "") }), el("span", { text: CARD[id].tx })]))) : null,
      closeInfo(),
    ]));
    sheet.querySelector("button")?.focus({ preventScroll: true });
  }
  /** 審査員と決め手、審査カードの山に残っている吸い方 */
  function openJudges() {
    if (ui.sheet && ui.sheet !== "info") return;
    const judges = G.tour.judges, tally = new Map();
    for (const q of (judges.length ? unseenPuffs(G) : [])) tally.set(q.id, (tally.get(q.id) || 0) + 1);
    openSheet("info", el("div.ichi-info", { dataset: { test: "ichi-info-sheet", who: "judges" } }, [
      el("header", [el("i.ichi-back.is-judge"), el("div", [el("h2", { text: judges.length ? `審査カード 残り${G.pile.length}枚` : "練習試合" }), el("small", { text: `${G.tour.name}・セッション ${sessionOf(G) + 1}/${G.tour.sessions}` })])]),
      judges.length ? el("div.ichi-info-puffs", [...tally].sort((a, b) => PUFFS[a[0]].dh - PUFFS[b[0]].dh).map(([id, n]) =>
        el(`span.ichi-puff-chip${PUFFS[id].dh > 0 ? ".is-up" : PUFFS[id].dh < 0 ? ".is-down" : ""}`, [el("b", { text: dhText(PUFFS[id].dh) }), el("span", { text: `${PUFFS[id].style} ×${n}` }), el("small", { text: PUFFS[id].tx })])))
        : el("p", { text: "審査カードは使わない。毎回「ふつうに吸う」。" }),
      judges.length ? el("ul.ichi-info-perms", judges.map((id) => el("li", [faceNode(JUDGE_FACE[id], JUDGE[id].name, ".is-judge"), el("b", { text: JUDGE[id].name }), el("span", { text: `決め手：${JUDGE[id].bonus}` })]))) : null,
      closeInfo(),
    ]));
    sheet.querySelector("button")?.focus({ preventScroll: true });
  }
  function puffCard(q) {
    return el(`div.ichi-puff-card${q.dh > 0 ? ".is-up" : q.dh < 0 ? ".is-down" : ""}`, { dataset: { test: "ichi-puff-card" } }, [
      el("small", { text: q.judge ? JUDGE[q.judge].name : "練習" }), el("b", { text: q.style }), el("strong", { text: dhText(q.dh) }), el("p", { text: q.tx })]);
  }
  async function showReveal(q) {
    openSheet("reveal", el("div.ichi-reveal", [el("small", { text: "審査" }), puffCard(q)]));
    await wait(1100);
    if (ui.sheet === "reveal") closeSheet();
  }
  function showScore(ev) {
    const row = (i, label) => {
      const r = ev.res[i];
      return el(`div.ichi-result-row.z-${r.zone}`, { dataset: { test: `ichi-result-${i === ME ? "me" : "foe"}`, zone: r.zone } }, [
        el("span.ichi-result-who", [faceNode(i === ME ? "hajime" : foe.id, label), el("b", { text: label })]), el("span.ichi-result-heat", { text: `判定熱 ${r.h}` }), el(`i.ichi-zone-chip.z-${r.zone}`, { text: ZONE_LABEL[r.zone] }),
        el("span.ichi-result-parts", { text: r.parts.length ? r.parts.map((x) => `${x.label}${x.n >= 0 ? "+" : ""}${x.n}`).join("　") : "加点なし" }),
        el("strong", { text: `${r.pts}点` }), r.vote ? el("em", { text: `一票 +${r.vote}` }) : null, r.lost ? el("small", { text: `${FLAVOR[r.lost].name}を1枚失う` }) : null]);
    };
    const mine = ev.res[ME];
    sfx(mine.zone === "just" ? "perfect" : mine.zone === "band" ? "good" : "miss");
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return; settled = true;
        if (ui.sheet === "score") closeSheet();
        for (const [i, who] of [[ME, "me"], [CPU, "foe"]]) { const n = ev.res[i].pts + (ev.res[i].vote || 0); if (n && !quick()) floatText(who, `+${n}`); }
        if (ev.voter != null && !quick() && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const medal = el(`i.ichi-flying-medal.is-${ev.voter === ME ? "me" : "foe"}`, { "aria-hidden": "true" });
          root.append(medal); setTimeout(() => medal.remove(), 850);
        }
        resolve();
      };
      openSheet("score", el("div.ichi-result", { dataset: { test: "ichi-result" } }, [
        !quick() && ev.res.some((r) => r.zone === "just" || r.zone === "scorch") ? el(`div.ichi-cutin-band.${ev.res[CPU].zone === "scorch" || ev.res[ME].zone === "scorch" ? "is-scorch" : "is-just"}`, { "aria-hidden": "true" },
          el("b", { text: ev.res[CPU].zone === "scorch" || ev.res[ME].zone === "scorch" ? "焦げ" : "ジャスト" })) : null,
        el("header", [el("small", { text: `ラウンド ${ev.round + 1}` }), puffCard(ev.puff)]),
        row(ME, "あなた"), row(CPU, G.P[CPU].name),
        el("p.ichi-result-vote", { text: ev.voter == null ? "帯が同じなので、票は入らない" : `${ev.voter === ME ? "あなた" : G.P[CPU].name}に一票` }),
        el("button.ichi-btn.is-primary", { type: "button", text: "次へ", dataset: { test: "ichi-next" }, onclick: () => { sfx("select"); done(); } }),
      ]));
      sheet.querySelector("button")?.focus({ preventScroll: true });
      if (pilot === "cpu") queueMicrotask(done);
    });
  }
  function showEnd() {
    const res = G.result, me = G.P[ME], op = G.P[CPU];
    const game = { winner: res.winner, scores: res.scores.slice(), votes: res.votes.slice(), tournament: G.tour.id, kit: me.kit, level: cfg.level, rounds: roundsOf(G) };
    games.push(game);
    setFoeMood(...(res.winner === CPU ? ["excited", "smile", "smug"] : res.winner === ME ? ["sad", "shock", "serious"] : ["normal"]));
    render();
    sfx(res.winner === ME ? "fanfare" : "cancel");
    return new Promise((resolve) => {
      const bonus = res.bonus.filter((b) => b.pts[0] || b.pts[1]).map((b) => el("li", [el("span", { text: `${JUDGE[b.judge].name}${b.note ? `（${b.note}）` : "の決め手"}` }), el("b", { text: `${b.pts[0] ? `+${b.pts[0]}` : "—"}` }), el("b", { text: `${b.pts[1] ? `+${b.pts[1]}` : "—"}` })]));
      openSheet("end", el("div.ichi-end", { dataset: { test: "ichi-end-sheet", winner: res.winner === ME ? "me" : res.winner === CPU ? "foe" : "draw" } }, [
        el("div.ichi-end-foe", { "aria-label": `${op.name}の表情` }, foeBust(op.name)),
        el("h2", { text: res.winner === ME ? "勝ち" : res.winner === CPU ? "負け" : "引き分け" }),
        el("div.ichi-end-scores", [el("div", [el("small", { text: "あなた" }), el("b", { text: String(me.score) }), el("span", { text: `票 ${me.votes}・ジャスト ${me.justCount}・焦げ ${me.scorchCount}` })]),
          el("div", [el("small", { text: op.name }), el("b", { text: String(op.score) }), el("span", { text: `票 ${op.votes}・ジャスト ${op.justCount}・焦げ ${op.scorchCount}` })])]),
        bonus.length ? el("ul.ichi-end-bonus", bonus) : null,
        el("div.ichi-end-buttons", [
          allowRetry ? el("button.ichi-btn", { type: "button", text: "もう一度", dataset: { test: "ichi-again" }, onclick: () => { sfx("select"); closeSheet(); resolve(); showSetup(); } }) : null,
          el("button.ichi-btn.is-primary", { type: "button", text: "おわる", dataset: { test: "ichi-finish" }, onclick: () => { sfx("select"); resolve(); close(true); } }),
        ]),
      ]));
      sheet.querySelector(".ichi-btn.is-primary")?.focus({ preventScroll: true });
    });
  }
  function openHelp(page = 0) {
    if (ui.sheet === "info") closeSheet();
    const back = ui.sheet;
    const draw = () => {
      const p = HELP_PAGES[page];
      openSheet("help", el("div.ichi-help", { dataset: { test: "ichi-help-sheet" } }, [
        el("header", [el("small", { text: `遊び方 ${page + 1}/${HELP_PAGES.length}` }), el("h2", { text: p.title })]),
        el("ul", p.lines.map((t) => el("li", { text: t }))),
        el("div.ichi-help-buttons", [
          el("button.ichi-btn.is-small", { type: "button", text: "前へ", disabled: page === 0, onclick: () => { page--; sfx("click"); draw(); } }),
          el("button.ichi-btn.is-small", { type: "button", text: "次へ", disabled: page === HELP_PAGES.length - 1, dataset: { test: "ichi-help-next" }, onclick: () => { page++; sfx("click"); draw(); } }),
          el("button.ichi-btn.is-small.is-primary", { type: "button", text: "とじる", dataset: { test: "ichi-help-close" }, onclick: () => { sfx("select"); closeSheet(); if (back === "quit") askQuit(); } }),
        ]),
      ]));
    };
    if (back && back !== "help" && back !== "quit") return; // 審査・結果の札の上には重ねない
    draw();
  }
  function askQuit() {
    if (ui.sheet === "info") { closeSheet(); return; }
    if (ui.sheet && ui.sheet !== "help") return;
    if (!G || G.over) { close(games.length > 0); return; }
    openSheet("quit", el("div.ichi-quit", { dataset: { test: "ichi-quit-sheet" } }, [
      el("h2", { text: "対戦をやめる？" }), el("p", { text: "この対戦は記録されない" }),
      el("div.ichi-end-buttons", [
        el("button.ichi-btn", { type: "button", text: "つづける", dataset: { test: "ichi-quit-no" }, onclick: () => { sfx("select"); closeSheet(); } }),
        el("button.ichi-btn.is-primary", { type: "button", text: "やめる", dataset: { test: "ichi-quit-yes" }, onclick: () => { sfx("cancel"); close(games.length > 0); } }),
      ]),
    ]));
  }

  if (cfg) startGame(); else showSetup();
  return promise;
}
