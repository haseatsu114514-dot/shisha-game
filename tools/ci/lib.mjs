// Shared helpers for the single CI workflow (.github/workflows/ci.yml).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST = join(ROOT, "tools", "ci", "suites.json");

// Folders every browser group checks out. Suites add their own extras with "sparse".
// asset_sources/ (about 3GB) and docs/ (about 0.7GB) are left out except for
// their top-level files and the folders a suite asks for.
export const BASE_SPARSE = [
  "/*",
  "!/*/",
  "/remake/",
  "/data/",
  "/assets/",
  "/tools/",
  "/brand/",
  "/experiments/proto/street/",
  "/docs/",
  "!/docs/*/",
  "/docs/qa/",
  "!/docs/qa/*/",
  "/asset_sources/",
  "!/asset_sources/*/",
  // Read by the appearance setup helper with lazy fetch disabled (most craft tests).
  "/asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json",
];

export function loadManifest(path = MANIFEST) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Same glob rules as GitHub's `paths` filter: `*` stays inside one folder,
// `**` crosses folders, `?` is one character.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file, globs) {
  return globs.some((g) => globToRegExp(g).test(file));
}

export function browserSuites(manifest) {
  return manifest.suites.filter((s) => s.kind === "browser");
}

export function quickSuites(manifest) {
  return manifest.suites.filter((s) => s.kind === "quick");
}

// Browser suites to run for a list of changed files.
export function selectSuites(manifest, changedFiles) {
  const all = browserSuites(manifest);
  if (changedFiles.some((f) => matchesAny(f, manifest.always_all))) return all;
  return all.filter((s) => changedFiles.some((f) => matchesAny(f, s.paths)));
}

// Spread suites over groups so each group takes about `target` minutes,
// longest suites first (LPT). Returns [] when nothing is selected.
export function shard(suites, { maxShards = 8, target = 12 } = {}) {
  if (!suites.length) return [];
  const total = suites.reduce((n, s) => n + s.weight, 0);
  const count = Math.max(1, Math.min(maxShards, suites.length, Math.ceil(total / target)));
  const groups = Array.from({ length: count }, () => ({ suites: [], weight: 0 }));
  const sorted = [...suites].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  for (const s of sorted) {
    const g = groups.reduce((best, x) => (x.weight < best.weight ? x : best), groups[0]);
    g.suites.push(s);
    g.weight += s.weight;
  }
  return groups.map((g, i) => ({
    shard: i + 1,
    suites: g.suites.map((s) => s.id).join(","),
    weight: Math.round(g.weight * 10) / 10,
    sparse: [...new Set([...BASE_SPARSE, ...g.suites.flatMap((s) => s.sparse || [])])].join("\n"),
    pillow: g.suites.some((s) => s.pillow),
  }));
}
