import { withLoading } from "./core/loading.js";

const host = document.querySelector("#loading-demo");
const frame = document.querySelector(".preview-frame");
const result = document.querySelector("#result");
const buttons = [...document.querySelectorAll("[data-demo]")];
const cancel = document.querySelector("#cancel");
function fit() {
  const scale = Math.min(1, (document.documentElement.clientWidth - 40) / 1280);
  host.style.transform = `scale(${scale})`;
  frame.style.width = `${1280 * scale}px`; frame.style.height = `${720 * scale}px`;
}
window.addEventListener("resize", fit); fit();

// Wireframe only: no story, dialogue or final illustration is invented here.
const panel = number => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="400" viewBox="0 0 480 400"><rect width="480" height="400" fill="#eee7dc"/><rect x="25" y="25" width="430" height="350" fill="none" stroke="#574562" stroke-width="3"/><text x="240" y="205" text-anchor="middle" fill="#574562" font-size="40">PANEL ${number}</text></svg>`)}`;
const comics = [{ id: "layout-preview", title: "２コマ漫画・配置確認", minChapter: 1,
  panels: [1, 2].map(number => ({ src: panel(number), alt: `${number}コマ目の仮枠。ここに採用した漫画を表示します。` })) }];
let controller;
cancel.onclick = () => controller?.abort();
document.querySelector("#underlying").onclick = () => { result.textContent = "本編側の操作を受け付けました。"; };
for (const button of buttons) button.onclick = async () => {
  controller = new AbortController();
  buttons.forEach(node => { node.disabled = true; }); cancel.disabled = false;
  result.textContent = "試験用の処理を実行しています。";
  try {
    await withLoading(async ({ signal, report }) => {
      const duration = button.dataset.demo === "fast" ? 10 : 500;
      for (let done = 1; done <= 4; done++) {
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(signal.reason); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, duration);
          signal.addEventListener("abort", abort, { once: true });
        });
        signal.throwIfAborted();
        if (button.dataset.demo === "error" && done === 2) throw new Error("試験用エラー");
        report(done, 4);
      }
    }, { host, comics: button.dataset.demo === "comic" ? comics : [], signal: controller.signal });
    result.textContent = "準備完了。次の場面を開始できます。";
  } catch (error) {
    result.textContent = error.name === "AbortError" ? "中断しました。元の操作に戻れます。" : "準備に失敗しました。再度お試しください。";
  } finally {
    buttons.forEach(node => { node.disabled = false; }); cancel.disabled = true;
  }
};
