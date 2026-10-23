// Selection metadata only. candidates.json remains the sole appearance catalog.
export const APPEARANCE_CATEGORIES = Object.freeze(["handle", "mouthpiece"]);
export const emptyAppearance = () => ({ handle: null, mouthpiece: null });

export function appearanceOptions(document) {
  if (!Array.isArray(document?.items) || document?.adoption?.runtime_integrated !== false
      || document?.adoption?.distribution_assets_ready !== false) {
    throw new Error("Appearance design catalog is unavailable");
  }
  const options = { handle: [], mouthpiece: [] };
  const seen = new Set();
  for (const item of document.items) {
    if (!item || !APPEARANCE_CATEGORIES.includes(item.category) || item.approved !== true
        || item.approval_scope !== "design_only" || item.runtime_integrated !== false
        || item.status !== "approved_design_runtime_integration_pending") continue;
    if (typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string"
        || !item.name.trim() || seen.has(item.id)) throw new Error("Invalid approved appearance ID");
    seen.add(item.id);
    options[item.category].push({ id: item.id, name: item.name });
  }
  if (APPEARANCE_CATEGORIES.some(category => !options[category].length)) {
    throw new Error("Approved appearance category is unavailable");
  }
  return options;
}

export function normalizeAppearance(value, options) {
  const result = emptyAppearance();
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const category of APPEARANCE_CATEGORIES) {
    const id = value[category];
    if (typeof id === "string" && options[category].some(item => item.id === id)) result[category] = id;
  }
  return result;
}
