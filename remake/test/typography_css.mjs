import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = "remake/css";
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : entry.name.endsWith(".css") ? [path] : [];
});
const failures = [];

for (const path of files(root)) {
  const css = readFileSync(path, "utf8");
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/gs)) {
    const [, selector, body] = match;
    const sizes = [...body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)].map((item) => Number(item[1]));
    if (!sizes.length) continue;
    const line = css.slice(0, match.index).split("\n").length;
    const label = `${path}:${line} ${selector.trim().split("\n").at(-1).trim()}`;
    if (sizes.some((size) => size < 12)) failures.push(`${label}: font-size below 12px`);
    if (sizes.some((size) => size >= 12 && size <= 13)) {
      const weights = [...body.matchAll(/font-weight\s*:\s*(\d+)/g)].map((item) => Number(item[1]));
      if (weights.some((weight) => weight < 700)) failures.push(`${label}: 12–13px with font-weight below 700`);
      const spacing = [...body.matchAll(/letter-spacing\s*:\s*(\d*\.?\d+)em/g)].map((item) => Number(item[1]));
      if (spacing.some((value) => value > 0.02)) failures.push(`${label}: 12–13px with letter-spacing above 0.02em`);
    }
  }
}

assert.deepEqual(failures, [], failures.join("\n"));
console.log(`Typography CSS: ${files(root).length} files checked`);
