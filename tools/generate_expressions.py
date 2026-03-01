#!/usr/bin/env python3
"""
表情差分生成スクリプト v2

Gemini gemini-2.0-flash-preview-image-generation を使ってキャラクタースプライトの
表情差分を生成する。

【既存スプライトから表情差分を生成】
  python3 tools/generate_expressions.py --char tsumugi
  python3 tools/generate_expressions.py --char sumi --expressions sad surprise
  python3 tools/generate_expressions.py --all

【新規キャラクターをテキストから生成（参照画像なし）】
  python3 tools/generate_expressions.py --new-char minto --expressions normal smile sad
  python3 tools/generate_expressions.py --new-char minto_work --expressions normal smile wink
  python3 tools/generate_expressions.py --new-chars   # 全新規キャラ一括生成

  --force: 既存ファイルを上書き

環境変数:
  GEMINI_API_KEY  Google AI Studio の API キー（必須）
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SPRITES = ASSETS / "sprites" / "characters"

MODEL = "gemini-2.0-flash-preview-image-generation"

# ──────────────────────────────────────────────────────────────────────────────
# 参照画像（既存スプライト）
# --all / --char で使用。既存 normal 画像を差分のベースにする。
# ──────────────────────────────────────────────────────────────────────────────
REFERENCE_IMAGES: dict[str, Path] = {
    "hajime":  ASSETS / "hazime.png",
    "sumi":    ASSETS / "sumi.png",
    "tsumugi": SPRITES / "tumugi.png",
    "naru":    SPRITES / "chr_naru_normal.png",
    "adam":    SPRITES / "chr_adam_normal.png",
    "pakki":   SPRITES / "chr_packii_normal.png",
}

# ──────────────────────────────────────────────────────────────────────────────
# キャラ別・追加生成する表情リスト
# ──────────────────────────────────────────────────────────────────────────────
# キャラ別デフォルト表情（--char / --all 実行時に生成される表情）
CHAR_DEFAULT_EXPRESSIONS: dict[str, list[str]] = {
    "hajime":  ["smile", "surprise", "sad", "serious"],
    "sumi":    ["sad", "surprise"],            # 既存: normal, serious, smile, thinking
    "naru":    ["serious", "surprise", "smug"],# 既存: fired_up, normal, sad, smile
    "adam":    ["smile", "surprise", "sad"],   # 既存: intense, normal, silent
    "tsumugi": ["smile", "surprise", "sad", "serious"],
    "pakki":   ["smile", "excited"],           # 既存: angry, normal, smoke
}

# --expressions で上書きしない場合のフォールバック
_DEFAULT_EXPRS = ["smile", "surprise", "sad", "serious"]

# ──────────────────────────────────────────────────────────────────────────────
# 参照画像ありの表情プロンプト
# ──────────────────────────────────────────────────────────────────────────────
#
# ★ 設計方針: プロンプトは短く・ポジティブに。
#   長い「DO NOT CHANGE」リストは逆効果（モデルが迷走して再生成してしまう）。
#   "Edit this image: change only X" という2文構造が最も忠実に動く。
#
# ─ 共通フレーム（全キャラ共通・2文） ──────────────────────────────────────────
# 顔切り抜き方式用フレーム（顔クロップ画像を送る前提のプロンプト）
_EDIT_FRAME = (
    "This is an anime character's face in pixel art style. "
    "Change only the facial expression as described below. "
    "Keep the hair, skin tone, eye color, face shape, and pixel art style exactly the same.\n"
)

# ─ 共通表情記述（キャラ個別指定がない場合のフォールバック）─────────────────
_EXPR_DESCS: dict[str, str] = {
    "smile":    "Facial expression: soft anime smile. Mouth corners gently upturned, eyes slightly warmer and relaxed.",
    "surprise": "Facial expression: surprised. Eyes wide open, eyebrows raised high, mouth slightly open.",
    "sad":      "Facial expression: quietly sad. Eyes downcast, inner brows slightly raised, mouth flat or barely downturned.",
    "serious":  "Facial expression: serious and focused. Eyebrows level, eyes sharp and direct, mouth closed.",
    "smug":     "Facial expression: smug. One eyebrow raised, lopsided half-smirk, eyes half-lidded with confidence.",
    "excited":  "Facial expression: excited. Eyes wide and bright, eyebrows raised, mouth open in a big enthusiastic smile.",
}

EXPRESSION_PROMPTS: dict[str, str] = {
    expr: _EDIT_FRAME + desc for expr, desc in _EXPR_DESCS.items()
}

# ─ キャラ別・表情記述（キャラの性格に合った細かいニュアンス）─────────────────
# _EDIT_FRAME は共通なので、ここでは表情の1文だけ書く。

_TSUMUGI_EXPR_DESCS: dict[str, str] = {
    # 控えめで内向きな性格 → 表情は全体的に抑えめ・繊細
    "smile":    "Facial expression: quiet, shy smile. Mouth corners very gently upturned, closed mouth. Eyes soften slightly. Understated — not a big grin.",
    "surprise": "Facial expression: mild surprise. Eyes open just a bit wider, eyebrows barely raised, mouth parts slightly.",
    "sad":      "Facial expression: inward sadness. Eyes downcast with heavy lids, inner brows slightly raised. Mouth still and flat. She hides her feelings.",
    "serious":  "Facial expression: focused and pensive. Slight brow furrow, calm analytical gaze, lips pressed lightly together.",
}
_TSUMUGI_PROMPTS = {expr: _EDIT_FRAME + desc for expr, desc in _TSUMUGI_EXPR_DESCS.items()}

_SUMI_EXPR_DESCS: dict[str, str] = {
    # 46歳の師匠 → 感情の振れ幅は小さく、落ち着いた表情
    "sad":      "Facial expression: quiet, heavy-hearted sadness. A veteran's sorrow — subdued, not dramatic. Brows slightly furrowed inward, eyes half-closed and downward, mouth corners barely drop.",
    "surprise": "Facial expression: mild surprise on a composed face. Eyes open slightly wider, eyebrows raise just a bit, mouth barely parts.",
}
_SUMI_PROMPTS = {expr: _EDIT_FRAME + desc for expr, desc in _SUMI_EXPR_DESCS.items()}

_NARU_EXPR_DESCS: dict[str, str] = {
    # 23歳・ライバル → 表情豊か、感情が顔に出やすい
    "serious":  "Facial expression: serious and steely. Level brows with slight intensity, sharp direct gaze, mouth closed and firm.",
    "surprise": "Facial expression: genuine shock. Eyes wide and stunned, eyebrows raised high, mouth open.",
    "smug":     "Facial expression: smug and arrogant — someone who thinks he's the best. One eyebrow raised, lopsided smirk, eyes half-lidded.",
}
_NARU_PROMPTS = {expr: _EDIT_FRAME + desc for expr, desc in _NARU_EXPR_DESCS.items()}

_ADAM_EXPR_DESCS: dict[str, str] = {
    # 28歳・職人・完璧主義 → 普段は無表情気味、感情が出ると少し大げさ
    "smile":    "Facial expression: rare, genuine smile on a usually stoic face. Soft closed-mouth smile, eyes slightly warmed.",
    "surprise": "Facial expression: surprised expression on a stoic face. Eyes wide, eyebrows raised, mouth slightly open.",
    "sad":      "Facial expression: dejected, self-critical sadness. Brows pulled slightly inward and down, eyes downcast, mouth corners drop.",
}
_ADAM_PROMPTS = {expr: _EDIT_FRAME + desc for expr, desc in _ADAM_EXPR_DESCS.items()}

_PAKKI_EXPR_DESCS: dict[str, str] = {
    # 大会MC・マスコット → 常にオーバーリアクション
    "smile":    "Facial expression: big friendly MC smile. Wide grin, eyes curved up happily.",
    "excited":  "Facial expression: maximum excitement. Eyes wide and sparkling, eyebrows sky-high, mouth wide open in a shout of joy.",
}
_PAKKI_PROMPTS = {expr: _EDIT_FRAME + desc for expr, desc in _PAKKI_EXPR_DESCS.items()}

# ── キャラ別プロンプト辞書 ────────────────────────────────────────────────────
CHAR_PROMPTS: dict[str, dict[str, str]] = {
    "tsumugi": _TSUMUGI_PROMPTS,
    "sumi":    _SUMI_PROMPTS,
    "naru":    _NARU_PROMPTS,
    "adam":    _ADAM_PROMPTS,
    "pakki":   _PAKKI_PROMPTS,
}


def get_expr_prompt(char_id: str, expression: str) -> str:
    """キャラ別プロンプト → 未定義なら共通プロンプトにフォールバック。"""
    return CHAR_PROMPTS.get(char_id, {}).get(expression) or EXPRESSION_PROMPTS.get(expression, "")


# ──────────────────────────────────────────────────────────────────────────────
# 新規キャラクター（テキストから生成）
# --new-char / --new-chars で使用。
# ──────────────────────────────────────────────────────────────────────────────

# ── 共通スタイル（新規キャラクター生成用）────────────────────────────────────
# つむぎのスプライトに合わせた等身・スタイルを指定する。
_NEW_STYLE = (
    "Retro pixel-art anime visual novel full-body character sprite. "
    "The character stands in a natural upright pose against a SOLID BRIGHT GREEN (#00FF00) chroma-key background. "
    "Art style: chunky clean outlines, limited color palette (approx 8–16 colors), "
    "retro Japanese RPG / visual novel style similar to games like Doki Doki Literature Club or old-school Ren'Py VNs. "
    "Body proportions: approx 5 to 6 head heights tall — slightly stylized anime proportions "
    "(not super-deformed chibi, but not fully realistic either). "
    "Full body visible from head to feet. "
    "IMPORTANT: Background must be solid flat bright green only — no gradients, no shadows, "
    "no floor lines, no environment. "
    "The character should face forward (or very slightly 3/4 angle) and look at the viewer."
)

# ── 各新規キャラのテキスト生成プロンプト ─────────────────────────────────────
# キー: char_id  → 表情名 → 完全プロンプト文字列
TEXT_CHAR_PROMPTS: dict[str, dict[str, str]] = {

    # ── みんと（素・カジュアル姿）────────────────────────────────────────────
    # 29歳（自称20歳）156cm, 黒髪ストレートロング, ベージュニット, タイトスカート
    "minto": {
        "normal": (
            f"{_NEW_STYLE} "
            "Character design: a young Japanese woman, 156cm, appears to be in her mid-to-late 20s "
            "(though she claims to be 20). "
            "Appearance: long straight black hair reaching her lower back, side-swept or center-parted. "
            "Wearing a loose, oversized beige chunky knit sweater. "
            "A subdued-colored (dark grey or muted navy) tight midi skirt. "
            "A simple small shoulder bag hanging at her side. "
            "Expression: a slightly tired, world-weary but gentle smile — the smile of someone who "
            "has seen a lot but still finds quiet contentment. Calm and mature for her claimed age."
        ),
        "smile": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto normal' — "
            "long straight black hair, loose beige knit sweater, subdued tight midi skirt, small shoulder bag, 156cm. "
            "Expression: a soft, genuine warm smile — rare sincerity breaking through her usual composure. "
            "Eyes slightly curved up, relaxed brows. "
            "Target emotion: 嬉しい (genuinely pleased, sincere warmth)."
        ),
        "sad": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto normal' — "
            "long straight black hair, loose beige knit sweater, subdued tight midi skirt, small shoulder bag, 156cm. "
            "Expression: a quiet, suppressed sadness — the face of someone who never lets others see her struggle. "
            "Eyes slightly downcast, brows barely furrowed. Mouth closed with a forced neutral expression. "
            "Target emotion: 悲しみ (quietly sad, holding it together, inner loneliness)."
        ),
        "serious": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto normal' — "
            "long straight black hair, loose beige knit sweater, subdued tight midi skirt, small shoulder bag, 156cm. "
            "Expression: a sharp, calculating serious look — a woman who has learned to read people expertly. "
            "Brows level and slightly furrowed. Eyes sharp and direct. Mouth closed, composed. "
            "Target emotion: 真剣 (sharp focus, reading the room, strategic)."
        ),
    },

    # ── みんと（コンカフェ「ぺぱーみんと」衣装）─────────────────────────────
    # 黒×ネオングリーン, 悪魔コスチューム, 小悪魔キャラ
    "minto_work": {
        "normal": (
            f"{_NEW_STYLE} "
            "Character design: a young Japanese woman, 156cm, in a cosplay-style concafe costume. "
            "Appearance: long straight black hair with small cute devil horns (black with neon green detail) "
            "on top of the head. A short, form-fitting off-shoulder dress in black and neon green "
            "(electric lime green), with bat-wing accessories on the back or as hair clips. "
            "A black choker with a green bow or gem. Black fishnet or opaque tights. "
            "Dark ankle boots or Mary Jane shoes. "
            "Expression: a playful, confident 'small devil' look — a practiced professional 'cute' expression "
            "with one eye slightly narrowed in a knowing look. "
            "The overall vibe is: idol-perfect, mischievous, cute-aggressive."
        ),
        "smile": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto_work normal' — "
            "devil-horn headband, black×neon-green off-shoulder dress, bat wings, black choker, 156cm. "
            "Expression: a bright, sparkling idol smile — wide eyes, big grin, full 'on stage' energy. "
            "Target emotion: 笑顔 (full idol smile, dazzling performer energy)."
        ),
        "wink": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto_work normal' — "
            "devil-horn headband, black×neon-green off-shoulder dress, bat wings, black choker, 156cm. "
            "Expression: a flirtatious wink — one eye closed, the other bright and sparkling. "
            "A playful smirk with a small fang (yaeba tooth) visible. "
            "Target emotion: ウインク (mischievous wink, small-devil flirt)."
        ),
        "serious": (
            f"{_NEW_STYLE} "
            "Character design: same as 'minto_work normal' — "
            "devil-horn headband, black×neon-green off-shoulder dress, bat wings, black choker, 156cm. "
            "Expression: a cold, calculating look that breaks through the idol facade — "
            "the real sharp eyes underneath the performance. Brows level, eyes narrowed slightly, "
            "mouth closed in a flat line. "
            "Target emotion: 本気 (the mask slips, showing real intent)."
        ),
    },

    # ── 南雲 修二 ─────────────────────────────────────────────────────────────
    # 45歳, 178cm, 大会審査員長, C.STATIONチェーン会長
    "nagumo": {
        "normal": (
            f"{_NEW_STYLE} "
            "Character design: a Japanese man, 45 years old, 178cm. "
            "Distinguished, authoritative appearance of a successful businessman and shisha connoisseur. "
            "Short well-groomed dark hair with some grey at the temples. "
            "Clean-shaven. Strong, composed face with slightly sharp features — a man who commands respect. "
            "Wearing a fitted dark suit jacket (charcoal or navy) with a crisp white dress shirt, "
            "no tie or a loosely worn tie. "
            "Posture: upright, arms slightly crossed or hands in jacket pockets — "
            "confident but not aggressive. "
            "Expression: neutral, composed, evaluating — the face of a man who is always assessing."
        ),
        "serious": (
            f"{_NEW_STYLE} "
            "Character design: same as 'nagumo normal' — "
            "dark suited Japanese man, 45yo, short greying-temple hair, composed features. "
            "Expression: a stern, intensely focused judging expression — "
            "this is his evaluation mode at the tournament. "
            "Eyebrows slightly lowered and furrowed, eyes sharp and piercing. "
            "Mouth closed, jaw set. Radiates authority and high standards. "
            "Target emotion: 審査 (stern judge mode, high-standard evaluation, no mercy)."
        ),
        "smile": (
            f"{_NEW_STYLE} "
            "Character design: same as 'nagumo normal' — "
            "dark suited Japanese man, 45yo, short greying-temple hair. "
            "Expression: a rare, restrained smile — a man who doesn't smile easily, "
            "but when he does, it carries weight. "
            "Slight upward curve of the mouth, warm but controlled. Eyes soften a little. "
            "Target emotion: 承認 (rare approval, restrained but genuine satisfaction)."
        ),
    },

    # ── 前園 壮一郎 ──────────────────────────────────────────────────────────
    # 39歳, 大会審査員, 口癖「シーシャはおいしいねえ」
    "maezono": {
        "normal": (
            f"{_NEW_STYLE} "
            "Character design: a Japanese man, 39 years old. "
            "Friendly, approachable appearance — a warm-hearted food and tobacco enthusiast. "
            "Slightly round, cheerful face with laugh lines. "
            "Well-kept hair, slightly casual business style. "
            "Wearing a smart casual blazer over a collarless shirt or casual button-up — "
            "relaxed but put-together. "
            "Expression: a gentle, naturally content expression — "
            "the face of someone who finds joy in simple pleasures like 'mmm, shisha is delicious'. "
            "Relaxed brows, warm eyes, slight comfortable smile at rest."
        ),
        "smile": (
            f"{_NEW_STYLE} "
            "Character design: same as 'maezono normal' — "
            "friendly round-faced Japanese man, 39yo, casual blazer outfit. "
            "Expression: a big, genuine, thoroughly satisfied smile — "
            "the face he makes right after a truly delicious shisha. "
            "Wide warm smile, eyes crinkled with delight, eyebrows raised happily. "
            "Target emotion: 美味しい (deeply satisfied, genuine food-lover joy, 「シーシャはおいしいねえ」)."
        ),
    },
}

# ── 新規キャラ: デフォルト生成表情 ──────────────────────────────────────────
NEW_CHAR_DEFAULT_EXPRESSIONS: dict[str, list[str]] = {
    "minto":      ["normal", "smile", "sad", "serious"],
    "minto_work": ["normal", "smile", "wink"],
    "nagumo":     ["normal", "serious", "smile"],
    "maezono":    ["normal", "smile"],
}


# ──────────────────────────────────────────────────────────────────────────────
# 顔切り抜き領域（画像全体に対する比率 0.0〜1.0）
# ──────────────────────────────────────────────────────────────────────────────
# full-body VN スプライト（立ち絵）の場合、頭部は画像上部 ~30% 以内。
# キャラごとに微調整可。--face-region で実行時上書きも可能。
CHAR_FACE_REGIONS: dict[str, dict[str, float]] = {
    "tsumugi": {"top": 0.02, "bottom": 0.32, "left": 0.18, "right": 0.82},
    "hajime":  {"top": 0.02, "bottom": 0.30, "left": 0.18, "right": 0.82},
    "sumi":    {"top": 0.02, "bottom": 0.30, "left": 0.18, "right": 0.82},
    "naru":    {"top": 0.02, "bottom": 0.30, "left": 0.18, "right": 0.82},
    "adam":    {"top": 0.02, "bottom": 0.30, "left": 0.18, "right": 0.82},
    "pakki":   {"top": 0.02, "bottom": 0.32, "left": 0.15, "right": 0.85},
}
_DEFAULT_FACE_REGION: dict[str, float] = {
    "top": 0.02, "bottom": 0.30, "left": 0.18, "right": 0.82,
}


# ──────────────────────────────────────────────────────────────────────────────
# 生成処理
# ──────────────────────────────────────────────────────────────────────────────

def _out_display(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def generate_expression_from_image(
    client,
    char_id: str,
    expression: str,
    ref_path: Path,
    force: bool = False,
    output_dir: Path = SPRITES,
    no_crop: bool = False,
    face_region: dict[str, float] | None = None,
) -> bool | None:
    """参照画像から表情差分を生成。None = スキップ, True = 成功, False = 失敗。

    デフォルト（no_crop=False）では「顔切り抜き→編集→元画像に貼り戻し」を行う。
    Pillow 未インストールまたは --no-crop 時はフルサイズ画像をそのまま送信。
    """
    from google.genai import types
    import io

    out_path = output_dir / f"chr_{char_id}_{expression}.png"
    if out_path.exists() and not force:
        print(f"  skip  {_out_display(out_path)}  (already exists, use --force to overwrite)")
        return None

    prompt = get_expr_prompt(char_id, expression)
    if not prompt:
        print(f"  skip  {char_id}/{expression}  (no prompt defined)")
        return None

    # Pillow が使えるかチェック
    use_crop = False
    if not no_crop:
        try:
            from PIL import Image as _PILImage  # noqa: F401
            use_crop = True
        except ImportError:
            print("    INFO: Pillow 未インストール → フルサイズ送信にフォールバック")
            print("          pip install Pillow で顔切り抜き方式が有効になります")

    print(
        f"  generating  {char_id} / {expression}"
        f"  [{'face-crop' if use_crop else 'full-image'}] ...",
        flush=True,
    )

    if use_crop:
        from PIL import Image as PILImage

        ref_img = PILImage.open(ref_path).convert("RGBA")
        w, h = ref_img.size

        reg = face_region or CHAR_FACE_REGIONS.get(char_id, _DEFAULT_FACE_REGION)
        box = (
            int(w * reg["left"]),
            int(h * reg["top"]),
            int(w * reg["right"]),
            int(h * reg["bottom"]),
        )

        face_crop = ref_img.crop(box)
        buf = io.BytesIO()
        face_crop.save(buf, format="PNG")
        send_bytes = buf.getvalue()
    else:
        ref_img = None
        box = None
        send_bytes = ref_path.read_bytes()

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=send_bytes, mime_type="image/png"),
            prompt,
        ],
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )

    # 編集済み画像を取得
    edited_bytes: bytes | None = None
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            edited_bytes = part.inline_data.data
            break

    if not edited_bytes:
        print(f"    WARN: no image in response for {char_id}/{expression}", file=sys.stderr)
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)

    if use_crop and ref_img is not None and box is not None:
        from PIL import Image as PILImage

        # 編集顔を元のサイズにリサイズして貼り戻す
        edited_face = PILImage.open(io.BytesIO(edited_bytes)).convert("RGBA")
        crop_w = box[2] - box[0]
        crop_h = box[3] - box[1]
        edited_face = edited_face.resize((crop_w, crop_h), PILImage.LANCZOS)

        result = ref_img.copy()
        result.paste(edited_face, (box[0], box[1]))
        result.convert("RGB").save(out_path)
    else:
        out_path.write_bytes(edited_bytes)

    print(f"    saved → {_out_display(out_path)}")
    return True


def generate_from_text(
    client,
    char_id: str,
    expression: str,
    force: bool = False,
    output_dir: Path = SPRITES,
) -> bool | None:
    """テキストプロンプトのみで新規キャラクターを生成。"""
    from google.genai import types

    out_path = output_dir / f"chr_{char_id}_{expression}.png"
    if out_path.exists() and not force:
        print(f"  skip  {_out_display(out_path)}  (already exists, use --force to overwrite)")
        return None

    prompt = TEXT_CHAR_PROMPTS.get(char_id, {}).get(expression)
    if not prompt:
        print(f"  skip  {char_id}/{expression}  (no text prompt defined)")
        return None

    print(f"  generating (text→image)  {char_id} / {expression} ...", flush=True)

    response = client.models.generate_content(
        model=MODEL,
        contents=[prompt],
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(part.inline_data.data)
            print(f"    saved → {_out_display(out_path)}")
            return True

    print(f"    WARN: no image in response for {char_id}/{expression}", file=sys.stderr)
    return False


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini で表情差分を生成")

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--all",       action="store_true",
                      help="既存参照画像を持つ全キャラの表情差分を生成")
    mode.add_argument("--char",      choices=sorted(REFERENCE_IMAGES),
                      help="既存参照画像を持つ特定キャラの表情差分を生成")
    mode.add_argument("--new-chars", action="store_true",
                      help="全新規キャラ（参照画像なし）をテキストから生成")
    mode.add_argument("--new-char",  choices=sorted(TEXT_CHAR_PROMPTS),
                      help="特定新規キャラをテキストから生成")

    parser.add_argument(
        "--expressions", nargs="+", metavar="EXPR",
        help="生成する表情を指定 (例: smile sad serious)。省略するとキャラ別デフォルト表情。",
    )
    parser.add_argument("--force", action="store_true", help="既存ファイルを上書き")
    parser.add_argument(
        "--output-dir", metavar="DIR",
        help="出力先ディレクトリを変更 (例: ~/Desktop/tumugi)。省略時は assets/sprites/characters/",
    )
    parser.add_argument(
        "--no-crop", action="store_true",
        help="顔切り抜き方式を無効化してフルサイズ画像を送信（デバッグ比較用）",
    )
    parser.add_argument(
        "--face-region", metavar="TOP,BOTTOM,LEFT,RIGHT",
        help="顔領域を比率で手動指定 (例: 0.02,0.32,0.18,0.82)。--char 単体指定時のみ有効",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("ERROR: 環境変数 GEMINI_API_KEY が設定されていません。")

    try:
        from google import genai
    except ImportError:
        sys.exit("ERROR: google-genai が未インストールです。\n  pip install google-genai")

    client = genai.Client(api_key=api_key)

    # 出力先ディレクトリ
    output_dir = Path(args.output_dir).expanduser() if args.output_dir else SPRITES
    output_dir.mkdir(parents=True, exist_ok=True)

    # --face-region パース
    custom_face_region: dict[str, float] | None = None
    if args.face_region:
        try:
            t, b, l, r = (float(x) for x in args.face_region.split(","))
            custom_face_region = {"top": t, "bottom": b, "left": l, "right": r}
        except ValueError:
            sys.exit("ERROR: --face-region の形式が正しくありません。例: 0.02,0.32,0.18,0.82")

    ok = skip = fail = 0

    # ── 既存参照画像から差分生成 ──────────────────────────────────────────────
    if args.all or args.char:
        targets = list(REFERENCE_IMAGES) if args.all else [args.char]

        for char_id in targets:
            ref_path = REFERENCE_IMAGES[char_id]
            if not ref_path.exists():
                print(f"\n[{char_id}] 参照画像が見つかりません: {_out_display(ref_path)}")
                fail += 1
                continue

            exprs = args.expressions or CHAR_DEFAULT_EXPRESSIONS.get(char_id, _DEFAULT_EXPRS)
            print(f"\n[{char_id}]  ref: {_out_display(ref_path)}")

            for expr in exprs:
                result = generate_expression_from_image(
                    client, char_id, expr, ref_path, args.force, output_dir,
                    no_crop=args.no_crop,
                    face_region=custom_face_region,
                )
                if result is True:
                    ok += 1
                elif result is None:
                    skip += 1
                else:
                    fail += 1

    # ── テキストから新規生成 ──────────────────────────────────────────────────
    elif args.new_chars or args.new_char:
        targets = list(TEXT_CHAR_PROMPTS) if args.new_chars else [args.new_char]

        for char_id in targets:
            exprs = args.expressions or NEW_CHAR_DEFAULT_EXPRESSIONS.get(char_id, ["normal"])
            print(f"\n[{char_id}]  (text → image)")

            for expr in exprs:
                result = generate_from_text(client, char_id, expr, args.force, output_dir)
                if result is True:
                    ok += 1
                elif result is None:
                    skip += 1
                else:
                    fail += 1

    print(f"\n完了: 生成={ok}  スキップ={skip}  失敗={fail}")


if __name__ == "__main__":
    main()
