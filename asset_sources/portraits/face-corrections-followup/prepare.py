"""Prepare one generated correction for review; never changes game assets."""
import argparse,json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from tools.fit_portrait import bbox,mass_x
from remake.tools.build_manifest import measure

def prepare(cid,face,version):
 prefix=f'{cid}-{face}-v{version}';source=OUT/f'{prefix}-source.png';oldpath=OUT/'previous'/f'chr_{cid}_{face}.png';preview=OUT/f'{prefix}-preview.png'
 old=Image.open(oldpath).convert('RGBA');src=Image.open(source).convert('RGBA');ob=bbox(old);sb=bbox(src)
 assert src.getchannel('A').getextrema()[0]==0
 assert sb[3]-sb[1]>=1300,('source figure too small',sb)
 target_h=ob[3]-ob[1];k=target_h/(sb[3]-sb[1]);fig=src.crop(sb).resize((round((sb[2]-sb[0])*k),target_h),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(896,1200));out.alpha_composite(fig,(round(mass_x(old)-mass_x(fig)),ob[3]-target_h));out.save(preview,optimize=True)
 oldm=measure(oldpath);newm=measure(preview);dx=round((oldm['ax']-newm['ax'])*896);dy=round((oldm['bottom']-newm['bottom'])*1200)
 aligned=Image.new('RGBA',out.size);aligned.paste(out,(dx,dy));aligned.save(preview,optimize=True)
 box=bbox(aligned);assert box[0]>0 and box[1]>0 and box[2]<896 and box[3]<1200
 meta=dict(character=cid,expression=face,version=version,source=source.name,source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),source_size=list(src.size),source_visible_height=sb[3]-sb[1],scale=k,translation=[dx,dy],preview=preview.name,preview_sha256=hashlib.sha256(preview.read_bytes()).hexdigest(),before_metrics=oldm,after_metrics=measure(preview),operation='uniform downscale and feet-aligned canvas placement; no face compositing')
 (OUT/f'{prefix}-preparation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
 crop=next(r['crop'] for r in json.loads((ROOT/'docs/qa/portrait-jawline/catalog.json').read_text()) if r['character']==cid and r['expression']==face)
 sheet=Image.new('RGB',(1200,1020),'#ddd');d=ImageDraw.Draw(sheet)
 for i,im in enumerate((old,aligned)):
  d.text((i*600+5,5),['BEFORE',f'CANDIDATE v{version}'][i],fill='black')
  for j,color in enumerate(('#ffffff','#888888','#16121c')):
   f=im.crop(crop);tile=Image.new('RGBA',f.size,color);tile.alpha_composite(f);y=30+330*j
   sheet.paste(tile.resize((f.width*3//2,f.height*3//2),Image.Resampling.LANCZOS),(i*600,y));sheet.paste(tile,(i*600+280,y));sheet.paste(tile.resize((f.width//2,f.height//2),Image.Resampling.LANCZOS),(i*600+480,y))
 sheet.save(OUT/f'{prefix}-face-compare.webp',lossless=True,method=2)
 sheet=Image.new('RGB',(1792,1230),'#292d35');d=ImageDraw.Draw(sheet)
 for i,im in enumerate((old,aligned)):
  t=Image.new('RGBA',im.size,'#292d35');t.alpha_composite(im);sheet.paste(t,(i*896,30));d.text((i*896+10,5),['BEFORE',f'CANDIDATE v{version}'][i],fill='white')
 sheet.save(OUT/f'{prefix}-full-compare.webp',lossless=True,method=2)
 print(json.dumps(meta))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('character');p.add_argument('expression');p.add_argument('version',type=int);a=p.parse_args();prepare(a.character,a.expression,a.version)
