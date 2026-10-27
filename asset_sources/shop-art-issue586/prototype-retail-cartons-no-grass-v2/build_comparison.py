"""Compose review previews from original generator PNGs; never rewrite source art."""
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'manifest.json').read_text())
canvas = Image.new('RGB', (1680, 1160), '#eeeae3')
draw = ImageDraw.Draw(canvas)
font = ImageFont.load_default(size=24)
small = ImageFont.load_default(size=18)
draw.text((28, 16), 'Issue 586 | REPRESENTATIVES ONLY | HOLD / NOT ADOPTED', fill='#282432', font=font)
html = ['<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
        '<title>Issue586 比較専用・採用保留</title><style>body{font:16px system-ui;background:#eeeae3;color:#282432;margin:24px}table{width:100%;max-width:1100px}th,td{text-align:center;padding:12px}img{max-width:100%;width:360px;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 50%/24px 24px}h1{font-size:24px}</style>',
        '<h1>比較専用・採用保留（本編未接続）</h1><p>旧21点は別案として全て保持。実在メーカーは構造・配置の参照のみ。ゲームの既存ブランドはアルファーヘブン（AF）。</p>',
        '<p>HMDはtanukish_lidの大きい上部突起を除去する解釈。器具や機能の削除ではありません。</p><table><tr><th>商品</th><th>旧案（保持）</th><th>新代表案（未採用）</th></tr>']
for col, item in enumerate(manifest['items']):
    old = ROOT.parent / 'originals' / (item['id'] + '.png')
    new = ROOT / item['output']
    pair = [Image.open(p).convert('RGBA') for p in (old, new)]
    # Ignore sub-visible generator alpha noise for preview framing only.
    cropped = [im.crop(im.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()) for im in pair]
    # Keep the same scale for the two HMD objects so the removed knob is visible.
    common_scale = min(350 / max(im.width for im in cropped), 420 / max(im.height for im in cropped))
    for row, im in enumerate(cropped):
        x, y = 20 + col * 415, 64 + row * 540
        draw.rounded_rectangle((x, y, x + 400, y + 525), radius=10, fill='#faf8f4')
        draw.text((x + 12, y + 12), item['id'], font=font, fill='#282432')
        draw.text((x + 12, y + 44), 'OLD / PRESERVED' if row == 0 else 'NEW / REVIEW ONLY', font=small, fill='#65576c')
        scale = common_scale if item['id'] == 'tanukish_lid' else min(350 / im.width, 420 / im.height)
        thumb = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x + (400 - thumb.width) // 2, y + 80 + (420 - thumb.height)), thumb)
    name = item.get('existing_name', 'tanukish_lid（HMD・上部突起修正）')
    html.append(f'<tr><th>{escape(name)}</th><td><img alt="旧案" src="../originals/{item["id"]}.png"></td><td><img alt="未採用の代表案" src="{item["output"]}"></td></tr>')
canvas.save(ROOT / 'comparison-old-vs-retail.png')
html.append('</table><p>公式参照URL・生成プロンプト・対応IDは <a href="manifest.json">manifest</a> / <a href="prompts.json">prompts</a> に記録。メーカー写真は同梱していません。</p></html>')
(ROOT / 'index.html').write_text('\n'.join(html) + '\n')
