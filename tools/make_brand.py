"""Generate every RideInsight logo asset from one definition.

Run from the project root:   python tools/make_brand.py

Writes SVG masters plus PNG/ICO rasters into static/brand/.
Re-run any time the mark changes — nothing here is hand-edited.

The mark is drawn on a 64x64 grid:
  - rounded square background
  - "R" built from a stem, a top bar, a semicircular bowl and a base bar
  - a diagonal leg in the accent colour, which is the "motion" in the mark
"""
import os
import math
from PIL import Image, ImageDraw

OUT = os.path.join("static", "brand")
os.makedirs(OUT, exist_ok=True)

NAVY  = "#16202e"
RED   = "#e11d48"
WHITE = "#ffffff"

# ── Geometry on the 64-unit grid ───────────────────────────────────────
G          = 64
CORNER     = 15
STROKE     = 5.5
STEM_X     = 23
TOP_Y      = 19
BASE_Y     = 35
BOTTOM_Y   = 46
BOWL_R     = 8
BOWL_CX    = STEM_X + 11.5          # 34.5
BOWL_CY    = (TOP_Y + BASE_Y) / 2   # 27
LEG_FROM   = (32, 35)
LEG_TO     = (44, 46)


# ── SVG ────────────────────────────────────────────────────────────────
def svg(bg, letter, leg, rounded=True):
    rect = (f'<rect width="64" height="64" rx="{CORNER}" fill="{bg}"/>'
            if rounded else "")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="RideInsight">
  <title>RideInsight</title>
  {rect}
  <path d="M{STEM_X} {BOTTOM_Y} V{TOP_Y} h11.5 a{BOWL_R} {BOWL_R} 0 0 1 0 16 H{STEM_X}"
        fill="none" stroke="{letter}" stroke-width="{STROKE}"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M{LEG_FROM[0]} {LEG_FROM[1]} L{LEG_TO[0]} {LEG_TO[1]}"
        stroke="{leg}" stroke-width="{STROKE}" stroke-linecap="round"/>
</svg>
'''


WORDMARK = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" width="300" height="64" role="img" aria-label="RideInsight">
  <title>RideInsight</title>
  <rect width="64" height="64" rx="15" fill="{bg}"/>
  <path d="M23 46 V19 h11.5 a8 8 0 0 1 0 16 H23" fill="none" stroke="{letter}"
        stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 35 L44 46" stroke="{leg}" stroke-width="5.5" stroke-linecap="round"/>
  <text x="78" y="42" font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="30" font-weight="800" letter-spacing="-0.8" fill="{word1}">Ride<tspan fill="{word2}">Insight</tspan></text>
</svg>
'''


# ── Raster ─────────────────────────────────────────────────────────────
def _cap(d, xy, w, fill):
    """Pillow has no round line caps — stamp a circle at each endpoint."""
    x, y = xy
    r = w / 2
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_mark(size, bg, letter, leg, pad=0.0, rounded=True, ss=8):
    """Render the mark at `size` px. `pad` insets the artwork (for maskable
    icons, where Android crops to a circle inscribed in the safe area)."""
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg:
        if rounded:
            d.rounded_rectangle([0, 0, S - 1, S - 1],
                                radius=CORNER / G * S, fill=bg)
        else:
            d.rectangle([0, 0, S - 1, S - 1], fill=bg)

    # Artwork scale/offset, honouring padding
    span = S * (1 - 2 * pad)
    k = span / G
    off = S * pad

    def P(x, y):
        return (off + x * k, off + y * k)

    w = STROKE * k

    # The R is ONE continuous path: stem up, across the top, round the bowl,
    # back along the base. Drawn as a single polyline with curved joins so the
    # corners meet cleanly. (Pillow's arc() strokes inward from its bounding
    # box, which pulls the bowl away from the bars and leaves a gap.)
    pts = [P(STEM_X, BOTTOM_Y), P(STEM_X, TOP_Y), P(BOWL_CX, TOP_Y)]
    STEPS = 48
    for i in range(STEPS + 1):
        t = math.radians(-90 + 180 * i / STEPS)
        pts.append(P(BOWL_CX + BOWL_R * math.cos(t),
                     BOWL_CY + BOWL_R * math.sin(t)))
    pts.append(P(STEM_X, BASE_Y))

    d.line(pts, fill=letter, width=max(1, int(round(w))), joint="curve")
    _cap(d, pts[0],  w, letter)   # bottom of the stem
    _cap(d, pts[-1], w, letter)   # end of the base bar

    # Accent leg
    d.line([P(*LEG_FROM), P(*LEG_TO)], fill=leg,
           width=max(1, int(round(w))), joint="curve")
    _cap(d, P(*LEG_FROM), w, leg)
    _cap(d, P(*LEG_TO), w, leg)

    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    return path, os.path.getsize(path)


written = []

# SVG masters
for name, (bg, letter, leg) in {
    "logo-navy.svg":  (NAVY,  WHITE, RED),
    "logo-red.svg":   (RED,   WHITE, NAVY),
    "logo-white.svg": (WHITE, NAVY,  RED),
}.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg(bg, letter, leg))
    written.append((name, os.path.getsize(os.path.join(OUT, name))))

for name, vals in {
    "wordmark-light.svg": dict(bg=NAVY, letter=WHITE, leg=RED,  word1=NAVY,  word2=RED),
    "wordmark-dark.svg":  dict(bg=RED,  letter=WHITE, leg=NAVY, word1=WHITE, word2=RED),
}.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(WORDMARK.format(**vals))
    written.append((name, os.path.getsize(os.path.join(OUT, name))))

# Favicon — navy, sharper on light browser chrome
for s in (16, 32, 48):
    written.append(save(draw_mark(s, NAVY, WHITE, RED), f"favicon-{s}.png"))
ico = draw_mark(256, NAVY, WHITE, RED)
ico.save(os.path.join(OUT, "favicon.ico"),
         sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
written.append(("favicon.ico", os.path.getsize(os.path.join(OUT, "favicon.ico"))))

# App icons — red, so it's findable on a home screen
for s in (120, 152, 167, 180, 192, 512, 1024):
    written.append(save(draw_mark(s, RED, WHITE, NAVY), f"icon-{s}.png"))

# Maskable: Android crops to a circle, so the mark sits inside a safe area
# and the background bleeds to the full square.
for s in (192, 512):
    written.append(save(draw_mark(s, RED, WHITE, NAVY, pad=0.18, rounded=False),
                        f"icon-maskable-{s}.png"))

print(f"{'FILE':28}{'BYTES':>10}")
print("-" * 38)
for name, size in written:
    print(f"{name:28}{size:>10,}")
print(f"\n{len(written)} files -> {OUT}/")
