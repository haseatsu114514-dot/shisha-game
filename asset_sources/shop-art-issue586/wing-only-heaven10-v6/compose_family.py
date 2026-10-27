"""Reuse accepted v5 three bytes; apply unchanged pinned v5 engine to seven only.

All source/carton resampling is restricted to QA layouts, never output artwork.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import io
import json
import math
import types
import cv2
import numpy as np
import PIL
from PIL import Image,ImageDraw,ImageFont

HERE=Path(__file__).resolve().parent
C=json.loads((HERE/'config.json').read_text())
IDS=['mint','double_apple','blueberry','strawberry','pineapple','lemon','orange','grape','watermelon','cinnamon']
FONT=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
SMALL=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',13)


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def encode(im):
    buf=io.BytesIO();im.save(buf,format='PNG');return buf.getvalue()


def engine():
    path=HERE/C['engine'];assert sha(path)==C['engine_sha256'],'Validated engine changed'
    module=types.ModuleType('immutable_v5_engine');module.__file__=str(path)
    # No importlib cache writes in the preserved v5 directory.
    exec(compile(path.read_text(),str(path),'exec'),module.__dict__)
    module.HERE=HERE;module.CONFIG=C
    return module


def protect(item,src,allowed):
    art=np.zeros(allowed.shape,'uint8')
    cv2.fillPoly(art,[np.asarray(item['protected_art_polygon'],'int32')],1)
    front=np.zeros_like(art)
    cv2.fillConvexPoly(front,np.asarray(item['front_quad_tl_tr_br_bl'],'int32'),1)
    assert not np.any(allowed&art.astype(bool)),f'Protected fruit/band overlap: {item["id"]}'
    assert not np.any(allowed&~front.astype(bool)),f'Outside front: {item["id"]}'
    assert int(np.ptp(src[:,:,:3].astype('int16'),axis=2)[allowed].max())<20
    return art


def accepted_row(item,files):
    v5=HERE.parent/'wing-only-composite-v5';id=item['id']
    v=json.loads((v5/'validation.json').read_text());report=copy.deepcopy(next(x for x in v['items'] if x['id']==id))
    output=HERE/item['reuse_output'];assert sha(output)==item['reuse_output_sha256']
    assert sha(HERE/item['source'])==item['source_sha256']
    src=np.asarray(Image.open(HERE/item['source']));out=np.asarray(Image.open(output))
    masks={}
    for name in ['old-glyph','new-glyph','allowed-union','changed']:
        path=v5/'masks'/f'{id}-{name}.png';files[f'masks/{id}-{name}.png']=path.read_bytes()
        masks[name]=np.asarray(Image.open(path))>0
    for suffix in ['allowed-overlay','diff-heatmap','logo-crops-100pct','logo-crops-200pct','front-before','front-after']:
        files[f'qa/{id}-{suffix}.png']=(v5/'qa'/f'{id}-{suffix}.png').read_bytes()
    files[report['output']]=output.read_bytes()  # Exact approved bytes, no decode/re-encode.
    report['reused_accepted_v5_bytes']=True
    return src,out,masks['allowed-union'],masks['changed'],report


def new_row(item,glyph,m,files):
    src,out,restored,old,new,allowed,changed,report,rect=m.compose(item,glyph)
    id=item['id'];files[report['output']]=m.png_bytes(out)
    for name,mask in [('old-glyph',old),('new-glyph',new),('allowed-union',allowed),('changed',changed)]:
        files[f'masks/{id}-{name}.png']=m.png_bytes(mask.astype('uint8')*255)
    overlay=np.asarray(m.paint_on_dark(src)).copy()
    overlay[allowed]=(overlay[allowed]*.45+np.array([50,230,130])*.55).astype('uint8')
    files[f'qa/{id}-allowed-overlay.png']=m.png_bytes(overlay)
    heat=np.zeros_like(src);heat[:,:,3]=255;heat[changed,:3]=[255,90,60]
    files[f'qa/{id}-diff-heatmap.png']=m.png_bytes(heat)
    roi=item['brand_roi_bbox'];panels=[m.paint_on_dark(a).crop(roi) for a in [src,restored,out]]
    cw,ch=panels[0].size;crop=Image.new('RGB',(cw*3,ch+25),'#191922');d=ImageDraw.Draw(crop)
    for j,(label,im) in enumerate(zip(['v4 candidate base','local old-ink fill ONLY','v6 wing code'],panels)):
        d.text((j*cw+4,2),label,font=SMALL,fill='white');crop.paste(im,(j*cw,25))
    files[f'qa/{id}-logo-crops-100pct.png']=encode(crop)
    files[f'qa/{id}-logo-crops-200pct.png']=encode(crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST))
    for name,a in [('before',src),('after',out)]:
        files[f'qa/{id}-front-{name}.png']=m.png_bytes(cv2.warpPerspective(a,rect,tuple(C['front_rectified_size']),flags=cv2.INTER_CUBIC))
    report['reused_accepted_v5_bytes']=False
    return src,out,allowed,changed,report


def layout(rows,m,files):
    # Variable-length layouts: no reuse of the old three-column fixed canvas.
    n=len(rows);cols=5;cell_w=300;cell_h=440
    family=Image.new('RGB',(cols*cell_w,90+math.ceil(n/cols)*cell_h),'#191922');fd=ImageDraw.Draw(family)
    fd.text((14,10),'Heaven10 / 3 accepted v5 byte reuses + 7 wing-only v6 / SOURCE ONLY',font=FONT,fill='white')
    fd.text((14,40),'Original baselines: v3 for three, v4 native candidates for seven. NO runtime adoption.',font=FONT,fill='#d0c9dc')
    pair_h=430;pair_w=600;pair=Image.new('RGB',(1200,90+math.ceil(n/2)*pair_h),'#191922');pd=ImageDraw.Draw(pair)
    pd.text((14,10),'Heaven10 BEFORE / AFTER: fruit, bands, carton, background pixels preserved',font=FONT,fill='white')
    pd.text((14,40),'v3 -> accepted v5 (3 exact reuse) | v4 candidate -> new wing-only code (7)',font=FONT,fill='#d0c9dc')
    thumbs=Image.new('RGB',(1080,60+n*180),'#191922');td=ImageDraw.Draw(thumbs)
    td.text((14,12),'ALL10 before / after at 66,112,128px; source-only QA',font=FONT,fill='white')
    planes=Image.new('RGB',(1000,60+n*290),'#191922');qd=ImageDraw.Draw(planes)
    qd.text((14,12),'ALL10 front plane (700x1000) / before left, after right',font=FONT,fill='white')
    review=Image.new('RGB',(1480,60+n*205),'#191922');rd=ImageDraw.Draw(review)
    rd.text((14,12),'ALL10 old glyph / new glyph / allowed union / real changed (native ROI)',font=FONT,fill='white')
    for idx,(item,src,out,allowed,changed,report) in enumerate(rows):
        id=item['id'];reused=item['mode']=='reuse_accepted_v5'
        before='v3 base' if reused else 'v4 CANDIDATE base';after='accepted v5 EXACT reuse' if reused else 'v6 wings-only code'
        fx=(idx%cols)*cell_w;fy=80+(idx//cols)*cell_h
        fd.text((fx+12,fy),id,font=FONT,fill='white');fd.text((fx+12,fy+25),after,font=SMALL,fill='#d0c9dc')
        family.paste(m.fitted_tile(out,280),(fx+10,fy+50));fd.text((fx+12,fy+340),'source: '+before,font=SMALL,fill='#d0c9dc')
        fd.text((fx+12,fy+363),'alpha exact / off-mask diff 0',font=SMALL,fill='#b5e6c5')
        px=(idx%2)*pair_w;py=80+(idx//2)*pair_h
        pd.text((px+12,py),id,font=FONT,fill='white');pd.text((px+12,py+30),before,font=SMALL,fill='#d0c9dc');pd.text((px+312,py+30),after,font=SMALL,fill='#d0c9dc')
        pair.paste(m.fitted_tile(src,280),(px+10,py+55));pair.paste(m.fitted_tile(out,280),(px+310,py+55))
        pd.text((px+12,py+355),'Only old/new wing+halo union changes; full alpha same',font=SMALL,fill='#b5e6c5')
        for j,size in enumerate([66,112,128]):
            bx=j*360;by=60+idx*180;td.text((bx+10,by),f'{id} {size}px ({before})',font=SMALL,fill='white')
            thumbs.paste(m.fitted_tile(src,size),(bx+12,by+24));thumbs.paste(m.fitted_tile(out,size),(bx+175,by+24))
        for j,name in enumerate(['before','after']):
            im=Image.open(io.BytesIO(files[f'qa/{id}-front-{name}.png'])).convert('RGBA')
            bg=Image.new('RGBA',im.size,'#292831');bg.alpha_composite(im)
            qy=60+idx*290;qd.text((j*500+10,qy),id+' / '+(before if name=='before' else after),font=SMALL,fill='white')
            planes.paste(bg.convert('RGB').crop((100,45,600,300)),(j*500,qy+24))
        rx0,ry0,rx1,ry1=item['brand_roi_bbox']
        for j,name in enumerate(['old-glyph','new-glyph','allowed-union','changed']):
            ry=60+idx*205;rd.text((j*370+10,ry),id+' / '+name,font=SMALL,fill='white')
            mask=np.asarray(Image.open(io.BytesIO(files[f'masks/{id}-{name}.png'])))>0
            crop=mask[ry0:ry1,rx0:rx1];a=np.zeros((*crop.shape,3),'uint8')
            a[crop]=[50,230,130] if name=='allowed-union' else [255,90,60] if name=='changed' else [240,240,240]
            review.paste(Image.fromarray(a),(j*370+10,ry+25))
    for name,im in [('comparison-heaven10.png',family),('comparison-before-after-heaven10.png',pair),
                    ('qa/thumbnails-all10.png',thumbs),('qa/front-planes-all10.png',planes),('qa/masks-and-diffs-all10.png',review)]:files[name]=encode(im)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    assert [i['id'] for i in C['items']]==IDS
    m=engine();glyph=m.canonical();files={};rows=[];manifest=[]
    for item in C['items']:
        if item['mode']=='reuse_accepted_v5':src,out,allowed,changed,report=accepted_row(item,files)
        else:src,out,allowed,changed,report=new_row(item,glyph,m,files)
        protected=protect(item,src,allowed)
        files[f'masks/{item["id"]}-protected-art.png']=m.png_bytes(protected*255)
        assert np.array_equal(src[:,:,3],out[:,:,3]) and not np.any(np.any(src!=out,axis=2)&~allowed)
        report.update(source_provenance=item['provenance'],mode=item['mode'],protected_art_overlap_pixels=0,
                      source_generation_manifest=item['source_generation_manifest'],protected_art_polygon=item['protected_art_polygon'])
        # Measure the real source print too: old v4 v~.166 is not a tolerance
        # around the new target v=.185.
        h=np.asarray(report['front_unit_to_native_homography'])
        pw,ph=C['front_rectified_size'];rect=np.diag([pw,ph,1.])@np.linalg.inv(h)
        before=cv2.warpPerspective(src,rect,(pw,ph),flags=cv2.INTER_LINEAR)
        white=(before[:,:,:3].min(axis=2)>=210)&(before[:,:,3]>200)
        white[:45]=False;white[300:]=False;white[:,:100]=False;white[:,600:]=False
        report['before_original_rgb210_geometry']=m.mark_geometry(white,(pw,ph))
        report['output_sha256']=hashlib.sha256(files[report['output']]).hexdigest()
        entry=copy.deepcopy(report)
        entry.update(source_rgba_sha256=hashlib.sha256(src.tobytes()).hexdigest(),source_alpha_sha256=hashlib.sha256(src[:,:,3].tobytes()).hexdigest(),
            output_rgba_sha256=hashlib.sha256(out.tobytes()).hexdigest(),output_alpha_sha256=hashlib.sha256(out[:,:,3].tobytes()).hexdigest())
        if item['mode']=='new_wing_code':
            assert entry['source_rgba_sha256']==item['source_rgba_sha256']
            assert entry['source_alpha_sha256']==item['source_alpha_sha256']
        if item['mode']=='reuse_accepted_v5':assert entry['output_sha256']==item['reuse_output_sha256']
        manifest.append(entry);rows.append((item,src,out,allowed,changed,report))
        print(item['id'],item['mode'],'off-mask0/alpha0',entry['actual_result_rgb210_geometry']['normalized'])
    layout(rows,m,files)
    data=dict(kind='CODE composition; no new image generation; source-only Heaven10',
        accepted_three='independent parent PASS of02c0649e; exact saved v5 bytes reused unchanged',
        new_seven='immutable v4 native candidate baselines; no v3 counterparts; not retroactive whole-v4 adoption',
        canonical_sha256=C['canonical_sha256'],engine_sha256=C['engine_sha256'],preedit_head=C['preedit_head'],
        runtime_integrated=False,adoption='no runtime/full PR merge approval; HMD held',
        dependencies=dict(opencv=cv2.__version__,numpy=np.__version__,pillow=PIL.__version__),items=manifest,
        limitations='Hidden paper texture locally inferred ONLY in old glyph mask. Manual front corners +/-2px approx, not camera calibration. Native source/v5 bytes and all alpha/off-mask RGBA exact.')
    files['manifest.json']=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode()
    for name,content in files.items():
        path=HERE/name
        if args.check:assert path.read_bytes()==content,f'Reproduction mismatch: {name}'
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)
    print(f'PASS: {len(files)} family artifacts; 10 outputs (3 byte reuse + 7 new wing code); exact pixels/alpha')


if __name__=='__main__':main()
