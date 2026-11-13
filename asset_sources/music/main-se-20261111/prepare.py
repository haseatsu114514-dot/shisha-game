"""本編の効果音（2026-11-11 第1弾・2026-11-13 第2弾）を、CC0 の原音から作り直す。

原音はリポジトリに置かない。sources.json の URL から取得して SHA-256 を照合し、
assets/audio/se/ のゲーム用ファイルと game_files.json を書き出す。ffmpeg が必要。

    python3 asset_sources/music/main-se-20261111/prepare.py [--cache DIR]

--cache を付けると、取得済みの原音をそのフォルダから読む（無ければそこへ取得する）。
"""
from pathlib import Path
import argparse
import array
import hashlib
import json
import subprocess
import tempfile
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / "assets/audio/se"
LEDGER = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))


def fetch(cache: Path) -> dict:
    """原音を cache へそろえ、キー → ファイルのパスを返す。"""
    paths = {}
    for src in LEDGER["originals"]:
        name = src["key"] + Path(src["file"].split("?")[0]).suffix
        path = cache / name
        if not path.exists():
            request = urllib.request.Request(src["file"], headers={"User-Agent": "Mozilla/5.0"})
            path.write_bytes(urllib.request.urlopen(request, timeout=120).read())
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != src["sha256"]:
            raise SystemExit(f"{src['key']}: 原音が台帳と違う（{digest}）。配布元の更新を確認する")
        if "member" in src:  # 書庫の中の1ファイルだけ使う
            member = cache / (src["key"] + "_" + Path(src["member"]).name)
            if path.suffix == ".7z":
                try:
                    import py7zr
                except ImportError:
                    raise SystemExit("7z の書庫を開くのに py7zr が要る: pip install py7zr")
                with tempfile.TemporaryDirectory() as unpack, py7zr.SevenZipFile(path) as archive:
                    archive.extract(path=unpack, targets=[src["member"]])
                    member.write_bytes((Path(unpack) / src["member"]).read_bytes())
            else:
                member.write_bytes(zipfile.ZipFile(path).read(src["member"]))
            path = member
        paths[src["key"]] = path
    return paths


def clip(source: Path, target: str, start: float, duration: float, ceiling: float, *, highpass=0, fade_in=0.004, fade_out=0.05):
    """区間を切り出し、モノラル 44.1kHz にして、最大音量を ceiling dBFS に合わせる。.mp3 は 96kbps。"""
    # 先に浮動小数・モノラル・44.1kHz へそろえる（測る時と書き出す時でステレオの混ぜ方が変わらないように）。
    chain = ["aformat=sample_fmts=flt:sample_rates=44100:channel_layouts=mono", f"atrim=start={start}:duration={duration}", "asetpts=PTS-STARTPTS"]
    if highpass:
        chain.append(f"highpass=f={highpass}")
    chain += [f"afade=t=in:d={fade_in}", f"afade=t=out:st={duration - fade_out}:d={fade_out}"]
    af = ",".join(chain)
    base = ["ffmpeg", "-v", "error", "-y", "-i", str(source)]
    samples = array.array("f")
    samples.frombytes(subprocess.check_output(base + ["-af", af, "-ar", "44100", "-ac", "1", "-f", "f32le", "-"]))
    gain = 10 ** (ceiling / 20) / max(abs(x) for x in samples)
    codec = ["-c:a", "libmp3lame", "-b:a", "96k", "-write_xing", "0", "-id3v2_version", "0"] if target.endswith(".mp3") else ["-c:a", "pcm_s16le"]
    subprocess.run(base + ["-af", f"{af},volume={gain:.6f}", "-ar", "44100", "-ac", "1", "-map_metadata", "-1", "-fflags", "+bitexact",
                           "-flags:a", "+bitexact", *codec, str(OUT / target)], check=True)


def build(src: dict):
    clip(src["applause"], "crowd_applause_01.mp3", 2.0, 4.2, -9, highpass=150, fade_in=0.04, fade_out=1.4)
    clip(src["applause"], "crowd_applause_02.mp3", 14.0, 4.2, -9, highpass=150, fade_in=0.04, fade_out=1.4)
    clip(src["purchase"], "coin_01.wav", 0.27, 0.80, -9, highpass=200, fade_out=0.08)
    clip(src["coins"], "coin_02.wav", 7.04, 0.40, -9, highpass=200, fade_out=0.06)
    clip(src["glass"], "glass_break.wav", 0, 1.05, -10, fade_out=0.12)
    clip(src["camera"], "camera_shutter.wav", 0.09, 0.75, -14, fade_out=0.03)
    clip(src["cat_soft"], "cat_mew_01.wav", 0.36, 0.64, -15, highpass=250, fade_in=0.02, fade_out=0.06)
    clip(src["cat_meow"], "cat_mew_02.wav", 0, 0.45, -15, highpass=250, fade_out=0.05)
    clip(src["fire"], "fire_crackle_01.wav", 0.90, 0.22, -16, highpass=400, fade_out=0.04)
    clip(src["fire"], "fire_crackle_02.wav", 1.58, 0.44, -16, highpass=400, fade_out=0.04)
    clip(src["fire"], "fire_crackle_03.wav", 2.26, 0.44, -16, highpass=400, fade_out=0.04)
    clip(src["bell"], "heart_bell.wav", 0, 0.62, -15, fade_out=0.1)
    clip(src["kenney_interface"], "ui_save.wav", 0, 0.5, -14, fade_out=0.02)
    # 第2弾（2026-11-13）
    clip(src["door"], "door_open.wav", 0, 0.82, -12, fade_out=0.05)
    clip(src["complete"], "item_get.wav", 0, 0.60, -14, fade_out=0.1)
    clip(src["birds"], "morning_birds.mp3", 1.4, 3.8, -14, fade_in=0.15, fade_out=1.2)


def catalog():
    files = {}
    for entry in LEDGER["game"]:
        path = OUT / entry["file"]
        probe = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
        files["se/" + entry["file"]] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size,
                                        "duration_seconds": round(float(probe), 3)}
    (HERE / "game_files.json").write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")
    return files


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        cache = args.cache or Path(temp)
        cache.mkdir(parents=True, exist_ok=True)
        build(fetch(cache))
    made = catalog()
    print(f"{len(made)} files, {sum(f['bytes'] for f in made.values())} bytes -> {OUT}")
