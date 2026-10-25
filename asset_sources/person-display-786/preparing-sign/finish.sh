#!/usr/bin/env bash
# Run from the repository root. Preserve all pixels outside the lettering area.
set -euo pipefail
source_dir=asset_sources/person-display-786/preparing-sign
target=assets/backgrounds/bg_shishark_preparing_night.png
patch_file=$(mktemp --suffix=.png)
trap 'rm -f "$patch_file"' EXIT
magick "$source_dir/generated.png" -crop 43x118+580+439 +repage "$patch_file"
magick "$target" "$patch_file" -geometry +580+439 -composite "$target"
magick "$target" -define webp:lossless=true remake/img/backgrounds/bg_shishark_preparing_night.webp
