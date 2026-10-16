"""配置のために半透明の髪や輪郭を薄くしてはいけない。"""
import unittest
from PIL import Image
from normalize_sprites import place_on_canvas_with_fixed_bbox


class TransparencyTest(unittest.TestCase):
    def test_canvas_placement_preserves_original_rgba(self):
        source = Image.new("RGBA", (2, 2))
        source.putdata([(40, 80, 120, a) for a in (0, 64, 128, 240)])
        placed = place_on_canvas_with_fixed_bbox(source, (0, 0, 2, 2), 8, 8)
        self.assertEqual(placed.crop((3, 6, 5, 8)).tobytes(), source.tobytes())
        self.assertEqual(placed.getpixel((0, 0)), (0, 0, 0, 0))


if __name__ == "__main__":
    unittest.main()
