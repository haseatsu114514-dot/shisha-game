"""Read-only size/anchor inventory and comparisons in the real VN scale."""
from pathlib import Path
import json,sys,hashlib
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from remake.tools.build_manifest import measure,portraits
from tools.make_face_icons import face_box
OUT=Path(__file__).resolve().parent
m=json.loads((ROOT/'remake/data/manifest.json').read_text())['portraits']
chars={c['id']:c for c in json.loads((ROOT/'data/characters.json').read_text())}
profile=json.loads((ROOT/'data/dialogue/samechan.json').read_text())['profile'];chars[profile['id']]=profile
cat=json.loads((ROOT/'docs/qa/portrait-jawline/catalog.json').read_text())
rows=[]
for r in cat:
 p=ROOT/r['source'];im=Image.open(p).convert('RGBA');a=im.getchannel('A');bbox=a.point(lambda x:255 if x>=24 else 0).getbbox()
 cid=r['character'];entry=m[cid];scale=chars.get(cid,{}).get('spriteScale',1)
 target=(.94 if cid=='pakki' else 1.36)*scale
 factor=min(target/entry['h'],2.4)*720/im.height
 feet=measure(p);head=measure(p,anchor='head')
 reference=ROOT/f'assets/sprites/characters/{cid}/chr_{cid}_normal.png';ref=measure(reference)
 rows.append(dict(character=cid,expression=r['expression'],source=r['source'],sha256=hashlib.sha256(p.read_bytes()).hexdigest(),canvas=list(im.size),bbox=list(bbox),spriteScale=scale,manifest=entry,feet=feet,head=head,body_height_720=(bbox[3]-bbox[1])*factor,render_factor_720=factor,head_to_feet_720=(head['ax']-feet['ax'])*im.width*factor,height_vs_normal=(feet['bottom']-feet['top'])/(ref['bottom']-ref['top']),foot_bottom_drift_px=(feet['bottom']-ref['bottom'])*im.height,foot_x_drift_px=(feet['ax']-ref['ax'])*im.width))
fresh=portraits();report=dict(characters=len(m),expressions=len(rows),manifest_mismatches={c:dict(saved=m[c],measured=fresh[c]) for c in m if m[c]!=fresh[c]},nonstandard_canvas=[r['source'] for r in rows if r['canvas']!=[896,1200]],rows=rows)
(OUT/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
normal=[r for r in rows if r['expression']=='normal']
for start in range(0,len(normal),6):
 group=normal[start:start+6];sheet=Image.new('RGB',(330*len(group),800),'#292d35');d=ImageDraw.Draw(sheet);floor=720
 for i,r in enumerate(group):
  im=Image.open(ROOT/r['source']).convert('RGBA');factor=r['render_factor_720']*.64
  # Same display scale for every character; do not fit each character to a separate box.
  fig=im.crop(r['bbox']);fig=fig.resize((round(fig.width*factor),round(fig.height*factor)),Image.Resampling.LANCZOS)
  ax=r['feet']['ax']*im.width-r['bbox'][0];x=round(i*330+165-ax*factor)
  for h in (200,300,400,500,600):d.line((i*330,floor-h,(i+1)*330-1,floor-h),fill='#454b56')
  sheet.paste(fig,(x,floor-fig.height),fig)
  d.text((i*330+10,8),f"{r['character']} / scale {r['spriteScale']}",fill='white');d.text((i*330+10,35),f"body {r['body_height_720']:.0f}px @720",fill='white');d.text((i*330+10,746),f"canvas {im.width} x {im.height}",fill='white')
 d.line((0,floor,sheet.width,floor),fill='white',width=2)
 sheet.save(OUT/f'body-lineup-{start//6+1}.webp',lossless=True,method=2)
# Compare head/face appearance at one common render scale, using the existing audit crop centers.
for start in range(0,len(normal),8):
 group=normal[start:start+8];sheet=Image.new('RGB',(260*len(group),350),'#ddd');d=ImageDraw.Draw(sheet)
 for i,r in enumerate(group):
  src=Image.open(ROOT/r['source']).convert('RGBA');crop=next(t['crop'] for t in cat if t['character']==r['character'] and t['expression']=='normal')
  cx=(crop[0]+crop[2])/2;cy=(crop[1]+crop[3])/2;f=r['render_factor_720']*1.3
  face=src.crop((round(cx-120/f),round(cy-125/f),round(cx+120/f),round(cy+125/f))).resize((240,250),Image.Resampling.LANCZOS)
  sheet.paste(face,(i*260+10,35),face);d.text((i*260+10,7),r['character'],fill='black')
  box=face_box(r['character'],src)
  if box:d.text((i*260+10,300),f'icon-based width~{.5*box[2]*r["render_factor_720"]:.0f}px',fill='black')
 sheet.save(OUT/f'face-scale-{start//8+1}.webp',lossless=True,method=2)
print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False,indent=2))
print('Height variation > 3%:',[(r['character'],r['expression'],round(r['height_vs_normal'],3)) for r in rows if abs(r['height_vs_normal']-1)>.03])
