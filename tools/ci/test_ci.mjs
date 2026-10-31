// node --test tools/ci/test_ci.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BASE_SPARSE, PR_BROWSER_MAX_WEIGHT, browserSuites, globToRegExp, loadManifest, matchesAny, ROOT, selectSuites, shard } from "./lib.mjs";

const manifest = loadManifest();

test("globs follow GitHub paths filter rules", () => {
  assert.ok(globToRegExp("remake/**").test("remake/js/core/state.js"));
  assert.ok(globToRegExp("assets/**/*.png").test("assets/a.png"));
  assert.ok(globToRegExp("assets/**/*.png").test("assets/x/y/a.png"));
  assert.ok(!globToRegExp("assets/**/*.png").test("assets/a.webp"));
  assert.ok(globToRegExp("remake/js/craft/water*.js").test("remake/js/craft/water-pour.js"));
  assert.ok(!globToRegExp("remake/js/craft/water*.js").test("remake/js/craft/sub/water.js"));
  assert.ok(globToRegExp("assets/proto_*/**").test("assets/proto_walk/a/b.png"));
  assert.ok(globToRegExp("remake/test/natural_wrap*").test("remake/test/natural_wrap_cases.json"));
  assert.ok(!globToRegExp("data/flavors.json").test("data/flavors.jsonx"));
  assert.ok(globToRegExp("remake/js/chapters/ch2*.js").test("remake/js/chapters/ch2-tournament.js"));
});

test("suite manifest is complete and consistent", () => {
  const ids = new Set();
  for (const s of manifest.suites) {
    assert.ok(/^[a-z0-9-]+$/.test(s.id), `bad id ${s.id}`);
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.ok(["quick", "browser"].includes(s.kind), `${s.id}: kind`);
    assert.ok(Array.isArray(s.run) && s.run.length, `${s.id}: run`);
    if (s.kind === "browser") {
      assert.ok(s.paths?.length, `${s.id}: browser suites need paths`);
      assert.ok(typeof s.weight === "number" && s.weight > 0, `${s.id}: weight`);
      assert.ok(typeof s.timeout === "number" && s.timeout > 0, `${s.id}: timeout`);
      assert.ok(!s.chrome || ["playwright", "system"].includes(s.chrome), `${s.id}: chrome`);
    }
    for (const cmd of s.run) {
      for (const m of cmd.matchAll(/(?:^|\s)((?:remake|tools|asset_sources)\/[\w./-]+\.(?:mjs|py|js))/g)) {
        assert.ok(existsSync(join(ROOT, m[1])), `${s.id}: missing ${m[1]}`);
      }
    }
  }
});

test("only removed workflows' tests changed owner, nothing selects nothing", () => {
  assert.equal(selectSuites(manifest, ["README.md"]).length, 0);
  assert.equal(selectSuites(manifest, ["tools/ci/suites.json"]).length, 0);
  const craft = selectSuites(manifest, ["remake/js/craft/water-pour.js"]).map((s) => s.id);
  assert.ok(craft.includes("water-pour"));
  assert.ok(matchesAny("data/dialogue/ch1_main.json", manifest.suites.find((s) => s.id === "ch1-presentation").paths));
});

test("chapter 3 changes do not start unrelated chapter and feature suites", () => {
  const changed = [
    "data/dialogue/ch3_prologue.json",
    "remake/js/chapters/ch3.js",
    "remake/css/ch3-kuze-video.css",
    "assets/backgrounds/bg_ch3_kuze_video.png",
    "remake/img/backgrounds/bg_ch3_kuze_video.webp",
    "remake/data/manifest.json",
    "remake/index.html",
    "remake/test/browser/ch2_tournament.mjs",
  ];
  const selected = new Set(selectSuites(manifest, changed).map((s) => s.id));
  for (const id of ["ch2-tournament", "ch3-tournament", "game-layout"])
    assert.ok(selected.has(id), `${id} must run`);
  for (const id of ["relationships", "minto-progression", "ch1-practice", "playthrough-direct"])
    assert.ok(!selected.has(id), `${id} is unrelated`);
  assert.ok(selected.size < 25, `chapter 3 selected ${selected.size} browser suites`);
});

test("PR browser selection keeps related short suites and changed tests", () => {
  const all = browserSuites(manifest);
  for (const file of ["remake/js/core/state.js", "remake/js/vn/engine.js", "data/characters.json"]) {
    const selected = selectSuites(manifest, [file]);
    assert.ok(selected.length > 0 && selected.length < all.length, `${file} should select a focused set`);
    assert.ok(selected.every((s) => s.weight <= PR_BROWSER_MAX_WEIGHT));
  }
  assert.deepEqual(selectSuites(manifest, ["remake/js/core/train-icon.js"]).map((s) => s.id),
    ["home-rig-backgrounds", "maps-and-shop"]);
  assert.ok(selectSuites(manifest, ["remake/test/browser/play_spots.mjs"])
    .some((s) => s.id === "play-spots"), "a changed browser test runs its long suite");
  assert.equal(browserSuites(manifest).length, all.length, "nightly still has every suite");
});

test("sharding keeps every suite once and stays within the group limit", () => {
  const suites = manifest.suites.filter((s) => s.kind === "browser");
  const groups = shard(suites);
  assert.ok(groups.length >= 1 && groups.length <= 8);
  const seen = groups.flatMap((g) => g.suites.split(","));
  assert.deepEqual([...seen].sort(), suites.map((s) => s.id).sort());
  assert.deepEqual(shard([]), []);
  const one = shard([suites[0]]);
  assert.equal(one.length, 1);
  assert.ok(one[0].sparse.startsWith(BASE_SPARSE.join("\n")));
  const extra = shard(suites.filter((s) => s.id === "hud-fortune"));
  assert.ok(extra[0].sparse.includes("/asset_sources/fortune-teller-682/"));
  assert.equal(extra[0].pillow, true);
});
