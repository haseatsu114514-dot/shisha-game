#!/usr/bin/env python3
"""サンドボード（DESERT RIDE）のブーストまわりの効果音を合成する（2026-11-11・自作。外部の音源は使わない）。

オーナー「ビリビリなる効果音とか欲しい、ブースト溜まると」「ブースト時も効果音欲しい、早そうな」。

- zap_1〜3.wav   … 放電の「ビリッ」1発（鋭いバチッ＋規則正しく震えるビリリリッ）。高さと長さ違いの3つ
- thunder_full.wav … ゲージ満タンの雷（バリバリバリッ＋ビリリッ＋ゴロゴロ）。1.5秒
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


def crack(n, rng, clicks, spread, width=(0.0006, 0.0018)):
    """バチッ: ごく短い雑音の粒（1〜2ミリ秒）を spread 秒のあいだに clicks 個。高い音だけ残して鋭くする。"""
    out = np.zeros(n)
    for k in range(clicks):
        pos = int(rng.uniform(0, spread) * SR) if k else 0
        m = int(rng.uniform(*width) * SR)
        if pos + m >= n:
            continue
        out[pos:pos + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 3)) * rng.uniform(0.6, 1.0)
    return biquad(out, "hp", 1500)


def buzz(t, f0, glide, flutter, drive=4.0):
    """ビリリリ: ひずませた鋸歯状波（f0 から glide 倍へ下がる）を、規則正しい flutter Hz で区切る（ビ・リ・リ・リ）。"""
    f = f0 * (1 + (glide - 1) * t / t[-1]) * (1 + 0.04 * np.sin(2 * math.pi * 9 * t))
    phase = np.cumsum(f) / SR
    saw = 2 * (phase % 1) - 1
    tone = np.tanh(drive * (saw + 0.35 * np.sign(np.sin(2 * math.pi * 2 * phase))))
    pulse = 0.5 + 0.5 * np.tanh(6 * np.sin(2 * math.pi * flutter * t + 0.6))  # 規則正しい区切り（角を丸めた矩形）
    return tone * (0.25 + 0.75 * pulse)


def zap(seed, f0, flutter, seconds):
    """ビリッ（1発）: 鋭い「バチッ」のあとに、規則正しく震える「ビリリリッ」が少し下がりながら消える。"""
    rng = np.random.default_rng(seed)
    n = int(SR * seconds)
    t = np.arange(n) / SR
    env = np.clip(t / 0.003, 0, 1) * np.exp(-t / (seconds * 0.6))
    env[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    body = buzz(t, f0, 0.8, flutter) * env
    sizzle = biquad(rng.standard_normal(n), "hp", 3500) * (0.5 + 0.5 * np.tanh(6 * np.sin(2 * math.pi * flutter * t + 0.6))) * env * 0.22
    snap = crack(n, rng, clicks=3, spread=0.012) * 1.4
    mix = biquad(body, "hp", 250) * 1.0 + sizzle + snap
    mix = biquad(mix, "lp", 9000)
    return normalize(mix, -10)


def thunder():
    """満タンの雷: 「バリバリバリッ」（裂けるように続く火花）＋ビリリッ（長め）＋「ゴロゴロ」（低い雑音がうねって消える）。"""
    rng = np.random.default_rng(61)
    n = int(SR * 1.5)
    t = np.arange(n) / SR
    tear = crack(n, rng, clicks=18, spread=0.2, width=(0.0008, 0.003)) * 1.6
    tear *= np.exp(-np.clip(t - 0.2, 0, None) / 0.05)
    zap_env = np.clip(t / 0.004, 0, 1) * np.exp(-t / 0.22)
    body = biquad(buzz(t, 95, 0.7, 30, drive=5.0), "hp", 200) * zap_env * 0.8
    # スマホのスピーカーは 150Hz より下がほとんど出ないので、ゴロゴロは 450Hz あたりまで広げる
    rumble = biquad(rng.standard_normal(n), "lp", 140) * 5 + biquad(rng.standard_normal(n), "bp", 300, 0.8) * 1.6
    roll = 0.6 + 0.4 * np.sin(2 * math.pi * 7 * t + 1.0) * np.sin(2 * math.pi * 2.3 * t)
    rumble *= np.clip((t - 0.05) / 0.08, 0, 1) * np.exp(-np.clip(t - 0.15, 0, None) / 0.45) * roll
    mix = tear + body + rumble
    mix[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return normalize(mix, -8)


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
    "zap_1": ("放電のビリッ（低め・短い）", lambda: zap(seed=7, f0=110, flutter=28, seconds=0.2)),
    "zap_2": ("放電のビリッ（中くらい）", lambda: zap(seed=11, f0=140, flutter=34, seconds=0.26)),
    "zap_3": ("放電のビリッ（高め・長い）", lambda: zap(seed=13, f0=175, flutter=40, seconds=0.32)),
    "thunder_full": ("ゲージ満タンの雷", thunder),
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
