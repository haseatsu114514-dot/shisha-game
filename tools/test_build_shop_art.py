"""Guard the adoption boundary, not the historical candidate inventory."""
import copy
import json
import unittest
from build_shop_art import APPROVED, ACTIVE, SOURCE, inspect, sha, validate_selection

HEAVEN = {'mint', 'double_apple', 'blueberry', 'strawberry', 'pineapple', 'lemon', 'orange', 'grape', 'watermelon', 'cinnamon'}
HELD = ['vanilla', 'coconut', 'mango', 'peach', 'melon', 'banana', 'rose', 'lychee',
        'lotos_hagal', 'tanukish_lid', 'amaburst_hms']

class AdoptionTests(unittest.TestCase):
    def test_adopted_sources_are_exact(self):
        items = json.loads((ACTIVE / 'adoption.json').read_text())['items']
        self.assertEqual({i['id'] for i in items}, HEAVEN)
        validate_selection(items)
        for i in items:
            self.assertEqual(sha(SOURCE / i['source']), i['sha256'])
            self.assertEqual(inspect(SOURCE / i['source'])['size'], [1254, 1254])

    def test_native_history_and_game_data_are_unchanged(self):
        for name in ['preserved-native-pngs.json', 'preserved-data.json']:
            baseline = json.loads((ACTIVE / name).read_text())['sha256']
            for path, digest in baseline.items():
                with self.subTest(path=path):
                    self.assertEqual(sha(SOURCE.parents[1] / path), digest)

    def test_cannot_register_held_products(self):
        for id in HELD:
            with self.subTest(id=id):
                changed = copy.deepcopy(APPROVED)
                changed.append(dict(changed[0], id=id))
                with self.assertRaises(ValueError): validate_selection(changed)
                changed = copy.deepcopy(APPROVED)
                changed[0]['id'] = id
                with self.assertRaises(ValueError): validate_selection(changed)

    def test_cannot_substitute_old_source_hash_or_delivery(self):
        for field, value in [('source', 'originals/mint.png'), ('sha256', '0' * 64),
                             ('delivery', 'remake/img/shop/packages/mint.webp')]:
            changed = copy.deepcopy(APPROVED)
            changed[0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_selection(changed)

if __name__ == '__main__': unittest.main()
