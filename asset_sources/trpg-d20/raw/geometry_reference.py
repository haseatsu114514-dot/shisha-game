import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation as R
from PIL import Image,ImageDraw
phi=(1+5**.5)/2
v=np.array([(0,a,b) for a in [-1,1] for b in [-phi,phi]]+[(a,b,0) for a in [-1,1] for b in [-phi,phi]]+[(b,0,a) for a in [-1,1] for b in [-phi,phi]],float)
v/=np.linalg.norm(v[0]); faces=ConvexHull(v).simplices
out=Image.new('RGBA',(1536,1024)); d=ImageDraw.Draw(out)
for k,angles in enumerate([(10,0,10),(25,30,0),(35,-30,30),(-30,35,-15),(0,15,0),(55,20,10)]):
 p=R.from_euler('xyz',angles,degrees=True).apply(v)
 for tri in sorted(faces,key=lambda f:p[f,2].mean()):
  pts=p[tri]; normal=np.cross(pts[1]-pts[0],pts[2]-pts[0]); normal*= np.sign(np.dot(normal,pts.mean(0))); normal/=np.linalg.norm(normal)
  if normal[2]<0:continue
  shade=.65+.3*max(0,np.dot(normal,np.array([-.4,-.5,1])/1.187))
  xy=[((k%3)*512+256+x*185,(k//3)*512+256-y*185) for x,y,z in pts]
  d.polygon(xy,fill=tuple(int(x*shade) for x in (255,244,220))+(255,),outline=(146,105,35,255),width=3)
out.save('trpg-d20-work/exact-icosahedron-geometry.png')
print('wrote shape reference')
