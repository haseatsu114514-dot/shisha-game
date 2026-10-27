// Limited flavor cartons; derived by tools/build_limited_flavor_art.py.
import { STORY_FLAVOR_ART } from "./shop-art-story.js";
export const LIMITED_FLAVOR_ART = {
  ...STORY_FLAVOR_ART,
  "nightside_earlgrey": { url: new URL("../../img/shop/limited/nightside_earlgrey.webp", import.meta.url).href, size: [512, 512], box: [116, 62, 282, 391] },
  "cardamom": { url: new URL("../../img/shop/limited/cardamom.webp", import.meta.url).href, size: [512, 512], box: [105, 41, 304, 436] },
  "lavender": { url: new URL("../../img/shop/limited/lavender.webp", import.meta.url).href, size: [512, 512], box: [123, 83, 266, 350] },
};
