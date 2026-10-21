// Keep the authored 1280×720 composition together inside variable FX layers.
// A preceding sibling covers gutters; keep .cutin directly under the FX layer.
export function mountIntro(host, parent) {
  const surface = document.createElement("div");
  surface.className = "intro-fit-surface";
  const swallow = event => { event.preventDefault(); event.stopPropagation(); };
  const events = ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "wheel"];
  const targets = [surface, host];
  let observer = null, disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    targets.forEach(target => events.forEach(type => target.removeEventListener(type, swallow, true)));
    host.remove();
    surface.remove();
  };
  try {
    host.classList.add("intro-fitted");
    parent.append(surface, host);
    const background = getComputedStyle(host).backgroundColor;
    const fit = () => {
      const width = surface.clientWidth, height = surface.clientHeight;
      const scale = Math.min(width / 1280, height / 720);
      host.style.setProperty("--intro-fit-scale", String(scale));
      // Preserve the ordinary stage's fade over the scene when there are no gutters.
      surface.style.backgroundColor = Math.abs(width - 1280 * scale) < .01 && Math.abs(height - 720 * scale) < .01
        ? "transparent" : background === "rgba(0, 0, 0, 0)" ? "#101820" : background;
    };
    targets.forEach(target => events.forEach(type => target.addEventListener(type, swallow, { capture: true, passive: false })));
    fit();
    observer = new ResizeObserver(fit);
    observer.observe(surface);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
