#!/usr/bin/env node
// Run CI suites from tools/ci/suites.json one after another.
//   node tools/ci/run.mjs --kind quick
//   node tools/ci/run.mjs --kind browser --suites a,b,c
// Commands continue after failures while the attempt has time remaining.
// Browser suites retry once. Each attempt has its own time limit.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
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

let aborted = false;
const activeChildren = new Set();
const abortController = new AbortController();

function killGroup(child, signal = "SIGTERM") {
  try {
    process.kill(-child.pid, signal);
  } catch {}
}

function abort() {
  aborted = true;
  abortController.abort();
  for (const child of activeChildren) killGroup(child, "SIGKILL");
}

process.on("SIGINT", abort);
process.on("SIGTERM", abort);

function runCommand(cmd, env, deadline) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bash", ["-o", "pipefail", "-c", cmd], { cwd: ROOT, env, stdio: "inherit", detached: true });
    activeChildren.add(child);
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
      activeChildren.delete(child);
      resolve({ cmd, ok: code === 0 && !timedOut && !aborted, code, signal, timedOut, seconds: (Date.now() - started) / 1000 });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      killGroup(child, "SIGKILL");
      activeChildren.delete(child);
      resolve({ cmd, ok: false, code: null, signal: null, timedOut, error: error.message, seconds: (Date.now() - started) / 1000 });
    });
  });
}

async function waitFor(url, seconds = 30) {
  for (let i = 0; i < seconds * 4; i++) {
    if (aborted) return false;
    try {
      const res = await fetch(url, { signal: abortController.signal });
      if (res.ok || res.status < 500) return true;
    } catch {}
    if (aborted) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const changedFiles = () => (spawnSync("git", ["diff", "--name-only"], { cwd: ROOT, encoding: "utf8" }).stdout || "")
  .split("\n").filter(Boolean);
// Files already changed before the run (local work in progress) are never touched.
const changedBeforeRun = new Set(changedFiles());
if (changedBeforeRun.size) console.log(`Local changes are left as they are: ${[...changedBeforeRun].slice(0, 10).join(", ")}`);

function restoreTrackedFiles(suiteId) {
  const files = changedFiles().filter((f) => !changedBeforeRun.has(f));
  if (!files.length) return true;
  console.log(`::warning::${suiteId} changed tracked files; restoring them so later suites start clean: ${files.slice(0, 10).join(", ")}`);
  return spawnSync("git", ["checkout", "--", ...files], { cwd: ROOT, stdio: "inherit" }).status === 0;
}

function retryArtifactPath(value) {
  const next = `${value}-retry1`;
  const path = relative(resolve(ROOT, ".codex/artifacts"), resolve(ROOT, next));
  if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`Retry artifact directory must stay under .codex/artifacts: ${next}`);
  }
  return next;
}

const results = [];
for (const suite of suites) {
  if (aborted) break;
  console.log(`::group::${suite.id} — ${suite.title}`);
  const started = Date.now();
  const attempts = [];
  const maxAttempts = kind === "browser" ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (aborted) break;
    if (attempt === 2) {
      console.log(`::warning::${suite.id} attempt 1 failed; retrying once`);
    }
    const attemptStarted = Date.now();
    const deadline = attemptStarted + (suite.timeout ?? (kind === "browser" ? 30 : 15)) * 60_000;
    const env = { ...process.env, ...(suite.env || {}) };
    const servers = [];
    const commands = [];
    const errors = [];
    let ready = true;
    let cleanupOk = true;

    try {
      if (suite.chrome) {
        if (!CHROME[suite.chrome]) throw new Error(`${suite.id}: chrome "${suite.chrome}" is not available`);
        env.CHROME_EXECUTABLE_PATH = CHROME[suite.chrome];
      }
      for (const key of ["ARTIFACT_DIR", "SHOTS", "COMPARISON_DIR"]) {
        if (env[key] !== undefined) {
          if (attempt === 2) env[key] = retryArtifactPath(env[key]);
          if (env[key]) mkdirSync(resolve(ROOT, env[key]), { recursive: true });
        }
      }

      for (const server of suite.servers || []) {
        if (aborted || Date.now() >= deadline) {
          ready = false;
          errors.push(aborted ? "aborted" : "server startup skipped (timeout)");
          break;
        }
        const child = spawn("bash", ["-c", server.run], { cwd: ROOT, env, stdio: "inherit", detached: true });
        activeChildren.add(child);
        const state = { child, ended: false, error: null, stopped: null };
        state.stopped = new Promise((resolve) => {
          child.once("error", (error) => {
            state.error = error.message;
            state.ended = true;
            activeChildren.delete(child);
            resolve();
          });
          child.once("exit", () => {
            state.ended = true;
            activeChildren.delete(child);
            resolve();
          });
        });
        servers.push(state);
        const available = await waitFor(server.url);
        if (!available || state.ended) {
          const message = `server did not start: ${server.run}${state.error ? ` (${state.error})` : ""}`;
          console.log(`::error::${suite.id}: ${message}`);
          errors.push(message);
          ready = false;
        }
      }

      for (const cmd of suite.run) {
        if (aborted) {
          commands.push({ cmd, ok: false, skipped: "aborted", timedOut: false, seconds: 0 });
          continue;
        }
        if (Date.now() >= deadline) {
          commands.push({ cmd, ok: false, skipped: "timeout", timedOut: true, seconds: 0 });
          console.log(`::error::${suite.id} failed: ${cmd} (not run: timeout)`);
          continue;
        }
        if (!ready) {
          commands.push({ cmd, ok: false, skipped: "server did not start", timedOut: false, seconds: 0 });
          continue;
        }
        console.log(`\n$ ${cmd}`);
        const r = await runCommand(cmd, env, deadline);
        commands.push(r);
        if (!r.ok) {
          console.log(`::error::${suite.id} failed: ${cmd}${r.timedOut ? " (timed out)" : ` (${r.error || `exit ${r.code ?? r.signal}`})`}`);
        }
      }
    } catch (error) {
      ready = false;
      errors.push(error.message);
      console.log(`::error::${suite.id}: ${error.message}`);
    } finally {
      for (const { child } of servers) killGroup(child, "SIGKILL");
      await Promise.all(servers.map((server) => server.stopped));
      try {
        cleanupOk = restoreTrackedFiles(suite.id);
      } catch (error) {
        cleanupOk = false;
        errors.push(`cleanup failed: ${error.message}`);
      }
      if (!cleanupOk) {
        errors.push("cleanup failed: tracked files were not restored");
        console.log(`::error::${suite.id}: tracked file restoration failed`);
      }
    }

    if (aborted && !errors.includes("aborted")) errors.push("aborted");
    const ok = !aborted && ready && cleanupOk &&
      commands.length === suite.run.length && commands.every((r) => r.ok);
    attempts.push({
      ok,
      cleanupOk,
      minutes: (Date.now() - attemptStarted) / 60_000,
      failed: commands.filter((r) => !r.ok),
      errors,
    });
    // A failed cleanup cannot provide a clean retry.
    if (ok || !cleanupOk || aborted) break;
  }

  const ok = !aborted && attempts.length > 0 &&
    attempts.every((a) => a.cleanupOk) && attempts.at(-1).ok;
  const status = ok ? (attempts.length === 2 ? "FLAKY" : "PASS") : "FAIL";
  const minutes = (Date.now() - started) / 60_000;
  results.push({ suite, ok, status, minutes, attempts });
  console.log(`::endgroup::`);
  console.log(`${status} ${suite.id} (${minutes.toFixed(1)} min)`);
  if (aborted) break;
}

function attemptDetails(attempt) {
  return [
    ...attempt.failed.map((c) =>
      `- \`${c.cmd}\`${c.skipped ? ` (not run: ${c.skipped})` : c.timedOut ? " (timed out)" : c.error ? ` (${c.error})` : ""}`),
    ...attempt.errors.map((error) => `- ${error}`),
  ];
}

const failed = results.filter((r) => !r.ok);
const flaky = results.filter((r) => r.status === "FLAKY");
const retryMinutes = results.reduce((sum, r) => sum + (r.attempts[1]?.minutes ?? 0), 0);
const icons = { PASS: "✅", FLAKY: "⚠️", FAIL: "❌" };
const table = [
  `### ${kind} suites: ${results.length - failed.length}/${results.length} passed${flaky.length ? ` (${flaky.length} flaky)` : ""}`,
  "",
  "| suite | result | minutes | estimate | attempts |",
  "| --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.suite.id} | ${icons[r.status]} | ${r.minutes.toFixed(1)} | ${r.suite.weight ?? "-"} | ${r.attempts.length} |`),
  "",
  ...failed.flatMap((r) => [
    `**${r.suite.id}** failed:`,
    ...r.attempts.flatMap((attempt, i) => [
      `Attempt ${i + 1}:`,
      ...attemptDetails(attempt),
    ]),
    "",
  ]),
  ...(flaky.length ? [
    "### Flaky suites — first-attempt failures",
    "",
    ...flaky.flatMap((r) => [
      `**${r.suite.id}** attempt 1:`,
      ...attemptDetails(r.attempts[0]),
      "",
    ]),
  ] : []),
  ...(aborted ? ["Run aborted.", ""] : []),
  `Flaky: ${flaky.length} suite(s); retry added ${retryMinutes.toFixed(1)} min`,
];
console.log(table.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table.join("\n") + "\n");
process.exit(aborted || failed.length ? 1 : 0);
