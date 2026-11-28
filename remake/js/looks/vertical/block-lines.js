const SKIP_TAGS = new Set(["rt", "rp", "script", "style", "svg", "canvas", "img", "button"]);
/** 絵の見えている幅（親が overflow で切り取っていれば、その幅まで）。 */
function visibleWidth(img) {
  let width = img.getBoundingClientRect().width;
  for (let node = img.parentElement; node && node.id !== "fx"; node = node.parentElement) {
    if (getComputedStyle(node).overflow !== "visible") width = Math.min(width, node.getBoundingClientRect().width);
  }
  return width;
}

/** 行の中の文字（ふりがな・隠れている所は除く）。数字のめくり（.tr-flip）は新しい方だけ読む。 */
function inlineText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.data;
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(node.localName)) return "";
  if (node.classList.contains("tr-flip")) return node.lastElementChild?.textContent || "";
  const cs = getComputedStyle(node);
  if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.3) return "";
  let out = "";
  for (const child of node.childNodes) out += inlineText(child);
  return out;
}

/**
 * 覆いの中に見えている文字を、上から順に行として読む。行は「ブロックの箱」ごと（インラインの子はつなげる）。
 * 戻り値: [{ text, size（ステージ上の字の大きさ px） }]
 */
export function readLines(root, opacity, lines) {
  if (SKIP_TAGS.has(root.localName) || root.hidden) return;
  const cs = getComputedStyle(root);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const visible = opacity * (parseFloat(cs.opacity) || 0);
  if (visible < 0.3) return;
  const size = parseFloat(cs.fontSize) || 16;
  // 横並び（flex の row）の箱は、子をつなげて1行として読む（「DAY 6」「…まで あと 8 日」）
  const row = cs.display.includes("flex") && !cs.flexDirection.startsWith("column");
  let run = "";
  const flush = () => {
    const value = run.replace(/\s+/g, " ").trim();
    run = "";
    if (value && !/^[▼▽▾]+$/.test(value)) lines.push({ text: value, size });
  };
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) { run += child.data; continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (child.localName === "img") {
      // 画面いっぱいの絵に書かれている文字（章タイトルの絵など）は、代わりの文字（alt）で読む。小さな絵（店のロゴなど）の alt は読まない
      if (child.alt && visibleWidth(child) >= (document.getElementById("stage")?.getBoundingClientRect().width || Infinity) * 0.6) {
        flush();
        for (const part of child.alt.split("　")) if (part.trim()) lines.push({ text: part.trim(), size: 30 });
      }
      continue;
    }
    if (SKIP_TAGS.has(child.localName)) continue;
    const display = getComputedStyle(child).display;
    if (row) run += ` ${inlineText(child)} `;
    else if (display.startsWith("inline") || display === "contents" || display.startsWith("ruby")) run += inlineText(child);
    else { flush(); readLines(child, visible, lines); }
  }
  flush();
  // 文字が無く、読み上げ用の名前だけ持つ絵（role="img"）は、その名前を読む
  if (!lines.length && root.getAttribute("role") === "img" && root.getAttribute("aria-label")
    && root.getBoundingClientRect().width >= (document.getElementById("stage")?.getBoundingClientRect().width || Infinity) * 0.6) {
    for (const part of root.getAttribute("aria-label").split("　")) if (part.trim()) lines.push({ text: part.trim(), size: 30 });
  }
}
