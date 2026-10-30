#!/usr/bin/env python3
"""Encode the generated AF vanilla carton without retouching its native source."""
import argparse
import io
import json
from pathlib import Path
from PIL import Image
from build_shop_art import inspect

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'asset_sources/af-vanilla/original.png'
DELIVERY = ROOT / 'remake/img/shop/af-vanilla/vanilla.webp'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    native = inspect(SOURCE)
    with Image.open(SOURCE) as im:
        output = io.BytesIO()
        im.resize((512, 512), Image.Resampling.LANCZOS).save(output, format='WEBP', quality=88, method=6, exact=True)
    encoded = output.getvalue()
    if args.check:
        assert DELIVERY.read_bytes() == encoded, 'Delivery differs from generated source'
    else:
        DELIVERY.parent.mkdir(parents=True, exist_ok=True)
        DELIVERY.write_bytes(encoded)
    delivery = inspect(DELIVERY)
    module = ('// Generated AF vanilla; derived by tools/build_af_vanilla_art.py.\n'
              'export const AF_VANILLA_ART = {\n'
              '  vanilla: { url: new URL("../../img/shop/af-vanilla/vanilla.webp", import.meta.url).href, '
              f'size: [512, 512], box: {json.dumps(delivery["box"])} }},\n'
              '};\n')
    files = {
        ROOT / 'remake/js/daily/shop-art-af-vanilla.js': module,
        ROOT / 'asset_sources/af-vanilla/validation.json': json.dumps({'source': native, 'delivery': delivery, 'bytes': len(encoded)}, indent=2) + '\n',
    }
    for path, content in files.items():
        if args.check:
            assert path.read_text() == content, f'Derived file differs: {path}'
        else:
            path.write_text(content)
    print(f'PASS: AF vanilla native PNG and 512px RGBA WebP decoded, alpha and measured window verified ({len(encoded)} bytes)')

if __name__ == '__main__':
    main()
