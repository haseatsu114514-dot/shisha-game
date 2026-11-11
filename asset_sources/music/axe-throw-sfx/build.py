#!/usr/bin/env python3
"""斧投げ（AXE THROW）の効果音を作る（2026-11-11）。

オーナー「斧投げ……なんか効果音しょぼかったり」。それまでの音は、その場で鳴らす短い合成音（雑音と単音の重ね）だけで、
刺さる音に重さが無く、斧が回って飛ぶ音・外れて床に落ちる音・ゲージを止める手応えも無かった。

- throw.wav      … 斧を放す（0.62秒）。腕を振る「フッ」のあと、回る刃が空気を切る「ブン・ブン・ブンッ」が近づく
- hit_1〜3.wav   … 刃が板に刺さる（0.7秒）。録音の「ドスッ」（CC0・下記）に、低い衝撃・板の鳴り・木の割れる粒を重ねた3種
- killshot.wav   … キルショット（1.4秒）。刺さる音＋刃が震える金属の「キィーン」
- bounce.wav     … 柄から当たって跳ね返る（0.35秒）。中が空洞の板を叩く「コンッ」＋刃の小さな金属音
- drop.wav       … 落ちた斧が床で鳴る（0.9秒）。「ガシャン」＋小さく2回跳ねる
- stop.wav       … ゲージを止める（0.12秒）。歯止めの「ガチッ」
- call.wav       … 狙いを宣言する（0.45秒）。刃を構える「チャキッ」と、短い金属の鳴り
- cue_drum.wav   … 最後の1投・持ち替え・延長戦（0.9秒）。低い太鼓「ドン・ドンッ」
- cue_clear.wav  … 目標達成（1.0秒）。明るい打ち上げ「シャーン」＋鈴の上昇

刺さる音の芯は、既存の録音 assets/audio/se/minigame/axe_thunk_01〜03.wav（Freesound「R15-11-Axe Thuds」craigsmith・CC0。
出典は asset_sources/music/minigame-se/）。ほかはすべて numpy で合成（外部の音源なし）。乱数の種は固定（何度作っても同じ音）。
形式は既存の録音SEと同じ（モノラル 44.1kHz 16bit）。

使い方: python3 asset_sources/music/axe-throw-sfx/build.py
出力: assets/audio/se/axe_throw/<名前>.wav と、このフォルダの台帳 game_files.json（SHA-256）。
"""
import hashlib
import json
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets/audio/se/axe_throw"
THUNK = ROOT / "assets/audio/se/minigame"


def biquad(x, kind, fc, q=0.707):
    """RBJ の双二次フィルター（lp / hp / bp。bp はピーク 0dB）。"""
    w = 2 * math.pi * fc / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    else:
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
    """周波数を時間で動かせるバンドパス（fc は配列）。"""
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


def normalize(x, peak_dbfs):
    return x / (np.max(np.abs(x)) or 1) * 10 ** (peak_dbfs / 20)


def fade(x, attack=0.002, release=0.02):
    x = x.copy()
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    x[:a] *= np.linspace(0, 1, a)
    x[-r:] *= np.linspace(1, 0, r)
    return x


def read(path):
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32768
        return data.reshape(-1, w.getnchannels()).mean(axis=1)


def place(out, x, at):
    """out の at 秒の所へ x を足す（はみ出した分は切る）。"""
    i = int(at * SR)
    m = min(len(x), len(out) - i)
    if m > 0:
        out[i:i + m] += x[:m]
    return out


def tail(x, share=0.3):
    """部品の終わりを、長さの share の分だけなめらかに消す（途中で切れて「プツッ」と鳴らないように）。"""
    m = max(2, int(len(x) * share))
    x = x.copy()
    x[-m:] *= 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, m))
    return x


def modes(seconds, partials, rng=None, detune=0.0):
    """打たれた物の鳴り: (周波数, 減衰の時定数, 大きさ) の正弦波の重ね。"""
    t = np.arange(int(SR * seconds)) / SR
    out = np.zeros_like(t)
    for f, tau, amp in partials:
        if rng is not None and detune:
            f *= 1 + rng.uniform(-detune, detune)
        out += amp * np.sin(2 * math.pi * f * t + (rng.uniform(0, 6.28) if rng is not None else 0)) * np.exp(-t / tau)
    return tail(out)


def burst(seconds, rng, lo, hi, tau):
    """短い雑音の粒（lo〜hi Hz）。"""
    n = int(SR * seconds)
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / tau)
    return tail(biquad(biquad(x, "hp", lo), "lp", hi))


def thump(seconds, f0, f1, tau):
    """低い衝撃: f0 から f1 へ下がる正弦波。"""
    t = np.arange(int(SR * seconds)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    return tail(np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0015)))


# ---------------------------------------------------------------- 個々の音
def throw():
    """フッ（腕を振る）→ ブン・ブン・ブンッ（回る刃が近づく）。最後の1回が一番大きく高い。"""
    rng = np.random.default_rng(301)
    seconds = 0.62
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # 腕を振る「フッ」: 低めの帯域の風（0〜0.16秒）
    swing = rng.standard_normal(n) * np.exp(-((t - 0.06) / 0.05) ** 2)
    out += 0.55 * svf_band(swing, np.full(n, 520.0), 0.9)
    # 回る刃: 1回転ごとに刃が空気を切る。間隔が少し詰まり、近づくほど大きく高くなる
    for k, (at, fc, amp) in enumerate([(0.17, 760, 0.45), (0.31, 980, 0.62), (0.43, 1250, 0.82), (0.53, 1550, 1.0)]):
        env = np.exp(-((t - at) / 0.038) ** 2)
        air = rng.standard_normal(n) * env
        sweep = fc * (0.75 + 0.5 / (1 + np.exp(-(t - at) / 0.012)))  # 通り過ぎる間に少し上がる
        out += amp * svf_band(air, sweep, 2.2)
        # 刃の重さ: 同じ所で鳴る低い「ブン」
        out += amp * 0.35 * np.sin(2 * math.pi * (95 + 18 * k) * t) * env
    out = biquad(out, "hp", 70)
    return fade(normalize(out, -7), 0.004, 0.03)


def hit(variant):
    """ドスッ（録音の芯）＋ドンッ（低い衝撃）＋ゴォン（板の鳴り）＋パキッ（木の割れる粒）。"""
    rng = np.random.default_rng(400 + variant)
    seconds = 0.7
    n = int(SR * seconds)
    out = np.zeros(n)
    core = read(THUNK / f"axe_thunk_0{variant}.wav")
    core = core[np.argmax(np.abs(core) > 0.05 * np.max(np.abs(core))):]  # 立ち上がりを頭にそろえる
    place(out, normalize(core, -3), 0)
    place(out, 0.75 * thump(0.45, 96 - 8 * variant, 46, 0.11), 0)
    board = modes(0.6, [(158, 0.2, 1.0), (386, 0.12, 0.6), (702, 0.07, 0.45), (1180, 0.045, 0.3)], rng, detune=0.04)
    place(out, 0.22 * board * (1 - np.exp(-np.arange(len(board)) / SR / 0.002)), 0.004)
    place(out, 0.5 * burst(0.012, rng, 2400, 7500, 0.003), 0)
    for at in (0.018, 0.041, 0.07 + 0.01 * variant):
        place(out, 0.16 * burst(0.008, rng, 2600, 6500, 0.002) * rng.uniform(0.6, 1), at)
    return fade(normalize(out, -4), 0.0005, 0.08)


def killshot():
    """キルショット: 刺さる音（hit 1）に、刃が震えて鳴る「キィーン」を重ねる。"""
    rng = np.random.default_rng(510)
    seconds = 1.4
    n = int(SR * seconds)
    out = np.zeros(n)
    place(out, hit(1), 0)
    # 刃の鳴り: 鋼の板を打った時のような倍音（整数倍でない）。2本を少しずらして揺らぎ（うなり）を出す
    ring = modes(1.35, [(1870, 0.75, 1.0), (1876.5, 0.75, 0.8), (5160, 0.32, 0.45), (3420, 0.45, 0.35), (8120, 0.12, 0.2)], rng)
    ring *= 1 - np.exp(-np.arange(len(ring)) / SR / 0.004)
    place(out, 0.34 * ring, 0.012)
    # 細かい火花のような高い粒（ごく小さく）
    for at in np.linspace(0.03, 0.22, 6):
        place(out, 0.05 * burst(0.006, rng, 6000, 12000, 0.0015), at + rng.uniform(0, 0.02))
    return fade(normalize(out, -4), 0.0005, 0.12)


def bounce():
    """柄から当たって跳ね返る: 板を叩く「コンッ」＋刃の小さな金属音。"""
    rng = np.random.default_rng(620)
    seconds = 0.35
    n = int(SR * seconds)
    out = np.zeros(n)
    knock = modes(0.3, [(212, 0.05, 1.0), (535, 0.03, 0.7), (1310, 0.015, 0.4)], rng)
    place(out, 0.8 * knock, 0)
    place(out, 0.45 * burst(0.01, rng, 1200, 5000, 0.002), 0)
    place(out, 0.12 * modes(0.25, [(2480, 0.05, 1.0), (4110, 0.03, 0.6)], rng), 0.006)
    return fade(normalize(out, -8), 0.0005, 0.05)


def drop():
    """床に落ちる: 「ガシャン」（刃の金属と柄の木）＋小さく2回跳ねる。"""
    rng = np.random.default_rng(730)
    seconds = 0.9
    n = int(SR * seconds)
    out = np.zeros(n)
    for at, amp in ((0.0, 1.0), (0.16, 0.45), (0.27, 0.22)):
        clank = modes(0.45, [(640, 0.16, 1.0), (1495, 0.11, 0.7), (2710, 0.07, 0.5), (3990, 0.04, 0.35)], rng, detune=0.03)
        clank *= 1 - np.exp(-np.arange(len(clank)) / SR / 0.001)
        place(out, amp * 0.42 * clank, at)
        place(out, amp * 0.55 * burst(0.03, rng, 900, 6000, 0.008), at)
        place(out, amp * 0.6 * thump(0.2, 140, 70, 0.04), at)
    # 転がる小さな音
    for at in np.linspace(0.33, 0.5, 5):
        place(out, 0.05 * burst(0.006, rng, 2000, 6000, 0.002), at + rng.uniform(0, 0.015))
    return fade(normalize(out, -7), 0.0005, 0.12)


def stop():
    """ゲージを止める歯止めの「ガチッ」: 2つの硬いクリックと小さな低い手応え。"""
    rng = np.random.default_rng(840)
    seconds = 0.12
    n = int(SR * seconds)
    out = np.zeros(n)
    place(out, 0.9 * burst(0.006, rng, 2000, 7000, 0.0012), 0)
    place(out, 0.6 * burst(0.006, rng, 1800, 6000, 0.0012), 0.014)
    place(out, 0.35 * modes(0.1, [(1650, 0.012, 1.0), (2900, 0.008, 0.6)], rng), 0.001)
    place(out, 0.45 * thump(0.08, 260, 150, 0.018), 0)
    return fade(normalize(out, -9), 0.0003, 0.02)


def call():
    """狙いを宣言する: 刃を構える「チャキッ」（短い擦れ＋カチッ）と、澄んだ金属の鳴り。"""
    rng = np.random.default_rng(950)
    seconds = 0.45
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros(n)
    slide = rng.standard_normal(n) * np.exp(-((t - 0.03) / 0.022) ** 2)
    out += 0.35 * svf_band(slide, 3000 + 3000 * np.clip(t / 0.06, 0, 1), 3.0)
    place(out, 0.7 * burst(0.006, rng, 2500, 9000, 0.0015), 0.062)
    ring = modes(0.38, [(2093, 0.16, 1.0), (4186, 0.08, 0.35), (5980, 0.05, 0.2)], rng)
    ring *= 1 - np.exp(-np.arange(len(ring)) / SR / 0.002)
    place(out, 0.3 * ring, 0.064)
    return fade(normalize(out, -9), 0.002, 0.05)


def cue_drum():
    """最後の1投・持ち替え・延長戦: 低い太鼓「ドン・ドンッ」（2打目が強い）。"""
    rng = np.random.default_rng(1060)
    seconds = 0.9
    n = int(SR * seconds)
    out = np.zeros(n)
    for at, amp in ((0.0, 0.7), (0.2, 1.0)):
        place(out, amp * thump(0.6, 120, 58, 0.16), at)
        place(out, amp * 0.25 * modes(0.4, [(190, 0.09, 1.0), (330, 0.05, 0.5)], rng), at)
        place(out, amp * 0.2 * burst(0.02, rng, 500, 3000, 0.006), at)
    return fade(normalize(out, -6), 0.0005, 0.1)


def cue_clear():
    """目標達成: 明るい「シャーン」（シンバル風の雑音）と、上がる鈴の4音。"""
    rng = np.random.default_rng(1170)
    seconds = 1.0
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros(n)
    shimmer = rng.standard_normal(n) * np.exp(-t / 0.28) * (1 - np.exp(-t / 0.003))
    out += 0.3 * biquad(biquad(shimmer, "hp", 5200), "lp", 13000)
    for k, f in enumerate((1047, 1319, 1568, 2093)):
        bell = modes(0.7, [(f, 0.28, 1.0), (f * 2.01, 0.12, 0.3), (f * 3.0, 0.07, 0.12)])
        bell *= 1 - np.exp(-np.arange(len(bell)) / SR / 0.002)
        place(out, 0.3 * bell, 0.06 * k)
    place(out, 0.4 * thump(0.3, 180, 90, 0.07), 0)
    return fade(normalize(out, -7), 0.0005, 0.12)


def write(name, x):
    OUT.mkdir(parents=True, exist_ok=True)
    data = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    path = OUT / f"{name}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"{name}.wav  {len(x) / SR:.2f}s  peak {20 * math.log10(np.max(np.abs(x))):.1f} dBFS")
    return path


def main():
    sounds = {"throw": throw(), "hit_1": hit(1), "hit_2": hit(2), "hit_3": hit(3), "killshot": killshot(), "bounce": bounce(),
              "drop": drop(), "stop": stop(), "call": call(), "cue_drum": cue_drum(), "cue_clear": cue_clear()}
    ledger = []
    for name, x in sounds.items():
        path = write(name, x)
        source = ("自作（numpy で合成）＋録音の芯 axe_thunk_0" + name[-1] + "（craigsmith・CC0）") if name.startswith("hit") or name == "killshot" else "自作（numpy で合成）"
        if name == "killshot":
            source = "自作（numpy で合成）＋録音の芯 axe_thunk_01（craigsmith・CC0）"
        ledger.append({"file": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "source": source})
    (Path(__file__).resolve().parent / "game_files.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
