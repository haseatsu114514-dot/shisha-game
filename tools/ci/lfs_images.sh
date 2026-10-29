#!/usr/bin/env bash
# Replace Git LFS pointer files in the checked-out game folders with the real
# images and DJ audio. Used by CI and the Pages deploy.
#   tools/ci/lfs_images.sh hash   # print a key for the LFS cache
#   tools/ci/lfs_images.sh fetch  # download (or take from .git/lfs/objects) and replace
#   tools/ci/lfs_images.sh check  # fail if a pointer is left
# It only looks at files on disk. `git lfs ls-files` / `git lfs pull` scan the
# whole tree and, in a sparse blobless checkout, fetch every missing file one by
# one (they hung for over 18 minutes).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
dirs=(assets remake/img)

pointers() {
  find "${dirs[@]}" -type f -size -2k \
    \( -iname '*.png' -o -iname '*.webp' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.gif' -o -path 'assets/audio/dj/*.mp3' \) \
    -exec grep -l -m1 '^version https://git-lfs.github.com/spec/v1' {} + 2>/dev/null | sort || true
}

case "${1:-}" in
  hash)
    mapfile -t files < <(pointers)
    if [ "${#files[@]}" -eq 0 ]; then echo none; else cat "${files[@]}" | sha256sum | cut -c1-32; fi
    ;;
  fetch)
    mapfile -t files < <(pointers)
    # A file pinned as a normal Git file in .gitattributes must never be a
    # pointer: that means a commit replaced the real file by mistake.
    bad=()
    for f in "${files[@]}"; do
      [ "$(git check-attr filter -- "$f" | sed 's/.*: //')" = lfs ] || bad+=("$f")
    done
    if [ "${#bad[@]}" -gt 0 ]; then
      printf 'Asset replaced by a Git LFS pointer (it is pinned as a normal Git file; restore it from main): %s\n' "${bad[@]}" >&2
      exit 1
    fi
    echo "Git LFS assets to fetch: ${#files[@]}"
    for f in "${files[@]}"; do
      git lfs smudge -- "$f" < "$f" > "$f.lfs-tmp"
      mv "$f.lfs-tmp" "$f"
    done
    "$0" check
    ;;
  check)
    mapfile -t left < <(pointers)
    if [ "${#left[@]}" -gt 0 ]; then
      printf 'Git LFS pointer left instead of an asset: %s\n' "${left[@]}" >&2
      exit 1
    fi
    echo "OK: no selected Git LFS pointers left in ${dirs[*]}"
    ;;
  *)
    echo "usage: $0 hash|fetch|check" >&2
    exit 2
    ;;
esac
