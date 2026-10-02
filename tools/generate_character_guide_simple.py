#!/usr/bin/env python3
"""Generate the simple, readability-first character reference PDF."""

from __future__ import annotations

import html
import json
import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image

from generate_character_guide import CHARACTERS, FUTURE, PAIR, ROOT


OUT = ROOT / "output" / "pdf" / "suien-zensen-character-guide.pdf"
WORK = ROOT / "tmp" / "pdfs" / "character-guide-simple"
ART = WORK / "art"
HTML = WORK / "index.html"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
NODE = Path("/Users/hasegawaatsuki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")
NODE_MODULES = Path("/Users/hasegawaatsuki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules")


def commit_hash() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
    ).strip()


def esc(value: object) -> str:
    return html.escape(str(value)).replace("\n", "<br>")


def normalize_art(path: Path, key: str, narrow: bool = False) -> Path:
    """Crop alpha padding and place art on a common transparent canvas."""
    ART.mkdir(parents=True, exist_ok=True)
    out = ART / f"{key}.png"
    source = Image.open(path).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if bbox:
        source = source.crop(bbox)

    # The dual Minto layout has half the horizontal space of a normal profile.
    # A 600:1500 canvas matches that box closely, so transparent canvas width
    # does not make her look shorter than the shared height scale specifies.
    canvas_w, canvas_h = (600 if narrow else 1050), 1500
    max_w, max_h = (570 if narrow else 970), 1390
    scale = min(max_w / source.width, max_h / source.height)
    resized = source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    dest = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - resized.width) // 2
    y = canvas_h - resized.height - 30
    dest.alpha_composite(resized, (x, y))
    dest.save(out, optimize=True)
    return out


def pair_profiles() -> list[dict]:
    data = json.loads((ROOT / "data" / "characters.json").read_text(encoding="utf-8"))
    master = {item.get("id"): item for item in data}
    profiles: list[dict] = []
    for item in PAIR:
        src = master[item["id"]]
        if item["id"] == "maezono":
            direction = "審査員を単なる癒やし枠にしない。楽しい・おいしそうという評価軸を持ち、敗者の魅力も言語化できる業界人として描く。"
        else:
            direction = "残酷な大会形式をショーに変える存在。騒がしさの反対側にある『本当にうまい煙で沈黙する』瞬間を、最大の評価として残す。"
        profiles.append(
            {
                "id": item["id"],
                "asset_id": item.get("asset_id", item["id"]),
                "name": item["name"],
                "full": item["name"],
                "role": item["role"],
                "age": item["age"],
                "accent": item["accent"],
                "image": item["image"],
                "core": item["body"],
                "shisha": item["flavor"],
                "story": src.get("background_secret") or "制作時に追加確認。",
                "voice": item["voice"],
                "direction": direction,
                "quote": item["quote"],
            }
        )
    return profiles


PROFILES = CHARACTERS + pair_profiles()

HEIGHTS_CM = {
    "hajime": 172,
    "sumi": 182,
    "naru": 176,
    "adam": 178,
    "minto": 156,
    "tsumugi": 152,
    "rin": 170,
    "ageha": 160,
    "kumicho": 186,
    "mashiro": 154,
    "dr_kemuri": 175,
    "nagumo": 178,
    "maezono": 175,
}


def figure_height_mm(profile: dict) -> float:
    if profile["id"] == "pakki":
        return 94
    # 186cmの人物がアート枠の最大高139mmになる共通縮尺。
    return round(HEIGHTS_CM.get(profile["id"], 170) * 139 / 186, 1)


def page_footer(page_no: int) -> str:
    return f"""
      <footer class="footer">
        <span>水煙前線 -EN:CODE- / CHARACTER REFERENCE</span>
        <span>{page_no:02d}</span>
      </footer>
    """


def cover(page_no: int, commit: str) -> str:
    selected = ["hajime", "naru", "minto", "ageha"]
    arts = []
    for cid in selected:
        p = next(item for item in PROFILES if item["id"] == cid)
        img = normalize_art(ROOT / p["image"], f"cover-{cid}")
        arts.append(f'<img src="{img.as_uri()}" alt="{esc(p["name"])}">')
    return f"""
    <section class="sheet cover">
      <div class="cover-copy">
        <div class="eyebrow">CREATIVE REFERENCE / INTERNAL</div>
        <h1>水煙前線<br><span>-EN:CODE-</span></h1>
        <h2>キャラクター設定資料</h2>
        <p>共同制作者向け / 完全ネタバレ</p>
        <div class="cover-meta">Edition 1.1 / 2026-06-29<br>Canonical source: commit {commit}</div>
      </div>
      <div class="cover-art">{''.join(arts)}</div>
      {page_footer(page_no)}
    </section>
    """


def index_page(page_no: int) -> str:
    rows = []
    for p in PROFILES:
        rows.append(
            f"""
            <div class="index-row">
              <div class="index-name">{esc(p['name'])}</div>
              <div class="index-role">{esc(p['role'])}</div>
              <div class="index-age">{esc(p['age'])}</div>
            </div>
            """
        )
    return f"""
    <section class="sheet">
      <header class="doc-header">
        <div class="eyebrow">CHARACTER INDEX</div>
        <h1>収録キャラクター</h1>
      </header>
      <div class="index-grid">{''.join(rows)}</div>
      <div class="check-block">
        <h2>制作上の要確認</h2>
        <div><b>つむぎ</b> 現行マスタでは姓を保留。外部共有物で未確定の姓を使わない。</div>
        <div><b>神崎竜二</b> 現行画像はマスタ外見と一致しないため、本資料ではART HOLD。口調は荒く、敬語は使わない。</div>
      </div>
      {page_footer(page_no)}
    </section>
    """


def section(title: str, body: str, klass: str = "") -> str:
    return f"""
      <section class="info-section {klass}">
        <h2>{esc(title)}</h2>
        <div class="section-body">{esc(body)}</div>
      </section>
    """


def profile_page(p: dict, page_no: int) -> str:
    art_html: str
    caption = "立ち絵基準 / 表情差分はrepo内assetsを参照"
    if p.get("art_hold"):
        art_html = f"""
        <div class="art-hold">
          <div class="art-hold-title">ART HOLD</div>
          <div class="art-hold-sub">CURRENT ASSET MISMATCH</div>
          <p>{esc(p['art_note'])}</p>
        </div>
        """
        caption = "現行画像は設定不一致のため掲載保留"
    elif p.get("image_alt"):
        a = normalize_art(ROOT / p["image"], f"{p['id']}-main", narrow=True)
        b = normalize_art(ROOT / p["image_alt"], f"{p['id']}-alt", narrow=True)
        art_html = f"""
        <div class="dual-art">
          <figure><img src="{a.as_uri()}" alt="営業時のみんと"><figcaption>営業 / みんと</figcaption></figure>
          <figure><img src="{b.as_uri()}" alt="素の栞"><figcaption>素 / 栞</figcaption></figure>
        </div>
        """
        caption = "二つの姿は同じ人物として同じ縮尺で掲載"
    else:
        art = normalize_art(ROOT / p["image"], p["id"])
        art_html = f'<img class="single-art" src="{art.as_uri()}" alt="{esc(p["name"])}">'

    return f"""
    <section class="sheet profile" style="--accent:{esc(p['accent'])};--figure-height:{figure_height_mm(p)}mm">
      <header class="profile-header">
        <div class="profile-role">{esc(p['role'])}</div>
        <h1>{esc(p['name'])}</h1>
        <div class="profile-full">{esc(p['full'])}</div>
      </header>
      <div class="profile-content">
        <aside class="visual-column">
          <div class="art-frame">{art_html}</div>
          <div class="art-caption">{esc(caption)}</div>
        </aside>
        <main class="text-column">
          <div class="meta-row">
            <div><span>AGE</span><b>{esc(p['age'])}</b></div>
            <div><span>ID</span><b>{esc(p['id'])}</b></div>
            <div><span>ROLE</span><b>{esc(p['role'])}</b></div>
          </div>
          {section('CHARACTER CORE', p['core'], 'core')}
          <div class="section-grid">
            {section('SHISHA', p['shisha'].replace('STYLE  ', '流儀  '))}
            {section('STORY / SECRET', p['story'])}
            {section('VOICE', p['voice'])}
            {section('DIRECTION', p['direction'])}
          </div>
          <blockquote>{esc(p['quote'])}</blockquote>
        </main>
      </div>
      {page_footer(page_no)}
    </section>
    """


def future_page(page_no: int, items: list[tuple], title: str) -> str:
    cards = []
    for name, meta, style, flavor, hook in items:
        cards.append(
            f"""
            <div class="future-card">
              <h2>{esc(name)}</h2>
              <div class="future-meta">{esc(meta)}</div>
              <dl><dt>STYLE</dt><dd>{esc(style)}</dd><dt>FLAVOR</dt><dd>{esc(flavor)}</dd></dl>
              <p>{esc(hook)}</p>
            </div>
            """
        )
    return f"""
    <section class="sheet">
      <header class="doc-header">
        <div class="eyebrow">FUTURE CAST / ART PENDING</div>
        <h1>{esc(title)}</h1>
        <p>現行マスタに設定があり、主要立ち絵が未収録の人物。</p>
      </header>
      <div class="future-grid">{''.join(cards)}</div>
      {page_footer(page_no)}
    </section>
    """


def source_page(page_no: int, commit: str) -> str:
    sources = [
        ("キャラクターマスタ", "data/characters.json", "ID、年齢、所属、得意味、説明、隠し設定"),
        ("現行台詞", "data/dialogue/*.json", "一人称、間、語尾、呼び名、実際の関係性"),
        ("確定ルール", "CLAUDE.md", "主人公アーク、旧設定NG、正式名称"),
        ("詳細設定", "brand/character_profiles.md", "長い背景設定。旧案は現行マスタを優先"),
        ("立ち絵", "assets/sprites/characters/", "正規表情差分と本資料の参照画像"),
    ]
    rows = "".join(
        f'<tr><th>{esc(a)}</th><td>{esc(b)}</td><td>{esc(c)}</td></tr>'
        for a, b, c in sources
    )
    return f"""
    <section class="sheet">
      <header class="doc-header">
        <div class="eyebrow">SOURCE / CONTINUITY</div>
        <h1>参照先と確定事項</h1>
      </header>
      <table class="source-table">{rows}</table>
      <div class="fixed-list">
        <h2>現行で固定</h2>
        <ul>
          <li>なるは人格者の好敵手。旧案のイキリ・天才気取りへ戻さない。</li>
          <li>はじめの現行一人称は「俺」。薄さは夢・大会・承認の場面だけに出す。</li>
          <li>アゲハは22歳。ましろは154cmで、シガーリーフ全般が好み。</li>
          <li>前園宗次郎へ改名。南雲の好みはシガー（葉巻系）。</li>
          <li>大会名はSMOKE CROWN CUP、チェーン名はC.STATION。</li>
        </ul>
      </div>
      <div class="source-meta">Canonical repository / commit {commit} / generated 2026-06-29</div>
      {page_footer(page_no)}
    </section>
    """


CSS = r"""
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ececec; }
body {
  font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
  color: #171717;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet {
  width: 297mm;
  height: 210mm;
  padding: 12mm 14mm 13mm;
  position: relative;
  overflow: hidden;
  background: #ffffff;
  page-break-after: always;
}
.sheet:last-child { page-break-after: auto; }
.footer {
  position: absolute;
  left: 14mm;
  right: 14mm;
  bottom: 5.2mm;
  border-top: 0.25mm solid #cfcfcf;
  padding-top: 2.2mm;
  display: flex;
  justify-content: space-between;
  font-size: 7pt;
  color: #777;
  letter-spacing: .03em;
}
.eyebrow { font-size: 8pt; font-weight: 700; letter-spacing: .12em; color: #6b6b6b; }
.doc-header { height: 30mm; border-bottom: .7mm solid #1e1e1e; }
.doc-header h1 { margin: 2mm 0 0; font-size: 25pt; line-height: 1.15; }
.doc-header p { margin: 2mm 0 0; font-size: 9.5pt; color: #555; }

.cover { display: grid; grid-template-columns: 42% 58%; padding-top: 18mm; }
.cover::before { content: ""; position: absolute; left: 14mm; top: 12mm; width: 32mm; height: 1.2mm; background: #ef785f; }
.cover-copy { padding-top: 19mm; z-index: 2; }
.cover-copy h1 { margin: 8mm 0 0; font-size: 37pt; line-height: 1.15; letter-spacing: .02em; }
.cover-copy h1 span { font-size: 28pt; font-weight: 500; }
.cover-copy h2 { margin: 10mm 0 0; font-size: 18pt; font-weight: 600; }
.cover-copy p { display: inline-block; margin: 8mm 0 0; padding: 2.6mm 4mm; background: #f6e0da; color: #7a2c21; font-size: 9.5pt; font-weight: 700; }
.cover-meta { position: absolute; left: 14mm; bottom: 18mm; color: #666; font-size: 8.5pt; line-height: 1.7; }
.cover-art { display: flex; align-items: flex-end; justify-content: center; height: 174mm; overflow: hidden; border-bottom: .5mm solid #222; }
.cover-art img { width: 25%; height: 152mm; object-fit: contain; object-position: bottom center; margin-left: -4mm; }

.index-grid { margin-top: 8mm; display: grid; grid-template-columns: 1fr 1fr; column-gap: 12mm; }
.index-row { min-height: 15mm; display: grid; grid-template-columns: 34% 46% 20%; align-items: center; border-bottom: .25mm solid #d8d8d8; }
.index-name { font-size: 11pt; font-weight: 700; }
.index-role { font-size: 8.8pt; color: #444; }
.index-age { font-size: 8.8pt; color: #555; text-align: right; }
.check-block { position: absolute; left: 14mm; right: 14mm; bottom: 15mm; border: .35mm solid #d7a49b; background: #fff8f6; padding: 4mm 5mm; display: grid; grid-template-columns: 24mm 1fr 1fr; gap: 5mm; align-items: start; }
.check-block h2 { margin: 0; font-size: 9.5pt; color: #8f3024; }
.check-block div { font-size: 8.3pt; line-height: 1.55; }

.profile { --accent: #555; }
.profile::before { content: ""; position: absolute; left: 0; top: 0; width: 100%; height: 3mm; background: var(--accent); }
.profile-header { height: 29mm; border-bottom: .35mm solid #bdbdbd; padding-top: 2mm; }
.profile-role { color: var(--accent); font-size: 8.5pt; font-weight: 700; letter-spacing: .04em; }
.profile-header h1 { margin: 1.2mm 0 0; font-size: 27pt; line-height: 1.05; }
.profile-full { margin-top: 1.5mm; font-size: 10.5pt; color: #555; }
.profile-content { display: grid; grid-template-columns: 105mm 1fr; gap: 9mm; height: 157mm; padding-top: 5mm; }
.visual-column { min-width: 0; border-right: .3mm solid #dedede; padding-right: 8mm; display: flex; flex-direction: column; }
.art-frame { height: 143mm; display: flex; align-items: flex-end; justify-content: center; background: #f7f7f5; border: .25mm solid #dededb; overflow: hidden; }
.single-art { width: 95mm; height: var(--figure-height); object-fit: contain; object-position: center bottom; }
.art-caption { text-align: center; margin-top: 2.3mm; font-size: 7.5pt; color: #777; }
.dual-art { width: 100%; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
.dual-art figure { width: 50%; height: 100%; margin: 0; position: relative; display: flex; align-items: flex-end; justify-content: center; }
.dual-art figure + figure { border-left: .25mm solid #ddd; }
.dual-art img { width: 100%; height: var(--figure-height); object-fit: contain; object-position: bottom center; }
.dual-art figcaption { position: absolute; left: 0; right: 0; bottom: 2mm; text-align: center; font-size: 7.5pt; background: rgba(255,255,255,.88); padding: 1mm; }
.art-hold { width: 89mm; min-height: 126mm; border: .45mm solid #9f4a3d; padding: 12mm 8mm; align-self: center; margin-bottom: 7mm; background: #fff8f6; }
.art-hold-title { font-size: 24pt; font-weight: 700; color: #8f3024; }
.art-hold-sub { margin-top: 2mm; font-size: 8pt; letter-spacing: .08em; color: #8f3024; }
.art-hold p { margin: 12mm 0 0; font-size: 9.3pt; line-height: 1.8; }

.text-column { min-width: 0; display: flex; flex-direction: column; }
.meta-row { display: grid; grid-template-columns: 1fr 1fr 2.2fr; gap: 3mm; margin-bottom: 4mm; }
.meta-row div { border-bottom: .3mm solid #bdbdbd; padding: 0 0 2mm; min-width: 0; }
.meta-row span { display: block; font-size: 7pt; color: #777; letter-spacing: .08em; }
.meta-row b { display: block; margin-top: .8mm; font-size: 9.3pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.info-section { padding-top: 1.8mm; border-top: .55mm solid var(--accent); }
.info-section h2 { margin: 0 0 1.5mm; font-size: 8.5pt; letter-spacing: .08em; color: var(--accent); }
.section-body { font-size: 9.8pt; line-height: 1.63; }
.info-section.core { margin-bottom: 4mm; }
.info-section.core .section-body { font-size: 10.2pt; line-height: 1.68; }
.section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 6mm; }
.section-grid .info-section { min-height: 39mm; }
blockquote { margin: auto 0 0; padding: 2.8mm 4mm; border-left: 1.2mm solid var(--accent); background: #f3f3f1; font-size: 9.2pt; line-height: 1.55; }

.future-grid { margin-top: 7mm; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 7mm; }
.future-card { min-height: 38mm; padding: 4mm 4.5mm; border: .3mm solid #cfcfcf; }
.future-card h2 { margin: 0; font-size: 12pt; }
.future-meta { margin-top: 1.2mm; font-size: 8.5pt; color: #666; }
.future-card dl { margin: 3mm 0 0; display: grid; grid-template-columns: 17mm 1fr 19mm 1fr; font-size: 8.8pt; }
.future-card dt { color: #777; }
.future-card dd { margin: 0; }
.future-card p { margin: 2.5mm 0 0; font-size: 9pt; line-height: 1.5; }

.source-table { width: 100%; margin-top: 10mm; border-collapse: collapse; }
.source-table th, .source-table td { border-bottom: .3mm solid #d2d2d2; padding: 4mm 3mm; text-align: left; font-size: 9.3pt; }
.source-table th { width: 42mm; font-size: 9.8pt; }
.source-table td:nth-child(2) { width: 63mm; font-family: Menlo, monospace; font-size: 8.6pt; }
.fixed-list { margin-top: 10mm; border-left: 1.2mm solid #ef785f; padding: 3mm 5mm; background: #faf7f4; }
.fixed-list h2 { margin: 0 0 2mm; font-size: 11pt; }
.fixed-list ul { margin: 0; padding-left: 6mm; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 10mm; }
.fixed-list li { font-size: 9.2pt; line-height: 1.5; }
.source-meta { margin-top: 8mm; font-size: 8pt; color: #777; }
"""


def build_html() -> str:
    commit = commit_hash()
    pages: list[str] = []
    page_no = 1
    pages.append(cover(page_no, commit))
    page_no += 1
    pages.append(index_page(page_no))
    page_no += 1
    for profile in PROFILES:
        pages.append(profile_page(profile, page_no))
        page_no += 1
    pages.append(future_page(page_no, FUTURE[:6], '設定先行キャラクター / ライバル'))
    page_no += 1
    pages.append(future_page(page_no, FUTURE[6:], '設定先行キャラクター / 審査・拠点'))
    page_no += 1
    pages.append(source_page(page_no, commit))
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>水煙前線 -EN:CODE- キャラクター設定資料</title><style>{CSS}</style></head>
<body>{''.join(pages)}</body></html>"""


def build() -> Path:
    if not CHROME.exists():
        raise SystemExit(f"Chrome not found: {CHROME}")
    if WORK.exists():
        shutil.rmtree(WORK)
    ART.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    HTML.write_text(build_html(), encoding="utf-8")
    runner = WORK / "print-pdf.cjs"
    runner.write_text(
        """
const { chromium } = require('playwright');
(async () => {
  const [url, out, chrome] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: out,
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
})();
""",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env["NODE_PATH"] = str(NODE_MODULES)
    subprocess.run(
        [
            str(NODE if NODE.exists() else "node"),
            str(runner),
            HTML.as_uri(),
            str(OUT),
            str(CHROME),
        ],
        cwd=ROOT,
        check=True,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return OUT


if __name__ == "__main__":
    print(build())
