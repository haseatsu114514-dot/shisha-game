// 選ぶ工程: 機材・コンセプト・配合・詰め・炭の配置・蒸らし時間。
import { el, sleep, clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { toast } from "../core/ui.js";
import { state } from "../core/state.js";
import { star, gainStat } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshRig } from "./session.js";
import { autoSkill } from "./common.js";
import { flavorColor } from "./art.js";
import { ownsFlavor, SHOP_FLAVORS } from "../daily/shop.js";

// 章ごとのレギュレーション（CLAUDE.md が正本: ch1 = ミント2g以上）
export const REGULATION = { 1: { flavor: "mint", min: 2, label: "課題フレーバー「ミント」を2g以上" } };
export const regulationFor = (cs) => (cs.mode === "tournament" || cs.mode === "rehearsal" ? REGULATION[state.chapter] : null);

// スミさんの手本（チュートリアル中だけ、工程の頭に出す）
const LESSON = {
  setup: "スミ「道具は相棒だ。今日のは店の基本セットでいい」",
  mix: "スミ「まずは基本形。ダブルアップルにミントを少し。迷ったら、ここへ帰ってこい」",
  pack: "スミ「詰めは空気の通り道を作ることだ。ふんわりか、ならすか、固めるか」",
  place: "スミ「炭は三角。基本の配置だ。四つは火が強すぎる」",
  steam: "スミ「蒸らしは待つ仕事だ。焦りは煙に出る」",
};

function choose(panel, options, { cols = 2 } = {}) {
  return new Promise((resolve) => {
    const grid = el(`div.opt-grid.cols-${cols}`, options.map((o) =>
      el(`button.opt${o.disabled ? ".off" : ""}`, {
        disabled: o.disabled || null,
        dataset: { test: `opt-${o.value}` },
        onclick: () => { SE.select(); resolve(o.value); },
      }, [
        o.badge ? el("span.opt-badge", { text: o.badge }) : null,
        el("b", { text: o.label }),
        el("small", { text: o.desc || "" }),
      ])));
    panel.append(grid);
    if (autoSkill()) {
      const pickV = options.find((o) => o.auto && !o.disabled) || options.find((o) => !o.disabled);
      setTimeout(() => resolve(pickV.value), 40);
    }
  });
}

const lessonHint = (cs, id, fallback) => (cs.mode === "tutorial" && LESSON[id]) || fallback;

// ---------------------------------------------------------------- 機材

export async function stepSetup(cs) {
  const types = [["bowl", "ボウル"], ["hms", "ヒートマネジメント"], ["charcoal", "炭"]];
  for (const [type, label] of types) {
    const owned = state.owned.map((id) => DB.equipById[id]).filter((e) => e && e.type === type);
    if (owned.length <= 1) { cs.equip[type] = owned[0]?.id || cs.equip[type]; continue; }
    const panel = stepPanel("setup", `機材 ── ${label}`, lessonHint(cs, "setup", "手持ちの機材から選ぶ"));
    cs.equip[type] = await choose(panel, owned.map((e) => ({ value: e.id, label: e.name, desc: e.description, auto: e.id === state.equip[type] })));
  }
  state.equip = { ...cs.equip };
  refreshRig();
}

// ---------------------------------------------------------------- コンセプト（FLAVOR TRIAL の土台）

export const CONCEPTS = [
  { id: "aroma", label: "香り重視", desc: "課題フレーバーの香りを芯まで残す" },
  { id: "smoke", label: "煙多め", desc: "見た目にも満足できる煙量" },
  { id: "relax", label: "リラックス", desc: "角のない、焦げない、落ち着く一台" },
  { id: "speed", label: "スピード提供", desc: "手際よく、待たせずに出す" },
  { id: "taste", label: "味濃いめ", desc: "一口目から主張する濃さ" },
  { id: "duration", label: "持続力重視", desc: "最後の一口まで味が崩れない" },
  { id: "original", label: "独創性重視", desc: "自分だけの組み合わせで勝負" },
];

export async function stepConcept(cs) {
  const panel = stepPanel("concept", "コンセプト ── 今日の方針", "作る前に、この一台の方針を2つ掲げる。審査では「言ったこと」と「作ったもの」の一致が問われる");
  const picked = [];
  const note = el("div.concept-note", { text: "あと2つ選ぶ" });
  const grid = el("div.opt-grid.cols-3");
  const confirm = el("button.btn.primary", { disabled: true, dataset: { test: "concept-ok" } }, [el("span.btn-label", { text: "この方針で作る" })]);
  const redraw = () => {
    grid.querySelectorAll(".opt").forEach((b) => b.classList.toggle("on", picked.includes(b.dataset.value)));
    note.textContent = picked.length < 2 ? `あと${2 - picked.length}つ選ぶ` : `「${picked.map((id) => CONCEPTS.find((c) => c.id === id).label).join("」×「")}」で行く`;
    confirm.disabled = picked.length !== 2;
  };
  for (const c of CONCEPTS) {
    grid.append(el("button.opt", { dataset: { value: c.id, test: `concept-${c.id}` }, onclick: () => {
      SE.click();
      const i = picked.indexOf(c.id);
      if (i >= 0) picked.splice(i, 1);
      else { if (picked.length >= 2) picked.shift(); picked.push(c.id); }
      redraw();
    } }, [el("b", { text: c.label }), el("small", { text: c.desc })]));
  }
  panel.append(grid, el("div.step-foot", [note, confirm]));
  await new Promise((resolve) => {
    confirm.addEventListener("click", () => { SE.select(); resolve(); });
    if (autoSkill()) {
      picked.push(...(autoSkill() === "good" ? ["aroma", "relax"] : ["smoke", "taste"]));
      redraw();
      setTimeout(() => confirm.click(), 40);
    }
  });
  cs.concepts = picked.slice();
}

// ---------------------------------------------------------------- 配合

function capacity(cs) {
  return DB.equipById[cs.equip.bowl]?.capacity || 12;
}

/** 配合の評価（相性・レシピ・NG・レギュレーション） */
export function evaluateMix(cs) {
  const mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  const ids = Object.keys(mix);
  const total = ids.reduce((s, id) => s + mix[id], 0);
  const notes = [];
  let score = [0, 68, 84, 80, 70][Math.min(4, ids.length)] - (ids.length > 4 ? 8 : 0);
  const key = ids.slice().sort().join("+");
  const recipe = DB.recipes.find((r) => r.flavors.slice().sort().join("+") === key) || null;
  if (recipe) { score += 14; notes.push(`レシピ「${recipe.name}」の組み合わせ`); }
  for (const ng of DB.ngMixes) {
    const [a, b] = ng.flavors;
    if (!(a in mix) || !(b in mix)) continue;
    const hit =
      (ng.condition === "both_over_5g" && mix[a] > 5 && mix[b] > 5) ||
      (ng.condition === "both_over_4g" && mix[a] > 4 && mix[b] > 4) ||
      (ng.condition === "combined_over_10g" && mix[a] + mix[b] > 10) ||
      (ng.condition === "ratio_close" && Math.abs(mix[a] - mix[b]) <= 1);
    if (hit) { score += ng.penalty * 3; notes.push(ng.text); }
  }
  const main = Math.max(...ids.map((id) => mix[id]), 0) / (total || 1);
  if (ids.length >= 2 && main >= 0.45 && main <= 0.8) { score += 4; notes.push("主役と脇役の比率がいい"); }
  const reg = regulationFor(cs);
  const regOk = !reg || (mix[reg.flavor] || 0) >= reg.min;
  if (reg && (mix.mint || 0) > 6) { score -= 6; notes.push("ミントが強すぎて、他の香りが隠れている"); }
  // 味の傾向（重さ平均）
  const prof = {};
  for (const id of ids) {
    const st = DB.flavorById[id]?.stats || {};
    for (const [k, v] of Object.entries(st)) prof[k] = (prof[k] || 0) + (v * mix[id]) / total;
  }
  return {
    score: clamp(Math.round(score), 25, 100), total, recipe, notes, regOk, profile: prof,
    count: ids.length, intensity: prof.assertiveness || 5, cooling: prof.cooling || 0,
  };
}

export async function stepMix(cs) {
  const reg = regulationFor(cs);
  const cap = capacity(cs);
  const panel = stepPanel("mix", "配合 ── MIX", lessonHint(cs, "mix", `${cap}gまで詰められるボウル。${reg ? reg.label + "が今日の課題。" : ""}合計12g以上で決める`));
  // 使えるフレーバー: 手持ち＋課題フレーバー（主催者支給）。チュートリアルは店の基本形
  let ids = [...new Set(["double_apple", ...SHOP_FLAVORS.filter(ownsFlavor), ...(ownsFlavor("nightside_earlgrey") ? ["nightside_earlgrey"] : [])])];
  if (reg && !ids.includes(reg.flavor)) ids.unshift(reg.flavor);
  if (cs.mode === "tutorial") ids = ["double_apple", "mint"];
  cs.mix = {};
  const lcd = el("div.lcd");
  const layers = el("div.bowl-layers");
  const regLine = el("div.reg-line");
  const recipeLine = el("div.recipe-line");
  const okBtn = el("button.btn.primary", { disabled: true, dataset: { test: "mix-ok" } }, [el("span.btn-label", { text: "この配合で詰める" })]);
  const totalOf = () => Object.values(cs.mix).reduce((s, g) => s + g, 0);

  const redraw = () => {
    const total = totalOf();
    lcd.textContent = `${total.toFixed(1)} g / ${cap} g`;
    lcd.classList.toggle("ok", total >= 12 && total <= cap);
    layers.replaceChildren(...Object.entries(cs.mix).filter(([, g]) => g > 0).map(([id, g]) =>
      el("i", { style: { height: `${(g / cap) * 100}%`, background: flavorColor(id) } })));
    const info = evaluateMix(cs);
    regLine.textContent = reg ? `${info.regOk ? "✓" : "✗"} ${reg.label}` : "";
    regLine.classList.toggle("ok", info.regOk);
    recipeLine.textContent = info.recipe ? `📖 ${info.recipe.name}` : "";
    okBtn.disabled = !(total >= 12 && total <= cap && info.regOk);
    rows.forEach((r) => { r.g.textContent = `${cs.mix[r.id] || 0}g`; });
    refreshRig();
  };

  const rows = ids.map((id) => {
    const f = DB.flavorById[id];
    const g = el("span.fr-g", { text: "0g" });
    const change = (d) => {
      const cur = cs.mix[id] || 0;
      const next = clamp(cur + d, 0, cap);
      if (d > 0 && totalOf() + d > cap) { SE.error(); return; }
      cs.mix[id] = next;
      if (d > 0) SE.pour(); else SE.click();
      redraw();
    };
    const row = el("div.flavor-row", { dataset: { flavor: id } }, [
      el("i.fr-swatch", { style: { background: flavorColor(id) } }),
      el("div.fr-name", [el("b", { text: f?.short_name || f?.name || id }), reg && id === reg.flavor ? el("small.fr-reg", { text: "課題（支給）" }) : el("small", { text: f?.description?.slice(0, 22) || "" })]),
      el("button.fr-btn", { text: "−", dataset: { test: `mix-minus-${id}` }, onclick: () => change(-1) }),
      g,
      el("button.fr-btn", { text: "＋", dataset: { test: `mix-plus-${id}` }, onclick: () => change(1) }),
    ]);
    return { id, g, row };
  });

  // 洞察★: 相性のいい組み合わせのヒント（レシピ帳・聞いた話から）
  const hint = star("insight") >= 2 && cs.mode !== "tutorial"
    ? DB.recipes.find((r) => r.flavors.every((f) => ids.includes(f)) && (state.flags[`_note_${r.hint_note}`] || r.id === "sumi_basic"))
    : null;

  panel.append(el("div.mix", [
    el("div.mix-list", rows.map((r) => r.row)),
    el("div.mix-side", [
      el("div.mix-bowl", [layers]),
      lcd, regLine, recipeLine,
      hint ? el("div.mix-hint", { text: `ひらめき: ${hint.hint_text || hint.memo}` }) : null,
      okBtn,
    ]),
  ]));
  redraw();
  await new Promise((resolve) => {
    okBtn.addEventListener("click", () => { SE.select(); resolve(); });
    if (autoSkill()) {
      // 上手=スミさんの基本形（ダブルアップル＋ミント）／下手=規定ぎりぎりの雑な配合
      if (autoSkill() === "good" || cs.mode === "tutorial") { cs.mix = { double_apple: 9, mint: 3 }; }
      else { cs.mix = { double_apple: 5, mint: 7 }; }
      redraw();
      setTimeout(() => okBtn.click(), 60);
    }
  });
  cs.mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  cs.mixInfo = evaluateMix(cs);
  // レシピ帳への登録（新発見のときだけ）
  const r = cs.mixInfo.recipe;
  if (r && !state.recipes[r.id]) {
    state.recipes[r.id] = { day: state.day };
    toast(`📖 レシピ帳に書き加えた「${r.name}」`, { kind: "good" });
    if (cs.mode !== "tournament") gainStat("sense", 1);
  }
  await sleep(200);
}

// ---------------------------------------------------------------- 詰め・配置・蒸らし時間

export async function stepPack(cs) {
  const panel = stepPanel("pack", "パッキング ── 詰め方", lessonHint(cs, "pack", "空気の通り道を作る。詰め方で抜けと熱の入り方が変わる"));
  cs.pack = await choose(panel, [
    { value: "fluffy", label: "ふんわり", desc: "空気を含ませて軽く。抜けが良く煙が出やすいが、熱が早く回る" },
    { value: "normal", label: "ノーマル", desc: "基本に忠実。熱の入り方が素直で、崩れにくい", auto: true },
    { value: "firm", label: "かため", desc: "ぎゅっと密度を出す。味は濃く長持ちするが、熱が要る" },
  ], { cols: 3 });
  SE.stamp();
  refreshRig();
}

export async function stepPlace(cs) {
  const panel = stepPanel("place", "炭の配置", lessonHint(cs, "place", "熾した炭をアルミの上に置く。基本はトライアングル"));
  cs.place = await choose(panel, [
    { value: "triangle", label: "トライアングル（3個）", desc: "基本の三角配置。熱が均一に回る", auto: true },
    { value: "four", label: "炭4個", desc: "かなり熱が上がる高火力。煙は増えるが、焦げと隣り合わせ", disabled: cs.mode === "tutorial" },
  ]);
  SE.crackle();
  refreshRig();
}

export async function stepSteamTime(cs) {
  const panel = stepPanel("steam", "蒸らし時間", lessonHint(cs, "steam", "炭を置いたら、吸える温度になるまで待つ。長いほど香りは開くが、焦げも近づく"));
  cs.steamMin = await choose(panel, [
    { value: 3, label: "3分", desc: "早めに立ち上げる。香りは軽く、温度合わせが忙しい", disabled: cs.mode === "tutorial" },
    { value: 5, label: "5分", desc: "基本の蒸らし。香りの輪郭を残しやすい", auto: true },
    { value: 8, label: "8分", desc: "じっくり待つ。甘さと余韻が開く" },
    { value: 10, label: "10分", desc: "攻めた長めの蒸らし。重い煙には効くが、焦げの気配も近い", disabled: cs.mode === "tutorial" },
  ], { cols: 2 });
}

