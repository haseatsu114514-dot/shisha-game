// VNエンジンの堅牢化（#1362）と scoreStep の入力防御（#1364）の回帰テスト。
// 実モジュールのソースを vm で読み、依存は SyntheticModule で差し替える（vn_cg_lifetime.mjs と同じ方式）。
// ブラウザも素材も使わない。エンジン内部へは末尾に足す port 経由でのみ触る。
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const engineSource = readFileSync(new URL("../js/vn/engine.js", import.meta.url), "utf8");
const sessionSource = readFileSync(new URL("../js/craft/session.js", import.meta.url), "utf8");

let failures = 0;
function check(name, fn) {
  try { fn(); console.log("PASS", name); }
  catch (e) { failures++; console.log("FAIL", name, e.message); }
}

async function loadModule(source, portSource, overrides) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance });
  const modules = new Map();
  const mod = new vm.SourceTextModule(source + portSource, { context });
  await mod.link(async (specifier) => {
    if (modules.has(specifier)) return modules.get(specifier);
    const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .filter((m) => m[2] === specifier)
      .flatMap((m) => m[1].split(",").map((n) => n.trim()));
    const dep = new vm.SyntheticModule(imports, function () {
      for (const name of imports) this.setExport(name, overrides[name] ?? (() => {}));
    }, { context });
    modules.set(specifier, dep);
    return dep;
  });
  await mod.evaluate();
  return mod.namespace;
}

// ---------------- VNエンジン（#1362） ----------------
const vnState = { stats: {}, money: 0, flags: {}, met: {}, contacts: [] };
const vnDb = {
  dialogues: {
    jump_target: { dialogue_id: "jump_target", lines: [{ text: "jumped" }], branches: {}, metadata: {} },
  },
  flavorById: {},
};
const nameData = await import("../js/core/data.js");
nameData.DB.characters = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8")).map(c => [c.id, c]));
const vn = await loadModule(engineSource, `
export const robustPort = { handleCondition, jumpTo, lineDisplayName, getVnWarnings, clearVnWarnings, hooks,
  setRunning: (r) => { running = r; }, getRunning: () => running };
`, { state: vnState, DB: vnDb, config: {}, displayName: nameData.displayName, STAT_EN: {}, affinityLevel: () => 0, tournamentFinished: () => false, basicsExperienced: () => false });
const port = vn.robustPort;

function fakeRunning() {
  return {
    id: "root_dlg", currentId: "root_dlg",
    dlg: { dialogue_id: "root_dlg", lines: [], branches: {}, metadata: {} },
    queue: [], branches: { yes: [{ text: "YES" }], no: [{ text: "NO" }] },
    visited: ["root_dlg"], slots: {}, context: null,
  };
}
function condition(line) {
  const r = fakeRunning();
  port.setRunning(r);
  port.handleCondition(line);
  return r;
}
const hasWarning = (kind, detail) => port.getVnWarnings().some((w) => w.kind === kind && w.detail === detail);

check("flag_count: 数値の閾値0を保持する（0 >= 0 で true）", () => {
  vnState.flags = { f: 0 };
  const r = condition({ condition_type: "flag_count", flag: "f", threshold: 0, next_true: "yes", next_false: "no" });
  assert.equal(r.queue[0]?.text, "YES");
});
check("flag_count: 文字列の閾値 '0' も同じ結果になる", () => {
  vnState.flags = { f: 0 };
  const r = condition({ condition_type: "flag_count", flag: "f", threshold: "0", next_true: "yes", next_false: "no" });
  assert.equal(r.queue[0]?.text, "YES");
});
check("flag_count: 閾値省略時は従来どおり既定1", () => {
  vnState.flags = { f: 0 };
  const r = condition({ condition_type: "flag_count", flag: "f", next_true: "yes", next_false: "no" });
  assert.equal(r.queue[0]?.text, "NO");
});
check("flag_count: 通常の閾値比較は変えない", () => {
  vnState.flags = { f: 2 };
  assert.equal(condition({ condition_type: "flag_count", flag: "f", threshold: 2, next_true: "yes", next_false: "no" }).queue[0]?.text, "YES");
  vnState.flags = { f: 1 };
  assert.equal(condition({ condition_type: "flag_count", flag: "f", threshold: 2, next_true: "yes", next_false: "no" }).queue[0]?.text, "NO");
});
check("未知の条件タイプ（フックなし）は false 扱い＋警告を集約する", () => {
  port.clearVnWarnings();
  const line = { condition_type: "mystery_kind", next_true: "yes", next_false: "no" };
  assert.equal(condition(line).queue[0]?.text, "NO");
  assert.ok(hasWarning("condition-unknown", "mystery_kind"));
  condition(line); // 同じ警告は重複させない
  assert.equal(port.getVnWarnings().filter((w) => w.kind === "condition-unknown").length, 1);
});
check("未知の条件タイプ: フックが undefined を返したら警告、値を返したら従う", () => {
  port.clearVnWarnings();
  port.hooks.evalCondition = () => undefined;
  assert.equal(condition({ condition_type: "custom_kind", next_true: "yes", next_false: "no" }).queue[0]?.text, "NO");
  assert.ok(hasWarning("condition-unknown", "custom_kind"));
  port.hooks.evalCondition = () => true;
  assert.equal(condition({ condition_type: "custom_kind", next_true: "yes", next_false: "no" }).queue[0]?.text, "YES");
  port.hooks.evalCondition = null;
});
check("解決できない分岐キーは警告する（黙って素通りしない）", () => {
  port.clearVnWarnings();
  vnState.flags = { x: true };
  const r = condition({ condition_type: "flag", flag: "x", next_true: "missing_key" });
  assert.equal(r.queue.length, 0);
  assert.ok(hasWarning("branch-unresolved", "missing_key"));
});
check("jumpTo: 存在しない台本は警告して何もしない", () => {
  port.clearVnWarnings();
  port.setRunning(fakeRunning());
  assert.equal(port.jumpTo("no_such_dlg"), undefined);
  assert.ok(hasWarning("jump-target-missing", "no_such_dlg"));
});
check("jumpTo: currentId を jump 先へ引き継ぎ、開始台本の id は残す", () => {
  const r = fakeRunning();
  port.setRunning(r);
  assert.equal(port.jumpTo("jump_target"), false); // 背景指定なし
  assert.equal(r.currentId, "jump_target");
  assert.equal(r.id, "root_dlg");
  assert.deepEqual(r.visited, ["root_dlg", "jump_target"]);
  assert.equal(r.queue[0]?.text, "jumped");
});

check("LIMEの名前表示: 明示metadataだけを使い、既存の公私名・未知名・声を保つ", () => {
  const r = fakeRunning(); r.dlg.metadata.contact_channel = "lime";
  vnState.met = { naru: true, minto: true }; vnState.flags = {};
  assert.equal(port.lineDisplayName({ speaker: "naru" }, r), "なる（LIME）");
  assert.equal(port.lineDisplayName({ speaker: "adam" }, r), "？？？（LIME）");
  assert.equal(port.lineDisplayName({ speaker: "minto" }, r), "みんと（LIME）");
  vnState.flags._minto_name_known = true;
  assert.equal(port.lineDisplayName({ speaker: "minto" }, r), "みんと（LIME）");
  r.context = "private";
  assert.equal(port.lineDisplayName({ speaker: "minto" }, r), `${nameData.DB.characters.minto.private_name}（LIME）`);
  assert.equal(port.lineDisplayName({ speaker: "samechan", voice: "korochan" }, r), "コロちゃん（LIME）");
  assert.equal(port.lineDisplayName({ speaker: "" }, r), "");
  delete r.dlg.metadata.contact_channel; r.id = r.currentId = "filename_lime";
  assert.equal(port.lineDisplayName({ speaker: "naru" }, r), "なる", "IDの字面では経路を推測しない");
});

check("LIMEの名前表示: jump先のmetadataへ切り替わり、対面へ持ち越さない", () => {
  const r = fakeRunning(); r.dlg.metadata.contact_channel = "lime";
  port.setRunning(r); port.jumpTo("jump_target");
  assert.equal(port.lineDisplayName({ speaker: "naru" }, r), "なる");
  vnDb.dialogues.jump_target.metadata.contact_channel = "lime";
  assert.equal(port.lineDisplayName({ speaker: "naru" }, r), "なる（LIME）");
  delete vnDb.dialogues.jump_target.metadata.contact_channel;
});

// ---------------- scoreStep（#1364） ----------------
const craft = await loadModule(sessionSource, `
export const robustPort = { scoreStep };
`, { state: { chapter: 1, flags: {}, flavorMastery: {}, equip: {}, day: 1 }, rand: () => 0 });
const scoreStep = craft.robustPort.scoreStep;
const freshCs = () => ({ arcade: { total: 0, parts: {} } });

check("scoreStep: 通常の工程点は従来どおり（穴あけ100点で20000）", () => {
  const cs = freshCs();
  assert.equal(scoreStep(cs, "holes", 100), 20000);
  assert.equal(scoreStep(cs, "mix", 50), 20000 + 2500);
});
check("scoreStep: 100を超える点は100に丸める", () => {
  const cs = freshCs();
  scoreStep(cs, "holes", 101);
  assert.equal(cs.arcade.parts.holes, 20000);
  scoreStep(cs, "heat", 100000);
  assert.equal(cs.arcade.parts.heat, 20000);
});
check("scoreStep: Infinity / NaN は 0 として扱い、記録へ伝播させない", () => {
  const cs = freshCs();
  scoreStep(cs, "holes", Infinity);
  assert.equal(cs.arcade.parts.holes, 0);
  scoreStep(cs, "steam", NaN);
  assert.equal(cs.arcade.parts.steam, 0);
  assert.ok(Number.isFinite(cs.arcade.total));
});
check("scoreStep: 負数と undefined は従来どおり 0", () => {
  const cs = freshCs();
  scoreStep(cs, "pull", -30);
  assert.equal(cs.arcade.parts.pull, 0);
  scoreStep(cs, "pull", undefined);
  assert.equal(cs.arcade.parts.pull, 0);
});


// #2446: 本名は身分証ではなく本人の名乗りで知る。正体既知/未知・旧セーブの全経路を読む。
check("みんとの名乗りは正体の既読に依存せず、名前欄は本人が名乗った後だけ", () => {
  const scenes = JSON.parse(readFileSync(new URL("../../data/dialogue/ch1_minto.json", import.meta.url), "utf8")).dialogues;
  const all = Array.isArray(scenes) ? scenes : Object.values(scenes);
  function readScene(id, flags) {
    vnState.flags = { ...flags };
    const dlg = all.find(d => d.dialogue_id === id);
    assert(dlg, id);
    const r = { ...fakeRunning(), dlg, context: dlg.metadata?.private_scene ? "private" : null, branches: dlg.branches || {}, queue: [...dlg.lines] };
    const seen = [];
    port.setRunning(r);
    while (r.queue.length) {
      const line = r.queue.shift();
      if (line.type === "condition") port.handleCondition(line);
      else if (line.type === "set_flag") vnState.flags[line.flag] = true;
      else if (line.text) seen.push({ text: line.text, name: port.lineDisplayName(line, r) });
    }
    return seen;
  }
  for (const known of [false, true]) for (const checked of [false, true]) {
    const seen = readScene("ch1_minto_fifth", { _minto_identity_revealed: known, _oneesan_id_checked: checked });
    const intro = seen.findIndex(line => line.text.includes("名前は、緑川栞"));
    assert(intro >= 0);
    assert(seen.slice(0, intro + 1).every(line => !line.name?.includes("栞")));
    assert(!seen.some(line => /身分証で|名前は、あの時見てた/.test(line.text)));
    assert.equal(vnState.flags._minto_name_known, true);
    assert(seen.slice(intro + 1).some(line => line.name === "栞"));
  }
  for (const known of [false, true]) {
    const seen = readScene("ch1_minto_private_1", { _minto_name_known: known });
    assert.equal(seen.some(line => line.text.includes("私、緑川栞")), !known);
    assert.equal(vnState.flags._minto_name_known, true);
  }
});

process.exitCode = failures ? 1 : 0;
