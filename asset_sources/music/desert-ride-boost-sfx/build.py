#!/usr/bin/env python3
"""サンドボード（DESERT RIDE）のブーストまわりの効果音を合成する（2026-11-11・自作。外部の音源は使わない）。

オーナー「ビリビリなる効果音とか欲しい、ブースト溜まると」「ブースト時も効果音欲しい、早そうな」。

- zap_sparse.wav … 溜まり始めの放電（まばらなパチパチとジジッ）。2秒ループ
- zap_dense.wav  … 満タンに近い放電（絶え間ないビリビリ）。2秒ループ
- boost_rush.wav … ブースト発進（ドンッ＋キュイーンと上がる回転音＋シュゴーッと抜ける風）。1.4秒
- boost_loop.wav … ブースト中の風切り（細かく震える風圧と低いうなり）。2秒ループ

ループは「2周つないでフィルターに通し、後ろの1周を使う」ので、つなぎ目で音が途切れない。
形式は既存の録音SEと同じ（モノラル 44.1kHz 16bit）。乱数の種は固定（何度作っても同じ音）。

使い方: python3 asset_sources/music/desert-ride-boost-sfx/build.py
出力: assets/audio/se/desert_ride/<名前>.wav（numpy だけを使う）と、同じフォルダの台帳 game_files.json（SHA-256）。
"""
import hashlib
import json
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets/audio/se/desert_ride"


def onepole_lp(x, fc):
    a = 1 - math.exp(-2 * math.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        s += a * (v - s)
        y[i] = s
    return y


def biquad(x, kind, fc, q=0.707):
    """RBJ の双二次フィルター（lowpass / highpass / bandpass）。"""
    w = 2 * math.pi * fc / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    else:  # bandpass（ピーク 0dB）
        b = [alpha, 0.0, -alpha]
    a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
    b0, b1, b2 = (v / a0 for v in b)
    a1, a2 = a1 / a0, a2 / a0
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        out = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, out
        y[i] = out
    return y


def svf_band(x, fc, q):
    """周波数を時間で動かせる状態変数フィルター（バンドパス）。fc は配列。"""
    y = np.empty_like(x)
    low = band = 0.0
    damp = 1 / q
    for i, v in enumerate(x):
        f = 2 * math.sin(math.pi * min(fc[i], SR / 6) / SR)
        high = v - low - damp * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def circular(fn, x):
    """ループ用: 2周つないで通し、後ろの1周を返す（つなぎ目でフィルターの状態が続く）。"""
    return fn(np.concatenate([x, x]))[len(x):]


def normalize(x, peak_dbfs):
    return x / (np.max(np.abs(x)) or 1) * 10 ** (peak_dbfs / 20)


def write(name, x):
    OUT.mkdir(parents=True, exist_ok=True)
    data = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"{name}.wav  {len(x) / SR:.2f}s  peak {20 * math.log10(np.max(np.abs(x))):.1f} dBFS")


def ramp_env(n, attack, release):
    env = np.ones(n)
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    env[:a] = np.linspace(0, 1, a)
    env[-r:] *= np.linspace(1, 0, r)
    return env


def zap(seed, seconds, arcs, crackles_per_sec, peak):
    """放電: ジジッと鳴る弧（うなる矩形波＋雑音を細かく点滅）と、パチッという火花を散らす。"""
    rng = np.random.default_rng(seed)
    n_total = int(SR * seconds)
    out = np.zeros(n_total)
    for _ in range(arcs):
        start = rng.integers(0, n_total)
        n = int(rng.uniform(0.04, 0.17) * SR)
        tt = np.arange(n) / SR
        f0 = rng.uniform(90, 200)  # ブブブ…と鳴る高さ（低いとブーン、高いとビー）
        phase = 2 * math.pi * f0 * tt + 0.4 * np.sin(2 * math.pi * rng.uniform(6, 14) * tt)
        buzz = np.sign(np.sin(phase)) * 0.6 + (2 * ((f0 * tt) % 1) - 1) * 0.4
        flick_rate = rng.uniform(25, 70)
        steps = int(n / SR * flick_rate) + 2
        gate = np.repeat((rng.random(steps) > 0.3).astype(float), int(SR / flick_rate) + 1)[:n]
        gate = np.convolve(gate, np.ones(44) / 44, mode="same")  # 1ms でならしてプツプツ鳴らさない
        arc = (buzz * 0.75 + rng.standard_normal(n) * 0.25) * gate * ramp_env(n, 0.003, 0.025) * rng.uniform(0.5, 1.0)
        out[(start + np.arange(n)) % n_total] += arc
    for _ in range(int(seconds * crackles_per_sec)):
        pos = rng.integers(0, n_total)
        n = int(rng.uniform(0.0008, 0.004) * SR)
        burst = rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 4)) * rng.uniform(0.3, 1.0)
        out[(pos + np.arange(n)) % n_total] += burst * 0.9
    body = circular(lambda s: biquad(s, "hp", 350), out)
    sizzle = circular(lambda s: biquad(s, "bp", 3000, 1.2), out)
    mix = circular(lambda s: biquad(s, "lp", 10000), body + 0.6 * sizzle)
    return normalize(mix, peak)


def boost_rush():
    """発進: ドンッ（下がる低音）＋パシッ（点火）＋キュイーン（上がる回転音）＋シュゴーッ（帯域が上がって抜ける風）。"""
    rng = np.random.default_rng(31)
    n = int(SR * 1.4)
    t = np.arange(n) / SR
    f_thump = 45 + 90 * np.exp(-t / 0.05)
    thump = np.sin(2 * math.pi * np.cumsum(f_thump) / SR) * np.exp(-t / 0.11) * 0.9
    crack = biquad(rng.standard_normal(n), "hp", 1500) * np.exp(-t / 0.018) * 0.7
    f_whine = 500 * (2600 / 500) ** np.clip(t / 0.5, 0, 1)
    ph = 2 * math.pi * np.cumsum(f_whine) / SR
    whine_env = np.clip(t / 0.015, 0, 1) * np.clip(1 - (t - 0.2) / 0.7, 0, 1) ** 1.5
    whine = (np.sin(ph) + 0.35 * np.sin(2 * ph)) * whine_env * 0.45
    fc = np.where(t < 0.22, 350 * (3200 / 350) ** (t / 0.22), 3200 * (700 / 3200) ** np.clip((t - 0.22) / 1.18, 0, 1))
    noise = rng.standard_normal(n)
    whoosh_env = np.clip(t / 0.03, 0, 1) * np.where(t < 0.45, 1.0, np.exp(-(t - 0.45) / 0.3))
    whoosh = svf_band(noise, fc, 2.5) * whoosh_env * 1.1
    air = onepole_lp(rng.standard_normal(n), 1500) * whoosh_env * 0.35
    mix = thump + crack + whine + whoosh + air
    mix[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return normalize(mix, -9)


def boost_loop():
    """ブースト中: 速く細かく震える風圧（16Hz）と、2Hz で寄せては返すうねり、低いうなり、細いジェットの鳴り（1750Hz）。
    どれも2秒で周期がそろうので、ループのつなぎ目でずれない。"""
    rng = np.random.default_rng(47)
    n = int(SR * 2.0)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    rush = circular(lambda s: biquad(s, "lp", 1800), noise)
    band = circular(lambda s: biquad(s, "bp", 1100, 0.9), noise)
    hiss = circular(lambda s: biquad(s, "bp", 4500, 1.0), noise) * 0.25
    rumble = circular(lambda s: biquad(s, "lp", 110), rng.standard_normal(n))
    rumble = rumble / np.max(np.abs(rumble))
    flutter = 1 + 0.35 * np.sin(2 * math.pi * 16 * t)
    swell = 1 + 0.25 * np.sin(2 * math.pi * 2 * t)
    mix = (rush * 0.6 + band * 0.5 + hiss) * flutter * swell
    jet = np.sin(2 * math.pi * 1750 * t + 3 * np.sin(2 * math.pi * 6 * t)) * 0.07 * swell
    mix = mix / np.max(np.abs(mix)) + rumble * 0.35 + jet
    return normalize(mix, -12)


SOUNDS = {
    "zap_sparse": ("溜まり始めの放電（ループ）", lambda: zap(seed=7, seconds=2.0, arcs=4, crackles_per_sec=10, peak=-14)),
    "zap_dense": ("満タンに近い放電（ループ）", lambda: zap(seed=11, seconds=2.0, arcs=16, crackles_per_sec=40, peak=-12)),
    "boost_rush": ("ブースト発進", boost_rush),
    "boost_loop": ("ブースト中の風切り（ループ）", boost_loop),
}


def main():
    ledger = []
    for name, (role, make) in SOUNDS.items():
        write(name, make())
        path = OUT / f"{name}.wav"
        ledger.append({"file": path.relative_to(ROOT).as_posix(), "role": role, "source": "自作（build.py で合成。外部の音源なし）",
                       "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    (Path(__file__).resolve().parent / "game_files.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
