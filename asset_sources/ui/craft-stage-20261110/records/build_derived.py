from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import numpy as np, math, json, hashlib
P=Path(__file__).resolve().parent.parent;O=P/'processed';O.mkdir(exist_ok=True)
def save(im,name):
 a=np.array(im.convert('RGBA'));a[a[:,:,3]==0,:3]=0;Image.fromarray(a).save(O/(name+'.png'))
def maskshape(size,fn):
 m=Image.new('L',size);fn(ImageDraw.Draw(m));return m
def fitplate(name,box,target):
 im=Image.open(P/'edited'/(name+'.png')).convert('RGBA').crop(box)
 im=im.resize(target,Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(1536,1024));out.alpha_composite(im,((1536-target[0])//2,(1024-target[1])//2));return out
# Voice: explicit rounded tag silhouette, square bottom-left; reuse generated face and portrait seat.
tex=Image.open(P/'edited/voice-plate.png').convert('RGBA').crop((500,405,1250,625)).resize((1382,346),Image.Resampling.LANCZOS)
im=Image.new('RGBA',(1536,1024));im.alpha_composite(tex,(77,339))
m=maskshape(im.size,lambda d:d.rounded_rectangle((77,339,1458,684),radius=62,fill=255));ImageDraw.Draw(m).rounded_rectangle((77,500,270,684),radius=14,fill=255)
a=np.array(im);a[:,:,3]=np.array(m);outer=np.array(m)>np.array(m.filter(ImageFilter.MinFilter(5)));a[outer,:3]=(109,90,134);inner=np.array(m.filter(ImageFilter.MinFilter(17)))>np.array(m.filter(ImageFilter.MinFilter(19)));a[inner,:3]=(63,47,81);im=Image.fromarray(a);d=ImageDraw.Draw(im)
d.ellipse((119,405,333,619),fill=(21,13,34,255),outline=(173,143,100,255),width=2);d.ellipse((122,408,330,616),outline=(130,103,158,255),width=1)
save(im,'voice-plate')
# Rail: reuse generated face, exact ratio; mask bloom to max2% canvas width.
im=fitplate('rail-now',(55,342,1483,718),(1306,384))
m=maskshape(im.size,lambda d:d.rounded_rectangle((115,320,1420,703),radius=192,fill=255))
arr=np.array(im);arr[:,:,3]=np.minimum(arr[:,:,3],np.array(m));im=Image.fromarray(arr)
glow=Image.new('RGBA',im.size,(201,167,230,0));gm=m.filter(ImageFilter.GaussianBlur(9));ga=np.array(gm);ga[ga<2]=0;glow.putalpha(Image.fromarray((ga*.26).astype('uint8')));glow.alpha_composite(im);save(glow,'rail-now')
# Spine plate: precisely constructed symmetric capsule rim; sample generated rim material colours.
W,H=1536,1024;yy,xx=np.indices((H,W));cx,cy=768,512;hw,hh=614.5,192
q=np.maximum(np.abs(xx-cx)-(hw-hh),0);dist=np.hypot(q,yy-cy)
# outer edge and inner edge have a total24px thickness (6.25% height)
a=np.zeros((H,W,4),dtype=np.uint8);rim=(dist<=hh)&(dist>=hh-24)
# texture from original generated capsule provides material, kept within deterministic rim.
src=np.array(Image.open(P/'edited/spine-plate.png').convert('RGBA'));tex=src[np.clip((yy*0+360+(dist-hh+24)).astype(int),0,H-1),np.clip(xx,0,W-1),:3]
noise=(tex.mean(2)-100)*.025;a[:,:,:3]=np.clip(np.array([72,46,94])[None,None,:]+noise[:,:,None],0,255);a[:,:,3]=rim*255
outer=(dist>hh-4)&(dist<=hh);inner=(dist>=hh-24)&(dist<hh-20);a[outer,:3]=(183,155,99);a[inner,:3]=(185,157,210);save(Image.fromarray(a),'spine-plate')
# Housing: original cap and foot; opaque shaft is vertically uniform in geometry. No glow.
src=Image.open(P/'edited/spine-housing.png').convert('RGBA');im=Image.new('RGBA',src.size)
m=maskshape(src.size,lambda d:(d.rounded_rectangle((400,47,623,145),radius=25,fill=255),d.rectangle((419,140,604,1380),fill=255),d.rounded_rectangle((369,1361,653,1494),radius=30,fill=255)))
a=np.array(src);a[:,:,3]=np.array(m)
# uniform shaft sides; sample source central strip with smooth row selection rather than retain taper
for y in range(145,1375):a[y,419:605,:3]=np.array(src)[650+(y%32),419:605,:3]
wm=maskshape(src.size,lambda d:d.rounded_rectangle((458,165,565,1360),radius=53,fill=255))
a[np.array(wm)>0]=0
# recenter and scale to prescribed20% overall width94%height
im=Image.fromarray(a).crop((368,46,655,1496)).resize((205,1444),Image.Resampling.LANCZOS)
# alpha1 from resampling is permitted edges only; make explicit window after transformation
out=Image.new('RGBA',(1024,1536));out.alpha_composite(im,(410,46));outa=np.array(out)
win=maskshape(out.size,lambda d:d.rounded_rectangle((475,166,549,1353),radius=36,fill=255));outa[np.array(win)>0]=0
out=Image.fromarray(outa);d=ImageDraw.Draw(out);d.rectangle((471,145,553,1370),fill=(34,21,52,255));d.rounded_rectangle((473,163,551,1356),radius=39,fill=(164,132,86,255));win=maskshape(out.size,lambda d:d.rounded_rectangle((476,166,548,1353),radius=36,fill=255));outa=np.array(out);outa[np.array(win)>0]=0;save(Image.fromarray(outa),'spine-housing')
# Dial: remap source annulus and inner texture into exact concentric geometry.
src=np.array(Image.open(P/'edited/dial-bezel.png').convert('RGBA'));W,H=1536,1024;y,x=np.indices((H,W));cx,cy,R=768,799,676
r=np.hypot(x-cx,y-cy);theta=np.arctan2(cy-y,x-cx);upper=(y<=cy);a=np.zeros((H,W,4),dtype=np.uint8)
# original bezel radii about 685..724 and face up to480 at centre(768,846)
for region,rs in [('outer',685+(r/R-.945)/.055*39),('face',r/(.53*R)*474)]:
 mask=upper&((r>=.945*R)&(r<=R) if region=='outer' else (r<=.53*R))
 sx=np.clip(np.rint(768+rs*np.cos(theta)),0,1535).astype(int);sy=np.clip(np.rint(846-rs*np.sin(theta)),0,1023).astype(int)
 a[mask,:3]=src[sy[mask],sx[mask],:3];a[mask,3]=255
# thin outer and inner gold/lavender hairlines
for radius,col in [(R,(191,160,103)),(.945*R,(185,153,212)),(.53*R,(99,69,126))]:
 k=upper&(abs(r-radius)<1.5);a[k,:3]=col;a[k,3]=255
im=Image.fromarray(a);d=ImageDraw.Draw(im);d.rectangle((58,799,1478,833),fill=(34,21,52,255));d.line((58,799,1478,799),fill=(196,163,102),width=2);d.ellipse((728,759,808,839),fill=(23,14,37),outline=(192,158,95),width=2)
save(im,'dial-bezel')
# Canonical lamp: one original glass texture, exact574px circular geometry reused for all states.
base=Image.open(P/'edited/lamp-off.png').convert('RGB').crop((261,273,981,993)).resize((574,574),Image.Resampling.LANCZOS)
texture=np.array(base).astype(float);H=W=1024;y,x=np.indices((H,W));r=np.hypot(x-511.5,y-511.5);inside=r<=287;diskR=np.hypot(*np.indices((574,574))-np.array([286.5,286.5])[:,None,None])/287
for state,centre,edge,glowrad in [('off',(46,29,69),(21,13,34),0),('faint',(58,42,77),(24,15,38),0),('fair',(217,185,154),(90,59,43),0),('good',(255,226,176),(156,83,32),82),('shine',(255,246,214),(184,134,47),143)]:
 a=np.zeros((H,W,4),dtype=np.uint8)
 if glowrad:
  g=np.clip(1-(r-287)/glowrad,0,1);g[r<=287]=0;a[:,:,:3]=centre;a[:,:,3]=(g*g*100).astype('uint8')
 weight=np.clip(1-diskR,0,1)**.65;rgb=np.array(edge)[None,None,:]+weight[:,:,None]*(np.array(centre)-edge)[None,None,:]
 # preserve low-amplitude weave from generated original
 lum=texture.mean(2);detail=(lum-lum.mean())*.17;rgb=np.clip(rgb+detail[:,:,None],0,255)
 patch=np.zeros((574,574,4),dtype=np.uint8);patch[:,:,:3]=rgb.astype('uint8');patch[:,:,3]=(diskR<=1)*255
 im=Image.fromarray(a);im.alpha_composite(Image.fromarray(patch),(225,225));d=ImageDraw.Draw(im)
 ring={'off':(123,99,146),'faint':(123,99,146),'fair':(102,77,61),'good':(172,125,66),'shine':(227,189,110)}[state]
 d.ellipse((225,225,798,798),outline=ring,width=3)
 # one calm upper-left reflection shared at exactly same location
 spot=Image.new('RGBA',im.size);sd=ImageDraw.Draw(spot);sd.ellipse((325,302,368,324),fill=(246,241,250,62));spot=spot.filter(ImageFilter.GaussianBlur(7));im.alpha_composite(spot)
 if state=='faint':
  spot=Image.new('RGBA',im.size);ImageDraw.Draw(spot).ellipse((508,508,515,515),fill=(170,160,182,100));spot=spot.filter(ImageFilter.GaussianBlur(3));im.alpha_composite(spot)
 if state=='shine':
  d=ImageDraw.Draw(im)
  for ang in [45,135,225,315]:
   px=511.5+287*math.cos(math.radians(ang));py=511.5+287*math.sin(math.radians(ang));d.line((px-7,py,px+7,py),fill=(255,246,214,255),width=1);d.line((px,py-7,px,py+7),fill=(255,246,214,255),width=1)
 if not glowrad:
  pix=np.array(im);pix[r>287]=0;im=Image.fromarray(pix)
 save(im,'lamp-'+state)
# Mat already passed: retain unmodified output, but standardize rgba transparency RGB policy.
save(Image.open(P/'edited/counter-mat.png'),'counter-mat')
print('Built',len(list(O.glob('*.png'))),'processed assets')
