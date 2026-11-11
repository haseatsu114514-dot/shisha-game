#!/usr/bin/env python3
"""Encode approved shop illustrations, preserving their native PNG originals."""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RECORDS = ROOT / 'asset_sources/shop-art-issue586/equipment-followup'
PREMIUM_RECORDS = ROOT / 'asset_sources/premium-equipment-vol08'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    original_items = json.loads((RECORDS / 'sources.json').read_text())['items']
    premium_items = json.loads((PREMIUM_RECORDS / 'sources.json').read_text())['items']
    if [item['id'] for item in original_items] != ['lotos_hagal', 'flat_charcoal', 'cube_charcoal']:
        raise ValueError('Unexpected original shop illustration IDs')
    # 2026-11-11 オーナー採用: 高密度フラット炭C（#3335）・くじ限定台3種（#3336）・アマバースト（#3337）
    if [item['id'] for item in premium_items] != ['kumogama_phunnel', 'lotos_plus', 'stand_walnut', 'stand_custom',
                                                  'dense_flat_charcoal', 'stand_custom_melty', 'stand_custom_tosu',
                                                  'stand_custom_engraved', 'amaburst_hms']:
        raise ValueError('Only the approved premium illustrations are selected')
    items = original_items + premium_items
    mappings, report = [], []
    for item in items:
        source, delivery = ROOT / item['source'], ROOT / item['delivery']
        raw = source.read_bytes()
        if hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError(f'Changed original: {source}')
        with Image.open(source) as original:
            original.load()
            if original.mode != 'RGBA' or original.width != original.height:
                raise ValueError(f'Expected square RGBA: {source}')
            # Encode the whole square with a transparent border; native PNGs stay intact.
            scaled = original.resize((368, 368), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (512, 512))
            canvas.paste(scaled, (72, 72))
            encoded = io.BytesIO()
            canvas.save(encoded, format='WEBP', quality=88, method=6, exact=True)
            data = encoded.getvalue()
            # Legacy deliveries remain byte-for-byte unchanged; encoder versions differ.
            if item in premium_items:
                if args.check:
                    if delivery.read_bytes() != data:
                        raise ValueError(f'Delivery mismatch: {delivery}')
                else:
                    delivery.parent.mkdir(parents=True, exist_ok=True)
                    delivery.write_bytes(data)
        with Image.open(delivery) as image:
            image.load()
            alpha = image.getchannel('A')
            if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 250:
                raise ValueError(f'Missing transparent or opaque pixels: {delivery}')
            visible = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
            if not visible:
                raise ValueError(f'Empty product: {delivery}')
            left, top, right, bottom = visible
            left, top = max(0, left - 2), max(0, top - 2)
            right, bottom = min(image.width, right + 2), min(image.height, bottom + 2)
            box = [left, top, right - left, bottom - top]
            complete = alpha.getbbox()
            if min(*complete[:2], image.width - complete[2], image.height - complete[3]) < 51:
                raise ValueError('Delivery requires at least 10% transparent margin')
            url = item['delivery'].removeprefix('remake/')
            mappings.append(f'  "{item["id"]}": {{ url: new URL("../../{url}", import.meta.url).href, size: {list(image.size)}, box: {box} }},')
            report.append(dict(**item, delivery_sha256=hashlib.sha256(delivery.read_bytes()).hexdigest(),
                               size=list(image.size), box=box, alpha=list(alpha.getextrema())))
        if source.read_bytes() != raw:
            raise ValueError(f'Original was modified: {source}')
    outputs = {
        ROOT / 'remake/js/daily/shop-equipment-art.js': '// Derived by tools/build_shop_equipment_art.py; pending candidates are excluded.\nexport const SHOP_EQUIPMENT_ART = {\n' + '\n'.join(mappings) + '\n};\n',
        PREMIUM_RECORDS / 'validation.json': json.dumps(dict(items=report[len(original_items):]), indent=2) + '\n',
    }
    for path, content in outputs.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'Derived file mismatch: {path}')
        else:
            path.write_text(content)
    print(f'PASS: {len(items)} shop illustrations decoded; margins checked; originals unchanged')


if __name__ == '__main__':
    main()
