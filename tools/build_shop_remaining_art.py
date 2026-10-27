#!/usr/bin/env python3
"""Issue 647: encode exactly eight recovered native cartons; never modify originals.

No drawing, retouching, background removal or perspective changes. Existing Heaven10
build/adoption contract remains independent; this script only produces the other8.
"""
import argparse, hashlib, io, json, pathlib
from PIL import Image
from build_shop_art import inspect
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'asset_sources/shop-art-issue647'
EXPECTED={'banana','coconut','mango','melon','peach','vanilla','rose','lychee'}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    items=json.loads((SOURCE/'sources.json').read_text())['items']
    if len(items)!=8 or {i['id'] for i in items}!=EXPECTED: raise ValueError('Expected the eight selected cartons only')
    mappings=[]; report=[]
    for item in items:
        native=ROOT/item['source']; original=native.read_bytes()
        if hashlib.sha256(original).hexdigest()!=item['sha256']: raise ValueError(f'Native source changed: {native}')
        before=inspect(native)
        with Image.open(native) as im:
            im.load(); out=io.BytesIO()
            im.resize((512,512),Image.Resampling.LANCZOS).save(out,format='WEBP',quality=88,method=6,exact=True)
        data=out.getvalue(); destination=ROOT/f'remake/img/shop/remaining8/{item["id"]}.webp'
        if args.check:
            if destination.read_bytes()!=data: raise ValueError(f'Delivery not reproducible: {destination}')
        else:
            destination.parent.mkdir(parents=True,exist_ok=True); destination.write_bytes(data)
        after=inspect(destination)
        if native.read_bytes()!=original: raise ValueError('Encoding mutated native PNG')
        report.append(dict(id=item['id'],source=before,delivery=after,bytes=len(data)))
        mappings.append(f'  "{item["id"]}": {{ url: new URL("../../img/shop/remaining8/{item["id"]}.webp", import.meta.url).href, size: [512, 512], box: {json.dumps(after["box"])} }},')
    module='// Recovered native cartons; derived by tools/build_shop_remaining_art.py.\nexport const REMAINING_SHOP_ART = {\n'+'\n'.join(mappings)+'\n};\n'
    for path,content in [(ROOT/'remake/js/daily/shop-art-remaining.js',module),(SOURCE/'validation.json',json.dumps(dict(items=report),indent=2)+'\n')]:
        if args.check:
            if path.read_text()!=content: raise ValueError(f'Derived file changed: {path}')
        else: path.write_text(content)
    print(f'PASS: 8 PNGs decoded, immutable source hashes verified; delivery {sum(i["bytes"] for i in report):,} bytes')
if __name__=='__main__': main()
