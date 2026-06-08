#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <source_file> <group> [output_name]" >&2
  exit 1
fi

src=$1
group=$2
name=${3:-$(basename "$src")}

case "$group" in
  ""|/*|*..*|*//*)
    echo "Invalid group: $group" >&2
    exit 1
    ;;
esac

if [ ! -f "$src" ]; then
  echo "Source file not found: $src" >&2
  exit 1
fi

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
src_dir="$repo_root/asset_sources/images/$group"
dst_dir="$repo_root/assets/$group"

mkdir -p "$src_dir" "$dst_dir"
cp "$src" "$src_dir/$name"
cp "$src" "$dst_dir/$name"

printf 'Imported:\n'
printf '  source copy: %s\n' "$src_dir/$name"
printf '  game asset : %s\n' "$dst_dir/$name"
