# Steve Davis normal portrait

Prepared for Chapter 3. The game-sized portrait is at `assets/sprites/characters/steve/chr_steve_normal.png`.

- `assets/sprites/characters/steve/chr_steve_normal.png`: adoption candidate, 896 × 1200 RGBA.
- `normal-source.png`: original unprocessed imagegen output for the chosen revision, 1086 × 1448 RGBA.
- `normal-source-first.png`: first imagegen output used as the character reference for the chosen revision.
- `normal-prompt.txt`: full first generation prompt.
- `normal-refinement-prompt.txt`: full chosen revision prompt. The image inputs were `normal-source-first.png`, `assets/sprites/characters/kuze/chr_kuze_normal.png`, and `assets/sprites/characters/volk/chr_volk_normal.png`, in that order.
- `build-normal.py`: reproducible size conversion and transparent pixel cleanup.

The illustration shows a warm, attentive, stocky adult with a cap and a kitchen timer, matching Steve's low temperature and patience motif. The candidate contains no smoking device, branded product, legible text, or background. Full body, hands and shoes were visually checked. Only alpha values below 8/255 were cleared after resize to remove red pixel noise from the imagegen transparency matte.

Visible alpha bounds: `(211, 10, 692, 1186)` at alpha 8 or more. The generated manifest framing is `h: 0.98`, `b: 0.0117`, `ax: 0.4986`, `aspect: 0.7467`; the portrait was checked in the Chapter 3 VN scene.

## File checksums (SHA-256)

- `normal-source-first.png`: `5874c49ec7f3429aa76f3a46a51492f0c3514867b5bc9223effcba1f940ff754`
- `normal-source.png`: `164e6896b50b71126454ea428d0e7916bd85b6766fc05ec6ffe132a771c9ed9f`
- `chr_steve_normal.png`: `5b34986cc4155228d574cedaeee5ad4e0e685279ef22f7d98eac3557419e02aa`

The Chapter 3 gameplay route registers this portrait in the manifest and displays it during Steve's low-temperature visit and the national match.
