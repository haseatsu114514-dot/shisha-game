"""Rebuild the selected CC0 game SE from the adjacent public source recordings.

Requires ffmpeg; run from any directory. Selection is based on source descriptions
and waveform events, not an assertion that pill packaging is a needle recording.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import struct
import subprocess
import wave

SOURCE = Path(__file__).resolve().parent
OUT = SOURCE.parents[2] / "assets/audio/se"
OUT.mkdir(parents=True, exist_ok=True)


def clip(source, target, start, duration, ceiling, filters="highpass=f=80,lowpass=f=6000", extra_db=0):
    af = f"atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,{filters},afade=t=in:d=0.001,afade=t=out:st={duration-.025}:d=0.025"
    data = array.array("f")
    data.frombytes(subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(SOURCE/source), "-af", af, "-ar", "44100", "-ac", "1", "-f", "f32le", "-"]))
    gain = min(1, 10**(ceiling/20) / max(abs(x) for x in data)) * 10**(extra_db/20)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SOURCE/source), "-af", af+f",volume={gain}", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(OUT/target)], check=True)


for n, start in ((1, .02), (2, .64)):
    clip("02_tongs_processed.mp3", f"coal_grab_{n:02}.wav", start, .19, -22, extra_db=-10)
for n, start in ((1, 0), (2, .565)):
    clip("09_metal_soft_hits.mp3", f"hms_knock_{n:02}.wav", start, .34, -26, filters="highpass=f=80,lowpass=f=3600")
clip("10_pill_foil_breach.mp3", "foil_puncture.wav", 2.95, .18, -32, filters="highpass=f=500,lowpass=f=7200")
clip("04_shop_door_bell.mp3", "shop_bell.wav", 0, 1.9, -18, filters="highpass=f=150")
clip("01_water_hookah.mp3", "water_draw.wav", .4, 2, -18, filters="highpass=f=45,lowpass=f=6000")
clip("01_water_hookah.mp3", "water_end.wav", 2.05, .38, -22, filters="highpass=f=45,lowpass=f=6000")

for source, target in (("confirm_click_02.ogg", "ui_click.wav"), ("confirm_click_01.ogg", "ui_select.wav"), ("back_001.ogg", "ui_back.wav")):
    filters = "asetrate=36162,aresample=44100" if target == "ui_back.wav" else "anull"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SOURCE/source), "-af", filters, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(OUT/target)], check=True)

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SOURCE/"06_glass_clink.wav"), "-filter_complex",
    "[0:a]highpass=f=120,asplit=2[a][b];[a]atrim=duration=0.30,afade=t=out:st=0.16:d=0.14,volume=0.55[a1];"
    "[b]asetrate=53760,aresample=48000,atrim=duration=0.34,afade=t=out:st=0.18:d=0.16,volume=0.50,adelay=120[b1];"
    "[a1][b1]amix=inputs=2:normalize=0,alimiter=limit=0.5:level=false[out]", "-map", "[out]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(OUT/"lime_glass.wav")], check=True)

# Periodic seam: the tail transitions into the head, followed by the same source
# position after that head. No fade-to-silence gap or overlapping repeated shots.
data = array.array("f")
data.frombytes(subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(SOURCE/"01_water_hookah.mp3"), "-af",
    "atrim=start=0.55:duration=1.4,asetpts=PTS-STARTPTS,highpass=f=45,lowpass=f=6000", "-ar", "44100", "-ac", "1", "-f", "f32le", "-"]))
n = round(.12*44100)
samples = list(data[n:-n]) + [data[-n+i]*math.cos(i/(n-1)*math.pi/2)+data[i]*math.sin(i/(n-1)*math.pi/2) for i in range(n)]
gain = min(1, 10**(-18/20)/max(abs(x) for x in samples))
with wave.open(str(OUT/"water_loop.wav"), "wb") as w:
    w.setparams((1, 2, 44100, 0, "NONE", "not compressed"))
    w.writeframes(b"".join(struct.pack("<h", round(x*gain*32767)) for x in samples))

catalog = []
for file in sorted(OUT.glob("*.wav")):
    with wave.open(str(file)) as w:
        catalog.append({"file": file.name, "duration_seconds": w.getnframes()/w.getframerate(),
                        "channels": w.getnchannels(), "sample_rate_hz": w.getframerate(),
                        "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
(SOURCE/"game_files.json").write_text(json.dumps(catalog, indent=2)+"\n")
print(f"Prepared {len(catalog)} mono WAV files ({sum(p.stat().st_size for p in OUT.glob('*.wav'))} bytes)")
