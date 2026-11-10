#!/usr/bin/env python3
"""Rebuild the provisional TRPG SE/BGM from the CC0 originals listed in sources.json.

Originals are not committed. They are fetched once into a cache outside the repo
(default /tmp/trpg-audio-cache, override with TRPG_AUDIO_CACHE) and checked by sha256.
Requires ffmpeg/ffprobe. Run from any directory:

    python3 asset_sources/music/trpg-audio/prepare.py
"""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SE_OUT = ROOT / "assets/audio/se/trpg"
BGM_OUT = ROOT / "assets/audio/bgm"
CACHE = Path(os.environ.get("TRPG_AUDIO_CACHE", "/tmp/trpg-audio-cache"))
SOURCES = {o["id"]: o for o in json.loads((HERE / "sources.json").read_text())["originals"]}

# TRPG SE: target file -> (pack, member, peak ceiling dBFS, max seconds or None)
SE = {
    "dice_shake.wav": ("kenney_casino", "Audio/dice-shake-1.ogg", -12, .55),
    "dice_throw_01.wav": ("kenney_casino", "Audio/dice-throw-1.ogg", -10, None),
    "dice_throw_02.wav": ("kenney_casino", "Audio/dice-throw-2.ogg", -10, None),
    "dice_throw_03.wav": ("kenney_casino", "Audio/dice-throw-3.ogg", -10, None),
    "die_throw_01.wav": ("kenney_casino", "Audio/die-throw-2.ogg", -10, None),
    "die_throw_02.wav": ("kenney_casino", "Audio/die-throw-4.ogg", -10, None),
    "card_place_01.wav": ("kenney_casino", "Audio/card-place-1.ogg", -14, None),
    "card_place_02.wav": ("kenney_casino", "Audio/card-place-2.ogg", -14, None),
    "card_slide_01.wav": ("kenney_casino", "Audio/card-slide-1.ogg", -16, None),
    "card_slide_02.wav": ("kenney_casino", "Audio/card-slide-2.ogg", -16, None),
    "book_open.wav": ("kenney_rpg", "OGG/bookOpen.ogg", -14, None),
    "page_flip_01.wav": ("kenney_rpg", "OGG/bookFlip2.ogg", -16, None),
    "page_flip_02.wav": ("kenney_rpg", "OGG/bookFlip3.ogg", -16, None),
    # Pizzicato jingles, picked by pitch contour (rising = good, falling = bad).
    "jingle_success.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA10.ogg", -12, None),
    "jingle_critical.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA02.ogg", -11, None),
    "jingle_mixed.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA08.ogg", -14, None),
    "jingle_trouble.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA09.ogg", -14, None),
    "jingle_fumble.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA14.ogg", -13, None),
    "jingle_ending.wav": ("kenney_jingles", "OGG/jingles_PIZZA/jingles_PIZZA15.ogg", -12, None),
}
# TRPG BGM: game key -> source id. Loudness is matched to bgm_trpg (about -15.7 LUFS).
BGM = {
    "bgm_trpg_heist": "covert_action",
    "bgm_trpg_shark": "chest_of_adventure",
    "bgm_trpg_island": "treasure_hunter",
    "bgm_trpg_leaf": "musicbox_cute",
    "bgm_trpg_mansion": "musicbox_spooky",
    "bgm_trpg_stage": "death_waltz",
    "bgm_trpg_castle": "apparitions_ball",
    "bgm_trpg_magic": "magic_town",
    "bgm_trpg_fox": "hot_spring_town",
    "bgm_trpg_space": "out_there",
}
TARGET_LUFS, CEILING_TP, BITRATE = -16.0, -1.5, "80k"


def fetch(src):
    path = CACHE / Path(src["download_url"]).name.replace("%20", " ")
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(src["download_url"], path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != src["sha256"]:
        raise SystemExit(f"sha256 mismatch for {path}: {digest}")
    return path


def member(pack, name):
    out = CACHE / pack / name
    if not out.exists():
        with zipfile.ZipFile(fetch(SOURCES[pack])) as z:
            z.extract(name, CACHE / pack)
    return out


def peak_db(path, af):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", af + ",astats=metadata=0", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"Peak level dB: (-?[\d.]+|-inf)", log)[-1])


def build_se():
    SE_OUT.mkdir(parents=True, exist_ok=True)
    for target, (pack, name, ceiling, limit) in SE.items():
        src = member(pack, name)
        af = "silenceremove=start_periods=1:start_threshold=-45dB,highpass=f=60"
        if limit:
            af += f",atrim=duration={limit:.3f},afade=t=out:st={limit - 0.12:.3f}:d=0.12"
        af += ",areverse,silenceremove=start_periods=1:start_threshold=-60dB,afade=t=in:d=0.02,areverse"
        gain = ceiling - peak_db(src, af + ",aresample=44100")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", f"{af},volume={gain:.2f}dB",
                        "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", "-map_metadata", "-1", str(SE_OUT / target)], check=True)


def loudness(path):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    data = json.loads(log[log.rindex("{"):log.rindex("}") + 1])
    return float(data["input_i"]), float(data["input_tp"])


def build_bgm():
    report = {}
    for key, sid in BGM.items():
        src = fetch(SOURCES[sid])
        lufs, tp = loudness(src)
        gain = min(TARGET_LUFS - lufs, CEILING_TP - tp)
        out = BGM_OUT / f"{key}.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", f"volume={gain:.2f}dB", "-ar", "44100", "-ac", "2",
                        "-c:a", "libmp3lame", "-b:a", BITRATE, "-map_metadata", "-1", "-id3v2_version", "0", str(out)], check=True)
        report[key] = {"source": sid, "input_lufs": lufs, "input_true_peak_db": tp, "gain_db": round(gain, 2)}
    return report


def catalog(report):
    rows = []
    for path in sorted(SE_OUT.glob("*.wav")) + [BGM_OUT / f"{k}.mp3" for k in BGM]:
        probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=sample_rate,channels",
                                                    "-of", "json", str(path)]))
        rows.append({"file": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
                     "duration_seconds": round(float(probe["format"]["duration"]), 3),
                     "channels": probe["streams"][0]["channels"], "sample_rate_hz": int(probe["streams"][0]["sample_rate"]),
                     "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                     **({"source": SE[path.name][0] + ":" + SE[path.name][1]} if path.suffix == ".wav" else report[path.stem])})
    (HERE / "game_files.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    build_se()
    catalog(build_bgm())
