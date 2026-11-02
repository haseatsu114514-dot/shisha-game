#!/usr/bin/env node
// TRPG scenario validator: structure, references, voices, text rules, campaign casting and a full simulation.
// Usage: node tools/validate_trpg_scenario.mjs [data/dialogue/trpg_xxx.json ...]   (no argument: every catalog scenario)
// Writing guide: docs/spec/trpg_scenario_authoring.md. Exit code 1 when any ERROR is found.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TrpgSession, STATS, phasesOf, checkKindsOf, pickCompanions } from "../remake/js/trpg/session.js";
import { materializeTrpgCast } from "../remake/js/trpg/campaign.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const catalog = read("data/trpg_catalog.json");
const characters = read("data/characters.json");
for (const file of catalog.characterProfiles || []) { const o = read("data/" + file); if (o.profile?.id) characters.push(o.profile); }
const people = new Set(characters.map(c => c.id));
const manifest = read("remake/data/manifest.json");
const MEMBERS = new Set(catalog.participants.map(p => p.id));
const width = t => Array.from(t).reduce((n, c) => n + (c.codePointAt(0) <= 255 ? 0.5 : 1), 0);

function validate(rel) {
  const errors = [], warns = [];
  const err = m => errors.push(m), warn = m => warns.push(m);
  let s;
  try { s = read(rel); } catch (e) { return { errors: ["JSON: " + e.message], warns }; }
  const ids = new Map(s.dialogues?.map(d => [d.dialogue_id, d]) || []);
  if (ids.size !== (s.dialogues || []).length) err("dialogue_id が重複している");
  const need = (cond, msg) => { if (!cond) err(msg); return cond; };
  const ref = (id, where) => need(typeof id === "string" && ids.has(id), where + " の台詞ID '" + id + "' が見つからない");
  for (const key of ["id", "version", "title", "author", "collection", "duration", "premise", "cast", "intro", "listen", "checks", "spots", "consult",
    "hypotheses", "preparation", "serving", "options", "profiles", "endings", "epilogue", "dialogues", "flow", "fitWeights", "fallbackEnding", "rules",
    "presentation", "debrief", "campaign", "interview", "twist", "sessionZero", "builder", "companionBuilds"]) need(key in s, "必須キー '" + key + "' がない");
  if (errors.length) return { errors, warns };

  // Cast and sheets.
  const gms = s.cast.filter(c => c.part === "GM");
  need(gms.length === 1, "GMはちょうど1人");
  const gm = gms[0]?.id;
  need(MEMBERS.has(gm), "GM '" + gm + "' は部員（catalog.participants）から選ぶ");
  const player = s.cast.find(c => c.id === "hajime");
  need(player?.sheet && player.abilityType === "reroll", "はじめ（PL・切り札は振り直し）が必要");
  const seats = s.cast.filter(c => c.part !== "GM" && c.id !== "hajime");
  need(seats.length === 2, "はじめ以外のPL席は2つ");
  for (const c of s.cast) {
    need(people.has(c.id), "cast '" + c.id + "' が characters.json にない");
    if (c.part === "GM") continue;
    need(c.sheet?.name && c.sheet.title && c.sheet.trait, c.id + " の sheet（name/title/trait）");
    need(STATS.every(k => Number.isInteger(c.sheet?.stats?.[k]) && c.sheet.stats[k] >= 1 && c.sheet.stats[k] <= 5), c.id + " の能力値は各1〜5");
    need(Object.values(c.sheet?.stats || {}).reduce((n, v) => n + v, 0) <= 11, c.id + " の能力値の合計は11以下");
    need(c.ability && c.abilityText && c.abilityType, c.id + " の切り札（ability/abilityText/abilityType）");
  }
  const helperTypes = seats.map(c => c.abilityType).sort().join(",");
  need(helperTypes === "prepare,serve", "仲間2人の切り札は prepare と serve に1つずつ");
  // Builder and companions.
  const b = s.builder;
  need(b.seat === "hajime" && b.points === 11 && b.min === 1 && b.max === 5, "builder: seat hajime / points 11 / min 1 / max 5");
  need(b.looks?.length === 4 && b.looks.every(l => l.id && l.label && l.detail && l.color), "builder.looks は4つ（id/label/detail/color）");
  need(b.archetypes?.length === 3 && b.archetypes[0].recommended === true, "builder.archetypes は3つ、1つ目に recommended:true");
  for (const a of b.archetypes || []) need(Object.values(a.stats).reduce((n, v) => n + v, 0) === 11 && a.name && a.title && a.trait, "出自 " + a.id + " は合計11点・name/title/trait");
  need(JSON.stringify(b.archetypes?.[0]?.stats) === JSON.stringify(player?.sheet?.stats) && b.archetypes?.[0]?.name === player?.sheet?.name, "はじめの sheet は出自1つ目と同じ");
  need(STATS.every(k => b.statHelp?.[k]), "builder.statHelp に4能力の説明");
  for (const c of seats) {
    const byPlayer = s.companionBuilds[c.id];
    if (!need(byPlayer?.[c.id]?.length >= 2, "companionBuilds." + c.id + "." + c.id + " に2案以上")) continue;
    need(byPlayer[c.id][0].name === c.sheet.name && JSON.stringify(byPlayer[c.id][0].stats) === JSON.stringify(c.sheet.stats), c.id + " の1案目は cast の sheet と同じ");
    for (const [pid, options] of Object.entries(byPlayer)) for (const o of options) {
      need(o.id && o.name && o.title && o.trait && o.likes, c.id + "/" + pid + "/" + o.id + " の name/title/trait/likes");
      need(STATS.every(k => o.stats?.[k] >= 1 && o.stats[k] <= 5) && Object.values(o.stats).reduce((n, v) => n + v, 0) <= 11, o.id + " の能力値");
      if (ref(o.making, o.id + ".making")) {
        const m = ids.get(o.making);
        need(m.metadata?.making === true, o.making + " に metadata.making:true");
        need(m.lines.some(l => l.speaker === pid), o.making + " で " + pid + " 本人が役を紹介する");
        need(m.lines.every(l => [pid, gm, "hajime"].includes(l.speaker)), o.making + " の話者は本人・GM・はじめだけ");
      }
    }
  }
  // Campaign seats.
  const cs = s.campaign.seats;
  need(cs.find(x => x.actor === gm)?.required === true && cs.find(x => x.actor === "hajime")?.required === true, "campaign.seats: GMとはじめは required");
  for (const x of cs) need(x.candidates.every(id => MEMBERS.has(id) || id === "hajime") && !x.candidates.some(id => ["sumi", "naru"].includes(id)), "seat " + x.actor + " の候補は部員だけ");
  need(cs.length === s.cast.length, "campaign.seats は cast と同じ席数");
  // Flow and checks.
  need(JSON.stringify(Object.keys(s.flow).sort()) === JSON.stringify(["prepare", "serve", "twist"]) && s.flow.prepare.length === 2 && s.flow.serve.length === 1 && s.flow.twist.length === 1,
    "flow は prepare 2つ / twist 1つ / serve 1つ");
  const fields = [...s.flow.prepare, ...s.flow.serve, ...s.flow.twist];
  for (const f of fields) {
    need(s.options[f]?.length === 3, "options." + f + " は3つ");
    for (const o of s.options[f] || []) { need(o.id && o.label && o.description, f + "/" + o.id); ref(o.response, f + "/" + o.id + ".response"); }
    need(s.presentation.fields?.[f], "presentation.fields." + f);
  }
  need(s.fitWeights[s.flow.twist[0]] === 0, "twist の項目は fitWeights 0（結末に効かない）");
  for (const kind of checkKindsOf(s)) {
    const c = s.checks[kind];
    if (!need(c, "checks." + kind)) continue;
    need(c.title && c.hint, kind + " の title/hint");
    for (const g of ["success", "mixed", "trouble"]) ref(c[g], kind + "." + g);
    need(c.approaches?.length === 3, kind + " の宣言は3つ");
    need(c.approaches?.[0]?.actor === "hajime", kind + " の宣言1つ目ははじめ");
    need(new Set(c.approaches?.map(a => a.actor)).size === 3, kind + " の宣言は3人に1つずつ");
    for (const a of c.approaches || []) {
      need(STATS.includes(a.stat) && a.sheet === a.actor && a.label && a.detail, kind + "/" + a.id);
      if (ref(a.declare, a.id + ".declare")) {
        const lines = ids.get(a.declare).lines;
        need(lines.some(l => l.speaker === a.actor) && lines.some(l => l.speaker === gm), a.declare + " にPLの宣言とGMの裁定");
      }
    }
  }
  need(s.checks.prepare.helper === seats.find(c => c.abilityType === "prepare")?.id && s.checks.serve.helper === seats.find(c => c.abilityType === "serve")?.id, "prepare/serve の helper は切り札の持ち主");
  // Story parts.
  need(s.spots.length === 6 && s.spots.every(p => p.id && p.label && p.short && p.x >= 6 && p.x <= 94 && p.y >= 15 && p.y <= 88), "調査地点は6つ（x 6〜94, y 15〜88）");
  need(s.profiles.length === 3, "隠れた事情（profiles）は3つ");
  need(JSON.stringify(s.hypotheses.map(h => h.id).sort()) === JSON.stringify(s.profiles.map(p => p.id).sort()), "見立て（hypotheses）のIDは profiles と同じ");
  for (const h of s.hypotheses) { need(h.label && h.description, "hypothesis " + h.id); ref(h.discussion, "hypothesis " + h.id + ".discussion"); }
  need(s.interview.topics?.length === 4 && s.interview.picks === 2 && s.interview.title && s.interview.prompt, "interview: 話題4つ・picks 2・title/prompt");
  const endings = new Set();
  for (const p of s.profiles) {
    need(s.endings[p.ending], p.id + " の結末 '" + p.ending + "'");
    endings.add(p.ending);
    need(p.arrival, p.id + ".arrival");
    for (const f of [...s.flow.prepare, ...s.flow.serve]) need(p.likes?.[f]?.length >= 1 && p.likes[f].every(v => s.options[f].some(o => o.id === v)), p.id + ".likes." + f);
    for (const spot of s.spots) { const e = p.evidence?.[spot.id]; if (need(e?.title && e.text, p.id + " の手がかり " + spot.id)) ref(e.lines, p.id + "/" + spot.id); }
    for (const t of s.interview.topics) { const a = p.answers?.[t.id]; if (need(a?.title && a.text, p.id + " の答え " + t.id)) ref(a.lines, p.id + "/ask " + t.id); }
  }
  need(endings.size === 3 && s.endings[s.fallbackEnding] && !endings.has(s.fallbackEnding) && Object.keys(s.endings).length === 4, "結末は4つ（事情ごと3つ＋外れ1つ）");
  for (const [id, e] of Object.entries(s.endings)) { need(e.title && e.line, "ending " + id); ref(e.dialogue, "ending " + id); }
  for (const key of ["intro", "listen", "preparation", "serving", "epilogue"]) ref(s[key], key);
  ref(s.twist.intro, "twist.intro");
  for (const id of Object.values(s.twist.byProfile || {})) ref(id, "twist.byProfile");
  ref(s.sessionZero.open, "sessionZero.open"); ref(s.sessionZero.close, "sessionZero.close");
  for (const v of ["smooth", "with-detour"]) ref(s.debrief[v], "debrief." + v);
  need(JSON.stringify(Object.keys(s.consult).sort()) === JSON.stringify(seats.map(c => c.id).sort()), "consult は仲間2人");
  for (const id of Object.values(s.consult)) ref(id, "consult");
  // Presentation.
  const pr = s.presentation;
  for (const key of ["theme", "number", "genre", "tagline", "sceneAlt", "location", "atmosphere", "titleLines", "fields", "phases", "help", "exitText", "endingKicker",
    "listenIdle", "interviewIdle", "exploreIdle", "twistIdle", "prepareIdle", "serveIdle", "endingIdle", "hypothesisTitle", "serveTitle", "twistTitle", "arrivalRole",
    "stats", "declareTitle", "declareHint", "target", "planTitle"]) need(pr[key] !== undefined, "presentation." + key);
  need(pr.image || pr.backdrop, "presentation.image か backdrop（画像が届くまでの色）");
  if (pr.image) need(fs.existsSync(path.join(root, "remake/js/trpg", pr.image)), "背景画像 " + pr.image + " が存在しない");
  if (pr.choiceArt) {
    need(fs.existsSync(path.join(root, "remake/js/trpg", pr.choiceArt.src)), "選択肢の絵 " + pr.choiceArt.src + " が存在しない");
    for (const [field, row] of Object.entries(pr.choiceArt.rows || {})) need(Number.isInteger(row) && row < pr.choiceArt.rowCount, "choiceArt.rows." + field);
  }
  for (const phase of phasesOf(s)) need(pr.phases?.[phase]?.kicker && pr.phases[phase].title, "presentation.phases." + phase);
  // Lines: speakers, faces, width, punctuation, tokens.
  const seatsAll = new Set(s.cast.map(c => c.id));
  for (const d of s.dialogues) {
    need(d.lines?.length, d.dialogue_id + " が空");
    for (const l of d.lines || []) {
      const where = d.dialogue_id + ": " + (l.text || "").slice(0, 20);
      need(people.has(l.speaker), where + " 話者 '" + l.speaker + "' が characters.json にない");
      const faces = manifest.portraits[l.speaker]?.faces || [];
      need(faces.includes(l.face || "normal"), where + " 表情 '" + l.face + "' は " + l.speaker + " にない（" + faces.join("/") + "）");
      need(typeof l.text === "string" && !l.text.includes("\n"), where + " 改行を入れない");
      need(width(l.text.replace(/\{pc(:[a-z]+)?\}|\{pcTitle\}/g, "あああああ").replace("{gm}", "サメちゃん")) <= 48, where + " 全角48字（{pc}は5字で計算）を超える");
      if (/。$/.test(l.text)) err(where + " 台詞の末尾に「。」を付けない");
      for (const m of l.text.matchAll(/\{([^}]*)\}/g)) {
        const t = m[1];
        need(t === "pc" || t === "pcTitle" || t === "gm" || (t.startsWith("pc:") && seatsAll.has(t.slice(3)) && t.slice(3) !== gm), where + " 不明なトークン {" + t + "}");
      }
      if (!d.metadata?.making && l.speaker !== gm && l.speaker !== "hajime" && !seatsAll.has(l.speaker)) err(where + " 卓にいない '" + l.speaker + "' が話している");
    }
  }
  for (const c of seats) for (const o of [c.sheet.name, ...Object.values(s.companionBuilds[c.id] || {}).flat().map(o => o.name)]) {
    for (const d of s.dialogues.filter(d => !d.metadata?.making)) for (const l of d.lines) if (l.text.includes(o)) err(d.dialogue_id + " にPC名 '" + o + "' が直書き（{pc:" + c.id + "} にする）");
  }
  for (const a of b.archetypes) for (const d of s.dialogues) for (const l of d.lines) if (l.text.includes(a.name) && a.name.length > 1) err(d.dialogue_id + " にはじめのPC名 '" + a.name + "' が直書き（{pc} にする）");
  // Simulation: every plan for every profile finishes; every ending is reachable; casts with empty seats materialize.
  const reached = new Set();
  let seed = 1;
  for (const p of s.profiles) {
    const combos = fields.reduce((acc, f) => acc.flatMap(c => s.options[f].map(o => ({ ...c, [f]: o.id }))), [{}]);
    for (const plan of combos) {
      try {
        const session = new TrpgSession(s, { seed: seed++, profileId: p.id });
        session.start(); session.beginCheck("listen"); session.settleCheck();
        for (const t of s.interview.topics.slice(0, 2)) session.ask(t.id);
        session.endInterview();
        for (const spot of s.spots.slice(0, Math.min(3, session.rules.exploreLimit))) session.inspect(spot.id);
        session.interpret(p.id);
        session.plan(s.flow.twist[0], plan[s.flow.twist[0]]); session.beginCheck("twist"); session.settleCheck();
        for (const f of s.flow.prepare) session.plan(f, plan[f]);
        session.beginCheck("prepare"); session.settleCheck();
        session.plan(s.flow.serve[0], plan[s.flow.serve[0]]); session.beginCheck("serve"); session.settleCheck();
        reached.add(session.result().ending);
      } catch (e) { err("シミュレーション失敗 " + p.id + " " + JSON.stringify(plan) + ": " + e.message); break; }
    }
  }
  for (const e of Object.keys(s.endings)) need(reached.has(e), "結末 '" + e + "' に届く組み合わせがない");
  const optional = cs.filter(x => !x.required);
  for (const mask of [0, 1, 2, 3]) {
    const assignments = Object.fromEntries(cs.map(x => [x.actor, x.required ? x.candidates[0] : null]));
    optional.forEach((x, i) => { if (mask & (1 << i)) assignments[x.actor] = x.candidates[0]; });
    try {
      const table = materializeTrpgCast(s, assignments);
      const session = new TrpgSession(table, { seed: 3 });
      pickCompanions(table, 3);
      session.start(); session.beginCheck("listen"); session.settleCheck();
    } catch (e) { err("少人数の卓 " + JSON.stringify(assignments) + ": " + e.message); }
  }
  for (const x of cs) for (const alt of x.candidates.slice(1)) {
    const assignments = Object.fromEntries(cs.map(y => [y.actor, y.candidates[0]])); assignments[x.actor] = alt;
    try { materializeTrpgCast(s, assignments); } catch (e) { err("代役 " + alt + " → " + x.actor + ": " + e.message); }
  }
  // Volume: a typical path should read about ten minutes of lines.
  const L = id => ids.get(id)?.lines.length || 0, p0 = s.profiles[0];
  const total = L(s.sessionZero.open) + L(s.sessionZero.close) + Object.values(s.companionBuilds).reduce((n, p) => n + L(Object.values(p)[0][0].making), 0)
    + L(s.intro) + L(s.listen) + 1 + Object.values(p0.answers).slice(0, 2).reduce((n, a) => n + L(a.lines), 0)
    + s.spots.slice(0, 4).reduce((n, spot) => n + L(p0.evidence[spot.id].lines), 0)
    + checkKindsOf(s).reduce((n, k) => n + L(s.checks[k].approaches[0].declare) + L(s.checks[k].mixed), 0)
    + L(s.hypotheses[0].discussion) + L(s.twist.intro) + L(s.options[s.flow.twist[0]][0].response) + L(s.preparation) + L(s.serving)
    + Object.values(s.consult).reduce((n, id) => n + L(id), 0) + L(s.endings[p0.ending].dialogue) + L(s.debrief.smooth) + L(s.epilogue)
    + fields.reduce((n, f) => n + L(s.options[f][0].response), 0) - L(s.options[s.flow.twist[0]][0].response);
  if (total < 95) err("標準ルートの台詞が " + total + " 行（目安 95〜140 行で約10分）");
  if (total > 170) warn("標準ルートの台詞が " + total + " 行。長すぎるかも");
  const entry = catalog.scenarios.find(e => e.file === rel.replace(/^data\//, ""));
  if (entry) {
    need(entry.id === s.id, "catalog の id と scenario.id が違う");
    need(Number.isInteger(entry.price) && entry.price >= 300 && entry.price <= 1500, "catalog.price は300〜1500円");
    need(entry.stockRequires?.includes(gm) && entry.stockRequires.every(id => MEMBERS.has(id)), "catalog.stockRequires にGMを含める");
  } else warn("catalog に未登録");
  return { errors, warns, total };
}

const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.relative(root, path.resolve(f)))
  : catalog.scenarios.map(e => "data/" + e.file);
let failed = 0;
for (const f of files) {
  const { errors, warns, total } = validate(f);
  console.log((errors.length ? "✗ " : "✓ ") + f + (total ? "  標準ルート " + total + " 行" : ""));
  for (const e of errors.slice(0, 60)) console.log("   ERROR " + e);
  if (errors.length > 60) console.log("   ... ほか " + (errors.length - 60) + " 件");
  for (const w of warns) console.log("   WARN  " + w);
  if (errors.length) failed++;
}
process.exit(failed ? 1 : 0);
