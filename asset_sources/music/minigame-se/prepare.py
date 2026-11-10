"""Rebuild the provisional minigame SE (axe throwing) from the adjacent CC0 sources.

Requires ffmpeg. Output: assets/audio/se/minigame/*.wav (mono, 44.1 kHz, 16-bit, like the other recorded SE).
Clip points come from waveform onsets, not from listening; see README.md.
"""
from pathlib import Path
import array
import hashlib
import json
import subprocess
import wave

SOURCE = Path(__file__).resolve().parent
OUT = SOURCE.parents[2] / "assets/audio/se/minigame"
OUT.mkdir(parents=True, exist_ok=True)


def peak(af, inputs):
    data = array.array("f")
    data.frombytes(subprocess.check_output(["ffmpeg", "-v", "error", *inputs, *af, "-ar", "44100", "-ac", "1", "-f", "f32le", "-"]))
    return max(abs(x) for x in data)


def render(target, inputs, graph, ceiling):
    """graph is a filter_complex ending in [out]; the result is normalised so its peak sits at `ceiling` dBFS."""
    af = ["-filter_complex", graph, "-map", "[out]"]
    gain = 10 ** (ceiling / 20) / peak(af, inputs)
    af = ["-filter_complex", graph + f";[out]volume={gain}[final]", "-map", "[final]"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, *af, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / target)], check=True)


def clip(target, source, start, duration, ceiling, filters="highpass=f=60"):
    fade = min(.08, duration / 3)
    graph = (f"[0:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,{filters},"
             f"afade=t=in:d=0.003,afade=t=out:st={duration - fade}:d={fade}[out]")
    render(target, ["-i", str(SOURCE / source)], graph, ceiling)


# Throw: one short swing whoosh (player and opponent).
clip("axe_throw.wav", "swing_woosh_jofae_389590.mp3", 0, .36, -12, filters="highpass=f=120")
# Stuck in the board: three separate thuds from one axe-into-wood recording (onsets about 1.48 s, 4.73 s, 9.22 s).
for n, start in ((1, 1.48), (2, 4.73), (3, 9.22)):
    clip(f"axe_thunk_{n:02}.wav", "axe_thuds_craigsmith_487080.mp3", start, .40, -6)
# Bounced off and fell: a plank knock, then a light metal clatter on the floor 0.26 s later.
render("axe_drop.wav", ["-i", str(SOURCE / "impactPlank_medium_000.ogg"), "-i", str(SOURCE / "impactMetal_light_001.ogg")],
       "[0:a]aformat=channel_layouts=mono[a];[1:a]aformat=channel_layouts=mono,volume=0.7,adelay=260[b];"
       "[a][b]amix=inputs=2:normalize=0:duration=longest,afade=t=out:st=0.55:d=0.15,atrim=duration=0.7[out]", -10)
# Bull / killshot: the bar crowd reacts (the swell of a short cheer, faded out).
clip("axe_cheer.wav", "short_crowd_cheer_qubodup_182571.mp3", .5, 2.2, -14, filters="highpass=f=150,lowpass=f=9000")
# Match result jingles.
clip("axe_win.wav", "tada_fanfare_a_plasterbrain_397355.mp3", 0, 1.75, -10, filters="anull")
clip("axe_lose.wav", "sad_downwards_jingle_indyarts_777557.mp3", 0, 1.54, -12, filters="anull")

catalog = []
for file in sorted(OUT.glob("*.wav")):
    with wave.open(str(file)) as w:
        catalog.append({"file": f"assets/audio/se/minigame/{file.name}", "seconds": round(w.getnframes() / w.getframerate(), 3),
                        "bytes": file.stat().st_size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
(SOURCE / "game_files.json").write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
