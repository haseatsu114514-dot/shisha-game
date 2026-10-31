# Radially remap the generated jog wheel (asset_sources/ui/dj-2073/jog-wheel.png): inner black platter 0.76R -> 0.66R,
# outer grip ring 0.24R -> 0.34R wide. Then hue-shift to purple (A) / cyan (B). Pillow + numpy only.
from PIL import Image
import numpy as np
SRC='asset_sources/ui/dj-2073/jog-wheel.png'; D='remake/img/ui/dj/'
RI, RO = .76, .66
j=Image.open(SRC).convert('RGBA'); j=j.crop(j.getbbox()).resize((1024,1024),Image.LANCZOS)
a=np.array(j).astype(float); n=a.shape[0]; c=(n-1)/2
y,x=np.mgrid[0:n,0:n]; dx,dy=x-c,y-c; r=np.hypot(dx,dy)/(n/2)
s=np.where(r<RO, r*RI/RO, RI+(r-RO)*(1-RI)/(1-RO))
k=np.divide(s,r,out=np.ones_like(r),where=r>0)
sx=(c+dx*k).round().astype(int).clip(0,n-1); sy=(c+dy*k).round().astype(int).clip(0,n-1)
out=a[sy,sx]; out[r>1]=0
img=Image.fromarray(out.astype('uint8'),'RGBA')
def shift(im,deg):
  al=im.getchannel('A'); hsv=np.array(im.convert('RGB').convert('HSV')).astype(int)
  hsv[...,0]=(hsv[...,0]+int(deg/360*256))%256
  o=Image.fromarray(hsv.astype('uint8'),'HSV').convert('RGB').convert('RGBA'); o.putalpha(al); return o
for name,deg in [('jog-wheel-purple',-75),('jog-wheel-cyan',-170)]:
  shift(img,deg).resize((420,420),Image.LANCZOS).save(D+name+'.webp',quality=86,method=6)
