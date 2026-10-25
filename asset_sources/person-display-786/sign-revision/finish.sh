#!/usr/bin/env bash
set -euo pipefail
for variant in night open; do
  if [ "$variant" = night ]; then
    source_image=asset_sources/person-display-786/sign-revision/night-generated.png
    key=bg_shishark_preparing_night
  else
    source_image=asset_sources/person-display-786/sign-revision/open-generated.png
    key=bg_shishark
  fi
  saved_dir=asset_sources/person-display-786/sign-revision
  mkdir -p "$saved_dir"
  target="assets/backgrounds/$key.png"
  magick "$source_image" -crop 43x118+580+439 +repage /tmp/786-noren.png
  magick "$source_image" -crop 34x86+227+233 +repage /tmp/786-board.png
  magick "$target" /tmp/786-noren.png -geometry +580+439 -composite /tmp/786-board.png -geometry +227+233 -composite "$target"
  magick "$target" -define webp:lossless=true "remake/img/backgrounds/$key.webp"
done
