"""必須依存の不足は画像処理や目録出力より前に説明付きで終了する。"""
import builtins
import contextlib
import io
from pathlib import Path
import runpy
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "remake/tools/build_manifest.py"


class ManifestDependenciesTest(unittest.TestCase):
    def test_startup_dependencies(self):
        # 実環境のインストール状況に依存せず、各パッケージだけが欠けた起動を再現。
        original_import = builtins.__import__
        packages = {"PIL": SimpleNamespace(Image=object()),
                    "numpy": SimpleNamespace(), "scipy": SimpleNamespace(ndimage=object())}
        for missing, label in [("PIL", "Pillow"), ("numpy", "NumPy"), ("scipy", "SciPy"), (None, None)]:
            with self.subTest(missing=missing):
                def dependency_import(name, *args, **kwargs):
                    if name == missing:
                        raise ModuleNotFoundError(name)
                    if name in packages:
                        return packages[name]
                    return original_import(name, *args, **kwargs)

                output = io.StringIO()
                with patch("builtins.__import__", side_effect=dependency_import), \
                     patch("sys.argv", [str(SCRIPT), "--help"]), \
                     contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as caught:
                    runpy.run_path(str(SCRIPT), run_name="__main__")
                if missing:
                    self.assertEqual(str(caught.exception), f"{label} が必要です: pip install Pillow numpy scipy")
                    self.assertEqual(output.getvalue(), "", "dependency check precedes argument handling")
                else:
                    self.assertEqual(caught.exception.code, 0)
                    self.assertIn("usage:", output.getvalue())


if __name__ == "__main__":
    unittest.main()
