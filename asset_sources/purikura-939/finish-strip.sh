#!/usr/bin/env bash
# #947: size the generated print regions; keep both untouched generation files.
set -euo pipefail
cd "$(dirname "$0")/../.."
source_png=asset_sources/purikura-939/strip-v4-source.png
magick -size 640x1080 xc:white \
  \( "$source_png" -crop 951x70+7+6 +repage -resize '640x40!' \) -geometry +0+0 -composite \
  \( "$source_png" -crop 920x721+23+90 +repage -resize '598x448!' -bordercolor white -border 1 \) -geometry +20+40 -composite \
  \( "$source_png" -crop 920x605+23+831 +repage -resize '598x448!' -bordercolor white -border 1 \) -geometry +20+520 -composite \
  \( "$source_png" -crop 951x170+7+1452 +repage -resize '640x110!' \) -geometry +0+970 -composite \
  -alpha off -strip PNG24:assets/cgs/cg_ch2_ageha_purikura_strip.png
