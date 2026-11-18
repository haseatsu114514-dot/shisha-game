// Anonymous players belong to Sai's cafe; they are never named cast members in disguise.
export const TRPG_REGULARS = Object.freeze(["regulara", "regularb"]);
export const isTrpgRegular = id => TRPG_REGULARS.includes(id);
