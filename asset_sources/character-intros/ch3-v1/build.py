"""Build cut-in review data from approved portraits, without modifying their pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image
import numpy as np

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
MASTER = {c['id']: c for c in json.loads((ROOT / 'data/characters.json').read_text())}
PALETTES = {
    'mashiro': ('ましろ', '#b5c8b9', '#eee5cc', '#172d2b', 'お茶・湯気・リネン'),
    'volk': ('ヴォルク', '#8fb4d8', '#c6e7df', '#112739', '精密な目盛り・ノギス・ダークミント'),
}
records = []
for cid, (name, color, secondary, shadow, motif_label) in PALETTES.items():
    intro = MASTER[cid]['intro_cutin']
    portrait = ROOT / f'assets/sprites/characters/{cid}/chr_{cid}_{intro["face"]}.png'
    im = Image.open(portrait).convert('RGBA')
    alpha = np.asarray(im)[..., 3]
    ys, xs = np.where(alpha >= 20)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    scale = 1140 / (y1 - y0)
    weights = alpha[y0:y0 + max(1, int((y1 - y0) * .2))].astype(float)
    head_x = float((weights.sum(axis=0) * np.arange(im.width)).sum() / weights.sum())
    bg = BASE / f'backgrounds/{cid}.png'
    records.append(dict(
        id=cid, name=name, full='', title=intro['title'], line=intro['line'],
        expression=intro['face'], color=color, secondary=secondary, shadow=shadow,
        motif='smoke', motif_label=motif_label,
        portrait=str(portrait.relative_to(ROOT)),
        portrait_sha256=hashlib.sha256(portrait.read_bytes()).hexdigest(),
        portrait_authority='採用済みゲーム立ち絵。拡縮・配置のみ。描き直し・フィルタなし',
        caption_source=f'data/characters.json: {cid}.intro_cutin',
        frame=dict(width=round(im.width * scale, 3), left=round(304 - head_x * scale, 3), top=round(38 - y0 * scale, 3)),
        backgrounds=dict(illustrated=dict(src=str(bg.relative_to(ROOT)), sha256=hashlib.sha256(bg.read_bytes()).hexdigest())),
    ))
(BASE / 'characters.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
html = (BASE.parent / 'ch1-v3/index.html').read_text()
html = html.replace('一章の登場カット', '第3章の登場カット — ましろ・ヴォルク')
html = html.replace('src="preview.js"', 'src="../ch1-v3/preview.js"')
(BASE / 'index.html').write_text(html)
