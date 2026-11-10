"""Rebuild camel-race and desert-ride SE from the adjacent sources.

Requires ffmpeg and cryptography (for remake/tools/pack_bgm.py).
CC0 originals live in sources/. Mixkit originals are not committed
(their free license forbids redistributing the material on its own);
set MIXKIT_RAW to a folder that contains <id>.wav (916, 226, 2658, 2494, 2498, 2043).

Outputs:
  assets/audio/se/camel_race/*.wav or *.bgm  (mono 44.1 kHz)
  assets/audio/se/desert_ride/*.bgm          (packed; Mixkit stays in this form)

Peak ceilings keep the SEs under BGM, matching asset_sources/music/minigame-se/prepare.py.
"""
from __future__ import annotations

import array
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
REPO = SOURCE.parents[2]
CAMEL_OUT = REPO / "assets/audio/se/camel_race"
DESERT_OUT = REPO / "assets/audio/se/desert_ride"
PACK = REPO / "remake/tools/pack_bgm.py"
MIXKIT_DEFAULTS = [
    Path(os.environ["MIXKIT_RAW"]) if os.environ.get("MIXKIT_RAW") else None,
    Path("/workspace/camel-sfx/raw/mixkit"),
    Path("/workspace/sandboard-sfx/raw/mixkit"),
    SOURCE / "mixkit_raw",
]
OLD_DESERT = [
    "boost_dash_lab.bgm", "carve_sand-dash_lab.bgm", "countdown_electronic_lab.bgm",
    "fall_thud_lab.bgm", "goal_fanfare_lab.bgm", "jump_anime_lab.bgm",
    "landing_soft_lab.bgm", "slide_snowboard_pocket.bgm", "ui_cursor1_lab.bgm",
    "ui_decide1_lab.bgm", "wind_hyoo_lab.bgm",
]


def mixkit(name: str) -> Path:
    for folder in MIXKIT_DEFAULTS:
        if folder and (folder / name).is_file():
            return folder / name
    raise SystemExit(
        f"Mixkit source {name} not found. Set MIXKIT_RAW to a folder with that file."
    )


def src(name: str) -> Path:
    path = SOURCE / "sources" / name
    if not path.is_file():
        raise SystemExit(f"missing source {path}")
    return path


def peak(inputs, graph):
    data = array.array("f")
    data.frombytes(subprocess.check_output(
        ["ffmpeg", "-v", "error", *inputs, "-filter_complex", graph, "-map", "[out]",
         "-ar", "44100", "-ac", "1", "-f", "f32le", "-"]
    ))
    return max(abs(x) for x in data) or 1e-12


def render_wav(target: Path, inputs: list[str], graph: str, ceiling: float):
    """graph must end in [out]; result is peak-normalised to `ceiling` dBFS, mono 44.1 kHz 16-bit WAV."""
    gain = 10 ** (ceiling / 20) / peak(inputs, graph)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *inputs,
         "-filter_complex", graph + f";[out]volume={gain}[final]", "-map", "[final]",
         "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(target)],
        check=True,
    )
    DURATIONS[target] = wav_seconds(target)


def clip_graph(start: float, duration: float, filters: str = "highpass=f=60") -> str:
    fade = min(0.08, max(0.01, duration / 3))
    return (f"[0:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,{filters},"
            f"afade=t=in:d=0.004,afade=t=out:st={max(0, duration - fade)}:d={fade}[out]")


def write_wav(target: Path, source: Path, start: float, duration: float, ceiling: float, filters: str = "highpass=f=60"):
    render_wav(target, ["-i", str(source)], clip_graph(start, duration, filters), ceiling)


def pack_wav(wav: Path, bgm: Path):
    DURATIONS[bgm] = wav_seconds(wav)
    with tempfile.TemporaryDirectory() as tmp:
        mp3 = Path(tmp) / "src.mp3"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(wav),
             "-codec:a", "libmp3lame", "-q:a", "4", "-ar", "44100", "-ac", "1", str(mp3)],
            check=True,
        )
        subprocess.run(["python3", str(PACK), str(mp3), str(bgm)], check=True)


def compose_countdown(target_wav: Path, beep_wav: Path, times: list[float], total: float, ceiling: float):
    """Place the same short beep at the given times on a silent canvas."""
    n = len(times)
    inputs = []
    for _ in times:
        inputs += ["-i", str(beep_wav)]
    delays = "".join(
        f"[{i}]adelay={int(t * 1000)}|{int(t * 1000)},aformat=sample_rates=44100:channel_layouts=mono[d{i}];"
        for i, t in enumerate(times)
    )
    mix = "".join(f"[d{i}]" for i in range(n))
    graph = (delays + f"{mix}amix=inputs={n}:normalize=0:dropout_transition=0,atrim=duration={total},"
             f"afade=t=out:st={total - 0.04}:d=0.04[out]")
    render_wav(target_wav, inputs, graph, ceiling)


def wav_seconds(path: Path) -> float:
    info = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        text=True,
    )
    return round(float(json.loads(info)["format"]["duration"]), 3)

DURATIONS = {}

def catalog_entry(path: Path) -> dict:
    return {
        "file": str(path.relative_to(REPO)),
        "seconds": DURATIONS.get(path),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def main():
    CAMEL_OUT.mkdir(parents=True, exist_ok=True)
    DESERT_OUT.mkdir(parents=True, exist_ok=True)
    built: list[Path] = []

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        # ---- camel (CC0 = wav, Mixkit = packed .bgm) ----
        beep = tmp / "beep.wav"
        write_wav(beep, mixkit("916.wav"), 0.05, 0.18, -10, filters="anull")
        camel_beep = tmp / "count_bleep.wav"
        shutil.copy(beep, camel_beep)
        pack_wav(camel_beep, CAMEL_OUT / "count_bleep.bgm")
        built.append(CAMEL_OUT / "count_bleep.bgm")

        write_wav(CAMEL_OUT / "start_cracker.wav", src("bsb_1997_firecracker-gun-1.mp3"), 0.0, 0.36, -10, filters="highpass=f=80")
        write_wav(CAMEL_OUT / "hoof_gallop.wav", src("bsb_0611_horse-gallop.mp3"), 3.22, 0.36, -12, filters="highpass=f=80")
        write_wav(CAMEL_OUT / "whip_complete.wav", src("bsb_2961_complete-whip-1.mp3"), 0.12, 0.85, -10, filters="highpass=f=80")
        write_wav(CAMEL_OUT / "perfect_confirm.wav", src("confirmation_002.ogg"), 0.0, 0.50, -12, filters="anull")
        write_wav(CAMEL_OUT / "good_confirm.wav", src("confirmation_001.ogg"), 0.0, 0.32, -12, filters="anull")
        write_wav(CAMEL_OUT / "miss_error.wav", src("error_001.ogg"), 0.0, 0.22, -12, filters="anull")
        write_wav(CAMEL_OUT / "spurt_horn.wav", src("bsb_1049_gas-fog-horn.mp3"), 0.0, 2.45, -12, filters="highpass=f=40")
        write_wav(CAMEL_OUT / "overtake_whoosh.wav", src("bsb_1801_whoosh-8.mp3"), 0.04, 0.72, -12, filters="highpass=f=80")
        fanfare = tmp / "fanfare.wav"
        write_wav(fanfare, mixkit("226.wav"), 0.08, 3.20, -12, filters="anull")
        pack_wav(fanfare, CAMEL_OUT / "fanfare_trumpet.bgm")
        built.append(CAMEL_OUT / "fanfare_trumpet.bgm")
        write_wav(CAMEL_OUT / "place_jingle.wav", src("jingles_HIT03.ogg"), 0.0, 0.78, -12, filters="anull")
        write_wav(CAMEL_OUT / "crowd_applause.wav", src("bsb_2363_applause-1.mp3"), 0.35, 3.05, -14, filters="highpass=f=80")
        write_wav(CAMEL_OUT / "stamp_drop.wav", src("drop_004.ogg"), 0.0, 0.32, -10, filters="anull")
        write_wav(CAMEL_OUT / "grunt_camel.wav", src("camel_01.ogg"), 0.04, 1.20, -14, filters="highpass=f=80")
        built += [
            CAMEL_OUT / "start_cracker.wav", CAMEL_OUT / "hoof_gallop.wav", CAMEL_OUT / "whip_complete.wav",
            CAMEL_OUT / "perfect_confirm.wav", CAMEL_OUT / "good_confirm.wav", CAMEL_OUT / "miss_error.wav",
            CAMEL_OUT / "spurt_horn.wav", CAMEL_OUT / "overtake_whoosh.wav", CAMEL_OUT / "place_jingle.wav",
            CAMEL_OUT / "crowd_applause.wav", CAMEL_OUT / "stamp_drop.wav", CAMEL_OUT / "grunt_camel.wav",
        ]

        # ---- desert-ride (all packed .bgm; Mixkit never stored unpacked) ----
        desert_wavs: dict[str, Path] = {}
        cd = tmp / "desert_countdown.wav"
        compose_countdown(cd, beep, [0.0, 0.8, 1.6], 2.50, -10)
        desert_wavs["countdown_bleeps"] = cd

        # 2494 is a soft sand bed with a lot of headroom; compress then peak-normalise so the loop is audible.
        slide = tmp / "slide.wav"
        render_wav(
            slide, ["-i", str(mixkit("2494.wav"))],
            ("[0:a]atrim=start=0.55:duration=2.4,asetpts=PTS-STARTPTS,highpass=f=80,"
             "acompressor=threshold=-40dB:ratio=3:attack=20:release=200,"
             "afade=t=in:d=0.08,afade=t=out:st=2.28:d=0.12[out]"),
            -14,
        )
        desert_wavs["slide_sand"] = slide

        wind = tmp / "wind.wav"
        render_wav(
            wind, ["-i", str(mixkit("2658.wav"))],
            ("[0:a]atrim=start=24:duration=8,asetpts=PTS-STARTPTS,highpass=f=50,lowpass=f=10000,"
             "afade=t=in:d=0.15,afade=t=out:st=7.82:d=0.18[out]"),
            -16,
        )
        desert_wavs["wind_ambience"] = wind

        carve = tmp / "carve.wav"
        write_wav(carve, mixkit("2498.wav"), 0.05, 0.70, -12, filters="highpass=f=80")
        desert_wavs["carve_sand"] = carve

        jump = tmp / "jump.wav"
        write_wav(jump, mixkit("2043.wav"), 0.0, 0.40, -12, filters="anull")
        desert_wavs["jump_videogame"] = jump

        drop = tmp / "drop.wav"
        write_wav(drop, src("drop_004.ogg"), 0.0, 0.32, -10, filters="anull")
        desert_wavs["drop_soft"] = drop

        boost = tmp / "boost.wav"
        write_wav(boost, src("bsb_1801_whoosh-8.mp3"), 0.04, 0.72, -12, filters="highpass=f=80")
        desert_wavs["boost_whoosh"] = boost

        smash = tmp / "smash.wav"
        write_wav(smash, src("metalPot1.ogg"), 0.0, 0.85, -10, filters="highpass=f=80")
        desert_wavs["smash_pot"] = smash

        pluck = tmp / "pluck.wav"
        write_wav(pluck, src("pluck_001.ogg"), 0.0, 0.14, -12, filters="anull")
        desert_wavs["ui_pluck"] = pluck

        gauge = tmp / "gauge.wav"
        write_wav(gauge, src("powerUp7.mp3"), 0.0, 0.42, -12, filters="anull")
        desert_wavs["gauge_powerup"] = gauge

        goal = tmp / "goal.wav"
        write_wav(goal, mixkit("226.wav"), 0.08, 3.20, -12, filters="anull")
        desert_wavs["goal_fanfare"] = goal

        decide = tmp / "decide.wav"
        write_wav(decide, src("confirmation_001.ogg"), 0.0, 0.32, -12, filters="anull")
        desert_wavs["ui_confirm"] = decide

        for name, wav in desert_wavs.items():
            bgm = DESERT_OUT / f"{name}.bgm"
            pack_wav(wav, bgm)
            built.append(bgm)

    for old in OLD_DESERT:
        path = DESERT_OUT / old
        if path.exists():
            path.unlink()
            print("removed", path.relative_to(REPO))

    catalog = [catalog_entry(p) for p in built]
    catalog.sort(key=lambda row: row["file"])
    (SOURCE / "game_files.json").write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for row in catalog:
        print(f"{row['file']}  {row['seconds']}s  {row['bytes']} bytes")


if __name__ == "__main__":
    main()
