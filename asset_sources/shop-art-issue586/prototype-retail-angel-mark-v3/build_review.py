"""Review-only layout/measurement of generated PNGs. Never rewrites original art."""
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'manifest.json').read_text())
font = ImageFont.load_default(size=23)
small = ImageFont.load_default(size=18)
sheet = Image.new('RGB', (1440, 1350), '#eeeae3')
draw = ImageDraw.Draw(sheet)
draw.text((24, 16), 'Issue 586 | AF lettering -> original white angel | HOLD / NOT ADOPTED', font=font, fill='#282432')
html = ['<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
        '<title>白い天使マーク代表比較・採用保留</title><style>body{font:16px system-ui;background:#eeeae3;color:#282432;margin:24px}table{width:100%;max-width:1100px}td,th{text-align:center;padding:10px}img{width:360px;max-width:100%;background:#39343e}h1{font-size:24px}</style>',
        '<h1>白い天使マーク代表比較（本編未接続・採用保留）</h1><p>既存ブランド「アルファーヘブン」は維持。絵のAF文字だけを独立した白い翼＋輪へ変更。旧21点・v2箱・HMDは全て保持し、HMDは今回生成していません。</p>',
        '<table><tr><th>商品</th><th>v2 AF版（保持）</th><th>v3 白い天使版（未採用）</th></tr>']
measurements = []
mark_masks = []
inspection = Image.new('RGB', (1440, 360), '#39343e')
qa_draw = ImageDraw.Draw(inspection)
for col, item in enumerate(manifest['items']):
    old = ROOT.parent / item['edit_target_relative_to_parent']
    new = ROOT / item['output']
    for row, path in enumerate((old, new)):
        im = Image.open(path).convert('RGBA')
        bbox = im.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
        visible = im.crop(bbox)
        x, y = 12 + col * 476, 58 + row * 545
        draw.rounded_rectangle((x, y, x + 464, y + 530), radius=10, fill='#faf8f4')
        draw.text((x + 14, y + 12), item['id'] + (' / v2 preserved' if row == 0 else ' / v3 review only'), font=font, fill='#282432')
        visible.thumbnail((380, 450), Image.Resampling.LANCZOS)
        sheet.paste(visible, (x + (464 - visible.width) // 2, y + 64 + (450 - visible.height)), visible)
        if row == 1:
            # Shop-icon-size preview uses the full native framing, not a modified asset.
            icon = im.copy(); icon.thumbnail((128, 128), Image.Resampling.LANCZOS)
            draw.text((x + 12, 1160), 'Native framing / 128 px preview', font=small, fill='#282432')
            sheet.paste(icon, (x + 165, 1190), icon)
    html.append(f'<tr><th>{escape(item["existing_name"])}</th><td><img alt="v2 保持" src="../{item["edit_target_relative_to_parent"]}"></td><td><img alt="v3 未採用" src="{item["output"]}"></td></tr>')
    im = Image.open(new).convert('RGBA')
    ul, ur, lr, ll = item['front_panel_quad_native_px']
    # Bilinear front-panel approximation; corners manually inspected, not CAD ground truth.
    front = im.transform((700, 1000), Image.Transform.QUAD, tuple(ul + ll + lr + ur), Image.Resampling.BICUBIC)
    pixels = front.load()
    mask = Image.new('1', front.size)
    out = mask.load()
    for y in range(40, 300):
        for x in range(105, 595):
            r, g, b, a = pixels[x, y]
            out[x, y] = a >= 200 and min(r, g, b) >= 210
    bounds = mask.getbbox()
    assert bounds, item['id']
    left, top, right, bottom = bounds
    metrics = {'id': item['id'], 'mark_bbox_in_rectified_front_px': list(bounds),
               'normalized_width': (right-left)/700, 'normalized_height': (bottom-top)/1000,
               'normalized_center_u': (left+right)/1400, 'normalized_center_v': (top+bottom)/2000,
               'method': 'Manually inspected front corners; bilinear 700x1000 rectification; white pixels RGB>=210, alpha>=200 in u=.15..85,v=.04..30; approximate.'}
    measurements.append(metrics)
    mark_masks.append(mask.crop(bounds).convert('L').resize((300, 120), Image.Resampling.NEAREST).point(lambda a: 255 if a>=128 else 0))
    qa_draw.text((col*476 + 18, 12), item['id'] + ' / rectified mark', font=font, fill='white')
    crop = front.crop((70, 30, 630, 310)); crop.thumbnail((440, 240), Image.Resampling.LANCZOS)
    inspection.paste(crop, (col*476+18, 54), crop)
    qa_draw.text((col*476 + 18, 290), f'W {metrics["normalized_width"]:.3f} / C ({metrics["normalized_center_u"]:.3f}, {metrics["normalized_center_v"]:.3f})', font=small, fill='white')
pairwise = []
for i in range(3):
    for j in range(i+1, 3):
        aa, bb = mark_masks[i], mark_masks[j]
        intersection = ImageChops.darker(aa, bb).histogram()[255]
        union = ImageChops.lighter(aa, bb).histogram()[255]
        pairwise.append({'pair': [measurements[i]['id'], measurements[j]['id']], 'shape_iou_after_bbox_normalization': intersection/union})
(ROOT/'mark-measurements.json').write_text(json.dumps({'items':measurements,'pairwise_shape_similarity':pairwise,'limits':'Approximate front geometry and threshold mask; shape IoU discards scale and placement. Human visual review also required. No claim of pixel-identical printing.'},indent=2)+'\n')
sheet.save(ROOT/'comparison-v2-af-vs-v3-angel.png')
inspection.save(ROOT/'qa/mark-inspection.png')
html.append('</table><p><a href="originals/canonical-white-angel-mark.png">共通マスター</a> / <a href="qa/canonical-on-dark-preview.png">マスター暗色背景プレビュー</a> / <a href="mark-measurements.json">位置・大きさ計測</a> / <a href="prompts.json">実プロンプト</a></p></html>')
(ROOT/'index.html').write_text('\n'.join(html)+'\n')
print(json.dumps({'measurements':measurements,'shape_similarity':pairwise},indent=2))
