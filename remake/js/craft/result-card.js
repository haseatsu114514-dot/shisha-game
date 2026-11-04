// Card data and layout stay independent of the DOM and scoring.
const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const FONT = '"Suien Gothic", "Noto Sans JP", sans-serif';

export function buildResultCardData({ mix = {}, flavors = {}, grade = "", advice = [] } = {}) {
  return {
    title: "水煙前線 -EN:CODE-",
    grade,
    mix: Object.entries(mix).filter(([, grams]) => Number.isFinite(grams) && grams > 0)
      .map(([id, grams]) => `${flavors[id]?.name || id}　${number.format(grams)}g`),
    advice: advice.filter(text => typeof text === "string" && text),
  };
}

export function resultCardFilename(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  return `shisha-result-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}

// Measurement is injected so long names and advice can be tested without a browser.
export function layoutResultCard(data, measure) {
  const width = 960, margin = 64, maxWidth = width - margin * 2;
  const lines = [];
  let y = margin;
  function block(text, size, color = "#f4ede0") {
    let line = "";
    const add = () => { lines.push({ text: line, x: margin, y, size, color }); y += size * 1.5; line = ""; };
    for (const char of String(text)) {
      if (char === "\n") { add(); continue; }
      if (line && measure(line + char, size) > maxWidth) add();
      line += char;
    }
    if (line) add();
    y += 16;
  }
  block(data.title, 32, "#e3bd6e");
  block("あなたの一台", 48);
  block(`総合　${data.grade}`, 32, "#e3bd6e");
  y = Math.max(y, 320);
  block("配合", 28, "#e3bd6e");
  data.mix.forEach(text => block(text, 28));
  y += 16;
  data.advice.forEach(text => block(text, 28));
  return { width, height: Math.max(720, Math.ceil(y + margin)), lines };
}

export function renderResultCard(canvas, data, smoke = null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const layout = layoutResultCard(data, (text, size) => {
    ctx.font = `${size}px ${FONT}`;
    return ctx.measureText(text).width;
  });
  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx.fillStyle = "#181020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (smoke) ctx.drawImage(smoke, 720, 48, 160, 240);
  ctx.textBaseline = "top";
  for (const line of layout.lines) {
    ctx.font = `${line.size}px ${FONT}`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);
  }
  return canvas.toDataURL("image/png");
}
