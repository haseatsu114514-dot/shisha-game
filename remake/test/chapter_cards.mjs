// Real chapter card renderers with controlled DOM/UI ports; no browser or SAVE.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const chapter of [4, 5]) {
  const calls = [];
  const plain = value => JSON.parse(JSON.stringify(value));
  const node = (selector, props = {}, children = []) => ({ selector,
    props: Array.isArray(props) ? {} : props, children: Array.isArray(props) ? props : children });
  const values = { el: node, state: {}, DB: {}, CH4_SCENE_FILES: { ch4_spots: [] },
    layers: { hud: { replaceChildren: () => calls.push("hud-clear"),
      classList: { remove: value => calls.push(`hud-remove:${value}`) } } },
    showScreen: (name, root) => calls.push({ name, root }),
    createChapterActions: () => ({}), createChapterMenu: () => owner => calls.push({ menuOwner: owner }) };
  const context = vm.createContext({ console });
  const source = readFileSync(new URL(`../js/chapters/ch${chapter}.js`, import.meta.url), "utf8");
  const runner = new vm.SourceTextModule(source + "\nexport { card };", { context });
  await runner.link(async spec => {
    if (spec === "../core/chapter-card.js") {
      const helperSource = readFileSync(new URL("../js/core/chapter-card.js", import.meta.url), "utf8");
      const helper = new vm.SourceTextModule(helperSource, { context });
      await helper.link(async dependency => {
        const names = dependency === "./util.js" ? ["el"] : ["showScreen"];
        return new vm.SyntheticModule(names, function () {
          for (const name of names) this.setExport(name, values[name]);
        }, { context });
      });
      return helper;
    }
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .filter(match => match[2] === spec).flatMap(match => match[1].split(",").map(name => name.trim()));
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => {}));
    }, { context });
  });
  await runner.evaluate();
  const owner = {};
  const heading = chapter === 4 ? "第四章 ／ 継承の煙" : "第五章 ／ 機械仕掛けの神";
  for (const rich of [false, true]) {
    calls.length = 0;
    const actions = [{ action: 1 }, { action: 2 }], content = { content: true };
    if (rich) runner.namespace.card(owner, "sample", "見出し", "説明", actions, "注記", "scene-id", chapter === 4 ? content : [null, content]);
    else runner.namespace.card(owner, "sample", "見出し", "説明");
    assert.deepEqual(calls.slice(0, 2), ["hud-clear", "hud-remove:show"]);
    assert.equal(calls.length, 3, "HUD clears before one screen replacement");
    const { name, root } = calls[2];
    assert.equal(name, `ch${chapter}`);
    assert.equal(root.selector, "main.ch2-contest");
    assert.equal(root.props.dataset.test, `ch${chapter}-sample`);
    assert.equal(root.props.dataset.scene, rich ? "scene-id" : "");
    const [header, description, note, ...tail] = root.children;
    assert.deepEqual(plain(header.children[0]), node("div", [node("p", { text: heading }), node("h1", { text: "見出し" })]));
    assert.equal(header.selector, "header.ch2-contest-header");
    const menu = header.children[1];
    assert.equal(menu.selector, "button.btn"); assert.equal(menu.props.type, "button");
    assert.equal(menu.props.text, "MENU"); assert.equal(menu.props.dataset.test, `ch${chapter}-menu`);
    assert.equal(typeof menu.props.onclick, "function");
    assert.deepEqual(plain(description), node("p.ch2-contest-description", { text: "説明" }));
    assert.deepEqual(plain(note), rich ? node("p.ch2-contest-note", { text: "注記" }) : null);
    const actionRow = tail.pop();
    assert.equal(actionRow.selector, "div.ch2-contest-actions");
    assert.equal(actionRow.children.length, rich ? 2 : 0);
    if (rich) assert.equal(actionRow.children, actions, "action node identity/order preserved");
    assert.deepEqual(plain(tail), chapter === 4 ? [rich ? content : null] : rich ? [null, content] : []);
    if (rich) assert.equal(tail.at(-1), content, "content nodes are not copied or flattened");
    menu.props.onclick(); assert.equal(calls.at(-1).menuOwner, owner, "MENU keeps its owner");
  }
  for (const extra of chapter === 4 ? [null, false, 0, "", [], [{ nested: true }]] : [[], [null], [false, 0, ""], [{ item: 1 }, { item: 2 }]]) {
    calls.length = 0;
    assert.equal(runner.namespace.card(owner, "boundary", "", "", [], "", "", extra), undefined);
    const children = calls.at(-1).root.children;
    const inserted = children.slice(3, -1);
    if (chapter === 4) { assert.equal(inserted.length, 1); assert.equal(inserted[0], extra); }
    else { assert.equal(inserted.length, extra.length); extra.forEach((item, index) => assert.equal(inserted[index], item)); }
  }
}
console.log("PASS: real chapter 4/5 cards preserve HUD order, DOM, defaults, notes and node identity");
