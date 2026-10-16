"""Authorized wing+halo-only composition; existing native sources are never saved.

python3 asset_sources/shop-art-issue586/wing-only-composite-v5/compose.py
python3 asset_sources/shop-art-issue586/wing-only-composite-v5/compose.py --check
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / 'config.json').read_text())
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
SMALL = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_bytes(array):
    buf = io.BytesIO()
    Image.fromarray(array).save(buf, format='PNG')
    return buf.getvalue()


def large_components(mask, minimum):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype('uint8'), 8)
    keep = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] >= minimum]
    return np.isin(labels, keep), len(keep)


def bbox(mask):
    yy, xx = np.where(mask)
    return [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]


def apply_h(points, matrix):
    a = np.c_[np.asarray(points), np.ones(len(points))] @ matrix.T
    return a[:, :2] / a[:, 2:]


def warp_coverage(source, matrix, size):
    ss=CONFIG['antialias_supersampling'];width,height=size
    # Align the centers of each supersampled block to the native pixel center.
    scale=np.array([[ss,0,(ss-1)/2],[0,ss,(ss-1)/2],[0,0,1.]])
    hi=cv2.warpPerspective(source,scale@matrix,(width*ss,height*ss),
        flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
    return cv2.resize(hi,(width,height),interpolation=cv2.INTER_AREA)


def mark_geometry(mask, plane_size):
    width,height=plane_size
    count,labels,stats,centers=cv2.connectedComponentsWithStats(mask.astype('uint8'),8)
    parts=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>30]
    assert len(parts)==2, 'Expected same two-component canonical design'
    halo,wing=sorted(parts,key=lambda i:centers[i,1])
    distance=cv2.distanceTransform((labels!=wing).astype('uint8'),cv2.DIST_L2,5)
    bb=bbox(mask)
    gap=float(distance[labels==halo].min())
    return dict(bbox=bb,normalized=dict(width=(bb[2]-bb[0])/width,height=(bb[3]-bb[1])/height,
        center_u=(bb[0]+bb[2])/(2*width),center_v=(bb[1]+bb[3])/(2*height)),
        halo_bbox=bbox(labels==halo),wings_bbox=bbox(labels==wing),
        minimum_halo_wing_pixel_center_distance=gap,gap_over_mark_width=gap/(bb[2]-bb[0]))


def canonical():
    path = HERE / CONFIG['canonical']
    assert sha(path) == CONFIG['canonical_sha256'], 'Canonical native SHA changed'
    im = Image.open(path); im.load()
    assert im.mode == 'RGBA'
    rgba = np.asarray(im)
    core, count = large_components(rgba[:, :, 3] >= 128, 500)
    assert count == 2, 'Expected joined wing pair and separate halo'
    support = cv2.dilate(core.astype('uint8'), np.ones((5, 5), 'uint8')) > 0
    coverage = np.where(support & (rgba[:, :, 3] >= 8), np.minimum(rgba[:, :, 3] / 254., 1.), 0).astype('float32')
    x0, y0, x1, y1 = CONFIG['canonical_crop']
    return coverage[y0:y1, x0:x1]


def compose(item, glyph):
    source = HERE / item['source']
    assert sha(source) == item['source_sha256'], f'Native source changed: {source}'
    with Image.open(source) as check: check.verify()
    original = Image.open(source); original.load()
    assert original.mode == 'RGBA' and original.size == (1254, 1254)
    src = np.asarray(original).copy(); height, width = src.shape[:2]
    # All search/allowed masks are declared independently of the output difference.
    x0, y0, x1, y1 = item['old_glyph_search_bbox']
    old_search = np.zeros((height, width), bool); old_search[y0:y1, x0:x1] = True
    rgb = src[:, :, :3].astype('int16')
    white = ((rgb.min(axis=2) >= CONFIG['old_white_min'])
             & (np.ptp(rgb, axis=2) <= CONFIG['old_white_chroma_max'])
             & (src[:, :, 3] > 200) & old_search)
    core, count = large_components(white, 16)
    assert count == 2, f'Expected exactly old wings + halo: {item["id"]} / {count}'
    radius = CONFIG['old_mask_dilation_px']
    old_mask = cv2.dilate(core.astype('uint8'), np.ones((2*radius+1, 2*radius+1), 'uint8')) > 0
    rx0, ry0, rx1, ry1 = item['brand_roi_bbox']
    roi = np.zeros_like(old_mask); roi[ry0:ry1, rx0:rx1] = True
    assert not np.any(old_mask & ~roi), 'Old mask extends past declared brand ROI'
    # Project the SAME canonical mark in a standardized 700x1000 front-face plane.
    plane_w, plane_h = CONFIG['front_rectified_size']
    plane_homography = cv2.getPerspectiveTransform(np.float32([[0,0],[1,0],[1,1],[0,1]]),
                                                  np.float32(item['front_quad_tl_tr_br_bl']))
    u, v = CONFIG['target_uv_center']; mark_w = CONFIG['target_width_u']
    mark_h = mark_w * plane_w / plane_h * glyph.shape[0] / glyph.shape[1]
    uv_quad = np.float32([[u-mark_w/2,v-mark_h/2],[u+mark_w/2,v-mark_h/2],
                         [u+mark_w/2,v+mark_h/2],[u-mark_w/2,v+mark_h/2]])
    dest_quad = apply_h(uv_quad, plane_homography).astype('float32')
    gh, gw = glyph.shape
    glyph_to_native = cv2.getPerspectiveTransform(np.float32([[0,0],[gw,0],[gw,gh],[0,gh]]), dest_quad)
    # Warp at 4x, then area-integrate to avoid point-sampling aliasing when reducing
    # the 1120px canonical contour to ~260-290 native pixels.
    coverage = warp_coverage(glyph,glyph_to_native,(width,height))
    coverage = np.clip(coverage, 0, 1)
    coverage[coverage < 1/255.] = 0
    new_mask = coverage > 0
    allowed = old_mask | new_mask
    assert not np.any(allowed & ~roi), 'Allowed glyph union extends past brand ROI'
    assert np.all(src[:, :, 3][allowed] > 250), 'Edit touched nonopaque cutout/box boundary'
    assert int(allowed.sum()) < width*height*.025, 'Unexpected allowed mask inflation'
    source_edit_chroma=int(np.ptp(src[:,:,:3].astype('int16'),axis=2)[allowed].max())
    assert source_edit_chroma<20,'Allowed mask touches colored ingredient/band ink'
    # Infer the occluded dark cardboard only inside the old glyph silhouette+6px.
    # This does not recover the unknowable original hidden texture exactly.
    local = src[ry0:ry1,rx0:rx1,:3].astype('float64')
    local_mask = old_mask[ry0:ry1,rx0:rx1]
    ly,lx = np.mgrid[:local.shape[0],:local.shape[1]]
    lx=(lx-local.shape[1]/2)/local.shape[1];ly=(ly-local.shape[0]/2)/local.shape[0]
    basis=np.stack([np.ones_like(lx),lx,ly,lx*lx,lx*ly,ly*ly,
                    lx**3,lx*lx*ly,lx*ly*ly,ly**3],axis=2)
    guard=cv2.dilate(local_mask.astype('uint8'),np.ones((7,7),'uint8'))>0
    known=(~guard)&(np.ptp(local,axis=2)<28)&(local.mean(axis=2)<110)
    coefficients=np.linalg.lstsq(basis[known],local[known],rcond=None)[0]
    model=np.clip(basis@coefficients,0,255)
    feather=np.clip(cv2.distanceTransform(local_mask.astype('uint8'),cv2.DIST_L2,5)
                    /CONFIG['restoration_feather_px'],0,1)
    local_restored=np.rint(local*(1-feather[:,:,None])+model*feather[:,:,None]).astype('uint8')
    restored=src.copy()
    restored[ry0:ry1,rx0:rx1,:3][local_mask]=local_restored[local_mask]
    luma = restored[:, :, :3].astype('float32').mean(axis=2)
    local_median = np.median(luma[roi & ~old_mask & ~new_mask])
    ink = np.clip(247 + .08*(luma-local_median), 242, 250)
    result = restored.copy()
    mixed = np.rint(restored[:, :, :3]*(1-coverage[:, :, None]) + ink[:, :, None]*coverage[:, :, None]).astype('uint8')
    result[new_mask, :3] = mixed[new_mask]
    # Never replace/resample/recolor the complete source or its alpha channel.
    changed = np.any(result != src, axis=2)
    assert np.count_nonzero(changed & ~allowed) == 0
    assert np.array_equal(result[:, :, 3], src[:, :, 3])
    assert np.array_equal(result[~allowed], src[~allowed])
    # Front-plane rectification for measurement/visual QA only (not deliverable edits).
    native_to_front = np.diag([plane_w,plane_h,1.]) @ np.linalg.inv(plane_homography)
    rect_cov = cv2.warpPerspective(coverage, native_to_front, (plane_w, plane_h), flags=cv2.INTER_LINEAR)
    measure = rect_cov > .5
    mb = bbox(measure)
    target_canonical = warp_coverage(glyph,
        cv2.getPerspectiveTransform(np.float32([[0,0],[gw,0],[gw,gh],[0,gh]]),
            np.float32(uv_quad)*np.float32([plane_w,plane_h])), (plane_w,plane_h)) > .5
    iou = np.count_nonzero(measure & target_canonical) / np.count_nonzero(measure | target_canonical)
    old_remaining = (restored[:, :, :3].min(axis=2) > 140) & old_mask
    assert not old_remaining.any(), 'Bright old ink remains after restoration'
    normalized = dict(width=(mb[2]-mb[0])/plane_w, height=(mb[3]-mb[1])/plane_h,
                      center_u=(mb[0]+mb[2])/(2*plane_w),center_v=(mb[1]+mb[3])/(2*plane_h))
    assert abs(normalized['center_u']-.5) < .002
    assert abs(normalized['center_v']-.185) < .002
    assert abs(normalized['width']-.45) < .004
    assert iou > .98, (item['id'],iou)
    rectified_result=cv2.warpPerspective(result,native_to_front,(plane_w,plane_h),flags=cv2.INTER_LINEAR)
    actual_white=rectified_result[:,:,:3].min(axis=2)>=210
    actual_white[:45]=False;actual_white[300:]=False;actual_white[:,:100]=False;actual_white[:,600:]=False
    actual_geometry=mark_geometry(actual_white,(plane_w,plane_h))
    canonical_geometry=mark_geometry(target_canonical,(plane_w,plane_h))
    native_yy, native_xx = np.where(new_mask)
    native_uv = apply_h(np.c_[native_xx, native_yy], np.linalg.inv(plane_homography))
    report = dict(id=item['id'], source=item['source'], source_sha256=sha(source),
        output=f'outputs/{item["id"]}-wings-composite.png', size=list(original.size), mode='RGBA',
        alpha_changed_pixels=0, off_allowed_mask_changed_rgba_pixels=0,
        old_glyph_core_components=count, old_mask_pixels=int(old_mask.sum()),
        new_mask_pixels=int(new_mask.sum()), allowed_union_pixels=int(allowed.sum()),
        allowed_canvas_fraction=float(allowed.mean()), changed_pixels=int(changed.sum()),
        allowed_bbox=bbox(allowed), brand_roi_bbox=item['brand_roi_bbox'],
        old_mask_dilation_px=radius, restored_old_ink_bright_pixels=int(old_remaining.sum()),
        restoration_cubic_rgb_coefficients=coefficients.tolist(), restoration_known_pixels=int(known.sum()),
        restoration_known_rgb_fit_rmse=float(np.sqrt(np.mean((model[known]-local[known])**2))),
        front_unit_to_native_homography=plane_homography.tolist(), glyph_to_native_homography=glyph_to_native.tolist(),
        target_quad_uv=uv_quad.tolist(), target_quad_native=dest_quad.tolist(),
        target_native_center=apply_h([[u,v]],plane_homography)[0].tolist(),
        actual_rectified_bbox=mb, actual_rectified_normalized=normalized,
        actual_result_rgb210_geometry=actual_geometry,canonical_plane_geometry=canonical_geometry,
        original_allowed_region_max_rgb_chroma=source_edit_chroma,
        original_png_metadata_keys=list(original.info),color_profile_conversion=False,
        rectified_shape_iou_vs_same_canonical=float(iou),
        target_print_top_edge_degrees=float(np.degrees(np.arctan2(*(dest_quad[1]-dest_quad[0])[::-1]))),
        raw_nonzero_mask_uv_bounds=[native_uv.min(axis=0).tolist(),native_uv.max(axis=0).tolist()])
    return src, result, restored, old_mask, new_mask, allowed, changed, report, native_to_front


def paint_on_dark(rgba):
    im=Image.fromarray(rgba); bg=Image.new('RGBA', im.size, '#292831');bg.alpha_composite(im)
    return bg.convert('RGB')


def fitted_tile(rgba, size):
    # Identical source-derived visible crop is used for before/after QA only.
    im=Image.fromarray(rgba);bb=im.getchannel('A').point(lambda x:255 if x>=8 else 0).getbbox()
    im=im.crop(bb);im.thumbnail((round(size*.88),round(size*.88)),Image.Resampling.LANCZOS)
    bg=Image.new('RGBA',(size,size),'#292831');bg.alpha_composite(im,((size-im.width)//2,(size-im.height)//2))
    return bg.convert('RGB')


def artifacts(rows, glyph):
    files={};comparison=Image.new('RGB',(1080,880),'#191922');draw=ImageDraw.Draw(comparison)
    draw.text((16,12),'v3 -> v5 / wing+halo CODE composition only / review pending',font=FONT,fill='white')
    thumbs=Image.new('RGB',(1080,610),'#191922');td=ImageDraw.Draw(thumbs)
    td.text((15,10),'Before / after at 66, 112, 128px (QA only)',font=FONT,fill='white')
    planes=Image.new('RGB',(1500,620),'#191922');pd=ImageDraw.Draw(planes)
    pd.text((12,10),'Front-plane rectification: v3 / v5 (same 700x1000 plane)',font=FONT,fill='white')
    masks=Image.new('RGB',(1480,610),'#191922');md=ImageDraw.Draw(masks)
    md.text((12,10),'Predefined old / projected new / allowed union / actual changed',font=FONT,fill='white')
    for idx,(src,out,restored,old,new,allowed,changed,report,rect_h) in enumerate(rows):
        id=report['id'];x=idx*360
        for yy,label,im in [(48,'v3 / '+id,src),(435,'v5 / same fruit + band + carton',out)]:
            draw.text((x+13,yy),label,font=FONT,fill='white')
            comparison.paste(fitted_tile(im,340),(x+10,yy+30))
        files[report['output']]=png_bytes(out)
        for name,mask in [('old-glyph',old),('new-glyph',new),('allowed-union',allowed),('changed',changed)]:
            files[f'masks/{id}-{name}.png']=png_bytes(mask.astype('uint8')*255)
        overlay=paint_on_dark(src);a=np.asarray(overlay).copy()
        # Green=old+new allowed silhouette; red=actual changed pixels.
        a[allowed]=(a[allowed]*.45+np.array([50,230,130])*.55).astype('uint8')
        files[f'qa/{id}-allowed-overlay.png']=png_bytes(a)
        heat=np.zeros_like(src);heat[:,:,3]=255;heat[changed,:3]=[255,90,60]
        files[f'qa/{id}-diff-heatmap.png']=png_bytes(heat)
        roi=CONFIG['items'][idx]['brand_roi_bbox'];rx0,ry0,rx1,ry1=roi
        # Full100% native logo/old-edge crops, plus a 2x nearest enlargement.
        panels=[paint_on_dark(im).crop(roi) for im in [src,restored,out]]
        cw,ch=panels[0].size
        crop=Image.new('RGB',(cw*3,ch+25),'#191922');cd=ImageDraw.Draw(crop)
        for j,(name,im) in enumerate(zip(['v3','old ink restored (only mask)','v5'],panels)):
            cd.text((j*cw+4,2),name,font=SMALL,fill='white');crop.paste(im,(j*cw,25))
        buf=io.BytesIO();crop.save(buf,format='PNG');files[f'qa/{id}-logo-crops-100pct.png']=buf.getvalue()
        buf=io.BytesIO();crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST).save(buf,format='PNG');files[f'qa/{id}-logo-crops-200pct.png']=buf.getvalue()
        for name,im in [('before',src),('after',out)]:
            rect=cv2.warpPerspective(im,rect_h,tuple(CONFIG['front_rectified_size']),flags=cv2.INTER_CUBIC)
            files[f'qa/{id}-front-{name}.png']=png_bytes(rect)
            py=60 if name=='before' else 350
            pd.text((idx*500+10,py-24),f'{id} / {name}',font=FONT,fill='white')
            planes.paste(paint_on_dark(rect).crop((100,45,600,300)),(idx*500,py))
        for j,(name,mask) in enumerate([('old + 6px',old),('new',new),('allowed union',allowed),('changed',changed)]):
            my=60+idx*180;mx=j*370
            md.text((mx+10,my-23),id+' / '+name,font=SMALL,fill='white')
            color=np.array([50,230,130] if name=='allowed union' else [255,90,60] if name=='changed' else [240,240,240])
            crop_mask=mask[ry0:ry1,rx0:rx1];panel=np.zeros((*crop_mask.shape,3),'uint8');panel[crop_mask]=color
            masks.paste(Image.fromarray(panel),(mx+10,my))
        for j,size in enumerate([66,112,128]):
            bx=j*360;by=55+idx*180
            td.text((bx+12,by),f'{id} {size}px: before / after',font=SMALL,fill='white')
            thumbs.paste(fitted_tile(src,size),(bx+15,by+26));thumbs.paste(fitted_tile(out,size),(bx+175,by+26))
    draw.text((16,843),'Alpha EXACT / outside explicit old+new glyph union: ZERO changed pixels',font=FONT,fill='white')
    for path,im in [('comparison-representatives.png',comparison),('qa/thumbnails-before-after.png',thumbs),
                    ('qa/front-plane-mark-comparison.png',planes),('qa/mask-and-diff-review.png',masks)]:
        buf=io.BytesIO();im.save(buf,format='PNG');files[path]=buf.getvalue()
    files['qa/canonical-coverage.png']=png_bytes(np.rint(glyph*255).astype('uint8'))
    return files


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    glyph=canonical();rows=[compose(item,glyph) for item in CONFIG['items']]
    files=artifacts(rows,glyph)
    for *_,report,_ in rows:
        report['output_sha256']=hashlib.sha256(files[report['output']]).hexdigest()
    report=dict(kind='code composition, not new generator output',source_manifest=CONFIG['source_manifest'],
                canonical_sha256=CONFIG['canonical_sha256'],items=[r[-2] for r in rows],
                caveats='Front corners manually estimated; metric center/tilt depends on that plane. Hidden cardboard is locally inferred only, not exact historical recovery. Native source PNGs/entire result alpha/off-mask RGBA unchanged.',
                dependencies=dict(opencv=cv2.__version__,numpy=np.__version__))
    files['validation.json']=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode()
    if args.check:
        for name,data in files.items():assert (HERE/name).read_bytes()==data,f'Reproduction mismatch: {name}'
        print(f'PASS: {len(files)} reproducible artifacts; source SHA/3 exact alpha/off-mask checks')
    else:
        for name,data in files.items():
            path=HERE/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        print(f'Saved {len(files)} artifacts; 3 outputs; exact alpha/off-mask checks PASS')
    for *_,r,_ in rows:print(r['id'],r['actual_rectified_normalized'],'changed',r['changed_pixels'],'allowed',r['allowed_union_pixels'])


if __name__=='__main__':main()
