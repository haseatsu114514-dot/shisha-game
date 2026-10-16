"""Independent saved-PNG/mask/source verification; never modifies artwork."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import cv2
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
IDS=['mint','double_apple','blueberry','strawberry','pineapple','lemon','orange','grape','watermelon','cinnamon']


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path):
    with Image.open(path) as check:check.verify()
    im=Image.open(path);im.load();return im,np.asarray(im)


def verify():
    c=json.loads((HERE/'config.json').read_text());manifest=json.loads((HERE/'manifest.json').read_text())
    assert [i['id'] for i in c['items']]==[i['id'] for i in manifest['items']]==IDS
    assert sha(HERE/c['canonical'])==c['canonical_sha256']
    assert sha(HERE/c['engine'])==c['engine_sha256']
    assert sum(i['mode']=='new_wing_code' for i in c['items'])==7
    rows=[]
    for item,record in zip(c['items'],manifest['items']):
        id=item['id'];source=HERE/item['source'];target=HERE/record['output']
        original,a=decode(source);result,b=decode(target)
        assert original.mode==result.mode=='RGBA' and original.size==result.size==(1254,1254)
        assert sha(source)==item['source_sha256']==record['source_sha256']
        assert sha(target)==record['output_sha256']
        assert hashlib.sha256(a.tobytes()).hexdigest()==record['source_rgba_sha256']
        assert hashlib.sha256(a[:,:,3].tobytes()).hexdigest()==record['source_alpha_sha256']
        assert hashlib.sha256(b.tobytes()).hexdigest()==record['output_rgba_sha256']
        assert hashlib.sha256(b[:,:,3].tobytes()).hexdigest()==record['output_alpha_sha256']
        masks={}
        for name in ['old-glyph','new-glyph','allowed-union','changed','protected-art']:
            mi,arr=decode(HERE/'masks'/f'{id}-{name}.png')
            assert mi.size==original.size and mi.mode=='L' and set(np.unique(arr))<={0,255}
            masks[name]=arr>0
        allowed=masks['old-glyph']|masks['new-glyph'];diff=np.any(a!=b,axis=2)
        assert np.array_equal(allowed,masks['allowed-union'])
        assert np.array_equal(diff,masks['changed'])
        assert np.count_nonzero(diff&~allowed)==0
        assert np.count_nonzero(a[:,:,3]!=b[:,:,3])==0
        assert np.array_equal(a[~allowed],b[~allowed])
        assert int(allowed.sum())<1254*1254*.025
        x0,y0,x1,y1=item['brand_roi_bbox'];roi=np.zeros(allowed.shape,bool);roi[y0:y1,x0:x1]=True
        assert not np.any(allowed&~roi)
        protected=np.zeros(allowed.shape,'uint8');cv2.fillPoly(protected,[np.asarray(item['protected_art_polygon'],'int32')],1)
        assert np.array_equal(masks['protected-art'],protected>0)
        assert not np.any(allowed&(protected>0))
        assert not np.any(diff&(protected>0))
        assert int(np.ptp(a[:,:,:3].astype('int16'),axis=2)[allowed].max())<20
        # Meaningful ingredient-area RGB tamper and background alpha tamper fail.
        probe=(903,601);assert protected[probe] and not allowed[probe]
        tampered=b.copy();tampered[probe[0],probe[1],0]^=1
        assert np.count_nonzero(np.any(a!=tampered,axis=2)&~allowed)==1
        tampered=b.copy();tampered[0,0,3]^=1
        assert np.count_nonzero(a[:,:,3]!=tampered[:,:,3])==1
        reused=item['mode']=='reuse_accepted_v5'
        if reused:assert target.read_bytes()==(HERE/item['reuse_output']).read_bytes()
        rows.append(dict(id=id,mode=item['mode'],provenance=item['provenance'],
            png_decode='PASS',size=list(result.size),mode_rgba=result.mode,
            source_png_sha256=sha(source),source_rgba_sha256=record['source_rgba_sha256'],source_alpha_sha256=record['source_alpha_sha256'],
            result_png_sha256=sha(target),full_alpha_changed_pixels=0,off_mask_rgba_changed_pixels=0,
            allowed_union_pixels=int(allowed.sum()),changed_pixels=int(diff.sum()),
            protected_band_and_ingredients_changed_pixels=0,saved_masks_match_real_diff=True,
            ingredient_rgb_negative_control_detected=True,background_alpha_negative_control_detected=True,
            exact_accepted_v5_byte_reuse=reused))
    repo=HERE.parents[2];preserved=0;v5_preserved=0
    tree=subprocess.check_output(['git','ls-tree','-r',c['preedit_head'],'--','asset_sources/shop-art-issue586'],cwd=repo).decode().splitlines()
    for line in tree:
        meta,name=line.split('\t',1);data=(repo/name).read_bytes()
        actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        assert actual==meta.split()[2],name
        preserved+=1;v5_preserved+=int('/wing-only-composite-v5/' in name)
    changes=subprocess.check_output(['git','diff','--name-only',c['preedit_head'],'--','data','assets','remake',
        'asset_sources/shop-art-issue586',':(exclude)asset_sources/shop-art-issue586/wing-only-heaven10-v6/**'],cwd=repo).decode().splitlines()
    assert not changes,changes
    return dict(kind='independent saved PNG verification, not generation or runtime QA',items=rows,
        preedit_head=c['preedit_head'],previous_shop_art_files_exact_bytes=preserved,
        previous_v5_files_exact_bytes=v5_preserved,accepted_v5_output_reuse_count=3,new_wing_code_count=7,
        data_assets_remake_or_previous_art_changed_paths=changes,canonical_native_sha256=c['canonical_sha256'])


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    report=verify();encoded=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode();path=HERE/'saved-png-checks.json'
    if args.check:assert path.read_bytes()==encoded,'Verification report differs'
    else:path.write_bytes(encoded)
    print('PASS: all10 RGBA decode/source hashes/full-alpha/off-mask/protected-art; both negative controls; '
          f'{report["previous_shop_art_files_exact_bytes"]} previous files incl {report["previous_v5_files_exact_bytes"]} v5 exact; 3 accepted bytes reused')


if __name__=='__main__':main()
