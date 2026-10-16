"""Independently decode saved PNGs/masks; no composition or image mutation."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent


def load(path):
    with Image.open(path) as check:check.verify()
    im=Image.open(path);im.load()
    return im,np.asarray(im)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    config=json.loads((HERE/'config.json').read_text());validation=json.loads((HERE/'validation.json').read_text())
    assert [i['id'] for i in config['items']]==[i['id'] for i in validation['items']]==['mint','double_apple','grape']
    rows=[]
    for item,expected in zip(config['items'],validation['items']):
        id=item['id'];source=HERE/item['source'];target=HERE/expected['output']
        original,a=load(source);result,b=load(target)
        assert hashlib.sha256(source.read_bytes()).hexdigest()==item['source_sha256']
        assert hashlib.sha256(target.read_bytes()).hexdigest()==expected['output_sha256']
        assert original.mode==result.mode=='RGBA' and original.size==result.size==(1254,1254)
        masks={name:load(HERE/'masks'/f'{id}-{name}.png')[1]>0 for name in ['old-glyph','new-glyph','allowed-union','changed']}
        allowed=masks['old-glyph']|masks['new-glyph'];changed=np.any(a!=b,axis=2)
        assert np.array_equal(allowed,masks['allowed-union'])
        assert np.array_equal(changed,masks['changed'])
        assert np.count_nonzero(changed&~allowed)==0
        assert np.count_nonzero(a[:,:,3]!=b[:,:,3])==0
        assert np.array_equal(a[~allowed],b[~allowed])
        x0,y0,x1,y1=item['brand_roi_bbox'];roi=np.zeros(allowed.shape,bool);roi[y0:y1,x0:x1]=True
        assert not (allowed&~roi).any()
        # A deliberately changed fruit-area pixel must be outside this allowance.
        probe=(int(original.height*.72),int(original.width*.48))
        assert not allowed[probe], 'Negative-control probe accidentally allowed'
        tampered=b.copy();tampered[probe[0],probe[1],0]^=1
        assert np.count_nonzero(np.any(a!=tampered,axis=2)&~allowed)==1
        rows.append(dict(id=id,decode='PASS',dimensions=list(result.size),mode=result.mode,
            original_alpha_extrema=original.getchannel('A').getextrema(),
            result_alpha_extrema=result.getchannel('A').getextrema(),
            source_sha256=item['source_sha256'],result_sha256=expected['output_sha256'],
            full_alpha_changed_pixels=0,off_mask_rgba_changed_pixels=0,
            saved_union_matches_old_or_new=True,saved_changed_mask_matches_real_diff=True,
            allowed_pixels=int(allowed.sum()),changed_pixels=int(changed.sum()),
            fruit_region_negative_control_detected=True))
    # Include ALL existing native sources, v2/v3/v4, alternatives and saved QA.
    preserved=0
    repo=HERE.parents[2]
    tree=subprocess.check_output(['git','ls-tree','-r',config['preedit_head'],'--','asset_sources/shop-art-issue586'],cwd=repo).decode().splitlines()
    for line in tree:
        meta,name=line.split('\t',1);data=(repo/name).read_bytes()
        oid=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        assert oid==meta.split()[2],name
        preserved+=1
    changes=subprocess.check_output(['git','diff','--name-only',config['preedit_head'],'--',
        'data','assets','remake','asset_sources/shop-art-issue586',
        ':(exclude)asset_sources/shop-art-issue586/wing-only-composite-v5/**'],cwd=repo).decode().splitlines()
    assert changes==[],changes
    report=dict(kind='independent saved-PNG roundtrip verification; no image edits',items=rows,
        preedit_head=config['preedit_head'],previous_shop_art_files_exact_bytes=preserved,
        data_assets_remake_or_previous_art_changed_paths=changes)
    encoded=(json.dumps(report,indent=2)+'\n').encode();path=HERE/'saved-png-checks.json'
    if args.check:assert path.read_bytes()==encoded,'Saved verification report differs'
    else:path.write_bytes(encoded)
    print(f'PASS: 3 decoded RGBA outputs; full alpha/off-mask EXACT; negative control; {preserved} prior files unchanged')


if __name__=='__main__':main()
