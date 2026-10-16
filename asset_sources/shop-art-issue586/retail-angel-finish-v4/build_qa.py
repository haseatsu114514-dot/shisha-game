"""Arrange/inspect native PNGs only; never modify generator bytes."""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parent
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 19)
SMALL = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
IDS = ['mint', 'double_apple', 'grape']
V3 = ROOT.parent/'prototype-retail-angel-mark-v3/originals'
PREV = ['mint-angel-aligned.png', 'double_apple-angel-positioned.png', 'grape-angel-prototype.png']
QUADS = {'default': [(265,175),(915,195),(915,1110),(265,1090)],
         'grape': [(257,154),(928,171),(928,1129),(257,1106)]}

def tile(path, size):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda x: 255 if x >= 8 else 0)
    im = im.crop(a.getbbox())  # QA visible extent; native bytes retained
    im.thumbnail((int(size*.88), int(size*.88)), Image.Resampling.LANCZOS)
    bg = Image.new('RGBA', (size,size), '#292831')
    bg.alpha_composite(im, ((size-im.width)//2,(size-im.height)//2))
    return bg

def make_comparison():
    out=Image.new('RGB',(1080,880),'#191922');d=ImageDraw.Draw(out)
    d.text((18,12),'HOLD / v3 -> v4 candidates: fruit/band invariants FAILED',font=FONT,fill='#ffb4b4')
    for i,(id,old) in enumerate(zip(IDS,PREV)):
        x=i*360
        d.text((x+18,48),id+'  |  v3',font=FONT,fill='white')
        out.paste(tile(V3/old,340).convert('RGB'),(x+10,78))
        d.text((x+18,435),'v4 HELD / not approved',font=FONT,fill='#ffb4b4')
        out.paste(tile(ROOT/'originals'/f'{id}.png',340).convert('RGB'),(x+10,465))
    d.text((18,842),'NO adoption: wing-only invariant failed / HMD unapproved / PNGs preserved',font=FONT,fill='#ffb4b4')
    out.save(ROOT/'comparison-representatives.png')

def validate():
    metrics={};masks={};paths=sorted((ROOT/'originals').glob('*.png'))
    sheet=Image.new('RGB',(900, max(1,len(paths))*175),'#22222b');d=ImageDraw.Draw(sheet)
    for idx,p in enumerate(paths):
        with Image.open(p) as test: test.verify()
        im=Image.open(p);im.load();assert im.mode=='RGBA';assert im.getchannel('A').getextrema()==(0,255)
        a=np.asarray(im);visible=im.getchannel('A').point(lambda x:255 if x>=8 else 0).getbbox()
        row={'size':im.size,'mode':im.mode,'alpha_extrema':im.getchannel('A').getextrema(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'visible_bbox_alpha8':visible,'alpha1_to7_pixels':int(((a[:,:,3]>0)&(a[:,:,3]<8)).sum())}
        if p.stem in ['mint','double_apple','grape','blueberry','strawberry','pineapple','lemon','orange','watermelon','cinnamon']:
            q=QUADS.get(p.stem,QUADS['default']);tl,tr,br,bl=q
            face=im.transform((700,1000),Image.Transform.QUAD,tuple(v for pt in [tl,bl,br,tr] for v in pt),Image.Resampling.BICUBIC)
            arr=np.asarray(face);mask=(arr[:,:,:3].min(axis=2)>210)&(arr[:,:,3]>200)
            mask[:45]=False;mask[300:]=False;mask[:,:100]=False;mask[:,600:]=False
            yy,xx=np.where(mask);box=(int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1)
            row['front_quad_approx']=q;row['mark_rectified']={'bbox':box,'width_ratio':round((box[2]-box[0])/700,5),'height_ratio':round((box[3]-box[1])/1000,5),'center':[round((box[0]+box[2])/1400,5),round((box[1]+box[3])/2000,5)]}
            crop=face.crop((100,45,600,300));crop.thumbnail((290,148));sheet.paste(crop.convert('RGB'),(590,idx*175+22))
            masks[p.stem]=np.asarray(Image.fromarray(mask[box[1]:box[3],box[0]:box[2]]).resize((300,120),Image.Resampling.NEAREST))
            face.save(ROOT/'qa'/f'{p.stem}-rectified.png')
        metrics[p.stem]=row
        d.text((10,idx*175+3),p.stem,font=FONT,fill='white')
        for j,size in enumerate([66,112,128]):
            t=tile(p,size);sheet.paste(t.convert('RGB'),(10+j*180,idx*175+33));d.text((10+j*180,idx*175+155),f'{size}px',font=SMALL,fill='white')
    scores={}
    for id,m in masks.items():
        common=masks['double_apple'];scores[id]=round(float((m&common).sum()/(m|common).sum()),5)
    (ROOT/'validation.json').write_text(json.dumps({'method':'Approximate manually inspected front quadrilaterals, rectification and white-ink threshold; not exact calibrated camera or pixel identity. QA layouts only. Native bytes unchanged.','items':metrics,'mark_shape_iou_vs_template_after_bbox_normalization':scores},indent=2)+'\n')
    sheet.save(ROOT/'qa'/'thumbnails-and-front-marks.png')

if __name__=='__main__':
    make_comparison();validate()
