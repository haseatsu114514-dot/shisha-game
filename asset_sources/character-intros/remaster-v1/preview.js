const records = await fetch("characters.json").then((response) => response.json());
const wanted = new URLSearchParams(location.search).get("character") || "hajime";
const character = records.find((record) => record.id === wanted) || records[0];
const stage = document.querySelector("#stage");
const portrait = document.querySelector("#portrait");
stage.style.setProperty("--accent", character.color);
stage.style.setProperty("--portrait-width", `${character.frame.width}px`);
stage.style.setProperty("--portrait-left", `${character.frame.left}px`);
stage.style.setProperty("--portrait-top", `${character.frame.top}px`);
stage.dataset.character = character.id;
portrait.src = character.portrait;
portrait.alt = character.name;
document.querySelector("#title").textContent = character.title;
document.querySelector("#name").textContent = character.name;
document.querySelector("#full").textContent = character.full ? `（${character.full}）` : "";
document.querySelector("#quote").textContent = `「${character.line}」`;
function fitStage() {
  const scale = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.transform = `translate(${(innerWidth - 1280 * scale) / 2}px, ${(innerHeight - 720 * scale) / 2}px) scale(${scale})`;
}
addEventListener("resize", fitStage);
fitStage();
await document.fonts.ready;
await portrait.decode();
for (const [selector, initial, minimum] of [["#name", 116, 60], ["#title", 30, 23], ["#quote", 30, 18]]) {
  const element = document.querySelector(selector);
  let size = initial;
  element.style.fontSize = `${size}px`;
  while (element.scrollWidth > element.clientWidth + 1 && size > minimum) element.style.fontSize = `${--size}px`;
}
window.previewReady = true;
