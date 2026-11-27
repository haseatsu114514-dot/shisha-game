# 合成元: assets/sprites/characters/ageha/chr_ageha_surprise.png と assets/backgrounds/bg_ageha_shop.png（MELTY PUFF）
from PIL import Image, ImageFilter, ImageEnhance
import os
repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
here = os.path.dirname(os.path.abspath(__file__))
W, H = 520, 508  # 2x of 260x254 CSS px
sprite = Image.open(f"{repo}/assets/sprites/characters/ageha/chr_ageha_surprise.png").convert("RGBA")
bg = Image.open(f"{repo}/assets/backgrounds/bg_ageha_shop.png").convert("RGB")
# background: heart-wall area of MELTY PUFF, blurred like a shallow depth-of-field photo
region = bg.crop((120, 40, 620, 528)).resize((W, H), Image.LANCZOS)
region = region.filter(ImageFilter.GaussianBlur(9))
region = ImageEnhance.Brightness(region).enhance(1.06)
region = ImageEnhance.Color(region).enhance(0.85)
# sprite crop: face + raised hands + shoulders
x0, y0, x1 = 316, 214, 628
cw = x1 - x0
ch = round(cw * H / W)
crop = sprite.crop((x0, y0, x1, y0 + ch)).resize((W, H), Image.LANCZOS)
out = region.convert("RGBA")
out.alpha_composite(crop)
out.convert("RGB").save(os.path.join(here, "photo.png"))
print(out.size, ch)
