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
                self.assertEqual(builder.portraits(base=root/'missing'),{})
            finally:
                builder.ASSETS,builder.OUT,builder.load_characters,images.ASSETS,images.OUT,sys.argv=original

if __name__=='__main__':
    unittest.main()
