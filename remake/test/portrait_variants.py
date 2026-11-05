"""New-portrait builder regressions using only generated fixture PNGs."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
import build_manifest as builder
import build_images as images

class PortraitVariants(unittest.TestCase):
    def test_scoped_build_preserves_classic_and_uses_own_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = root / 'assets/sprites/character_variants/new'
            folder = base / 'tsumugi'
            folder.mkdir(parents=True)
            for face in ('normal', 'smile'):
                png = Image.new('RGBA', (896,1200))
                ImageDraw.Draw(png).rectangle((200,100,650,1100), fill=(10,20,30,255))
                png.save(folder / f'chr_tsumugi_{face}.png')
            out = root / 'remake/data/manifest.json'
            out.parent.mkdir(parents=True)
            classic = {'tsumugi':{'faces':['normal'],'h':.99}}
            out.write_text(json.dumps({'portraits':classic,'backgrounds':[],'cgs':[],'making':[],'webp':['old.png']}))
            original = (builder.ASSETS,builder.OUT,builder.load_characters,images.ASSETS,images.OUT,sys.argv)
            try:
                builder.ASSETS=root/'assets';builder.OUT=out;builder.load_characters=lambda:{'tsumugi':{}}
                images.ASSETS=builder.ASSETS;images.OUT=root/'remake/img'
                sys.argv=['build_manifest.py','--portrait-variants-only','tsumugi']
                builder.main()
                result=json.loads(out.read_text())
                self.assertEqual(result['portraits'],classic)
                entry=result['portraitVariants']['new']['tsumugi']
                self.assertEqual(entry['faces'],['normal','smile'])
                self.assertLess(entry['h'],.99)
                self.assertIn('old.png',result['webp'])
                for face in entry['faces']:
                    rel=f'sprites/character_variants/new/tsumugi/chr_tsumugi_{face}.png'
                    self.assertIn(rel, images.targets(result))
                    self.assertIn(rel,result['webp'])
                    with Image.open(images.OUT/Path(rel).with_suffix('.webp')) as im:
                        self.assertEqual(im.size,(896,1200))
                        with Image.open(builder.ASSETS/rel) as source:
                            self.assertEqual(im.convert('RGBA').tobytes(),source.convert('RGBA').tobytes())
                self.assertEqual(builder.portraits(base=root/'missing'),{})
            finally:
                builder.ASSETS,builder.OUT,builder.load_characters,images.ASSETS,images.OUT,sys.argv=original

    def test_nanami_targets_are_lossless_and_head_anchor_is_style_specific(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / 'sprites/character_variants/nanami/ageha'
            folder.mkdir(parents=True)
            png = folder / 'chr_ageha_normal.png'
            im = Image.new('RGBA', (896, 1200))
            ImageDraw.Draw(im).rectangle((100,100,400,1100), fill=(10,20,30,200))
            im.save(png)
            old = images.ASSETS, builder.load_characters
            try:
                images.ASSETS = root
                builder.load_characters = lambda: {'ageha': {'spriteAnchorVariants': {'nanami': 'head'}}}
                entry = builder.portraits(base=folder.parent, style='nanami')['ageha']
                self.assertEqual(entry['anchor'], 'head')
                self.assertNotIn('anchor', builder.portraits(base=folder.parent, style='new')['ageha'])
                manifest = {'backgrounds': [], 'cgs': [], 'making': [], 'portraits': {}, 'portraitVariants': {'nanami': {'ageha': entry}}}
                rel = 'sprites/character_variants/nanami/ageha/chr_ageha_normal.png'
                self.assertIn(rel, images.targets(manifest))
                import io
                with Image.open(io.BytesIO(images.encode(png, rel))) as result:
                    self.assertEqual(result.convert('RGBA').tobytes(), im.tobytes())
            finally:
                images.ASSETS, builder.load_characters = old

if __name__=='__main__':
    unittest.main()
