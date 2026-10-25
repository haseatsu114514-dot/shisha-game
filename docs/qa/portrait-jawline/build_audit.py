"""Read-only visual audit sheets from the actual shipped sprites, not generated candidates."""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / 'audit'
OUT.mkdir(exist_ok=True)
rows = json.loads((OUT.parent / 'catalog.json').read_text())
for row in rows:
    source, runtime = (ROOT / row[key] for key in ('source', 'runtime'))
    a = np.array(Image.open(source).convert('RGBA'))
    b = np.array(Image.open(runtime).convert('RGBA'))
    row['source_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    row['runtime_sha256'] = hashlib.sha256(runtime.read_bytes()).hexdigest()
    row['same_dimensions'] = a.shape == b.shape
    row['rgba_identical'] = a.shape == b.shape and bool(np.array_equal(a, b))
    row['alpha_identical'] = a.shape == b.shape and bool(np.array_equal(a[..., 3], b[..., 3]))
    if a.shape == b.shape:
        visible = (a[..., 3] > 0) | (b[..., 3] > 0)
        row['visible_changed_pixels'] = int((np.any(a != b, axis=2) & visible).sum())
    row.pop('classification', None)

for start in range(0, len(rows), 5):
    group = rows[start:start + 5]
    sheet = Image.new('RGB', (330 * len(group), 1040), '#dedede')
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(group):
        im = Image.open(ROOT / row['runtime']).convert('RGBA')
        face = im.crop(row['crop'])
        # Pakki's larger head is shown at a bounded size; human faces retain 1.5x.
        k = min(1.5, 300 / max(face.size))
        draw.text((i * 330 + 6, 5), f"{start+i+1:03} {row['character']} / {row['expression']}", fill='black')
        for j, color in enumerate(('#ffffff', '#888888', '#16121c')):
            tile = Image.new('RGBA', face.size, color)
            tile.alpha_composite(face)
            x, y = i * 330, 30 + j * 335
            sheet.paste(tile.resize((round(face.width*k), round(face.height*k)), Image.Resampling.LANCZOS), (x, y))
            small_k = min(.5, 90 / max(face.size))
            sheet.paste(tile.resize((round(face.width*small_k), round(face.height*small_k)), Image.Resampling.LANCZOS), (x + 230, y + 235))
    filename = f"faces-{start+1:03}-{start+len(group):03}.webp"
    sheet.save(OUT / filename, lossless=True, quality=100, method=6, exact=True)
    for row in group:
        row['audit_sheet'] = filename
(OUT / 'technical-check.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'count': len(rows), 'rgba_identical': sum(r['rgba_identical'] for r in rows),
                  'different': [r['source'] for r in rows if not r['rgba_identical']]}, indent=2))
