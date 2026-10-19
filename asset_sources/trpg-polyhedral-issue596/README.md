# Spare polyhedral equipment — Issue #596

The supplied built-in image_gen output is preserved byte for byte in `spare-polyhedral-kit-v1.png` and `assets/ui/trpg/spare-polyhedral-kit-v1.png`. Exact generation prompt: `prompts.json`; dimensions, alpha, hashes and mechanical conversion: `provenance.json`. No external stock or semantic image edits.

Visual QA: three unused manufactured polyhedral shapes and a teal pouch, without numbers, pips, writing or a result highlight. Transparent corners and semitransparent contact shadows remain. The runtime WebP is mechanically resized to 768×512 using LANCZOS and quality 90. The native source is 1536×1024 RGBA, alpha 0–254. The supplied output has faint semitransparent shadow across its bounds; it is not thresholded or repainted.

Only the separate live DOM d6 pair represents the check. Spare gear uses an empty presentation element with aria-hidden and pointer-events:none. It is static at the outer right edge on wide screens and hidden at widths ≤1200px or heights ≤600px. Table and d6 depth use CSS; text and hit regions stay level. Actual browser QA is in `docs/qa/trpg-polyhedral-issue596/`.
