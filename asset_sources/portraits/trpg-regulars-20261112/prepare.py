#!/usr/bin/env python3
"""Candidate delivery exports only; never writes to game assets or character settings.

The fit follows tools/fit_portrait.py: alpha >= 16 bounds, proportional LANCZOS
downscale, 896x1200 transparent canvas, 1080px figure, feet at y=1140.
No paint, color adjustment, upscaling or changes to the original files.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
POINTS = {
    'regulara': {'crown': [487, 16], 'chin': [477, 233],
                 'eyes': [[439, 134], [494, 130]], 'cheeks': [422, 538, 160]},
    'regularb': {'crown': [518, 46], 'chin': [509, 243],
                 'eyes': [[475, 177], [534, 164]], 'cheeks': [469, 560, 194]},
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def convert(args):
    subprocess.run(['magick', *map(str, args)], check=True)

def main():
    out = ROOT / 'delivery'
    out.mkdir(exist_ok=True)
    records = {}
    for cid, points in POINTS.items():
        source = ROOT / 'originals' / f'{cid}-normal.png'
        im = Image.open(source)
        assert im.mode == 'RGBA'
        alpha = im.getchannel('A')
        box = alpha.point(lambda v: 255 if v >= 16 else 0).getbbox()
        left, top, right, bottom = box
        height = bottom - points['crown'][1]
        head = points['chin'][1] - points['crown'][1]
        assert height >= 1300 and 6.4 <= height / head <= 7.7
        scale = 1080 / (bottom - top)
        assert scale <= 1
        width = round((right - left) * scale)
        x = (896 - width) // 2
        png = out / f'chr_{cid}_normal.png'
        convert(['-size', '896x1200', 'canvas:none', '(', source,
                 '-crop', f'{right-left}x{bottom-top}+{left}+{top}', '+repage',
                 '-filter', 'Lanczos', '-resize', f'{width}x1080!', ')',
                 '-geometry', f'+{x}+60', '-composite', png])
        webp = png.with_suffix('.webp')
        convert([png, '-define', 'webp:lossless=true', webp])
        point = lambda p: [round(x + (p[0]-left)*scale, 3), round(60 + (p[1]-top)*scale, 3)]
        crown, chin = point(points['crown']), point(points['chin'])
        cheeks = [point([points['cheeks'][0], points['cheeks'][2]])[0],
                  point([points['cheeks'][1], points['cheeks'][2]])[0]]
        # docs/portrait_standard.md: head occupies .58; its midpoint is at .48.
        side = (chin[1] - crown[1]) / .58
        cx = sum(cheeks) / 2
        face_top = (crown[1] + chin[1]) / 2 - .48 * side
        crop = [round(cx-side/2), round(face_top), round(side), round(side)]
        icon = out / f'face_{cid}.png'
        convert([png, '-crop', f'{crop[2]}x{crop[3]}+{crop[0]}+{crop[1]}',
                 '+repage', '-filter', 'Lanczos', '-resize', '128x128', icon])
        convert([icon, '-define', 'webp:lossless=true', icon.with_suffix('.webp')])
        frame = {'src': [896, 1200], 'box': [crop[0], crop[1], crop[0]+crop[2], crop[1]+crop[3]],
                 'face': {'cx': cx}}
        records[cid] = {
            'status': 'unselected candidate; not canon or integrated', 'class': 'standard',
            'original': {'file': str(source.relative_to(ROOT)), 'sha256': sha(source),
                         'size': list(im.size), 'alpha_bounds_ge16': list(box),
                         'points': points, 'figure_height': height, 'head_height': head,
                         'head_count': round(height/head, 4)},
            'fit': {'method': 'LANCZOS downscale and placement only', 'scale': scale,
                    'canvas': [896, 1200], 'figure_height': 1080, 'feet_y': 1140,
                    'points': {'crown': crown, 'chin': chin, 'eyes': [point(p) for p in points['eyes']],
                               'cheeks': [*cheeks, point([0,points['cheeks'][2]])[1]]}},
            'portrait_manifest_candidate': {'h': .9, 'b': .05, 'ax': .5, 'aspect': 896/1200},
            'trpg_face_frame_candidate': frame,
            'files': [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p), 'bytes': p.stat().st_size}
                      for p in [png, webp, icon, icon.with_suffix('.webp')]],
        }
    (ROOT/'metrics.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: v['original']['head_count'] for k,v in records.items()}))

if __name__ == '__main__':
    main()
