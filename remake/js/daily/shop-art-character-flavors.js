// Character-linked cartons generated for the chapter shops. Each sheet keeps its original tile grid.
const nine = new URL("../../img/shop/character-flavors/sheet-nine.webp", import.meta.url).href;
const three = new URL("../../img/shop/character-flavors/sheet-three.webp", import.meta.url).href;
const blast = new URL("../../img/shop/character-flavors/nightside-blast-mint.webp", import.meta.url).href;
const tea = new URL("../../img/shop/character-flavors/dragonfruit-black-tea.webp", import.meta.url).href;
const tileNine = (col, row) => ({ url: nine, size: [1254, 1254], box: [col * 418, row * 418, 418, 418] });
const tileThree = (col) => ({ url: three, size: [2172, 724], box: [col * 724, 0, 724, 724] });

export const CHARACTER_FLAVOR_ART = {
  spring_water: { url: new URL("../../img/shop/character-flavors/spring-water.webp", import.meta.url).href, size: [512, 512], box: [102, 38, 319, 457] },
  white_gummy_bear: { url: new URL("../../img/shop/character-flavors/white-gummy-bear.webp", import.meta.url).href, size: [512, 512], box: [94, 47, 381, 436] },
  red_gummy_bear: { url: new URL("../../img/shop/character-flavors/red-gummy-bear.webp", import.meta.url).href, size: [512, 512], box: [96, 51, 355, 430] },
  mountain_mist: tileNine(2, 0),
  nightside_earlgrey_release: tileNine(0, 1),
  cola: tileNine(1, 1),
  raspberry: tileNine(2, 1),
  pistachio: tileNine(0, 2),
  gum_cinnamon: tileNine(1, 2),
  dark_earlgrey: tileNine(2, 2),
  bombshell: tileThree(0),
  white_musk: tileThree(1),
  siga: tileThree(2),
  nightside_blast_mint: { url: blast, size: [1254, 1254], box: [245, 110, 760, 1010] },
  dragonfruit: { url: tea, size: [1774, 887], box: [0, 0, 887, 887] },
  peppermint_shake: { url: new URL("../../img/shop/character-flavors/peppermint-shake.webp", import.meta.url).href, size: [512, 512], box: [41, 52, 362, 429] },
  death_by_ice: { url: new URL("../../img/shop/character-flavors/death-by-ice.webp", import.meta.url).href, size: [512, 512], box: [41, 51, 362, 430] },
  black_tea: { url: tea, size: [1774, 887], box: [887, 0, 887, 887] },
};
