#!/usr/bin/env python3
"""Typeset lighting studies with a single shared type layer."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageOps
from build_titles import ROOT,SIZE,typography

m=json.loads((ROOT/'generation.json').read_text())
out=ROOT/'lighting-ch2';out.mkdir(exist_ok=True)
for d in ['images','plates']: (out/d).mkdir(exist_ok=True)
t=typography(2);t.save(out/'type.png')
for row in m['lighting_variants']:
    raw=ROOT/row['original'];assert hashlib.sha256(raw.read_bytes()).hexdigest()==row['original_sha256']
    plate=ImageOps.fit(Image.open(raw).convert('RGB'),SIZE,method=Image.Resampling.LANCZOS)
    final=Image.alpha_composite(plate.convert('RGBA'),t).convert('RGB')
    plate.save(out/'plates'/f"{row['id']}-art.png")
    final.save(out/'images'/f"{row['id']}-title.png")
    print('Built lighting',row['id'])
fp=next(Path('/System/Library/Fonts').glob('*角*シック W4.ttc'))
font=ImageFont.truetype(str(fp),20);small=ImageFont.truetype(str(fp),16)
sheet=Image.new('RGB',(1360,880),'#15121b');d=ImageDraw.Draw(sheet)
d.text((30,18),'第2章 — 暗さを保った光の位置4案',font=font,fill='#eee6f2')
for i,row in enumerate(m['lighting_variants']):
    x=30+(i%2)*670;y=65+(i//2)*400
    sheet.paste(Image.open(out/'images'/f"{row['id']}-title.png").resize((640,360),Image.Resampling.LANCZOS),(x,y))
    d.text((x,y+369),f"{row['id']}  {row['label']}",font=small,fill='#dcc9e6')
sheet.save(out/'comparison.png')
