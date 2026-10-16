// 選ぶ工程: 機材・配合・詰め・炭の配置・蒸らし時間。
import { el, sleep, clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { toast } from "../core/ui.js";
import { state } from "../core/state.js";
import { star, earnStat } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, reactAudience, scoreStep, waitBenchReady } from "./session.js";
import { autoSkill } from "./common.js";
import { flavorColor, mixBowlPreview, packingBowlPreview } from "./art.js";
import { mixTaste } from "./mix-taste.js";
import { flavorStock, addFlavorStock, ownedFlavorIds } from "../daily/shop.js";
import { runSteamTimer } from "./timer.js";
import { cafeNoted } from "../daily/cafe-ideas.js";
import { availableCoalLayouts, coalCount, coalTypes, COAL_UNLOCK } from "./coals.js";
import { buildThermometer, formatTemperatureRange } from "./thermometer.js";
import { flavorFamilyGrams } from "./score.js";
import { makerMixProfile, compareEquipment, EQUIP_CATEGORY_GUIDE } from "./temperature-model.js";

// 章ごとのレギュレーション（CLAUDE.md が正本: ch1 = ミント2g以上）
export const REGULATION = {
  1: { flavor: "mint", min: 2, label: "課題フレーバー「ミント」を2g以上" },
  2: { flavor: "strawberry", min: 1, label: "課題フレーバー「ストロベリー」を使う" },
};
export const regulationFor = (cs) => (cs.mode === "tournament" || cs.mode === "rehearsal" ? REGULATION[state.chapter] : null);

// スミさんの手本（チュートリアル中だけ、工程の頭に出す）
const LESSON = {
  setup: "スミ「道具は相棒だ。今日のは店の基本セットでいい」",
  mix: "スミ「まずは基本形。ダブルアップルにミントを少し。迷ったら、ここへ帰ってこい」",
  pack: "スミ「詰めは空気の通り道を作ることだ。ふんわりか、ならすか、固めるか」",
  place: "スミ「炭は三角。基本の配置だ。四つは火が強すぎる」",
  steam: "スミ「分と秒で時間を決めてスタートだ。秒は10秒ずつ動くぞ」",
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

export const isSuyakiBowl = (bowlId) => {
  const b = DB.equipById?.[bowlId];
  return (b?.capacity || 0) >= 20 || String(bowlId || "").startsWith("suyaki");
};

export async function stepSetup(cs) {
  await waitBenchReady(cs, "setup");
  const types = [["bowl", "ボウル（ハガル）"], ["hms", "HMD（ヒートマネジメント）"], ["charcoal", "炭（チャコール）"]];
  for (const [type, label] of types) {
    const owned = state.owned.map((id) => DB.equipById[id]).filter((e) => e && e.type === type);
    const suyaki = type === "hms" && isSuyakiBowl(cs.equip.bowl);
    const selectable = owned.filter((e) => !(suyaki && e.id === "tanukish_lid"));
    if (owned.length <= 1) {
      cs.equip[type] = selectable[0]?.id || (suyaki ? "lotos_hagal" : owned[0]?.id || cs.equip[type]);
      continue;
    }
    const currentId = state.equip[type];
    const panel = stepPanel("setup", `機材 ${label}`, lessonHint(cs, "setup", EQUIP_CATEGORY_GUIDE[type] || "手持ちの機材から選ぶ"));
    cs.equip[type] = await choose(panel, owned.map((e) => {
      const disabled = suyaki && e.id === "tanukish_lid";
      const cmp = compareEquipment(e.id, currentId);
      const diffLine = cmp?.rows?.[0] ? `【${cmp.rows[0].label}】${cmp.rows[0].value}` : "";
      return {
        value: e.id, label: e.name,
        desc: diffLine ? `${e.description} ／ ${diffLine}` : e.description,
        disabled, badge: disabled ? "素焼き非対応" : e.id === currentId ? "装備中" : null,
        auto: !disabled && e.id === currentId,
      };
    }));
  }
  state.equip = { ...cs.equip };
  refreshBench();
}

// ---------------------------------------------------------------- ミックス

function capacity(cs) {
  return DB.equipById[cs.equip.bowl]?.capacity || 12;
}

const familyKeyOf = (id) => DB.flavorById?.[id]?.family || id;

/** ミックスの評価（相性・レシピ・NG・レギュレーション） */
export function evaluateMix(cs) {
  const mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  const ids = Object.keys(mix);
  const total = ids.reduce((s, id) => s + mix[id], 0);
  const notes = [];
  let score = [0, 68, 84, 80, 70][Math.min(4, ids.length)] - (ids.length > 4 ? 8 : 0);
  const key = [...new Set(ids.map(familyKeyOf))].sort().join("+");
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
  const regOk = !reg || flavorFamilyGrams(mix, reg.flavor) >= reg.min;
  if (reg && flavorFamilyGrams(mix, "mint") > 6) { score -= 6; notes.push("ミントが強すぎて、他の香りが隠れている"); }
  // 味の傾向（重さ平均）
  const prof = {};
  for (const id of ids) {
    const st = DB.flavorById[id]?.stats || {};
    for (const [k, v] of Object.entries(st)) prof[k] = (prof[k] || 0) + (v * mix[id]) / total;
  }
  const maker = makerMixProfile(cs);
  return {
    score: clamp(Math.round(score), 25, 100), total, recipe, notes, regOk, profile: prof,
    count: ids.length, intensity: prof.assertiveness || 5, cooling: prof.cooling || 0, maker,
  };
}

export async function stepMix(cs) {
  await waitBenchReady(cs, "mix");
  const reg = regulationFor(cs);
  const cap = capacity(cs);
  const panel = stepPanel("mix", "フレーバーのミックス", lessonHint(cs, "mix", `${cap}gまで詰められるボウル。${reg ? reg.label + "が今日の課題。" : ""}合計12g以上で決める`));
  // 使えるフレーバー: 在庫のあるもの＋課題フレーバー（主催者支給）。チュートリアルは店の基本形。
  // 大会は持ち込んだ在庫から詰む（詰んだ分だけ減る・旧版 N3）。練習・リハーサルは店の葉なので減らない
  const consumes = cs.mode === "tournament";
  const supplied = (id) => !!reg && id === reg.flavor;
  let ids = ownedFlavorIds(); // 店の品＋限定サンプル＋もらった葉（贈られたハガルに添えられたカルダモン等）
  if (reg && !ids.includes(reg.flavor)) ids.unshift(reg.flavor);
  if (cs.mode === "tutorial") ids = ["double_apple", "mint"];
  const limit = (id) => (consumes && !supplied(id) ? flavorStock(id) : Infinity);
  const practiceFlavor = cs.mode === "rehearsal" ? state.flags._prep_flavor : null;
  cs.mix = practiceFlavor && ids.includes(practiceFlavor) ? { [practiceFlavor]: 10, mint: 2 } : {};
  const lcd = el("div.lcd");
  const vessel = el("div.mix-vessel", { dataset: { test: "mix-vessel" } });
  const taste = el("div.mix-taste", { "aria-live": "polite", dataset: { test: "mix-taste" } });
  const regLine = el("div.reg-line");
  const recipeLine = el("div.recipe-line");
  const thermometer = buildThermometer({ cs, bandPreview: true, height: 200, width: 36 });
  const idealLine = el("span.mix-ideal"), optimalLine = el("span.mix-optimal");
  const temperaturePreview = el("details.mix-temperature-preview", { dataset: { test: "mix-temperature-preview" } }, [
    el("summary", { text: "温度の目安を見る" }),
    thermometer.root,
    el("div.mix-temperature-legend", { "aria-live": "polite" }, [idealLine, optimalLine]),
  ]);
  const okBtn = el("button.btn.primary", { disabled: true, dataset: { test: "mix-ok" } }, [el("span.btn-label", { text: "このミックスで詰める" })]);
  const totalOf = () => Object.values(cs.mix).reduce((s, g) => s + g, 0);

  const redraw = () => {
    const total = totalOf();
    lcd.textContent = `${total.toFixed(1)} g / ${cap} g`;
    lcd.classList.toggle("ok", total >= 12 && total <= cap);
    vessel.replaceChildren(mixBowlPreview(cs, total));
    vessel.dataset.filled = String(total > 0);
    const aroma = cs.mode === "tournament" && cs.chapter === 2
      ? { headline: "苺の輪郭が、つかめない", detail: "ミックスは見えている。でも、舌では確かめられない。手元と温度を頼りに組み立てよう。", tags: ["味覚の不調"] }
      : mixTaste(cs.mix);
    taste.replaceChildren(el("b", { text: aroma.headline }), el("p", { text: aroma.detail }),
      el("div.mix-taste-tags", aroma.tags.map(text => el("span", { text }))));
    const info = evaluateMix(cs);
    const bands = thermometer.updateBands();
    idealLine.textContent = `緑 · 適温 ${formatTemperatureRange(bands.ideal)}`;
    optimalLine.textContent = `虹 · 最適温 ${formatTemperatureRange(bands.optimal)}`;
    const m = info.maker;
    const synergyText = m.makerCount <= 1 ? "単一メーカー" : `${m.makerCount}社ミックス`;
    temperaturePreview.title = `装備×メーカー適温幅 ×${m.totalWidthScale.toFixed(2)}（${synergyText}）`;
    regLine.textContent = reg ? `${info.regOk ? "✓" : "✗"} ${reg.label}` : "";
    regLine.classList.toggle("ok", info.regOk);
    recipeLine.textContent = info.recipe ? `📖 ${info.recipe.name}` : "";
    okBtn.disabled = !(total >= 12 && total <= cap && info.regOk);
    rows.forEach((r) => { r.g.textContent = `${cs.mix[r.id] || 0}g`; });
    refreshBench();
  };

  const rows = ids.map((id) => {
    const f = DB.flavorById[id];
    const g = el("span.fr-g", { text: "0g" });
    const change = (d) => {
      const cur = cs.mix[id] || 0;
      const next = clamp(cur + d, 0, cap);
      if (d > 0 && totalOf() + d > cap) { SE.error(); return; }
      if (d > 0 && cur + d > limit(id)) { SE.error(); toast(`${f?.short_name || f?.name || id}の持ち込みは残り${flavorStock(id)}gまで`, { kind: "warn" }); return; }
      cs.mix[id] = next;
      // シロップを含む葉を取る操作はほぼ無音。数字を減らすUIだけ短いクリック。
      if (d < 0) SE.click();
      redraw();
    };
    const row = el("div.flavor-row", { dataset: { flavor: id } }, [
      el("i.fr-swatch", { style: { background: flavorColor(id) } }),
      el("div.fr-name", [
        el("b", { text: f?.short_name || f?.name || id }),
        supplied(id) ? el("small.fr-reg", { text: "課題（支給）" })
          : consumes ? el("small.fr-stock", { text: `持ち込み 残り${flavorStock(id)}g` })
          : el("small", { text: f?.description?.slice(0, 22) || "" }),
      ]),
      el("button.fr-btn", { text: "−", "aria-label": `${f?.short_name || f?.name || id}を1g減らす`, dataset: { test: `mix-minus-${id}` }, onclick: () => change(-1) }),
      g,
      el("button.fr-btn", { text: "＋", "aria-label": `${f?.short_name || f?.name || id}を1g足す`, dataset: { test: `mix-plus-${id}` }, onclick: () => change(1) }),
    ]);
    return { id, g, row };
  });

  // 洞察★: 相性のいい組み合わせのヒント（レシピ帳・聞いた話から）。喫茶こはくで思いついた配合は洞察に関係なく出す
  const insightful = star("insight") >= 2;
  const hint = cs.mode !== "tutorial"
    ? DB.recipes.find((r) => r.flavors.every((f) => ids.includes(f)) && !state.recipes?.[r.id] && cafeNoted(state, r))
      || (insightful ? DB.recipes.find((r) => r.flavors.every((f) => ids.includes(f)) && (state.flags[`_note_${r.hint_note}`] || r.id === "sumi_basic")) : null)
    : null;

  panel.append(el("div.mix", [
    el("div.mix-side", [vessel, taste, recipeLine,
      hint ? el("div.mix-hint", { text: `ひらめき: ${hint.hint_text || hint.idea_hint || hint.memo}` }) : null]),
    el("div.mix-list", [el("p.mix-list-caption", { text: "葉を1gずつ、器へ。" }), ...rows.map((r) => r.row)]),
    el("div.mix-footer", [el("div.mix-amount", [lcd, regLine]), temperaturePreview, okBtn]),
  ]));
  redraw();
  await new Promise((resolve) => {
    okBtn.addEventListener("click", () => { SE.select(); resolve(); });
    if (autoSkill()) {
      // 上手=スミさんの基本形（ダブルアップル＋ミント）／下手=規定ぎりぎりの雑な配合
      if (autoSkill() === "good" || cs.mode === "tutorial") { cs.mix = practiceFlavor && ids.includes(practiceFlavor) ? { [practiceFlavor]: 9, mint: 3 } : { double_apple: 9, mint: 3 }; }
      else { cs.mix = { double_apple: 5, mint: 7 }; }
      if (reg?.flavor === "strawberry") {
        const apple = autoSkill() === "good" ? Math.min(9, flavorStock("double_apple")) : 0;
        cs.mix = { strawberry: 12 - apple, ...(apple ? { double_apple: apple } : {}) };
      }
      redraw();
      setTimeout(() => okBtn.click(), 60);
    }
  });
  cs.mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  if (consumes) for (const [id, g] of Object.entries(cs.mix)) if (!supplied(id)) addFlavorStock(id, -g);
  cs.mixInfo = evaluateMix(cs);
  scoreStep(cs, "mix", cs.mixInfo.score, "配合");
  reactAudience(cs, cs.mixInfo.score >= 65 ? "good" : "bad", { force: true });
  // レシピ帳への登録（新発見のときだけ）
  const r = cs.mixInfo.recipe;
  if (r && !state.recipes[r.id]) {
    state.recipes[r.id] = { day: state.day };
    toast(`📖 レシピ帳に書き加えた「${r.name}」`, { kind: "good" });
    if (cs.mode !== "tournament") earnStat("sense", 1);
  }
  await sleep(200);
}

// ---------------------------------------------------------------- 詰め・配置・蒸らし時間

export async function stepPack(cs) {
  await waitBenchReady(cs, "pack");
  const panel = stepPanel("pack", "パッキング", lessonHint(cs, "pack", "空気の通り道を作る。詰め方で抜けと熱の入り方が変わる"));
  const options = [
    { value: "fluffy", label: "ふんわり", surface: "葉の間に空気を残す", desc: "抜けが軽く、煙が出やすい。熱は早く回る" },
    { value: "normal", label: "ノーマル", surface: "均等にならす", desc: "熱が素直に入り、崩れにくい基本の詰め方" },
    { value: "firm", label: "かため", surface: "隙間を詰める", desc: "味が濃く、長持ち。立ち上げには熱が要る" },
  ];
  let selected = options.find(o => o.value === cs.pack) || options[1];
  const vessel = el("div.pack-vessel", { role: "img", dataset: { test: "pack-vessel" } });
  const caption = el("div.pack-caption", { "aria-live": "polite" });
  const confirm = el("button.btn.primary.pack-confirm", { dataset: { test: "pack-confirm" } }, [
    el("span.btn-label", { text: "この詰め方で決める" }),
  ]);
  const choices = options.map(option => el("button.pack-choice", {
    type: "button", dataset: { test: `opt-${option.value}` }, onclick: () => { selected = option; SE.select(); draw(); },
  }, [el("b", { text: option.label }), el("small", { text: option.surface })]));
  function draw() {
    vessel.dataset.pack = selected.value;
    vessel.setAttribute("aria-label", `${DB.equipById[cs.equip.bowl]?.name || "ハガル"}：${selected.label}。${selected.surface}`);
    vessel.replaceChildren(packingBowlPreview(cs, selected.value));
    caption.replaceChildren(el("b", { text: selected.label }), el("p", { text: selected.desc }));
    choices.forEach((button, i) => button.setAttribute("aria-pressed", String(options[i] === selected)));
  }
  panel.append(el("div.packing", [
    el("p.pack-aroma", { dataset: { test: "mix-confirmed-taste" }, text: mixTaste(cs.mix).detail }),
    vessel, caption,
    el("div.pack-choices", { role: "group", "aria-label": "詰め方を見比べる" }, choices),
    el("div.pack-footer", [el("small", { text: "ボウルを見比べて、詰め方を選ぼう" }), confirm]),
  ]));
  draw();
  cs.pack = await new Promise(resolve => {
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      choices.forEach(button => { button.disabled = true; });
      resolve(selected.value);
    }, { once: true });
    if (autoSkill()) setTimeout(() => confirm.click(), 40);
  });
  SE.stamp();
  refreshBench();
}

export async function stepPlace(cs) {
  await waitBenchReady(cs, "place");
  const panel = stepPanel("place", "炭の配置", lessonHint(cs, "place", "基本は同じ炭を三角に3個。配置を決めてから炭を焼く"));
  const layouts = availableCoalLayouts(cs.mode === "tutorial" ? {} : state.flags);
  cs.place = await choose(panel, layouts.map(value => value === "triangle"
    ? { value, label: "トライアングル（3個）", desc: "三角に置いて、熱を均等に届ける", auto: true }
    : { value, label: "4点置き（4個）", desc: "熱が強く入る配置。温度を見て調整する" }));
  cs.coalTypes = coalTypes({ ...cs, coalTypes: null });
  if (cs.mode !== "tutorial" && state.flags[COAL_UNLOCK.mixed] && state.owned.includes("flat_charcoal") && state.owned.includes("cube_charcoal")) {
    const n = coalCount(cs);
    const combination = await choose(stepPanel("place", "炭の組み合わせ", "フラットとキューブの火力を組み合わせる"), [
      { value: "same", label: "同じ炭で揃える", desc: `${n}個とも選んだ炭を使う`, auto: true },
      { value: "mixed", label: "フラット＋キューブ", desc: `キューブ1個とフラット${n - 1}個` },
    ]);
    if (combination === "mixed") cs.coalTypes = ["cube_charcoal", ...Array(n - 1).fill("flat_charcoal")];
  }
  refreshBench();
}

export async function stepSteamTime(cs) {
  await waitBenchReady(cs, "timer");
  await runSteamTimer(cs);
}
