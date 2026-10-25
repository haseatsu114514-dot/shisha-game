#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
finish() {
  local source_png="asset_sources/purikura-939/retro-$1-source.png"
  local suffix="$2"
  magick -size 640x1080 xc:white \
    \( "$source_png" -crop "$3" +repage -resize '640x40!' \) -geometry +0+0 -composite \
    \( "$source_png" -crop "$4" +repage -resize '576x448!' -bordercolor white -border 12x1 \) -geometry +20+40 -composite \
    \( "$source_png" -crop "$5" +repage -resize '576x448!' -bordercolor white -border 12x1 \) -geometry +20+520 -composite \
    \( "$source_png" -crop "$6" +repage -resize '640x110!' \) -geometry +0+970 -composite \
    -alpha off -strip "PNG24:assets/cgs/cg_ch2_ageha_purikura_strip${suffix}.png"
}
finish a '' '966x82+0+0' '928x715+21+95' '920x643+24+827' '966x144+0+1485'
finish b '_soft' '966x66+0+0' '934x717+16+75' '934x648+16+815' '966x154+0+1475'
finish c '_gal' '965x49+0+0' '900x698+33+67' '900x622+33+793' '965x201+0+1428'
