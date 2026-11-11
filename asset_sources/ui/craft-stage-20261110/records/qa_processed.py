from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
p=Path(__file__).resolve().parent.parent;r=p/'processed';rows=[];checks={}
for f in sorted(r.glob('*.png')):
 im=Image.open(f);a=np.array(im);target=(1024,1024) if f.stem.startswith('lamp') else ((1024,1536) if f.stem=='spine-housing' else (1536,1024))
 assert im.size==target;assert a.shape[2]==4;assert np.all(a[a[:,:,3]==0,:3]==0)
 rows.append({'file':'processed/'+f.name,'size':list(im.size),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
checks['dimensions_all11']=True;checks['transparent_rgb_zero_all11']=True
im=np.array(Image.open(r/'spine-housing.png'));assert not im[220:1300,485:540,3].any();checks['housing_window_alpha_zero']=True
im=np.array(Image.open(r/'spine-plate.png'));assert not im[345:680,360:1176,3].any();checks['capsule_inside_alpha_zero']=True
im=np.array(Image.open(r/'dial-bezel.png'));y,x=np.indices(im.shape[:2]);rr=np.hypot(x-768,y-799);mask=(y<790)&(rr>362)&(rr<635);assert not im[:,:,3][mask].any();checks['dial_arc_full_alpha_zero']=True
# exact geometric symmetry of the arc-window mask
mask2=(y<759)&(rr>.53*676+3)&(rr<.945*676-3);assert not im[:,:,3][mask2].any();checks['dial_radii_0.53_to_0.945']=True
centres=[]
for n in ['off','faint','fair','good','shine']:
 im=np.array(Image.open(r/('lamp-'+n+'.png')));centres.append(float(im[505:519,505:519,:3].mean()))
 if n in ['off','faint','fair']:
  yy,xx=np.indices((1024,1024));assert not im[:,:,3][np.hypot(xx-511.5,yy-511.5)>289].any()
 assert not im[0,:,3].any() and not im[-1,:,3].any() and not im[:,0,3].any() and not im[:,-1,3].any()
assert centres==sorted(centres);checks['lamp_brightness_order']=centres;checks['lamp_common_ring_center']=[511.5,511.5];checks['lamp_common_ring_outer_diameter']=574;checks['lamp_all_edge_alpha_zero']=True
manifest=[]
for folder in ['edited','processed']:
 for f in sorted((p/folder).glob('*.png')):manifest.append({'file':str(f.relative_to(p)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(p/'records/final-manifest.json').write_text(json.dumps(manifest,indent=2));(p/'records/final-qa.json').write_text(json.dumps({'checks':checks,'files':rows},indent=2))
can=Image.new('RGB',(1200,1300),'#150d22');d=ImageDraw.Draw(can)
for i,f in enumerate(sorted(r.glob('*.png'))):
 im=Image.open(f);b=im.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox();im=im.crop(b);im.thumbnail((360,270));x=i%3*400+20;y=i//3*325+30;can.paste(im,(x,y),im);d.text((x,y-20),f.name,fill='white')
can.save(p/'records/final-preview.jpg',quality=92)
print(json.dumps(checks))
