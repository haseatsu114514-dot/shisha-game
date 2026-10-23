#!/usr/bin/env node
// Decide which browser suites run and split them into groups.
//   node tools/ci/plan.mjs --changed changed.txt   # PR: suites whose paths match
//   node tools/ci/plan.mjs --all [--only a,b]       # nightly / manual
//   node tools/ci/plan.mjs --none --reason "..."    # Draft PR or push to main
// Writes `matrix` and `count` to $GITHUB_OUTPUT and a table to the job summary.
import { appendFileSync, readFileSync } from "node:fs";
import { browserSuites, loadManifest, selectSuites, shard } from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const manifest = loadManifest();
let suites = [];
let reason = arg("--reason") || "";

if (args.includes("--all")) {
  suites = browserSuites(manifest);
  const only = arg("--only");
  if (only) {
    const want = new Set(only.split(",").map((s) => s.trim()).filter(Boolean));
    const unknown = [...want].filter((id) => !suites.some((s) => s.id === id));
    if (unknown.length) {
      console.error(`Unknown suite id: ${unknown.join(", ")}`);
      process.exit(1);
    }
    suites = suites.filter((s) => want.has(s.id));
  }
  reason ||= "all browser suites";
} else if (arg("--changed")) {
  const changed = readFileSync(arg("--changed"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  suites = selectSuites(manifest, changed);
  reason ||= `${changed.length} changed file(s)`;
} else if (!args.includes("--none")) {
  console.error("Use --changed <file>, --all or --none");
  process.exit(2);
}

const groups = shard(suites);
const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `matrix=${JSON.stringify({ include: groups })}\n`);
  appendFileSync(out, `count=${groups.length}\n`);
}
const lines = [
  `### Browser suites: ${suites.length} (${reason})`,
  "",
  groups.length ? "| group | minutes (estimate) | suites |\n| --- | --- | --- |" : "No browser suites run for this event.",
  ...groups.map((g) => `| ${g.shard} | ${g.weight} | ${g.suites.replaceAll(",", ", ")} |`),
  "",
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
