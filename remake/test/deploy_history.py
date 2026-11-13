#!/usr/bin/env python3
"""Deployment retention regression; also run by the stamp-deploy quick suite."""
import http.server
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('history', ROOT / 'tools/retain_deploy_js.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class HistoryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.cache = self.root / 'cache'

    def site(self, build, contents='export const value = 1;'):
        site = self.root / ('site-' + build)
        js = site / 'remake' / ('js-' + build)
        js.mkdir(parents=True, exist_ok=True)
        (js / 'main.js').write_text(contents)
        return site

    def seed(self, builds):
        self.cache.mkdir(exist_ok=True)
        for name in builds:
            d = self.cache / name
            d.mkdir(exist_ok=True)
            (d / 'main.js').write_text('old')
        (self.cache / 'index.json').write_text(json.dumps(builds))

    def test_cache_miss_and_rerun(self):
        site = self.site('new')
        (site / 'remake/build.json').write_text('{"build":"new"}')
        first = m.retain(site, self.cache, 'new', 100)
        self.assertTrue(first['currentCached'])
        self.assertEqual(m.retain(site, self.cache, 'new', 101)['builds'], 1)
        self.assertEqual((site / 'remake/build.json').read_text(), '{"build":"new"}')

    def test_old_lazy_import_after_replacement(self):
        old = self.site('old', "export async function resume() { return (await import('./chapter.js')).value; }")
        (old / 'remake/js-old/chapter.js').write_text('export const value = 42;')
        m.retain(old, self.cache, 'old', 100)
        new = self.site('new', 'export const value = 99;')
        # Without retention, a fresh deployment deletes the old URLs.
        self.assertFalse((new / 'remake/js-old/chapter.js').exists())
        m.retain(new, self.cache, 'new', 101)
        class QuietHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(args[2].active_directory), **kwargs)

            def do_GET(self):
                if self.path == '/deploy':
                    self.server.active_directory = new
                    self.send_response(200)
                    self.end_headers()
                else:
                    super().do_GET()

            def log_message(self, *_):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        server.active_directory = old
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            # Main was already loaded before the deployment; only the chapter is
            # requested after it. Execute the actual ESM dynamic import, not a regex.
            code = """
import vm from 'node:vm';
import assert from 'node:assert/strict';
const url = process.argv[1];
const context = vm.createContext({});
async function load(url) {
  const response = await fetch(url); assert.equal(response.status, 200);
  const mod = new vm.SourceTextModule(await response.text(), { context, identifier: url,
    importModuleDynamically: async (specifier, parent) => load(new URL(specifier, parent.identifier).href) });
  await mod.link(() => { throw new Error('unexpected static import'); });
  await mod.evaluate(); return mod;
}
const main = await load(url + '/remake/js-old/main.js');
assert.equal((await fetch(url + '/deploy')).status, 200);
assert.equal(await main.namespace.resume(), 42);
assert.equal(await main.namespace.resume(), 42);
assert.equal((await load(url + '/remake/js-new/main.js')).namespace.value, 99);
"""
            subprocess.run(['node', '--experimental-vm-modules', '--input-type=module', '-e', code,
                            f'http://127.0.0.1:{server.server_port}'], check=True, capture_output=True, text=True)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
        self.assertEqual((new / 'remake/js-old/chapter.js').read_bytes(), (old / 'remake/js-old/chapter.js').read_bytes())

    def test_expiry_and_never_refresh_old_age(self):
        self.seed({'js-expired': 99, 'js-recent': 101})
        site = self.site('new')
        m.retain(site, self.cache, 'new', 100 + m.MAX_AGE)
        self.assertFalse((site / 'remake/js-expired').exists())
        self.assertTrue((site / 'remake/js-recent').exists())
        self.assertEqual(json.loads((self.cache / 'index.json').read_text())['js-recent'], 101)
        site2 = self.site('next')
        m.retain(site2, self.cache, 'next', 102 + m.MAX_AGE)
        self.assertFalse((site2 / 'remake/js-recent').exists())

    def test_count_limit_newest_first(self):
        self.seed({f'js-old{i}': 100 + i for i in range(30)})
        site = self.site('new')
        result = m.retain(site, self.cache, 'new', 200)
        self.assertEqual(result['builds'], m.MAX_BUILDS)
        self.assertTrue((site / 'remake/js-old29').exists())
        self.assertFalse((site / 'remake/js-old10').exists())

    def test_byte_budget_and_oversize_current_keeps_publishing(self):
        old_limit = m.MAX_BYTES
        self.addCleanup(setattr, m, 'MAX_BYTES', old_limit)
        m.MAX_BYTES = 10
        self.seed({'js-first': 100, 'js-second': 101, 'js-third': 102})
        site = self.site('new', '1234')
        self.assertEqual(m.retain(site, self.cache, 'new', 200)['bytes'], 10)
        self.assertFalse((site / 'remake/js-first').exists())
        big = self.site('large', 'x' * 11)
        result = m.retain(big, self.cache, 'large', 201)
        self.assertFalse(result['currentCached'])
        self.assertLessEqual(result['bytes'], 10)
        self.assertEqual((big / 'remake/js-large/main.js').read_text(), 'x' * 11)

    def test_invalid_metadata_and_unknown_files_do_not_publish(self):
        self.seed({'../../escape': 100, 'js-bad': 'invalid', 'js-future': 300,
                   'js-nan': float('nan'), 'js-huge': 10**400, 'js-neghuge': -(10**400), 'js-good': 100})
        (self.cache / 'unlisted.txt').write_text('not public')
        site = self.site('new')
        self.assertEqual(m.retain(site, self.cache, 'new', 200)['builds'], 2)
        self.assertEqual(set(p.name for p in self.cache.iterdir()), {'index.json', 'js-good', 'js-new'})

    def test_corrupt_or_wrong_shape_index_is_cache_miss(self):
        self.cache.mkdir()
        for data in ('{broken', '[]', 'null'):
            (self.cache / 'index.json').write_text(data)
            self.assertEqual(m.retain(self.site('new'), self.cache, 'new', 100)['builds'], 1)

    def test_symlink_old_tree_is_not_published(self):
        self.seed({'js-old': 100})
        (self.cache / 'js-old/link.js').symlink_to(self.root / 'secret')
        site = self.site('new')
        self.assertEqual(m.retain(site, self.cache, 'new', 200)['builds'], 1)
        self.assertFalse((site / 'remake/js-old').exists())

    def test_unpublished_candidate_does_not_drop_previous_published_js(self):
        m.retain(self.site('published'), self.cache, 'published', 100)
        # A prepared run saves its candidate, then fails or is cancelled before
        # deploy; the next run must still retain the actually published version.
        m.retain(self.site('cancelled'), self.cache, 'cancelled', 101)
        next_site = self.site('next')
        m.retain(next_site, self.cache, 'next', 102)
        self.assertTrue((next_site / 'remake/js-published/main.js').exists())
        self.assertTrue((next_site / 'remake/js-cancelled/main.js').exists())

    def test_workflow_cache_is_optional_bounded_and_saved_before_publication(self):
        workflow = (ROOT.parent / '.github/workflows/deploy-pages.yml').read_text()
        restore = workflow.index('uses: actions/cache/restore@v4')
        retain = workflow.index('python3 remake/tools/retain_deploy_js.py')
        save = workflow.index('uses: actions/cache/save@v4')
        publish = workflow.index('uses: actions/deploy-pages@v4')
        self.assertLess(restore, retain)
        self.assertLess(retain, save)
        self.assertLess(save, publish)
        for action in ('restore', 'save'):
            step = workflow.split(f'uses: actions/cache/{action}@v4', 1)[1].split('      - ', 1)[0]
            self.assertIn('continue-on-error: true', step)
            self.assertIn('path: .deploy-js-history', step)
            self.assertIn('key: deploy-js-v1-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}', step)
        self.assertIn('restore-keys: deploy-js-v1-', workflow)
        self.assertIn('group: pages', workflow)
        self.assertIn('cancel-in-progress: true', workflow)

    def test_missing_current_fails_without_erasing_history(self):
        self.seed({'js-old': 100})
        with self.assertRaises(ValueError):
            m.retain(self.root / 'absent', self.cache, 'new', 200)
        self.assertTrue((self.cache / 'js-old/main.js').exists())


if __name__ == '__main__':
    unittest.main()
