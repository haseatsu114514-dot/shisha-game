// Anonymous players belong to Sai's cafe; they are never named cast members in disguise.
export const TRPG_REGULARS = Object.freeze(["regulara", "regularb"]);
export const isTrpgRegular = id => TRPG_REGULARS.includes(id);

/** A neutral seat marker until a regular has a portrait of their own. */
export function regularPortrait(id) {
  if (!isTrpgRegular(id)) return null;
  const color = id === "regulara" ? "#bb9c72" : "#8faeaa";
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"><rect width="180" height="240" rx="12" fill="#233b3e"/><circle cx="90" cy="60" r="30" fill="${color}"/><path d="M24 216v-57a66 66 0 0 1 132 0v57Z" fill="${color}"/></svg>`);
}
