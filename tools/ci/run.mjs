#!/usr/bin/env node
// Run CI suites from tools/ci/suites.json one after another.
//   node tools/ci/run.mjs --kind quick
//   node tools/ci/run.mjs --kind browser --suites a,b,c
// Every command of every suite runs even after a failure, so one CI run shows
// all problems. Each suite has its own time limit (minutes, "timeout").
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { loadManifest, ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const kind = arg("--kind");
const manifest = loadManifest();
let suites = manifest.suites.filter((s) => s.kind === kind);
const only = arg("--suites");
if (only) {
  const want = only.split(",").filter(Boolean);
  suites = want.map((id) => {
    const s = suites.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown ${kind} suite: ${id}`);
    return s;
  });
}
if (!suites.length) {
  console.error(`No ${kind || "?"} suites to run`);
  process.exit(2);
}

const CHROME = {
  playwright: process.env.PLAYWRIGHT_CHROMIUM,
  system: "/opt/google/chrome/chrome",
};

function killGroup(child, signal = "SIGTERM") {
  try {
    process.kill(-child.pid, signal);
  } catch {}
}

function runCommand(cmd, env, deadline) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bash", ["-o", "pipefail", "-c", cmd], { cwd: ROOT, env, stdio: "inherit", detached: true });
    let timedOut = false;
    const ms = Math.max(1000, deadline - Date.now());
    const timer = setTimeout(() => {
      timedOut = true;
      console.log(`::error::Timed out: ${cmd}`);
      killGroup(child);
      setTimeout(() => killGroup(child, "SIGKILL"), 10_000).unref();
    }, ms);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      // Stop anything the command left running in the background.
      killGroup(child, "SIGKILL");
      resolve({ cmd, ok: code === 0 && !timedOut, code, signal, timedOut, seconds: (Date.now() - started) / 1000 });
    });
  });
}

async function waitFor(url, seconds = 30) {
  for (let i = 0; i < seconds * 4; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function restoreTrackedFiles(suiteId) {
  const diff = spawnSync("git", ["diff", "--name-only"], { cwd: ROOT, encoding: "utf8" });
  const files = (diff.stdout || "").split("\n").filter(Boolean);
  if (!files.length) return;
  console.log(`::warning::${suiteId} changed tracked files; restoring them so later suites start clean: ${files.slice(0, 10).join(", ")}`);
  spawnSync("git", ["checkout", "--", ...files], { cwd: ROOT, stdio: "inherit" });
}

const results = [];
for (const suite of suites) {
  console.log(`::group::${suite.id} — ${suite.title}`);
  const started = Date.now();
  const deadline = started + (suite.timeout || 15) * 60_000;
  const env = { ...process.env, ...(suite.env || {}) };
  if (suite.chrome) {
    if (!CHROME[suite.chrome]) throw new Error(`${suite.id}: chrome "${suite.chrome}" is not available`);
    env.CHROME_EXECUTABLE_PATH = CHROME[suite.chrome];
  }
  for (const key of ["ARTIFACT_DIR", "SHOTS", "COMPARISON_DIR"]) {
    if (env[key]) mkdirSync(env[key], { recursive: true });
  }
  const servers = [];
  let ready = true;
  for (const server of suite.servers || []) {
    const child = spawn("bash", ["-c", server.run], { cwd: ROOT, env, stdio: "inherit", detached: true });
    servers.push(child);
    if (!(await waitFor(server.url))) {
      console.log(`::error::${suite.id}: server did not start: ${server.run}`);
      ready = false;
    }
  }
  const commands = [];
  if (ready) {
    for (const cmd of suite.run) {
      console.log(`\n$ ${cmd}`);
      const r = await runCommand(cmd, env, deadline);
      commands.push(r);
      if (!r.ok) console.log(`::error::${suite.id} failed: ${cmd}${r.timedOut ? " (timed out)" : ` (exit ${r.code ?? r.signal})`}`);
    }
  }
  for (const child of servers) killGroup(child, "SIGKILL");
  restoreTrackedFiles(suite.id);
  const ok = ready && commands.every((r) => r.ok);
  const minutes = (Date.now() - started) / 60_000;
  results.push({ suite, ok, minutes, failed: commands.filter((r) => !r.ok) });
  console.log(`::endgroup::`);
  console.log(`${ok ? "PASS" : "FAIL"} ${suite.id} (${minutes.toFixed(1)} min)`);
}

const failed = results.filter((r) => !r.ok);
const table = [
  `### ${kind} suites: ${results.length - failed.length}/${results.length} passed`,
  "",
  "| suite | result | minutes | estimate |",
  "| --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.suite.id} | ${r.ok ? "✅" : "❌"} | ${r.minutes.toFixed(1)} | ${r.suite.weight ?? "-"} |`),
  "",
  ...failed.flatMap((r) => [
    `**${r.suite.id}** failed:`,
    ...(r.failed.length ? r.failed.map((c) => `- \`${c.cmd}\`${c.timedOut ? " (timed out)" : ""}`) : ["- server did not start"]),
  ]),
  "",
];
console.log(table.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table.join("\n") + "\n");
process.exit(failed.length ? 1 : 0);
