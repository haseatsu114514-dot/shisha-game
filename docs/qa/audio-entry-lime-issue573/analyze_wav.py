"""Read-only PCM diagnostics. Run from repository root; JSON on stdout."""
import hashlib, json, math, struct, wave
from pathlib import Path
results = []
for path in sorted(Path('assets/audio/se').glob('*.wav')):
    with wave.open(str(path), 'rb') as wav:
        channels, width, rate, frames, compression, _ = wav.getparams()
        raw = wav.readframes(frames)
    if width != 2 or compression != 'NONE':
        raise ValueError(f'Unsupported PCM: {path}')
    samples = struct.unpack('<' + 'h' * (len(raw) // 2), raw)
    per_channel = []
    for channel in range(channels):
        values = samples[channel::channels]
        per_channel.append(dict(peak=max(map(abs, values))/32768,
            rms=math.sqrt(sum(v*v for v in values)/len(values))/32768,
            dc=sum(values)/len(values)/32768, first=values[0]/32768, last=values[-1]/32768,
            max_adjacent_delta=max(abs(b-a) for a,b in zip(values, values[1:]))/32768,
            saturated_samples=sum(v in (-32768,32767) for v in values)))
    results.append(dict(file=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        channels=channels, sample_width_bytes=width, sample_rate=rate, frames=frames,
        duration_seconds=frames/rate, metrics=per_channel))
print(json.dumps(results, indent=2))
