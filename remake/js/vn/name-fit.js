// Measure the actual name font/tracking; leave names that already fit unchanged.
export function createNameFit(element) {
  let disposed = false;
  function fit() {
    if (disposed) return;
    element.style.removeProperty('--vn-name-fit-size');
    // DS retains its existing independent font rule.
    if (!element.isConnected || element.closest('body.game-ds') || !element.textContent) return;
    const width = element.clientWidth;
    const box = element.getBoundingClientRect();
    if (!width || !box.width) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const textWidth = range.getBoundingClientRect().width * width / box.width;
    if (textWidth <= width) return;
    const fontSize = parseFloat(getComputedStyle(element).fontSize);
    const fitted = Math.max(14, Math.floor(fontSize * (width - 1) / textWidth * 1000) / 1000);
    element.style.setProperty('--vn-name-fit-size', `${fitted}px`);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(element);
  window.addEventListener('resize', fit);
  document.fonts.addEventListener('loadingdone', fit);
  document.fonts.ready.then(fit);
  return { fit, dispose() {
    disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', fit);
    document.fonts.removeEventListener('loadingdone', fit);
    element.style.removeProperty('--vn-name-fit-size');
  } };
}
