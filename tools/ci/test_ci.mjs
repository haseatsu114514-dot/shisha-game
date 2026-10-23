// node --test tools/ci/test_ci.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BASE_SPARSE, globToRegExp, loadManifest, matchesAny, ROOT, selectSuites, shard } from "./lib.mjs";

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
  assert.equal(selectSuites(manifest, ["tools/ci/suites.json"]).length, manifest.suites.filter((s) => s.kind === "browser").length);
  const craft = selectSuites(manifest, ["remake/js/craft/water-pour.js"]).map((s) => s.id);
  assert.ok(craft.includes("water-pour"));
  assert.ok(matchesAny("data/dialogue/ch1_main.json", manifest.suites.find((s) => s.id === "ch1-presentation").paths));
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
