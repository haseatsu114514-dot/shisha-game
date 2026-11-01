# 生成画像（または既存差分）を透過で切り抜き、normal の人物の高さ・上端・中心に合わせて 896×1200 へ配置
import sys
from PIL import Image
def place(src,normal,dst):
  n=Image.open(normal).convert('RGBA');nb=n.split()[3].getbbox()
  im=Image.open(src).convert('RGBA');a=im.split()[3].point(lambda v:v if v>8 else 0);im.putalpha(a)
  im=im.crop(a.getbbox());h=nb[3]-nb[1];w=round(im.width*h/im.height)
  im=im.resize((w,h),Image.LANCZOS)
  out=Image.new('RGBA',n.size,(0,0,0,0));cx=(nb[0]+nb[2])//2
  out.alpha_composite(im,(max(0,min(n.width-w,cx-w//2)),nb[1]));out.save(dst,optimize=True)
if __name__=='__main__': place(*sys.argv[1:4])
