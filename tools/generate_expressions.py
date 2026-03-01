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

# ── 重要: 見た目保持のための共通制約 ──────────────────────────────────────────
# 「参照画像に準拠しない」問題を防ぐため、変更禁止の指示を最大限強化している。
_PRESERVE_CONSTRAINT = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "You MUST preserve every part of the reference image EXACTLY as-is — "
    "hair color, hair style, outfit, accessories, pose, body shape, background color, "
    "pixel art style, line thickness, and color palette must all remain 100% identical. "
    "ABSOLUTELY DO NOT alter the character's clothing, hairstyle, body proportions, "
    "background, or art style in any way. "
    "The ONLY permitted change is the facial expression: "
    "modify ONLY the eyes (shape and gaze direction), eyebrows (angle and height), "
    "and mouth (shape and openness). "
    "Do NOT redraw or reinterpret the image — treat this as a surgical face edit."
)

# ── 共通表情プロンプト（キャラ個別定義がない場合のフォールバック）────────────
EXPRESSION_PROMPTS: dict[str, str] = {
    "smile": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to a warm, genuine anime smile. "
        "Corners of the mouth gently upturned in a soft, closed or slightly open friendly smile. "
        "Eyes slightly narrowed or brightened with warmth. Eyebrows relaxed and slightly raised. "
        "Target emotion: 嬉しい (happy, pleased)."
    ),
    "surprise": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to a surprised anime expression. "
        "Eyes wide open, irises fully visible, eyebrows raised high. "
        "Mouth slightly open — a small 'O' shape or parted lips. "
        "Target emotion: 驚き (surprised, caught off guard)."
    ),
    "sad": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to a sad, dejected anime expression. "
        "Inner eyebrow corners slightly raised (worried arch). "
        "Eyes drooping downward with heavy lids. Mouth flat or slightly downturned. "
        "No tears needed — just quiet, subdued sadness. "
        "Target emotion: 悲しみ (sad, downcast)."
    ),
    "serious": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to a serious, focused anime expression. "
        "Eyebrows level or very slightly furrowed — concentration, not anger. "
        "Eyes looking forward with calm, sharp intensity. Mouth closed, lips pressed together. "
        "Target emotion: 真剣 (serious, focused, determined)."
    ),
    "smug": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to a smug, self-satisfied anime expression. "
        "One eyebrow slightly raised. A lopsided half-smile, corners pulled up on one side. "
        "Eyes half-lidded with a confident, slightly condescending look. "
        "Target emotion: ドヤ顔 (smug, self-confident, showing off)."
    ),
    "excited": (
        f"{_PRESERVE_CONSTRAINT} "
        "Change ONLY the facial expression to an excited, energetic anime expression. "
        "Eyes wide and sparkling. Eyebrows raised high. Mouth open in a big enthusiastic smile "
        "or open-mouthed shout of excitement. "
        "Target emotion: 興奮 (excited, hyped, overjoyed)."
    ),
}

# ── つむぎ専用プロンプト ──────────────────────────────────────────────────────
# 見た目: 茶色のボブヘア・前髪 / 濃紺フーディー / 腕を組んでタブレットを抱えたポーズ
#          黒のひざ上ソックス / 暗い色のプリーツスカート / 控えめで内向きな気質
_TSUMUGI_PRESERVE = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "This is a retro pixel-art anime visual novel sprite. "
    "You MUST preserve ALL of the following EXACTLY as shown in the reference image: "
    "her brown bob haircut with blunt straight-cut bangs, "
    "her dark navy blue hoodie/sweatshirt, "
    "her crossed arms with the tablet or device held against her chest, "
    "her dark pleated skirt, her black knee-high socks, her dark shoes, "
    "the solid bright green chroma-key background, "
    "the chunky pixel art outlines, and the limited color palette. "
    "ABSOLUTELY DO NOT redraw or change ANY of these elements. "
    "Modify ONLY the face: eyes, eyebrows, and mouth. Nothing else."
)

_TSUMUGI_PROMPTS: dict[str, str] = {
    "smile": (
        f"{_TSUMUGI_PRESERVE} "
        "Change ONLY the face to a quiet, reserved smile — a shy girl genuinely pleased. "
        "Corners of the mouth gently upturned, soft closed-mouth smile. "
        "Eyes soften slightly, lids lowering just a little — relaxed and warm. "
        "Understated, not a beaming grin. Target emotion: 嬉しい (quietly happy, warmly pleased)."
    ),
    "surprise": (
        f"{_TSUMUGI_PRESERVE} "
        "Change ONLY the face to a mildly surprised expression — not dramatic, but visibly caught off guard. "
        "Eyes open wider than normal, irises fully visible. Eyebrows raised slightly. "
        "Mouth parts just a little — a small gap. "
        "Target emotion: 驚き (quietly startled, momentarily surprised)."
    ),
    "sad": (
        f"{_TSUMUGI_PRESERVE} "
        "Change ONLY the face to a quietly sad, inwardly pained expression. "
        "Inner eyebrow corners lift very slightly inward (subtle worried arch). "
        "Eyes lower, lids drooping with a heavy, tired quality. "
        "Mouth flat and still — she internalizes feelings, doesn't show much. No tears. "
        "Target emotion: 悲しみ (sad, emotionally withdrawn, quietly hurt)."
    ),
    "serious": (
        f"{_TSUMUGI_PRESERVE} "
        "Change ONLY the face to a focused, pensive expression — thinking carefully. "
        "Eyebrows level and very slightly drawn together — concentration without anger. "
        "Eyes look forward with calm, analytical gaze — sharp but not cold. "
        "Mouth closed, lips pressed lightly together in a neutral, composed line. "
        "Target emotion: 真剣 (serious, focused, deep in thought)."
    ),
}

# ── スミさん専用プロンプト ────────────────────────────────────────────────────
# キャラ: 46歳, 182cm, tonari 店長・師匠。飄々とした物腰、元名プレイヤー。
_SUMI_PRESERVE = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "This is a retro pixel-art anime visual novel sprite of a middle-aged Japanese man "
    "(the shisha shop master, Sumi-san, aged 46). "
    "You MUST preserve ALL of the following EXACTLY: "
    "his hair style and color, his outfit and accessories, his pose, "
    "the solid bright green chroma-key background, and the pixel art style. "
    "ABSOLUTELY DO NOT change any of these. "
    "Modify ONLY the face: eyes, eyebrows, and mouth. Nothing else."
)

_SUMI_PROMPTS: dict[str, str] = {
    "sad": (
        f"{_SUMI_PRESERVE} "
        "Change ONLY the face to a quietly sorrowful, heavy-hearted expression. "
        "The sadness of a seasoned man who has seen much — subdued, not dramatic. "
        "Eyebrows slightly furrowed inward at the center. Eyes half-closed, gaze downward. "
        "Mouth closed, corners barely dropping. "
        "Target emotion: 悲しみ (quiet grief, weary sadness, a veteran's sorrow)."
    ),
    "surprise": (
        f"{_SUMI_PRESERVE} "
        "Change ONLY the face to a mildly surprised expression — a composed man briefly caught off guard. "
        "Eyes open slightly wider than usual, eyebrows raised just a bit. "
        "Mouth barely parts — he rarely shows surprise openly. "
        "Target emotion: 驚き (mild surprise, momentarily caught off guard)."
    ),
}

# ── なる専用プロンプト ────────────────────────────────────────────────────────
# キャラ: 鳴切亮太 23歳, 176cm, シルバーヘア, ストリート系, 当初は天才気取りのイキリ。
_NARU_PRESERVE = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "This is a retro pixel-art anime visual novel sprite of a young Japanese man "
    "(Naru, aged 23, silver/white stylized hair, street fashion with accessories). "
    "You MUST preserve ALL of the following EXACTLY: "
    "his silver or white hair style, his street-style outfit and accessories (earrings etc.), "
    "his pose, the solid bright green chroma-key background, and the pixel art style. "
    "ABSOLUTELY DO NOT change any of these. "
    "Modify ONLY the face: eyes, eyebrows, and mouth. Nothing else."
)

_NARU_PROMPTS: dict[str, str] = {
    "serious": (
        f"{_NARU_PRESERVE} "
        "Change ONLY the face to a serious, steely expression — a young rival who has matured. "
        "Eyebrows level, slightly furrowed with intensity. Eyes sharp and direct, unwavering gaze. "
        "Mouth closed and firm. "
        "Target emotion: 真剣 (focused, serious, rival-level determination)."
    ),
    "surprise": (
        f"{_NARU_PRESERVE} "
        "Change ONLY the face to a surprised, shaken expression. "
        "Eyes wide and stunned, eyebrows raised high. Mouth open in shock. "
        "Target emotion: 驚き (genuine shock, thrown off completely)."
    ),
    "smug": (
        f"{_NARU_PRESERVE} "
        "Change ONLY the face to a smug, arrogant, self-satisfied expression — "
        "the face of someone who believes he's the best. "
        "One eyebrow raised. Lopsided half-smirk. Eyes half-lidded with contempt and confidence. "
        "Target emotion: ドヤ顔 (smug, condescending, showing off)."
    ),
}

# ── アダム専用プロンプト ──────────────────────────────────────────────────────
# キャラ: 吾妻大夢 28歳, 178cm, ダブルアップル職人。完璧主義者だが私生活ポンコツ。
_ADAM_PRESERVE = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "This is a retro pixel-art anime visual novel sprite of a young Japanese man "
    "(Adam, aged 28, a craftsman dedicated to double-apple shisha). "
    "You MUST preserve ALL of the following EXACTLY: "
    "his hair style and color, his outfit, his pose, "
    "the solid bright green chroma-key background, and the pixel art style. "
    "ABSOLUTELY DO NOT change any of these. "
    "Modify ONLY the face: eyes, eyebrows, and mouth. Nothing else."
)

_ADAM_PROMPTS: dict[str, str] = {
    "smile": (
        f"{_ADAM_PRESERVE} "
        "Change ONLY the face to a rare, genuine smile — the smile of a stoic perfectionist "
        "who rarely shows warmth, but does so sincerely. "
        "Soft closed or slightly open smile. Eyes warmed, tension released from the brow. "
        "Target emotion: 嬉しい (rare, genuine, quietly pleased)."
    ),
    "surprise": (
        f"{_ADAM_PRESERVE} "
        "Change ONLY the face to a surprised expression on a usually stoic face. "
        "Eyes wide, eyebrows raised. Mouth slightly open. "
        "Target emotion: 驚き (genuinely caught off guard)."
    ),
    "sad": (
        f"{_ADAM_PRESERVE} "
        "Change ONLY the face to a dejected, self-critical expression — a perfectionist who failed. "
        "Eyebrows pulled slightly inward and downward. Eyes downcast, heavy-lidded. "
        "Mouth closed, corners dropping. "
        "Target emotion: 悲しみ (self-critical sadness, disappointment in himself)."
    ),
}

# ── パッキー専用プロンプト ────────────────────────────────────────────────────
# キャラ: 大会MC・マスコット。常にハイテンション。笑い声「ぷぷぷっ！」
_PAKKI_PRESERVE = (
    "CRITICAL CONSTRAINT — FACE EXPRESSION EDIT ONLY: "
    "This is a retro pixel-art anime visual novel sprite of a mascot-like MC character (Pakki). "
    "You MUST preserve ALL of the following EXACTLY: "
    "his hair/head style and color, his outfit and any accessories, his pose, "
    "the solid bright green chroma-key background, and the pixel art style. "
    "ABSOLUTELY DO NOT change any of these. "
    "Modify ONLY the face: eyes, eyebrows, and mouth. Nothing else."
)

_PAKKI_PROMPTS: dict[str, str] = {
    "smile": (
        f"{_PAKKI_PRESERVE} "
        "Change ONLY the face to a big friendly MC smile — warm, welcoming, crowd-pleasing. "
        "Wide open grin, eyes curved up happily. "
        "Target emotion: 笑顔 (big friendly smile, entertainer energy)."
    ),
    "excited": (
        f"{_PAKKI_PRESERVE} "
        "Change ONLY the face to an over-the-top excited expression — peak hype MC energy. "
        "Eyes wide and sparkling. Eyebrows sky-high. Mouth wide open in a shout of excitement. "
        "Target emotion: 興奮 (maximum hype, excited shout, 「ぷぷぷっ！」energy)."
    ),
}

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
# 生成処理
# ──────────────────────────────────────────────────────────────────────────────

def _save_image(response, out_path: Path, char_id: str, expression: str) -> bool:
    """レスポンスから画像を保存。成功したら True を返す。"""
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(part.inline_data.data)
            try:
                display = str(out_path.relative_to(ROOT))
            except ValueError:
                display = str(out_path)
            print(f"    saved → {display}")
            return True
    print(f"    WARN: no image in response for {char_id}/{expression}", file=sys.stderr)
    return False


def generate_expression_from_image(
    client,
    char_id: str,
    expression: str,
    ref_path: Path,
    force: bool = False,
    output_dir: Path = SPRITES,
) -> bool | None:
    """参照画像から表情差分を生成。None = スキップ, True = 成功, False = 失敗。"""
    from google.genai import types

    out_path = output_dir / f"chr_{char_id}_{expression}.png"
    if out_path.exists() and not force:
        try:
            display = str(out_path.relative_to(ROOT))
        except ValueError:
            display = str(out_path)
        print(f"  skip  {display}  (already exists, use --force to overwrite)")
        return None

    prompt = get_expr_prompt(char_id, expression)
    if not prompt:
        print(f"  skip  {char_id}/{expression}  (no prompt defined)")
        return None

    print(f"  generating  {char_id} / {expression} ...", flush=True)

    image_bytes = ref_path.read_bytes()
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            prompt,
        ],
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )
    return _save_image(response, out_path, char_id, expression)


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
        try:
            display = str(out_path.relative_to(ROOT))
        except ValueError:
            display = str(out_path)
        print(f"  skip  {display}  (already exists, use --force to overwrite)")
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
    return _save_image(response, out_path, char_id, expression)


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

    ok = skip = fail = 0

    # ── 既存参照画像から差分生成 ──────────────────────────────────────────────
    if args.all or args.char:
        targets = list(REFERENCE_IMAGES) if args.all else [args.char]

        for char_id in targets:
            ref_path = REFERENCE_IMAGES[char_id]
            try:
                ref_display = str(ref_path.relative_to(ROOT))
            except ValueError:
                ref_display = str(ref_path)
            if not ref_path.exists():
                print(f"\n[{char_id}] 参照画像が見つかりません: {ref_display}")
                fail += 1
                continue

            exprs = args.expressions or CHAR_DEFAULT_EXPRESSIONS.get(char_id, _DEFAULT_EXPRS)
            print(f"\n[{char_id}]  ref: {ref_display}")

            for expr in exprs:
                result = generate_expression_from_image(
                    client, char_id, expr, ref_path, args.force, output_dir
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
