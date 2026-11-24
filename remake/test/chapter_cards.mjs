// Real chapter card renderers with controlled DOM/UI ports; no browser or SAVE.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const chapter of [4, 5]) {
  const calls = [];
  const plain = value => JSON.parse(JSON.stringify(value));
  const node = (selector, props = {}, children = []) => ({ selector,
    props: Array.isArray(props) ? {} : props, children: Array.isArray(props) ? props : children });
  let creditsPending = true;
  const values = { el: node, state: { flags: {} }, DB: {}, CH4_SCENE_FILES: { ch4_spots: [] },
    layers: { hud: { replaceChildren: () => calls.push("hud-clear"),
      classList: { remove: value => calls.push(`hud-remove:${value}`) } } },
    showScreen: (name, root) => calls.push({ name, root }),
    createChapterMenu: () => owner => calls.push({ menuOwner: owner }),
    chapterFourProgress: () => ({ read: {} }), chapterFiveCreditsPending: () => creditsPending,
    canReflect: () => true, saveFlow: () => calls.push("manual-save"), save: () => calls.push("auto-save") };
  const context = vm.createContext({ console, location: { reload: () => calls.push("title-reload") } });
  const source = readFileSync(new URL(`../js/chapters/ch${chapter}.js`, import.meta.url), "utf8");
  const runner = new vm.SourceTextModule(source + `
    export { card, renderComplete };
    export function openForTest() { return session = { state, active: true }; }
  `, { context });
  await runner.link(async spec => {
    if (spec === "../core/chapter-card.js" || spec === "../core/chapter-actions.js") {
      const helperSource = readFileSync(new URL(`../js/${spec.slice(3)}`, import.meta.url), "utf8");
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
  // #3938: only the completion card is a chapter-clear screen (the level-up plate moves off its text).
  calls.length = 0;
  runner.namespace.card(owner, "complete", "完", "説明");
  assert.equal(calls.at(-1).root.selector, "main.ch2-contest.chapter-clear");
  assert.equal(calls.at(-1).root.props.dataset.test, `ch${chapter}-complete`);

  // 第5章は初回スタッフロールの前後を両方確認する。盤の入口は標準の操作の後ろに並ぶ。
  for (const pending of chapter === 4 ? [false] : [true, false]) {
    calls.length = 0;
    creditsPending = pending;
    runner.namespace.renderComplete(runner.namespace.openForTest());
    const actions = calls.at(-1).root.children.at(-1).children;
    assert.deepEqual(Array.from(actions, ({ selector, props }) => [selector, props.dataset.test, props.text]), [
      chapter === 4 ? ["button.btn.primary", "ch4-chapter-five", "第5章へ進む"]
        : ["button.btn.primary", "ch5-complete-credits", pending ? "スタッフロールへ" : "スタッフロールを見る"],
      ["button.btn", `ch${chapter}-complete-save`, "ここまでをセーブ"],
      ...(!pending ? [["button.btn", `ch${chapter}-complete-title`, "タイトルへ"]] : []),
      ...(chapter === 5 ? [["button.btn", "ch5-reflect", "観音堂で盤を開く（時間は進まない）"]] : []),
    ]);
    await actions[1].props.onclick();
    assert.equal(calls.at(-1), "manual-save");
    if (!pending) {
      await actions[2].props.onclick();
      assert.deepEqual(calls.slice(-2), ["auto-save", "title-reload"]);
    }
  }
}
console.log("PASS: real chapter 4/5 cards preserve HUD order, DOM, and completion actions including the credits gate");
