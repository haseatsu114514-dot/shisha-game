const frame = document.querySelector('iframe');
const size = document.querySelector('#size');
const city = document.querySelector('#city');
const scenario = document.querySelector('#scenario');
const caption = document.querySelector('#caption');
const result = document.querySelector('#result');
let variant = 'current';
function sendVariant() {
  frame.contentWindow.postMessage({ type: 'map-comparison-variant', variant }, location.origin);
}
for (const button of document.querySelectorAll('[data-variant]')) button.onclick = () => {
  variant = button.dataset.variant;
  for (const item of document.querySelectorAll('[data-variant]')) item.setAttribute('aria-pressed', String(item === button));
  caption.textContent = variant === 'current' ? 'A 現行' : 'B 改善案（採用前）';
  sendVariant();
};
size.onchange = () => {
  const [width, height] = size.value.split(',');
  frame.parentElement.style.width = `${width}px`;
  frame.style.height = `${height}px`;
};
function reload() {
  result.textContent = '';
  frame.src = `map-comparison-scene.html?city=${city.value}&scenario=${scenario.value}`;
}
city.onchange = scenario.onchange = reload;
frame.onload = sendVariant;
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'map-comparison-result') result.textContent = event.data.text;
});
