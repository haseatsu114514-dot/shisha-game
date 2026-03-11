#!/usr/bin/env python3
"""
Face-only expression swap for character sprites.

Strategy:
  1. Use the "normal" sprite as the immutable body base.
  2. For each expression donor, detect character bounds and compute
     scale + offset relative to the base.  If the donor character is
     drawn at a different size/position, resize and reposition it to
     match the base before extracting face features.
  3. Build a soft elliptical mask covering only eyes/brows and mouth.
  4. Composite: base * (1 - mask) + aligned_donor * mask
  5. Preserve the normal sprite's silhouette, hair, body, clothes.
"""

import os
import shutil
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

# ---------------------------------------------------------------------------
# Per-character face-feature anchors (on the BASE / normal sprite).
# Coordinates are in full-image space (896 x 1200).
# Each feature is an ellipse: cx, cy, rx, ry, feather.
# ---------------------------------------------------------------------------

CHAR_ANCHORS = {
    "mashiro": {
        "features": {
            "eyes": {"cx": 449, "cy": 548, "rx": 58, "ry": 24, "feather": 10},
            "mouth": {"cx": 449, "cy": 605, "rx": 34, "ry": 20, "feather": 8},
            "cheeks": {"cx": 449, "cy": 575, "rx": 52, "ry": 12, "feather": 10},
        },
    },
    "tsumugi": {
        "features": {
            "eyes": {"cx": 437, "cy": 565, "rx": 48, "ry": 20, "feather": 8},
            "mouth": {"cx": 440, "cy": 610, "rx": 26, "ry": 14, "feather": 6},
            "cheeks": {"cx": 437, "cy": 587, "rx": 44, "ry": 10, "feather": 10},
        },
    },
    "minto": {
        "features": {
            "eyes": {"cx": 443, "cy": 548, "rx": 55, "ry": 28, "feather": 10},
            "mouth": {"cx": 440, "cy": 608, "rx": 38, "ry": 26, "feather": 8},
            "cheeks": {"cx": 440, "cy": 578, "rx": 50, "ry": 14, "feather": 10},
        },
    },
    "minto_ura": {
        "features": {
            "eyes": {"cx": 443, "cy": 548, "rx": 55, "ry": 28, "feather": 10},
            "mouth": {"cx": 440, "cy": 608, "rx": 38, "ry": 26, "feather": 8},
            "cheeks": {"cx": 440, "cy": 578, "rx": 50, "ry": 14, "feather": 10},
        },
    },
    "hajime": {
        "features": {
            "eyes": {"cx": 445, "cy": 548, "rx": 52, "ry": 22, "feather": 8},
            "mouth": {"cx": 445, "cy": 600, "rx": 28, "ry": 16, "feather": 6},
            "cheeks": {"cx": 445, "cy": 574, "rx": 48, "ry": 12, "feather": 10},
        },
    },
    "ageha": {
        "features": {
            "eyes": {"cx": 440, "cy": 542, "rx": 50, "ry": 22, "feather": 8},
            "mouth": {"cx": 440, "cy": 594, "rx": 30, "ry": 16, "feather": 6},
            "cheeks": {"cx": 440, "cy": 568, "rx": 46, "ry": 12, "feather": 10},
        },
    },
    "sumi": {
        "features": {
            "eyes": {"cx": 445, "cy": 540, "rx": 50, "ry": 22, "feather": 8},
            "mouth": {"cx": 445, "cy": 592, "rx": 28, "ry": 16, "feather": 6},
            "cheeks": {"cx": 445, "cy": 566, "rx": 46, "ry": 12, "feather": 10},
        },
    },
    "naru": {
        "features": {
            "eyes": {"cx": 442, "cy": 545, "rx": 50, "ry": 22, "feather": 8},
            "mouth": {"cx": 442, "cy": 596, "rx": 28, "ry": 16, "feather": 6},
            "cheeks": {"cx": 442, "cy": 570, "rx": 46, "ry": 12, "feather": 10},
        },
    },
}


# ---------------------------------------------------------------------------
# Character bounds detection
# ---------------------------------------------------------------------------

def find_character_bounds(img_arr, x_range=(300, 600)):
    """
    Find the vertical extent and horizontal centroid of the character
    in the given column range.
    Returns (top_y, bottom_y, centroid_x, centroid_y) or None.
    """
    region_alpha = img_arr[:, x_range[0]:x_range[1], 3]
    opaque_rows = np.where(region_alpha.max(axis=1) > 200)[0]
    if len(opaque_rows) < 10:
        return None

    top_y = int(opaque_rows[0])
    bottom_y = int(opaque_rows[-1])

    # Centroid of opaque pixels in the upper 40% (head area)
    head_bottom = top_y + int((bottom_y - top_y) * 0.4)
    head_region = img_arr[top_y:head_bottom, x_range[0]:x_range[1]]
    mask = head_region[:, :, 3] > 200
    if mask.sum() < 10:
        return top_y, bottom_y, (x_range[0] + x_range[1]) // 2, (top_y + bottom_y) // 2
    ys, xs = np.where(mask)
    cx = int(np.mean(xs)) + x_range[0]
    cy = int(np.mean(ys)) + top_y

    return top_y, bottom_y, cx, cy


def align_donor_to_base(base_arr, donor_arr):
    """
    Resize and reposition the donor image so its character aligns with
    the base character's position and scale.
    Returns (aligned_donor_arr, scale_factor, dx, dy).
    """
    base_bounds = find_character_bounds(base_arr)
    donor_bounds = find_character_bounds(donor_arr)

    if base_bounds is None or donor_bounds is None:
        return donor_arr, 1.0, 0, 0

    b_top, b_bot, b_cx, b_cy = base_bounds
    d_top, d_bot, d_cx, d_cy = donor_bounds

    b_height = b_bot - b_top
    d_height = d_bot - d_top

    if d_height < 10 or b_height < 10:
        return donor_arr, 1.0, 0, 0

    scale = b_height / d_height

    # If scale is very close to 1.0 and offset is small, skip expensive resize
    dx = d_cx - b_cx
    dy = d_cy - b_cy
    if abs(scale - 1.0) < 0.02 and abs(dx) < 5 and abs(dy) < 5:
        return donor_arr, 1.0, 0, 0

    h, w = base_arr.shape[:2]

    if abs(scale - 1.0) >= 0.02:
        # Need to scale the donor
        donor_img = Image.fromarray(donor_arr, "RGBA")

        # Scale around the donor character's bottom (feet stay planted)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        scaled = donor_img.resize((new_w, new_h), Image.LANCZOS)

        # Create canvas at original size, paste scaled image aligned at bottom
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        # The donor bottom was at d_bot; after scaling, the character height
        # is d_height * scale = b_height. The new top = d_bot - b_height.
        # We need to offset the paste so the bottom aligns.
        paste_y = h - new_h  # bottom-align the scaled image
        # Horizontal: center-align using the centroid
        paste_x = int(round(b_cx - d_cx * scale))

        canvas.paste(scaled, (paste_x, paste_y))
        aligned = np.array(canvas)

        # Recompute bounds after alignment for fine-tuning
        new_bounds = find_character_bounds(aligned)
        if new_bounds is not None:
            _, _, new_cx, new_cy = new_bounds
            fine_dx = new_cx - b_cx
            fine_dy = new_cy - b_cy
        else:
            fine_dx, fine_dy = 0, 0

        return aligned, scale, fine_dx, fine_dy
    else:
        # Just shift, no scale needed
        result = np.zeros_like(donor_arr)
        # Shift by (-dx, -dy)
        src_y1 = max(0, dy)
        src_y2 = min(h, h + dy)
        src_x1 = max(0, dx)
        src_x2 = min(w, w + dx)
        dst_y1 = max(0, -dy)
        dst_y2 = min(h, h - dy)
        dst_x1 = max(0, -dx)
        dst_x2 = min(w, w - dx)
        result[dst_y1:dst_y2, dst_x1:dst_x2] = donor_arr[src_y1:src_y2, src_x1:src_x2]
        return result, 1.0, dx, dy


# ---------------------------------------------------------------------------
# Mask building and hair exclusion
# ---------------------------------------------------------------------------

def build_feature_mask(width, height, features):
    """Build a soft mask from feature ellipse definitions."""
    mask = np.zeros((height, width), dtype=np.float32)

    for feat_name, params in features.items():
        cx, cy = params["cx"], params["cy"]
        rx, ry = params["rx"], params["ry"]
        feather = params.get("feather", 6)

        temp = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(temp)
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        temp = temp.filter(ImageFilter.GaussianBlur(radius=feather))
        mask = np.maximum(mask, np.array(temp, dtype=np.float32) / 255.0)

    return mask


def build_hair_exclusion(base_arr, donor_aligned_arr, feature_mask):
    """
    Suppress blending where the aligned donor has dark hair/bangs
    but the base has light skin. Prevents bangs bleeding into eyes.
    """
    d_bright = base_arr[:, :, :3].astype(float).mean(axis=2)
    b_bright = base_arr[:, :, :3].astype(float).mean(axis=2)
    b_r = base_arr[:, :, 0].astype(float)
    b_b_ch = base_arr[:, :, 2].astype(float)
    b_a = base_arr[:, :, 3]

    d_rgb = donor_aligned_arr[:, :, :3].astype(float)
    d_bright = d_rgb.mean(axis=2)
    d_a = donor_aligned_arr[:, :, 3]

    # Base is skin-like: light, warm, opaque
    base_skin = (b_a > 200) & (b_bright > 130) & (b_r > b_b_ch)
    # Donor is dark at that position: opaque and dark
    donor_dark = (d_a > 200) & (d_bright < 100)
    # Conflict zone
    conflict = base_skin & donor_dark & (feature_mask > 0.1)

    if conflict.sum() == 0:
        return feature_mask

    exc = Image.fromarray((conflict * 255).astype(np.uint8), "L")
    exc = exc.filter(ImageFilter.MaxFilter(5))
    exc = exc.filter(ImageFilter.GaussianBlur(radius=4))
    exc_arr = np.array(exc, dtype=np.float32) / 255.0

    return feature_mask * (1.0 - exc_arr)


# ---------------------------------------------------------------------------
# Core compositing
# ---------------------------------------------------------------------------

def apply_face_expression(base_path, donor_path, output_path, features,
                          strength=1.0):
    """
    Composite face features from donor onto base body.
    Auto-aligns and scales the donor if needed.
    """
    base_img = Image.open(base_path).convert("RGBA")
    donor_img = Image.open(donor_path).convert("RGBA")

    if base_img.size != donor_img.size:
        print(f"  WARNING: Size mismatch {base_img.size} vs {donor_img.size}")
        return False, {}

    w, h = base_img.size
    base_arr = np.array(base_img, dtype=np.uint8)
    donor_arr = np.array(donor_img, dtype=np.uint8)

    if np.array_equal(base_arr, donor_arr):
        shutil.copy2(base_path, output_path)
        return True, {"aligned": False}

    # Align donor to base (handles scale + position differences)
    aligned_donor, scale, fine_dx, fine_dy = align_donor_to_base(base_arr, donor_arr)

    info = {"scale": scale, "fine_dx": fine_dx, "fine_dy": fine_dy}
    if abs(scale - 1.0) >= 0.02:
        print(f"    scale={scale:.3f}, residual offset=({fine_dx},{fine_dy})")
    elif fine_dx != 0 or fine_dy != 0:
        print(f"    offset=({fine_dx},{fine_dy})")

    # Build feature mask and apply hair exclusion
    mask = build_feature_mask(w, h, features)
    mask = build_hair_exclusion(base_arr, aligned_donor, mask)
    mask = mask * strength

    # Blend
    base_f = base_arr.astype(np.float32)
    donor_f = aligned_donor.astype(np.float32)
    mask_4ch = mask[:, :, np.newaxis]

    result_f = base_f * (1.0 - mask_4ch) + donor_f * mask_4ch
    result = np.clip(result_f, 0, 255).astype(np.uint8)
    result[:, :, 3] = base_arr[:, :, 3]  # preserve base alpha

    Image.fromarray(result, "RGBA").save(output_path)
    return True, info


# ---------------------------------------------------------------------------
# Comparison board
# ---------------------------------------------------------------------------

def generate_comparison_board(char_name, base_path, donor_path, result_path,
                              output_board_path, mask=None):
    """Side-by-side: [base] [donor] [result] [mask overlay]"""
    base = Image.open(base_path).convert("RGBA")
    donor = Image.open(donor_path).convert("RGBA")
    result = Image.open(result_path).convert("RGBA")

    crop_box = (300, 440, 600, 700)
    cw = crop_box[2] - crop_box[0]
    ch = crop_box[3] - crop_box[1]

    panels = [
        base.crop(crop_box),
        donor.crop(crop_box),
        result.crop(crop_box),
    ]

    if mask is not None:
        mc = mask[crop_box[1]:crop_box[3], crop_box[0]:crop_box[2]]
        vis = np.zeros((ch, cw, 4), dtype=np.uint8)
        vis[:, :, 0] = (mc * 255).astype(np.uint8)
        vis[:, :, 3] = (mc * 180).astype(np.uint8)
        overlay = panels[0].copy()
        overlay = Image.alpha_composite(overlay, Image.fromarray(vis, "RGBA"))
        panels.append(overlay)

    pad = 4
    bw = len(panels) * cw + (len(panels) + 1) * pad
    bh = ch + 2 * pad
    board = Image.new("RGBA", (bw, bh), (240, 240, 240, 255))
    for i, p in enumerate(panels):
        board.paste(p, (pad + i * (cw + pad), pad))
    board.save(output_board_path)


# ---------------------------------------------------------------------------
# Character processing
# ---------------------------------------------------------------------------

def process_character(char_name, sprites_dir, output_dir, board_dir,
                      dry_run=False):
    anchor_key = char_name
    if anchor_key not in CHAR_ANCHORS:
        print(f"  No anchors defined for '{char_name}', skipping")
        return []

    features = CHAR_ANCHORS[anchor_key]["features"]
    char_dir = os.path.join(sprites_dir, char_name)
    if not os.path.isdir(char_dir):
        return []

    normal_path = os.path.join(char_dir, f"chr_{char_name}_normal.png")
    if not os.path.exists(normal_path):
        return []

    results = []
    for fname in sorted(os.listdir(char_dir)):
        if not fname.startswith(f"chr_{char_name}_") or not fname.endswith(".png"):
            continue
        if fname == f"chr_{char_name}_normal.png":
            continue

        expr_name = fname.replace(f"chr_{char_name}_", "").replace(".png", "")
        donor_path = os.path.join(char_dir, fname)

        # minto_ura: use ura_normal as base
        if char_name == "minto" and "ura" in expr_name:
            ura_normal = os.path.join(char_dir, "chr_minto_ura_normal.png")
            if os.path.exists(ura_normal) and "ura_normal" not in expr_name:
                ura_features = CHAR_ANCHORS.get("minto_ura", CHAR_ANCHORS[char_name])["features"]
                out_path = os.path.join(output_dir, char_name, fname)
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                if not dry_run:
                    ok, info = apply_face_expression(ura_normal, donor_path, out_path, ura_features)
                    if ok:
                        w, h = Image.open(ura_normal).size
                        mask = build_feature_mask(w, h, ura_features)
                        bp = os.path.join(board_dir, f"{char_name}_{expr_name}_board.png")
                        generate_comparison_board(char_name, ura_normal, donor_path, out_path, bp, mask)
                        results.append((expr_name, out_path, bp))
                        print(f"  {expr_name}: done (ura)")
            continue

        out_path = os.path.join(output_dir, char_name, fname)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        if dry_run:
            print(f"  {expr_name}: would process")
            continue

        ok, info = apply_face_expression(normal_path, donor_path, out_path, features)
        if ok:
            w, h = Image.open(normal_path).size
            mask = build_feature_mask(w, h, features)
            bp = os.path.join(board_dir, f"{char_name}_{expr_name}_board.png")
            generate_comparison_board(char_name, normal_path, donor_path, out_path, bp, mask)
            results.append((expr_name, out_path, bp))
            print(f"  {expr_name}: done")
        else:
            print(f"  {expr_name}: skipped")

    return results


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Face-only expression swap")
    parser.add_argument("--sprites-dir", default="assets/sprites/characters")
    parser.add_argument("--output-dir", default="/tmp/face_swap_output")
    parser.add_argument("--board-dir", default="/tmp/face_swap_boards")
    parser.add_argument("--characters", nargs="*", default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--deploy", action="store_true")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    os.makedirs(args.board_dir, exist_ok=True)

    chars = args.characters or [c for c in CHAR_ANCHORS if "_" not in c]

    all_results = {}
    for char in chars:
        print(f"\nProcessing {char}...")
        results = process_character(char, args.sprites_dir, args.output_dir,
                                    args.board_dir, dry_run=args.dry_run)
        all_results[char] = results

    if args.deploy and not args.dry_run:
        print("\n--- Deploying ---")
        for char, results in all_results.items():
            for expr_name, out_path, _ in results:
                target = os.path.join(args.sprites_dir, char, os.path.basename(out_path))
                if os.path.exists(target):
                    shutil.copy2(out_path, target)
                    print(f"  {target}")

    print("\nDone.")


if __name__ == "__main__":
    main()
