"""Build a font-independent SVG from the site's exact BrandMark paths.

Requires fonttools and a local Arial Bold font; no font file is redistributed.
PNG exports use sharp from the project's existing node_modules.
"""
from pathlib import Path
from hashlib import sha256
from math import cos, sin, pi
import argparse
import re
from xml.sax.saxutils import escape

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--font", default="/System/Library/Fonts/Supplemental/Arial Bold.ttf")
args = parser.parse_args()
font = TTFont(args.font)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
upem = font["head"].unitsPerEm
source = ROOT / "src/components/ui/Logo.tsx"
raw = source.read_text()
mark = raw.split("export function Logo(")[0]
paths = re.findall(r'<path\s+d="([^"]+)"\s+fill="([^"]+)"\s*/>', mark)
assert len(paths) == 3, "Source BrandMark changed; review extraction"
assert 'viewBox="0 0 48 48"' in mark
TOP = "STUDENT VALUE 1.984"
BOTTOM = "KNOW WHAT’S NEXT"
assert ord(BOTTOM[9]) == 0x2019

def arc_text(text, size, radius, top, spacing):
    scale = size / upem
    advances = [font["hmtx"][cmap[ord(c)]][0] * scale for c in text]
    width = sum(advances) + spacing * (len(text) - 1)
    distance = -width / 2
    result = [f'<g aria-label="{escape(text)}" fill="#dcecff">']
    for char, advance in zip(text, advances):
        offset = (distance + advance / 2) / radius
        theta = -pi / 2 + offset if top else pi / 2 - offset
        x, y = 600 + radius * cos(theta), 600 + radius * sin(theta)
        angle = theta * 180 / pi + (90 if top else -90)
        if char != " ":
            pen = SVGPathPen(glyphs)
            glyphs[cmap[ord(char)]].draw(pen)
            result.append(
                f'<path transform="translate({x:.5f} {y:.5f}) rotate({angle:.5f}) '
                f'translate({-advance/2:.5f} 0) scale({scale:.8f} {-scale:.8f})" '
                f'd="{pen.getCommands()}"/>'
            )
        distance += advance + spacing
    result.append("</g>")
    return "\n".join(result)

svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-labelledby="title desc">',
    f'<title id="title">{TOP} · {BOTTOM}</title>',
    '<desc id="desc">Student Value OAuth emblem. Original blue, ice-blue and burgundy brand mark, with outlined lettering on circular arcs.</desc>',
    f'<metadata>Source: src/components/ui/Logo.tsx#BrandMark; SHA-256 {sha256(source.read_bytes()).hexdigest()}. Lettering: Arial Bold, converted to paths. Approval candidate; not a site logo replacement.</metadata>',
    '<circle cx="600" cy="600" r="570" fill="#0b1222"/>',
    arc_text(TOP, 110, 435, True, 2.5),
    arc_text(BOTTOM, 112, 518, False, 3.5),
    '<g fill="#81b5ff"><circle cx="120" cy="600" r="13"/><circle cx="1080" cy="600" r="13"/></g>',
    '<g id="original-brand-mark" transform="translate(240 240) scale(15)">',
    *[f'<path d="{d}" fill="{fill}"/>' for d, fill in paths],
    '</g>',
    '</svg>',
]
target = OUT / "student-value-oauth-emblem.svg"
target.write_text("\n".join(svg) + "\n")
print(f"Created {target}; exact source paths: {len(paths)}; text: {TOP} / {BOTTOM}")
