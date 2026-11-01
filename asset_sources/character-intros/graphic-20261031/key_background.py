import sys, numpy as np
from PIL import Image
src,dst,mode=sys.argv[1:4]
a=np.array(Image.open(src).convert('RGB')).astype(float)
R,G,B=a[...,0],a[...,1],a[...,2]
if mode=='m': m=np.minimum(R,B)-G
else: m=G-np.maximum(R,B)
al=np.clip((170-m)/80,0,1)
if mode=='m':
    cap=G+np.maximum(0,(1-al))*0+ (al<1)*30
    R=np.where(al<1,np.minimum(R,G+ (R-G)*al),R); B=np.where(al<1,np.minimum(B,G+(B-G)*al),B)
else:
    G=np.where(al<1,np.minimum(G,np.maximum(R,B)+(G-np.maximum(R,B))*al),G)
out=np.dstack([R,G,B,al*255]).clip(0,255).astype('uint8')
im=Image.fromarray(out,'RGBA'); im.save(dst)
print(dst, round((al<0.05).mean(),3))
