// 本編と独立ページのミニゲームで同じ manifest の画風・表情差分を選ぶ。
export function resolvePortrait(manifest, speaker, face = "normal", style = "new") {
  style = style === "classic" ? "classic" : "new";
  const folder = ({ tumugi: "tsumugi", hazime: "hajime", oneesan: "minto" })[speaker] || speaker;
  const p = manifest.portraits?.[folder];
  if (!p) return null;
  const candidate = style === "new" ? manifest.portraitVariants?.new?.[folder] : null;
  let f = face || "normal";
  if (speaker === "oneesan") {
    f = f.startsWith("ura_") ? f : `ura_${f}`;
    if (!p.faces.includes(f)) f = "ura_normal";
    if (!p.faces.includes(f)) return null;
  } else if (!p.faces.includes(f) && !candidate?.faces?.includes(f)) {
    const near = { excited: "smile", smug: "smile", wink: "smile", evil: "serious", thinking: "serious", intense: "serious" }[f];
    const costumeNormal = f.includes("_") ? `${f.slice(0, f.lastIndexOf("_") + 1)}normal` : "normal";
    if (near && p.faces.includes(near)) f = near;
    else if (!candidate?.faces?.includes(costumeNormal)) f = "normal";
  }
  const costume = f.includes("_") ? f.slice(0, f.lastIndexOf("_") + 1) : "";
  const normal = `${costume}normal`;
  const variantFace = candidate?.faces?.includes(f) ? f : candidate?.faces?.includes(normal) ? normal : null;
  const useVariant = variantFace !== null;
  const metrics = useVariant ? candidate : p;
  const actualFace = useVariant ? variantFace : f;
  const rel = `sprites/${useVariant ? `character_variants/${style}` : "characters"}/${folder}/chr_${folder}_${actualFace}.png`;
  return { folder, face: actualFace, style: useVariant ? style : "classic", rel,
    h: metrics.h || 0.85, b: useVariant ? (metrics.b ?? 0.02) : (p.b || 0.02),
    ax: metrics.ax ?? 0.5, aspect: metrics.aspect || 0.75, topOverhang: metrics.topOverhang || 0 };
}

export function portraitAsset(manifest, speaker, face = "normal", style = "new") {
  const portrait = resolvePortrait(manifest, speaker, face, style);
  if (!portrait) return null;
  const webp = (manifest.webp || []).includes(portrait.rel);
  return { ...portrait, src: new URL(webp
    ? `../../img/${portrait.rel.replace(/\.png$/, ".webp")}`
    : `../../../assets/${portrait.rel}`, import.meta.url).href };
}
